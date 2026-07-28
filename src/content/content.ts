import type { ContentRequest, ContentResponse, WhatsAppSelectors } from '../shared/types';

chrome.runtime.onMessage.addListener(({ payload, type }: ContentRequest, _sender, sendResponse) => {
  if (type !== 'whatsapp:send-message') return;
  sendMessageToGroup(
    payload.groupChatName,
    payload.messageText,
    payload.extensionConfig.whatsappSelectors,
  ).then(sendResponse);
  return true;
});

async function sendMessageToGroup(
  groupChatName: string,
  messageText: string,
  selectors: WhatsAppSelectors,
  retryAttempts = 2,
): Promise<ContentResponse> {
  void document.body.offsetHeight;
  window.dispatchEvent(new Event('resize'));
  let lastResult: ContentResponse = errorResponse('Unable to send message');

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    lastResult = await sendMessageToGroupOnce(groupChatName, messageText, selectors);
    if (lastResult.ok) return lastResult;

    if (attempt < retryAttempts) {
      await waitUnthrottled(250);
    }
  }

  return lastResult;
}

async function sendMessageToGroupOnce(
  groupChatName: string,
  messageText: string,
  $$$: WhatsAppSelectors,
): Promise<ContentResponse> {
  const headerChatTitleElement = document.querySelector<HTMLElement>($$$.headerChatTitle);
  if (
    headerChatTitleElement?.innerText.trim().toLowerCase() === groupChatName.trim().toLowerCase()
  ) {
    const sendResult = await typeAndSendMessage(messageText, $$$);
    return sendResult;
  }

  const chatsBtn = await waitForElement($$$.chatsButton);
  if (!chatsBtn) return errorResponse('WhatsApp Web is not ready yet.');
  chatsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitReactRenderWithTimeout(250);

  const chatListSearch = await waitForElement($$$.chatListSearchContainer);
  if (!chatListSearch) return errorResponse('WhatsApp Web chat list is not ready yet.');

  const searchBox = await waitForElement<HTMLInputElement>($$$.chatListSearchInput);
  if (!searchBox) return errorResponse('Search box not found');
  const previousSearchValue = searchBox.value;
  try {
    setReactInputValue(searchBox, groupChatName);
    await waitReactRenderWithTimeout(250);

    const results = await waitForElementWithTimeout($$$.searchResultsContainer, 2000);
    if (!results) {
      const noChats = await waitForElementWithTimeout($$$.searchNoChatsContainer, 2000);
      if (noChats) return errorResponse('Group chat not found');
      return errorResponse('Search is not available or took too long to respond');
    }

    const groupTitle = findElementByTextContent(results, $$$.searchResultTitleItem, groupChatName);
    if (!groupTitle) return errorResponse('Group chat not found');
    groupTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await waitReactRenderWithTimeout(250);

    const sendResult = await typeAndSendMessage(messageText, $$$);
    return sendResult;
  } finally {
    const latestSearchBox = document.querySelector<HTMLInputElement>($$$.chatListSearchInput);
    if (latestSearchBox) {
      setReactInputValue(latestSearchBox, previousSearchValue);
      await waitReactRerender();
    }
  }
}

async function typeAndSendMessage(
  messageText: string,
  $$$: WhatsAppSelectors,
): Promise<ContentResponse> {
  const composer = await waitForElement($$$.composerTextbox);
  if (!composer) return errorResponse('Message composer is not available.');
  setReactContentEditableValue(composer, messageText);

  const sendBtn = await waitForElement($$$.sendButton);
  if (!sendBtn) return errorResponse('Send button is not available.');
  sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await waitReactRerender();
  return successResponse();
}

//
//
// utils

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

function waitForElementWithTimeout<TElement extends HTMLElement>(
  selector: string,
  timeoutMs: number,
  root: HTMLElement | Document = document.documentElement,
): Promise<TElement | null> {
  return Promise.race([waitForElement<TElement>(selector, root), waitUnthrottled(timeoutMs, null)]);
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
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set;

  nativeInputValueSetter!.call(input, newValue);

  const inputEvent = new Event('input', { bubbles: true });
  input.dispatchEvent(inputEvent);
}

function setReactContentEditableValue(element: HTMLElement, newText: string) {
  if (element.getAttribute('contenteditable') !== 'true')
    throw new Error('Element is not contenteditable');

  element.focus();
  element.innerText = newText;

  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: newText,
  });

  element.dispatchEvent(inputEvent);
}

function waitReactRerender() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve(undefined);
    channel.port2.postMessage(undefined);
  });
}

function waitUnthrottled<T>(ms: number, result?: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'scheduler:wait', payload: ms }, () => {
      resolve(result as T);
    });
  });
}

async function waitReactRenderWithTimeout<T>(ms: number, result?: T): Promise<T> {
  await waitReactRerender();
  return await waitUnthrottled(ms, result);
}

//
function successResponse(): ContentResponse {
  return { ok: true };
}

function errorResponse(error: string): ContentResponse {
  return { ok: false, error };
}
