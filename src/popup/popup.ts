import type {
  ExtensionConfig,
  RuntimeRequest,
  RuntimeResponse,
  SchedulerStatus,
  WhatsAppSelectors,
} from '../shared/types';

const {
  form,
  groupChatNameInput,
  messageTextInput,
  scheduleTimesInput,
  stopButton,
  statusNode,
  chatsButtonSelectorInput,
  chatListSearchContainerSelectorInput,
  chatListSearchInputSelectorInput,
  searchResultsContainerSelectorInput,
  searchNoChatsContainerSelectorInput,
  searchResultTitleItemSelectorInput,
  composerTextboxSelectorInput,
  sendButtonSelectorInput,
} = queryRequiredElements({
  form: '#schedulerForm',
  groupChatNameInput: '#groupChatName',
  messageTextInput: '#messageText',
  scheduleTimesInput: '#scheduleTimes',
  stopButton: '#stopBtn',
  statusNode: '#status',
  chatsButtonSelectorInput: '#selectorChatsButton',
  chatListSearchContainerSelectorInput: '#selectorChatListSearchContainer',
  chatListSearchInputSelectorInput: '#selectorChatListSearchInput',
  searchResultsContainerSelectorInput: '#selectorSearchResultsContainer',
  searchNoChatsContainerSelectorInput: '#selectorSearchNoChatsContainer',
  searchResultTitleItemSelectorInput: '#selectorSearchResultTitleItem',
  composerTextboxSelectorInput: '#selectorComposerTextbox',
  sendButtonSelectorInput: '#selectorSendButton',
}) as {
  form: HTMLFormElement;
  groupChatNameInput: HTMLInputElement;
  messageTextInput: HTMLTextAreaElement;
  scheduleTimesInput: HTMLInputElement;
  stopButton: HTMLButtonElement;
  statusNode: HTMLDivElement;
  chatsButtonSelectorInput: HTMLInputElement;
  chatListSearchContainerSelectorInput: HTMLInputElement;
  chatListSearchInputSelectorInput: HTMLInputElement;
  searchResultsContainerSelectorInput: HTMLInputElement;
  searchNoChatsContainerSelectorInput: HTMLInputElement;
  searchResultTitleItemSelectorInput: HTMLInputElement;
  composerTextboxSelectorInput: HTMLInputElement;
  sendButtonSelectorInput: HTMLInputElement;
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void startScheduler();
});

stopButton.addEventListener('click', () => {
  void stopScheduler();
});

void refreshStatus();

async function startScheduler(): Promise<void> {
  const parsedTimes = parseScheduleTimes(scheduleTimesInput.value);
  if (!parsedTimes.ok) {
    statusNode.textContent = parsedTimes.error;
    return;
  }

  const response = await sendRuntimeMessage({
    type: 'scheduler:start',
    payload: {
      groupChatName: groupChatNameInput.value,
      messageText: messageTextInput.value,
      scheduleTimes: parsedTimes.times,
      extensionConfig: getExtensionConfigFromForm(),
    },
  });

  renderResponse(response);
}

async function stopScheduler(): Promise<void> {
  const response = await sendRuntimeMessage({ type: 'scheduler:stop' });
  renderResponse(response);
}

async function refreshStatus(): Promise<void> {
  const response = await sendRuntimeMessage({ type: 'scheduler:get-status' });
  renderResponse(response);
}

async function sendRuntimeMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse | undefined;
    if (!response) {
      return {
        ok: false,
        error: 'Background script did not return a response.',
        status: emptyStatus(),
      };
    }

    return response;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to reach background script.',
      status: emptyStatus(),
    };
  }
}

function renderResponse(response: RuntimeResponse): void {
  const { status } = response;
  groupChatNameInput.value = status.groupChatName;
  messageTextInput.value = status.messageText;
  scheduleTimesInput.value = status.scheduleTimes.join(' ');
  applySelectorsToForm(status.extensionConfig.whatsappSelectors);

  const rows = [
    response.ok ? 'Scheduler: OK' : `Scheduler error: ${response.error}`,
    status.enabled ? 'State: running' : 'State: stopped',
    `WhatsApp tab: ${status.whatsappTabOpen ? 'open' : 'missing'}`,
    `Schedule: ${status.scheduleTimes.join(' ') || '-'}`,
    `Next run: ${formatTimestamp(status.nextRunAt)}`,
    `Last run: ${formatTimestamp(status.lastRunAt)}`,
  ];

  if (status.lastError) {
    rows.push(`Last send error: ${status.lastError}`);
  }

  if (response.ok && response.note) {
    rows.push(response.note);
  }

  statusNode.textContent = rows.join('\n');
}

