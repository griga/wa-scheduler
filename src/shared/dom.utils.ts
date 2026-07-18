export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForElement<TElement extends Element>(
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

export function setEditableText(element: HTMLElement, value: string): void {
  element.focus();

  if (element.textContent?.trim() !== value.trim()) {
    element.textContent = value;
  }

  element.dispatchEvent(
    new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" })
  );
}

export function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null;
}

export function findElementByTextContent<TElement extends HTMLElement>(
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

export function findFirstVisibleElement<TElement extends HTMLElement>(
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

export function queryRequiredElements<T extends Record<string, string>>(
  selectors: T
): { [K in keyof T]: HTMLElement } {
  const result = {} as { [K in keyof T]: HTMLElement };
  for (const [key, selector] of Object.entries(selectors)) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`Required element missing: ${selector}`);
    }
    result[key as keyof T] = element;
  }
  return result;
}