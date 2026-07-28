// 1. Force visibility getters to always return visible
Object.defineProperty(document, 'visibilityState', {
  get: () => 'visible',
  configurable: true
});

Object.defineProperty(document, 'hidden', {
  get: () => false,
  configurable: true
});

// 2. Intercept and block visibility change events from reaching WhatsApp's listeners
window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

// 3. Optional: Fake focus state
Object.defineProperty(document, 'hasFocus', {
  value: () => true,
  writable: false
});