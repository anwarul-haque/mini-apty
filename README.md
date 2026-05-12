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

## Architecture

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

## Selector strategy (priority order)

1. data-testid
2. id
3. aria-label
4. nth-child disambiguated CSS path

---

## Tradeoffs

- Shadow DOM isolates extension UI from host page styles
- MutationObserver enables SPA compatibility
- Floating UI handles tooltip overflow automatically
