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
  intervalSeconds: 60,
  nextRunAt: null,
  lastRunAt: null,
  lastError: null,
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureStoredState();
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  void handleRuntimeRequest(message).then(sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  void runScheduledSend();
});

async function handleRuntimeRequest(message: RuntimeRequest): Promise<RuntimeResponse> {
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
  const validationError = validateSchedulerInput(payload);
  if (validationError) {
    return { ok: false, error: validationError, status: await getStatus() };
  }

  const whatsappTab = await findWhatsAppTab();
  if (!whatsappTab?.id) {
    return {
      ok: false,
      error: 'Open and log into WhatsApp Web in at least one tab first.',
      status: await getStatus(),
    };
  }

  const nextRunAt = Date.now() + payload.intervalSeconds * 1000;
  const nextState: SchedulerState = {
    enabled: true,
    groupChatName: payload.groupChatName.trim(),
    messageText: payload.messageText.trim(),
    intervalSeconds: payload.intervalSeconds,
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
    note:
      payload.intervalSeconds < 30
        ? 'Small intervals can be delayed by browser throttling.'
        : undefined,
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
  if (!currentState.enabled) {
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }

  const sendResult = await dispatchMessage(currentState);
  const nextRunAt = Date.now() + currentState.intervalSeconds * 1000;
  const nextState: SchedulerState = {
    ...currentState,
    nextRunAt,
    lastRunAt: Date.now(),
    lastError: sendResult.ok ? null : sendResult.error,
  };

  await saveState(nextState);
  await chrome.alarms.create(ALARM_NAME, { when: nextRunAt });
}

async function dispatchMessage(state: SchedulerState): Promise<ContentResponse> {
  const whatsappTab = await findWhatsAppTab();
  if (!whatsappTab?.id) {
    return {
      ok: false,
      error: 'WhatsApp Web tab is not open.',
    };
  }

  const request: ContentRequest = {
    type: 'whatsapp:send-message',
    payload: {
      groupChatName: state.groupChatName,
      messageText: state.messageText,
    },
  };

  try {
    const response = (await chrome.tabs.sendMessage(whatsappTab.id, request)) as
      | ContentResponse
      | undefined;

    if (!response) {
      return { ok: false, error: 'No response from WhatsApp tab.' };
    }

    return response;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to contact WhatsApp tab.',
    };
  }
}

async function findWhatsAppTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return tabs.find((tab) => tab.id !== undefined);
}

function validateSchedulerInput(input: SchedulerInput): string | null {
  if (!input.groupChatName.trim()) {
    return 'groupchatname is required.';
  }

  if (!input.messageText.trim()) {
    return 'messagetxt is required.';
  }

  if (!Number.isFinite(input.intervalSeconds) || input.intervalSeconds <= 0) {
    return 'intervallinseconds must be greater than zero.';
  }

  return null;
}

async function ensureStoredState(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) {
    return;
  }

  await saveState(DEFAULT_STATE);
}

async function getStoredState(): Promise<SchedulerState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as Partial<SchedulerState> | undefined;
  if (!raw) {
    return DEFAULT_STATE;
  }

  return {
    enabled: Boolean(raw.enabled),
    groupChatName: typeof raw.groupChatName === 'string' ? raw.groupChatName : '',
    messageText: typeof raw.messageText === 'string' ? raw.messageText : '',
    intervalSeconds:
      typeof raw.intervalSeconds === 'number' && Number.isFinite(raw.intervalSeconds)
        ? raw.intervalSeconds
        : 60,
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