function formatTimestamp(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '-';
}

function emptyStatus(): SchedulerStatus {
  return {
    enabled: false,
    groupChatName: 'm22',
    messageText: Math.random().toString(36).substring(2, 8),
    scheduleTimes: [],
    extensionConfig: {
      whatsappSelectors: {
        chatsButton: "[aria-label='Chats']",
        chatListSearchContainer: "[data-testid='chat-list-search-container']",
        chatListSearchInput: "[data-testid='chat-list-search-container'] [role='textbox']",
        searchResultsContainer: "[aria-label^='Search results'][aria-rowcount='1']",
        searchNoChatsContainer: "[data-testid='search-no-chats-or-contacts-container']",
        searchResultTitleItem: "[data-testid='cell-frame-title']",
        composerTextbox: '[data-testid=compose-box] [role=textbox]',
        sendButton: "footer button[aria-label='Send']",
      },
    },
    nextRunAt: null,
    lastRunAt: null,
    lastError: null,
    whatsappTabOpen: false,
  };
}

function getExtensionConfigFromForm(): ExtensionConfig {
  const selectors: WhatsAppSelectors = {
    chatsButton: chatsButtonSelectorInput.value,
    chatListSearchContainer: chatListSearchContainerSelectorInput.value,
    chatListSearchInput: chatListSearchInputSelectorInput.value,
    searchResultsContainer: searchResultsContainerSelectorInput.value,
    searchNoChatsContainer: searchNoChatsContainerSelectorInput.value,
    searchResultTitleItem: searchResultTitleItemSelectorInput.value,
    composerTextbox: composerTextboxSelectorInput.value,
    sendButton: sendButtonSelectorInput.value,
  };

  return { whatsappSelectors: selectors };
}

function applySelectorsToForm(selectors: WhatsAppSelectors): void {
  chatsButtonSelectorInput.value = selectors.chatsButton;
  chatListSearchContainerSelectorInput.value = selectors.chatListSearchContainer;
  chatListSearchInputSelectorInput.value = selectors.chatListSearchInput;
  searchResultsContainerSelectorInput.value = selectors.searchResultsContainer;
  searchNoChatsContainerSelectorInput.value = selectors.searchNoChatsContainer;
  searchResultTitleItemSelectorInput.value = selectors.searchResultTitleItem;
  composerTextboxSelectorInput.value = selectors.composerTextbox;
  sendButtonSelectorInput.value = selectors.sendButton;
}

function parseScheduleTimes(
  rawInput: string,
): { ok: true; times: string[] } | { ok: false; error: string } {
  const tokens = rawInput
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: 'scheduletimes is required.' };
  }

  const unique = new Set<string>();

  for (const token of tokens) {
    const normalized = normalizeTimeToken(token);
    if (!normalized.ok) {
      return { ok: false, error: normalized.error };
    }

    unique.add(normalized.time);
  }

  const times = Array.from(unique).sort(compareTimes);
  return { ok: true, times };
}

function normalizeTimeToken(
  token: string,
): { ok: true; time: string } | { ok: false; error: string } {
  const match = token.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return {
      ok: false,
      error: `Invalid time "${token}". Use H:MM or HH:MM (for example 0:19 or 00:19).`,
    };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    return { ok: false, error: `Invalid hour in "${token}". Hour must be 0-23.` };
  }

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return { ok: false, error: `Invalid minutes in "${token}". Minutes must be 00-59.` };
  }

  return {
    ok: true,
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

function compareTimes(a: string, b: string): number {
  return timeToMinutes(a) - timeToMinutes(b);
}

function timeToMinutes(time: string): number {
  const [hoursText, minutesText] = time.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
}

function queryRequiredElements<T extends Record<string, string>>(
  selectors: T,
): { [K in keyof T]: Element } {
  const entries = Object.entries(selectors).map(([key, selector]) => {
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Required element not found for selector: ${selector}`);
    }

    return [key, element] as const;
  });

  return Object.fromEntries(entries) as { [K in keyof T]: Element };
}
