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
  const chatsButton = await waitForElement(
    () => document.querySelector<HTMLElement>("[aria-label='Chats']"),
    7000
  );
  if (!chatsButton)
    return { ok: false, error: "WhatsApp Web is not ready yet." };
  chatsButton.click();

  const searchContainer = await waitForElement(
    () => document.querySelector("[data-testid='chat-list-search-container']"),
    7000
  );
  if (!searchContainer)
    return { ok: false, error: "WhatsApp Web chat list is not ready yet." };


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
  const sendButton = document.querySelector<HTMLElement>("footer button[aria-label='Send']");

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

  const searchBox = findSearchBox();
  console.log("searchBox", searchBox);
  if (!searchBox) {
    return false;
  }

  // Open/focus chats search before typing the target term.
  searchBox.click();
  await wait(100);

  setEditableText(searchBox, groupChatName);
  await wait(800);

  const foundAfterSearch = await waitForElement(
    () => findChatListItem(groupChatName),
    5000
  );
  console.log("foundAfterSearch", foundAfterSearch);
  if (!foundAfterSearch) {
    return false;
  }

  foundAfterSearch.click();
  await wait(250);
  return true;
}

function findChatListItem(groupChatName: string): HTMLElement | null {
  const target = groupChatName.trim().toLowerCase();
  const chatList = document.querySelector<HTMLElement>("[data-testid='chat-list']");
  console.log("chatList", chatList);
  if (!chatList) {
    return null;
  }

  const listItems = Array.from(
    chatList.querySelectorAll<HTMLElement>("[data-testid^='list-item-']")
  );

  for (const item of listItems) {
    const text = item.innerText?.trim().toLowerCase();
    if (text && text.includes(target)) {
      return item;
    }
  }

  return null;
}

function findSearchBox(): HTMLElement | null {
  const container = document.querySelector<HTMLElement>(
    "[data-testid='chat-list-search-container']"
  );
  if (!container)
    return null;


  const textbox =
    container.querySelector<HTMLElement>("[role='textbox']") ??
    container.querySelector<HTMLElement>("[contenteditable='true']");

  if (textbox && isVisible(textbox))
    return textbox;


  return null;
}

function setEditableText(element: HTMLElement, value: string): void {
  element.focus();
  // document.execCommand("selectAll", false);
  // document.execCommand("insertText", false, value);

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
  const element = getElement();
  if (element) {
    return element;
  }

  const root = document.documentElement;
  if (!root) {
    return null;
  }

  return new Promise((resolve) => {
    let isSettled = false;
    let timeoutId = 0;

    const observer = new MutationObserver(() => {
      const nextElement = getElement();
      if (!nextElement) {
        return;
      }

      settle(nextElement);
    });

    const settle = (value: TElement | null) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    timeoutId = window.setTimeout(() => settle(null), timeoutMs);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });
}
