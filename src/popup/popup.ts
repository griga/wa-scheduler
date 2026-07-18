import type { RuntimeRequest, RuntimeResponse, SchedulerStatus } from "../shared/types";
import { queryRequiredElements } from "../shared/dom.utils";

const {
  form,
  groupChatNameInput,
  messageTextInput,
  intervalSecondsInput,
  stopButton,
  statusNode,
} = queryRequiredElements({
  form: "#schedulerForm",
  groupChatNameInput: "#groupChatName",
  messageTextInput: "#messageText",
  intervalSecondsInput: "#intervalSeconds",
  stopButton: "#stopBtn",
  statusNode: "#status",
}) as {
  form: HTMLFormElement;
  groupChatNameInput: HTMLInputElement;
  messageTextInput: HTMLTextAreaElement;
  intervalSecondsInput: HTMLInputElement;
  stopButton: HTMLButtonElement;
  statusNode: HTMLDivElement;
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void startScheduler();
});

stopButton.addEventListener("click", () => {
  void stopScheduler();
});

void refreshStatus();

async function startScheduler(): Promise<void> {
  const intervalValue = Number(intervalSecondsInput.value);
  if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
    statusNode.textContent = "intervallinseconds must be greater than zero.";
    return;
  }

  const response = await sendRuntimeMessage({
    type: "scheduler:start",
    payload: {
      groupChatName: groupChatNameInput.value,
      messageText: messageTextInput.value,
      intervalSeconds: intervalValue,
    },
  });

  renderResponse(response);
}

async function stopScheduler(): Promise<void> {
  const response = await sendRuntimeMessage({ type: "scheduler:stop" });
  renderResponse(response);
}

async function refreshStatus(): Promise<void> {
  const response = await sendRuntimeMessage({ type: "scheduler:get-status" });
  renderResponse(response);
}

async function sendRuntimeMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse | undefined;
    if (!response) {
      return {
        ok: false,
        error: "Background script did not return a response.",
        status: emptyStatus(),
      };
    }

    return response;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to reach background script.",
      status: emptyStatus(),
    };
  }
}

function renderResponse(response: RuntimeResponse): void {
  const { status } = response;
  groupChatNameInput.value = status.groupChatName;
  messageTextInput.value = status.messageText;
  intervalSecondsInput.value = String(status.intervalSeconds);

  const rows = [
    response.ok ? "Scheduler: OK" : `Scheduler error: ${response.error}`,
    status.enabled ? "State: running" : "State: stopped",
    `WhatsApp tab: ${status.whatsappTabOpen ? "open" : "missing"}`,
    `Next run: ${formatTimestamp(status.nextRunAt)}`,
    `Last run: ${formatTimestamp(status.lastRunAt)}`,
  ];

  if (status.lastError) {
    rows.push(`Last send error: ${status.lastError}`);
  }

  if (response.ok && response.note) {
    rows.push(response.note);
  }

  statusNode.textContent = rows.join("\n");
}

function formatTimestamp(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "-";
}

function emptyStatus(): SchedulerStatus {
  return {
    enabled: false,
    groupChatName: "m22",
    messageText: Math.random().toString(36).substring(2, 8),
    intervalSeconds: 60,
    nextRunAt: null,
    lastRunAt: null,
    lastError: null,
    whatsappTabOpen: false,
  };
}