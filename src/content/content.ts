import type { ContentRequest, ContentResponse } from "../shared/types";
import {
  findElementByTextContent,
  findFirstVisibleElement,
  setEditableText,
  wait,
  waitForElement,
} from "../shared/dom.utils";

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

  const foundAfterSearch = await waitForElement(
    () => findElementByTextContent(
      "[data-testid='chat-list']",
      "[data-testid^='list-item-']",
      groupChatName
    ),
    5000
  );
  if (!foundAfterSearch) {
    return false;
  }

  foundAfterSearch.click();
  await wait(250);
  return true;
}
