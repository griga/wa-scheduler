# Copilot Instructions — Chrome Extension (pnpm + TypeScript + Vite)

## Project context
This repository contains a Chrome Extension developed with:
- **Package manager:** pnpm
- **Language:** TypeScript
- **Bundler/dev server:** Vite
- **Target platform:** Chrome Extensions (Manifest V3)

Assume all code changes should preserve Chrome extension compatibility and MV3 constraints.

---

## Goals for Copilot
When generating or editing code, prioritize:
1. Correct **Manifest V3** architecture.
2. Strong **TypeScript typings** and minimal `any`.
3. Small, maintainable modules with clear file boundaries.
4. Secure defaults (least privilege permissions, safe message passing).
5. Fast local development and reliable production builds via Vite.

---

## Tech and conventions

### Package manager
- Use `pnpm` commands, never npm/yarn equivalents.
- Prefer scripts in `package.json` over ad hoc commands.
- When adding dependencies, choose the smallest suitable package.

### TypeScript
- Keep strict typing on (`strict: true` expected).
- Export explicit types for shared messages, storage schema, and settings.
- Avoid `as unknown as ...` and unsafe casts.
- Prefer discriminated unions for runtime message contracts.

### Vite
- Keep Vite config simple and explicit.
- Ensure separate entry points build correctly for extension parts:
  - background service worker
  - content scripts
  - popup/options pages
- Treat extension output as static assets suitable for `chrome://extensions` loading.

---

## Chrome Extension architecture (MV3)

### Required components
- **manifest.json** (MV3)
- **background** service worker (event-driven, no long-running assumptions)
- **content scripts** for page interaction
- **UI pages** (popup/options) as needed

### Service worker rules
- Do not rely on global in-memory state persisting forever.
- Rehydrate state from `chrome.storage` when needed.
- Use alarms, storage, and message passing for coordination.
- Keep handlers idempotent and resilient to restarts.

### Content scripts
- Minimize DOM churn and avoid page breakage.
- Use isolated, namespaced CSS/classes for injected UI.
- Never assume specific page structure without guards.
- Fail gracefully when target elements are missing.

### Messaging
- Define typed request/response contracts in shared files.
- Validate message shape at runtime for untrusted boundaries.
- Centralize message types and action constants.

### Storage
- Prefer `chrome.storage.local` unless sync is explicitly needed.
- Define typed storage keys and version migrations.
- Provide defaults and corruption/fallback handling.

---

## Security and privacy requirements
- Request the **minimum permissions** required.
- Prefer `activeTab` over broad host permissions when possible.
- Avoid `eval`, dynamic code execution, and remote code loading.
- Sanitize any HTML insertion; prefer textContent over innerHTML.
- Never log secrets/tokens.
- Keep any external network requests explicit, documented, and minimal.

---

## Suggested folder structure
Use this as a baseline (adapt only if requested):

```text
src/
  background/
    index.ts
  content/
    index.ts
  popup/
    index.html
    main.ts
  options/
    index.html
    main.ts
  shared/
    messaging.ts
    storage.ts
    types.ts
  styles/
    content.css
manifest.json
vite.config.mjs
tsconfig.json