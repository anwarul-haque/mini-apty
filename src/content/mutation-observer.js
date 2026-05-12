const DEBOUNCE_MS = 80;
const MAX_RETRIES = 25;
const RETRY_MS = 200;
// Poll for an element with exponential patience.
// Re-tries on every MutationObserver tick (debounced) plus a timer fallback.
// This handles both immediate availability and late SPA renders.
export function watchForElement(resolve, onFound, onTimeout) {
    let retries = 0;
    let retryTimer = null;
    let debounceTimer = null;
    let stopped = false;
    let mo = null;
    function attempt() {
        if (stopped)
            return;
        const el = resolve();
        if (el) {
            cleanup();
            onFound(el);
            return;
        }
        if (retries >= MAX_RETRIES) {
            cleanup();
            onTimeout();
            return;
        }
        retries++;
        retryTimer = setTimeout(attempt, RETRY_MS);
    }
    function onMutation() {
        if (stopped)
            return;
        if (debounceTimer !== null)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(attempt, DEBOUNCE_MS);
    }
    function cleanup() {
        stopped = true;
        if (retryTimer !== null)
            clearTimeout(retryTimer);
        if (debounceTimer !== null)
            clearTimeout(debounceTimer);
        mo?.disconnect();
        mo = null;
    }
    mo = new MutationObserver(onMutation);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    attempt();
    return { stop: cleanup };
}
// Returns a teardown function.
// Covers: Navigation API (Chrome 102+), popstate, hashchange, and History.pushState/replaceState patch.
export function watchSpaNavigation(onNavigate) {
    const teardowns = [];
    // Modern Navigation API — most reliable for SPAs
    if ('navigation' in window) {
        const nav = window.navigation;
        const handler = (e) => onNavigate(e.destination.url);
        nav.addEventListener('navigate', handler);
        teardowns.push(() => nav.removeEventListener('navigate', handler));
    }
    // Legacy fallbacks
    const popstateHandler = () => onNavigate(location.href);
    const hashchangeHandler = () => onNavigate(location.href);
    window.addEventListener('popstate', popstateHandler);
    window.addEventListener('hashchange', hashchangeHandler);
    teardowns.push(() => window.removeEventListener('popstate', popstateHandler), () => window.removeEventListener('hashchange', hashchangeHandler));
    // Patch History API for React Router / Vue Router / etc.
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => {
        origPush(...args);
        onNavigate(location.href);
    };
    history.replaceState = (...args) => {
        origReplace(...args);
        onNavigate(location.href);
    };
    teardowns.push(() => {
        history.pushState = origPush;
        history.replaceState = origReplace;
    });
    return () => teardowns.forEach(fn => fn());
}
