import type { ContentRequest, ContentResponse } from "../shared/types";

type ResultState = "success" | "error" | "pending";
type Result = { state: ResultState; message?: string };

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
  debugger
  const chatsButton = await waitForElement("[aria-label='Chats']");
  if (!chatsButton)
    return { ok: false, error: "WhatsApp Web is not ready yet." };
  chatsButton.click();
  await waitReactRerender();
  await wait(100)

  const searchContainer = await waitForElement("[data-testid='chat-list-search-container']");
  if (!searchContainer)
    return { ok: false, error: "WhatsApp Web chat list is not ready yet." };


  const opened = await openGroupChat(groupChatName);
  if (opened.state === "error")
    return { ok: false, error: `Failed to open group chat: ${opened.message}` };


  const composer = await waitForElement("[data-testid=compose-box] [role=textbox]");

  if (!composer) {
    return { ok: false, error: "Message composer is not available." };
  }

  setReactContentEditableValue(composer, messageText);

  const sendButton = document.querySelector<HTMLElement>("footer button[aria-label='Send']");

  if (!sendButton) {
    return { ok: false, error: "Send button is not available." };
  }

  sendButton.dispatchEvent(new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    view: window
  }));
  return { ok: true };
}

async function openGroupChat(groupChatName: string): Promise<Result> {
  const searchBox = await waitForElement(
    "[data-testid='chat-list-search-container'] [role='textbox']"
  );
  if (!searchBox) return { state: "error", message: "Search box not found" };


  setReactInputValue(searchBox as HTMLInputElement, groupChatName);

  await waitReactRerender();
  await wait(100)

  const container = await Promise.race([
    waitForElement("[aria-label^='Search results'][aria-rowcount='1']"),
    waitForElement("[data-testid='search-no-chats-or-contacts-container']"),
  ])

  if (!container || container.getAttribute("data-testid") === "search-no-chats-or-contacts-container")
    return { state: "error", message: "Group chat not found" };



  const groupTitleEl = findElementByTextContent<HTMLElement>(
    container,
    "[data-testid='cell-frame-title']",
    groupChatName
  )

  if (!groupTitleEl) { return { state: "error", message: "Group chat not found" }; }
  groupTitleEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

  await waitReactRerender();
  await wait(100);

  const compose = await waitForElement("[data-testid='compose-box'] [role=textbox]");
  return { state: "success" };
}


//
//
//
//
//
// utils
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement<TElement extends HTMLElement>(
  selector: string,
  root: HTMLElement | Document = document.documentElement
): Promise<TElement | null> {
  const element = root.querySelector<TElement>(selector);
  if (element) return element;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<TElement>(selector);
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

function findElementByTextContent<TElement extends HTMLElement>(
  container: HTMLElement,
  itemSelector: string,
  targetText: string
): TElement | null {
  const target = targetText.trim().toLowerCase();
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


function setReactInputValue(input: HTMLInputElement, newValue: string) {
  if (!input) return;

  // 1. Get the native input value setter bypassing React's overridden setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set;

  // 2. Call the native setter on our target input element
  nativeInputValueSetter!.call(input, newValue);

  // 3. Dispatch a bubbling input event so React's event delegation detects it
  const inputEvent = new Event('input', { bubbles: true });
  input.dispatchEvent(inputEvent);
}

function setReactContentEditableValue(element: HTMLElement, newText: string) {
  if (element.getAttribute('contenteditable') !== 'true') throw new Error('Element is not contenteditable');

  // 1. Focus the element so the browser registers it as active
  element.focus();

  // 2. Change the actual visual/DOM text content
  element.innerText = newText;

  // 3. Create and dispatch a native InputEvent mimicking human typing
  const inputEvent = new InputEvent('input', {
    bubbles: true,        // MANDATORY: React relies on event delegation
    cancelable: true,
    inputType: 'insertText', // Mimics standard keyboard text insertion
    data: newText         // The string data that was "typed"
  });

  element.dispatchEvent(inputEvent);
}


function waitReactRerender() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(undefined);
      channel.port2.postMessage(undefined);
    });
  });
}