import type { ContentRequest, ContentResponse } from '../shared/types';

chrome.runtime.onMessage.addListener(
  async ({ payload, type }: ContentRequest, _sender, sendResponse) => {
    if (type !== 'whatsapp:send-message') return;
    const result = await sendMessageToGroup(payload.groupChatName, payload.messageText);
    console.log('sendMessageToGroup result:', result);
    return sendResponse(result);
  },
);

async function sendMessageToGroup(
  groupChatName: string,
  messageText: string,
): Promise<ContentResponse> {
  const chatsBtn = await waitForElement("[aria-label='Chats']");
  if (!chatsBtn) return errorResponse('WhatsApp Web is not ready yet.');
  chatsBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await waitReactRerender();
  await wait(100);

  const chatListSearch = await waitForElement("[data-testid='chat-list-search-container']");
  if (!chatListSearch) return errorResponse('WhatsApp Web chat list is not ready yet.');

  const searchBox = await waitForElement<HTMLInputElement>(
    "[data-testid='chat-list-search-container'] [role='textbox']",
  );
  if (!searchBox) return errorResponse('Search box not found');
  setReactInputValue(searchBox, groupChatName);

  await waitReactRerender();
  await wait(100);

  const results = await Promise.race([
    waitForElement("[aria-label^='Search results'][aria-rowcount='1']"),
    waitForElement("[data-testid='search-no-chats-or-contacts-container']"),
  ]);
  if (results.dataset.testid === 'search-no-chats-or-contacts-container')
    return errorResponse('Group chat not found');

  const groupTitle = findElementByTextContent<HTMLElement>(
    results,
    "[data-testid='cell-frame-title']",
    groupChatName,
  );
  if (!groupTitle) return errorResponse('Group chat not found');
  groupTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

  await waitReactRerender();
  await wait(100);

  const composer = await waitForElement('[data-testid=compose-box] [role=textbox]');
  if (!composer) return errorResponse('Message composer is not available.');
  setReactContentEditableValue(composer, messageText);

  const sendBtn = await waitForElement("footer button[aria-label='Send']");
  if (!sendBtn) return errorResponse('Send button is not available.');
  sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  return successResponse();
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

function waitForElement<TElement extends HTMLElement>(
  selector: string,
  root: HTMLElement | Document = document.documentElement,
): Promise<TElement> {
  const element = root.querySelector<TElement>(selector);
  if (element) return Promise.resolve(element);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<TElement>(selector);
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });

    observer.observe(root, { childList: true, subtree: true, attributes: true });
  });
}

function findElementByTextContent<TElement extends HTMLElement>(
  container: HTMLElement,
  itemSelector: string,
  targetText: string,
): TElement | null {
  const target = targetText.trim().toLowerCase();

  const items = Array.from(container.querySelectorAll<TElement>(itemSelector));

  for (const item of items) {
    const text = item.innerText?.trim().toLowerCase();
    if (text?.includes(target)) {
      return item;
    }
  }

  return null;
}

function setReactInputValue(input: HTMLInputElement, newValue: string) {
  // 1. Get the native input value setter bypassing React's overridden setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set;

  // 2. Call the native setter on our target input element
  nativeInputValueSetter!.call(input, newValue);

  // 3. Dispatch a bubbling input event so React's event delegation detects it
  const inputEvent = new Event('input', { bubbles: true });
  input.dispatchEvent(inputEvent);
}

function setReactContentEditableValue(element: HTMLElement, newText: string) {
  if (element.getAttribute('contenteditable') !== 'true')
    throw new Error('Element is not contenteditable');

  // 1. Focus the element so the browser registers it as active
  element.focus();

  // 2. Change the actual visual/DOM text content
  element.innerText = newText;

  // 3. Create and dispatch a native InputEvent mimicking human typing
  const inputEvent = new InputEvent('input', {
    bubbles: true, // MANDATORY: React relies on event delegation
    cancelable: true,
    inputType: 'insertText', // Mimics standard keyboard text insertion
    data: newText, // The string data that was "typed"
  });

  element.dispatchEvent(inputEvent);
}

function waitReactRerender() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(undefined);
      channel.port2.postMessage(undefined);
    });
  });
}

//
function successResponse(): ContentResponse {
  return { ok: true };
}

function errorResponse(error: string): ContentResponse {
  return { ok: false, error };
}
