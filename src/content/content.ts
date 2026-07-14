import type { ContentRequest, ContentResponse } from "../shared/types";

chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
  if (message.type !== "whatsapp:send-message") {
    return;
  }

  void sendMessageToGroup(message.payload.groupChatName, message.payload.messageText).then(sendResponse);
  return true;
});

async function sendMessageToGroup(
  groupChatName: string,
  messageText: string
): Promise<ContentResponse> {
  const paneSide = await waitForElement(() => document.querySelector("#pane-side"), 7000);
  if (!paneSide) {
    return { ok: false, error: "WhatsApp Web chat list is not ready yet." };
  }

  const opened = await openGroupChat(groupChatName);
  if (!opened) {
    return { ok: false, error: `Group "${groupChatName}" was not found.` };
  }

  const composer = (await waitForElement(
    () => document.querySelector<HTMLElement>("footer div[role='textbox'][contenteditable='true']"),
    5000
  )) as HTMLElement | null;

  if (!composer) {
    return { ok: false, error: "Message composer is not available." };
  }

  setEditableText(composer, messageText);
  const sendButton = document.querySelector<HTMLElement>("footer button span[data-icon='send']")
    ?.parentElement as HTMLButtonElement | null;

  if (sendButton) {
    sendButton.click();
    return { ok: true };
  }

  composer.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );

  return { ok: true };
}

async function openGroupChat(groupChatName: string): Promise<boolean> {
  const existing = findChatListItem(groupChatName);
  if (existing) {
    existing.click();
    await wait(250);
    return true;
  }

  const searchBox = findSearchBox();
  if (!searchBox) {
    return false;
  }

  setEditableText(searchBox, groupChatName);
  await wait(800);
  const foundAfterSearch = findChatListItem(groupChatName);
  if (!foundAfterSearch) {
    return false;
  }

  foundAfterSearch.click();
  await wait(250);
  return true;
}

function findChatListItem(groupChatName: string): HTMLElement | null {
  const target = groupChatName.trim().toLowerCase();
  const titleNodes = Array.from(document.querySelectorAll<HTMLElement>("#pane-side span[title]"));

  for (const node of titleNodes) {
    const nodeTitle = node.getAttribute("title")?.trim().toLowerCase();
    if (nodeTitle === target) {
      const clickable =
        node.closest<HTMLElement>("div[role='listitem']") ??
        node.closest<HTMLElement>("div[role='row']") ??
        node.closest<HTMLElement>("li") ??
        node;
      return clickable;
    }
  }

  return null;
}

function findSearchBox(): HTMLElement | null {
  const selectors = [
    "#side div[role='textbox'][contenteditable='true']",
    "div[aria-label='Search input textbox'][role='textbox'][contenteditable='true']",
    "div[title='Search input textbox'][role='textbox'][contenteditable='true']",
    "div[data-tab='3'][role='textbox'][contenteditable='true']",
  ];

  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && isVisible(element)) {
      return element;
    }
  }

  return null;
}

function setEditableText(element: HTMLElement, value: string): void {
  element.focus();
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, value);

  if (element.textContent?.trim() !== value.trim()) {
    element.textContent = value;
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
}

function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement<TElement extends Element>(
  getElement: () => TElement | null,
  timeoutMs: number
): Promise<TElement | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = getElement();
    if (element) {
      return element;
    }

    await wait(150);
  }

  return null;
}
