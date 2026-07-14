export interface SchedulerInput {
  groupChatName: string;
  messageText: string;
  intervalSeconds: number;
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
  | { type: "scheduler:get-status" }
  | { type: "scheduler:start"; payload: SchedulerInput }
  | { type: "scheduler:stop" };

export type RuntimeResponse =
  | { ok: true; status: SchedulerStatus; note?: string }
  | { ok: false; error: string; status: SchedulerStatus };

export type ContentRequest = {
  type: "whatsapp:send-message";
  payload: Pick<SchedulerInput, "groupChatName" | "messageText">;
};

export type ContentResponse = { ok: true } | { ok: false; error: string };
