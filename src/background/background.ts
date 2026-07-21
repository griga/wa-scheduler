import type {
  ContentRequest,
  ContentResponse,
  RuntimeRequest,
  RuntimeResponse,
  SchedulerInput,
  SchedulerState,
  SchedulerStatus,
} from '../shared/types';

const STORAGE_KEY = 'schedulerState';
const ALARM_NAME = 'wa-scheduler-send';

const DEFAULT_STATE: SchedulerState = {
  enabled: false,
  groupChatName: '',
  messageText: '',
  scheduleTimes: [],
  nextRunAt: null,
  lastRunAt: null,
  lastError: null,
};

chrome.runtime.onInstalled.addListener(() => ensureStoredState());

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  handleRuntimeRequest(message).then(sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  runScheduledSend();
});

async function handleRuntimeRequest(message: RuntimeRequest): Promise<RuntimeResponse> {
  console.log('Received runtime request:', message);

  switch (message.type) {
    case 'scheduler:get-status':
      return {
        ok: true,
        status: await getStatus(),
      };

    case 'scheduler:start':
      return startScheduler(message.payload);

    case 'scheduler:stop':
      return stopScheduler();

    default:
      return {
        ok: false,
        error: 'Unsupported request.',
        status: await getStatus(),
      };
  }
}

async function startScheduler(payload: SchedulerInput): Promise<RuntimeResponse> {
  try {
    validateSchedulerInput(payload);
  } catch (e) {
    return { ok: false, error: (<Error>e).message, status: await getStatus() };
  }

  const scheduleTimes = normalizeAndSortScheduleTimes(payload.scheduleTimes);
  const nextRunAt = getNextRunTimestamp(scheduleTimes, Date.now());
  const nextState: SchedulerState = {
    enabled: true,
    groupChatName: payload.groupChatName.trim(),
    messageText: payload.messageText.trim(),
    scheduleTimes,
    nextRunAt,
    lastRunAt: null,
    lastError: null,
  };

  await saveState(nextState);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { when: nextRunAt });

  return {
    ok: true,
    status: await getStatus(),
  };
}

async function stopScheduler(): Promise<RuntimeResponse> {
  const currentState = await getStoredState();
  const nextState: SchedulerState = {
    ...currentState,
    enabled: false,
    nextRunAt: null,
  };

  await saveState(nextState);
  await chrome.alarms.clear(ALARM_NAME);

  return { ok: true, status: await getStatus() };
}

async function runScheduledSend(): Promise<void> {
  const currentState = await getStoredState();
  if (!currentState.enabled || currentState.scheduleTimes.length === 0) {
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }

  const sendResult = await dispatchMessage(currentState);
  console.log('Scheduled send result:', sendResult);
  const now = Date.now();
  const nextRunAt = getNextRunTimestamp(currentState.scheduleTimes, now);
  const nextState: SchedulerState = {
    ...currentState,
    nextRunAt,
    lastRunAt: now,
    lastError: sendResult.ok ? null : sendResult.error,
  };

  await saveState(nextState);
  await chrome.alarms.create(ALARM_NAME, { when: nextRunAt });
}

async function dispatchMessage(state: SchedulerState): Promise<ContentResponse> {
  const whatsappTab = await findWhatsAppTab();
  if (!whatsappTab?.id) return errorResponse('WhatsApp Web tab is not open. Skipped this alarm.');

  const request: ContentRequest = {
    type: 'whatsapp:send-message',
    payload: {
      groupChatName: state.groupChatName,
      messageText: state.messageText,
    },
  };

  try {
    const response = await chrome.tabs.sendMessage(whatsappTab.id, request);
    if (!response) return errorResponse('No response from WhatsApp tab.');
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to contact WhatsApp tab.';
    return errorResponse(msg);
  }
}

async function findWhatsAppTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  const found = tabs.find((tab) => tab.id !== undefined);
  console.log('Found WhatsApp tabs:', found);
  return found;
}

function validateSchedulerInput(input: SchedulerInput): void {
  invariant(input.groupChatName.trim(), 'groupchatname is required.');
  invariant(input.messageText.trim(), 'messagetxt is required.');
  invariant(Array.isArray(input.scheduleTimes) && input.scheduleTimes.length > 0, 'scheduletimes is required.');
  for (const scheduleTime of input.scheduleTimes) {
    invariant(isValidTimeToken(scheduleTime), `Invalid schedule time: ${scheduleTime}`);
  }
}

async function ensureStoredState(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) return;

  await saveState(DEFAULT_STATE);
}

async function getStoredState(): Promise<SchedulerState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as Partial<SchedulerState> | undefined;
  if (!raw) {
    return DEFAULT_STATE;
  }

  const rawScheduleTimes = Array.isArray(raw.scheduleTimes)
    ? raw.scheduleTimes.filter((value): value is string => typeof value === 'string')
    : [];
  const scheduleTimes = normalizeAndSortScheduleTimes(rawScheduleTimes);

  return {
    enabled: Boolean(raw.enabled),
    groupChatName: typeof raw.groupChatName === 'string' ? raw.groupChatName : '',
    messageText: typeof raw.messageText === 'string' ? raw.messageText : '',
    scheduleTimes,
    nextRunAt: typeof raw.nextRunAt === 'number' ? raw.nextRunAt : null,
    lastRunAt: typeof raw.lastRunAt === 'number' ? raw.lastRunAt : null,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
  };
}

async function saveState(state: SchedulerState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function getStatus(): Promise<SchedulerStatus> {
  const [state, whatsappTab] = await Promise.all([getStoredState(), findWhatsAppTab()]);
  return {
    ...state,
    whatsappTabOpen: Boolean(whatsappTab?.id),
  };
}

//
//
//
//
// utils

function errorResponse(error: string): ContentResponse {
  return { ok: false, error };
}

function invariant(value: boolean | string, message: string): void {
  if (!value) throw new Error(message);
}

function normalizeAndSortScheduleTimes(scheduleTimes: string[]): string[] {
  const unique = new Set<string>();

  for (const token of scheduleTimes) {
    if (!isValidTimeToken(token)) continue;
    const [hoursText, minutesText] = token.split(':');
    const normalized = `${hoursText.padStart(2, '0')}:${minutesText}`;
    unique.add(normalized);
  }

  return Array.from(unique).sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
}

function isValidTimeToken(time: string): boolean {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

function timeToMinutes(time: string): number {
  const [hoursText, minutesText] = time.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
}

function getNextRunTimestamp(scheduleTimes: string[], nowMs: number): number {
  if (scheduleTimes.length === 0) {
    return nowMs;
  }

  const now = new Date(nowMs);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentMilliseconds = now.getMilliseconds();

  for (const scheduleTime of scheduleTimes) {
    const totalMinutes = timeToMinutes(scheduleTime);
    if (
      totalMinutes > currentMinutes ||
      (totalMinutes === currentMinutes && currentSeconds === 0 && currentMilliseconds === 0)
    ) {
      const next = new Date(nowMs);
      next.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
      if (next.getTime() >= nowMs) {
        return next.getTime();
      }
    }
  }

  const first = scheduleTimes[0];
  const firstMinutes = timeToMinutes(first);
  const nextDay = new Date(nowMs);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(Math.floor(firstMinutes / 60), firstMinutes % 60, 0, 0);
  return nextDay.getTime();
}
