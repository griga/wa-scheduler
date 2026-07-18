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
  const chatsButton = await waitForElement<HTMLElement>("[aria-label='Chats']");
  if (!chatsButton)
    return { ok: false, error: "WhatsApp Web is not ready yet." };
  chatsButton.click();

  const searchContainer = await waitForElement("[data-testid='chat-list-search-container']");
  if (!searchContainer)
    return { ok: false, error: "WhatsApp Web chat list is not ready yet." };


  const opened = await openGroupChat(groupChatName);
  if (!opened) {
    return { ok: false, error: `Group "${groupChatName}" was not found.` };
  }

  const composer = await waitForElement<HTMLElement>("footer div[role='textbox'][contenteditable='true']");

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
  const searchBox = findFirstVisibleElement(
    "[data-testid='chat-list-search-container']",
    ["[role='textbox']", "[contenteditable='true']"]
  );
  if (!searchBox) {
    return false;
  }

  // Open/focus chats search before typing the target term.
  searchBox.click();
  await wait(100);

  setEditableText(searchBox, groupChatName);
  await wait(800);

  let foundAfterSearch: HTMLElement | null = null;
  for (let i = 0; i < 20; i++) {
    foundAfterSearch = findElementByTextContent<HTMLElement>(
      "[data-testid='chat-list']",
      "[data-testid^='list-item-']",
      groupChatName
    );
    if (foundAfterSearch) break;
    await wait(250);
  }

  if (!foundAfterSearch) {
    return false;
  }

  foundAfterSearch.click();
  await wait(250);
  return true;
}



//
//
//
//
//
//
// utils
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement<TElement extends Element>(
  selector: string
): Promise<TElement | null> {
  const element = document.querySelector<TElement>(selector);
  if (element) return element;

  const root = document.documentElement;
  if (!root) return null;

  return new Promise((resolve) => {
    let isSettled = false;

    const observer = new MutationObserver(() => {
      const nextElement = document.querySelector<TElement>(selector);
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
      resolve(value);
    };

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });
}

function setEditableText(element: HTMLElement, value: string): void {
  element.focus();

  if (element.textContent?.trim() !== value.trim()) {
    element.textContent = value;
  }

  element.dispatchEvent(
    new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" })
  );
}

function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null;
}

function findElementByTextContent<TElement extends HTMLElement>(
  containerSelector: string,
  itemSelector: string,
  targetText: string
): TElement | null {
  const target = targetText.trim().toLowerCase();
  const container = document.querySelector<HTMLElement>(containerSelector);
  if (!container) {
    return null;
  }

  const items = Array.from(container.querySelectorAll<TElement>(itemSelector));

  for (const item of items) {
    const text = item.innerText?.trim().toLowerCase();
    if (text && text.includes(target)) {
      return item;
    }
  }

  return null;
}

function findFirstVisibleElement<TElement extends HTMLElement>(
  containerSelector: string,
  selectors: string[]
): TElement | null {
  const container = document.querySelector<HTMLElement>(containerSelector);
  if (!container) {
    return null;
  }

  for (const selector of selectors) {
    const element = container.querySelector<TElement>(selector);
    if (element && isVisible(element)) {
      return element;
    }
  }

  return null;
}
