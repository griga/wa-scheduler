export interface WhatsAppSelectors {
  headerChatTitle: string;
  chatsButton: string;
  chatListSearchContainer: string;
  chatListSearchInput: string;
  searchResultsContainer: string;
  searchNoChatsContainer: string;
  searchResultTitleItem: string;
  composerTextbox: string;
  sendButton: string;
}

export interface ExtensionConfig {
  whatsappSelectors: WhatsAppSelectors;
}

export interface SchedulerInput {
  groupChatName: string;
  messageText: string;
  scheduleTimes: string[];
  extensionConfig: ExtensionConfig;
}

export interface SchedulerState extends SchedulerInput {
  enabled: boolean;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastError: string | null;
}

export interface SchedulerStatus extends SchedulerState {
  whatsappTabOpen: boolean;
}

export type RuntimeRequest =
  | { type: 'scheduler:wait'; payload: number }
  | { type: 'scheduler:get-status' }
  | { type: 'scheduler:start'; payload: SchedulerInput }
  | { type: 'scheduler:stop' };

export type RuntimeResponse =
  | { ok: true; status: SchedulerStatus; note?: string }
  | { ok: false; error: string; status: SchedulerStatus };

export type ContentRequest = {
  type: 'whatsapp:send-message';
  payload: Pick<SchedulerInput, 'groupChatName' | 'messageText' | 'extensionConfig'>;
  note?: string;
};

export type ContentResponse = { ok: true } | { ok: false; error: string };
