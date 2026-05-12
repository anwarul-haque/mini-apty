# Mini Apty

## Setup

```bash
pnpm install
pnpm build
```

Load `dist/` as unpacked extension in Chrome.

```
chrome://extensions -> enable Developer mode -> Load unpacked -> select dist/
```

---

## What is this?

Mini Apty is a Chrome extension that lets you record interactive product walkthroughs on any website and play them back, similar to tools like Apty or WalkMe. The core flow is: **Record steps → Save → Replay with tooltips**.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Popup (React)          ← user-facing launcher  │
├─────────────────────────────────────────────────┤
│  Service Worker         ← message router +      │
│  (background.ts)            storage gateway     │
├─────────────────────────────────────────────────┤
│  Content Script         ← runs IN the page      │
│  (recorder, player,         records + renders   │
│   store, content.tsx)       tooltips            │
└─────────────────────────────────────────────────┘
```

These three contexts can't share memory directly — they communicate via `chrome.runtime.sendMessage`.

**Stack:**
- MV3 Chrome extension
- React 18 + TypeScript
- Zustand state management
- Zod schema validation
- Shadow DOM isolation
- Floating UI tooltip positioning
- MutationObserver for SPA support

---

## File structure

```
src/
  shared/         types, storage helpers, zod schemas
  background/     service worker -- relays messages
  content/        injected into every page
    dom/          selector generation + resolution
    recorder.ts   click-to-capture element mode
    player.ts     tooltip-based walkthrough playback
    store.ts      zustand state
    content.tsx   shadow DOM root + overlay UI
  popup/          extension popup (list + play)
```

---

## The Recording Flow

When recording starts, `recorder.ts` attaches DOM event listeners in **capture phase** (the `true` flag). On every hover, it outlines the element in blue. On click, it calls `e.stopImmediatePropagation()` so the page's own click handler doesn't fire, then captures the element.

---

## Selector Strategy

Rather than a single brittle CSS path, the selector generator produces a **ranked list of candidates** with confidence scores:

| Strategy | Score | Example |
|---|---|---|
| `data-testid` / `data-cy` | 95 | `[data-testid="submit-btn"]` |
| Non-auto `id` | 90 | `#submit-button` |
| `role` + `aria-label` | 85 | `[role="button"][aria-label="Save"]` |
| `placeholder` | 70 | `input[placeholder="Email"]` |
| Structural path | 30 | `form > div > button:nth-of-type(2)` |

Auto-generated IDs (React's `:r0:`, hash-like strings) are explicitly filtered out because they're unstable. Tailwind utility classes are also skipped in structural paths for the same reason.

---

## State Management

The content script uses **Zustand** with three modes: `idle | recording | playing`. Zustand is ideal here because the store is accessed by both the React overlay and vanilla JS modules (recorder, player) without hooks — via `useContentStore.getState()`.

---

## The Playback Flow

`player.ts` resolves each step's element using the ranked candidates, then positions a tooltip using `@floating-ui/dom` — which handles viewport collisions automatically (flip, shift middleware).

**SPA navigation support** — A `MutationObserver` watches for DOM and URL changes. When a SPA navigates, the framework is given 400ms to settle then the current step is re-rendered. Without this, SPAs that update the URL without a real page load would break playback.

**Progress persistence** — When navigating between pages during a walkthrough, progress (which walkthrough, which step) is stored in `chrome.storage.session` keyed by tab ID. On page load, the content script checks for saved progress and resumes automatically.

---

## Service Worker as a Trusted Gateway

The background service worker acts as the single source of truth for storage. All content scripts route through it via message passing. This serializes concurrent access to `chrome.storage` and avoids race conditions.

Incoming data is validated against a Zod schema (`WalkthroughSchema`) before saving, so corrupted or malicious payloads are rejected at the boundary.

The **badge** on the extension icon shows how many walkthroughs exist for the current tab's origin — refreshed on tab switch and tab update events.

---

## Shadow DOM Isolation

The entire overlay (recording panel, tooltips) is injected into a **Shadow DOM**. This ensures the extension's styles don't leak into the host page and vice versa. Clicks inside the shadow root are detected and excluded from being captured as steps.

---

## Tradeoffs

- Selector stability is prioritized over simplicity — multi-candidate system with confidence scores
- Shadow DOM provides clean style isolation from the host page
- Service worker is the single storage gateway to serialize concurrent access
- `chrome.storage.session` is used for progress (auto-cleared on browser close)
- Walkthroughs are tab-scoped during playback — multi-tab flows are not supported
