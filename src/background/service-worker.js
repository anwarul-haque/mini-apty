import { getWalkthroughs, getWalkthroughsByOrigin, saveWalkthrough, deleteWalkthrough, getProgress, setProgress, clearProgress, } from '../shared/storage';
import { WalkthroughSchema } from '../shared/schema';
import { ok, err } from '../shared/messages';
chrome.runtime.onInstalled.addListener(() => {
    console.log('[mini-apty] installed');
});
// Async message router. Returns true keeps the channel open for the async response.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    route(msg, sender)
        .then(sendResponse)
        .catch((e) => sendResponse(err(e instanceof Error ? e.message : 'Unknown error')));
    return true;
});
async function route(msg, sender) {
    const tabId = sender.tab?.id;
    switch (msg.type) {
        case 'SAVE_WALKTHROUGH': {
            const parsed = WalkthroughSchema.safeParse(msg.payload);
            if (!parsed.success)
                return err(`Invalid walkthrough: ${parsed.error.message}`);
            await saveWalkthrough(parsed.data);
            await refreshBadge(tabId);
            return ok(parsed.data.id);
        }
        case 'LIST_WALKTHROUGHS': {
            const origin = msg.payload?.origin ?? '';
            const list = origin
                ? await getWalkthroughsByOrigin(origin)
                : await getWalkthroughs();
            return ok(list);
        }
        case 'DELETE_WALKTHROUGH': {
            const id = msg.payload?.id;
            if (!id)
                return err('Missing id');
            await deleteWalkthrough(id);
            await refreshBadge(tabId);
            return ok(null);
        }
        case 'SET_PROGRESS': {
            const p = msg.payload;
            if (!p?.walkthroughId || tabId == null)
                return err('Missing required fields');
            await setProgress({
                walkthroughId: p.walkthroughId,
                stepIndex: p.stepIndex ?? 0,
                tabId,
                savedAt: p.savedAt ?? Date.now(),
            });
            return ok(null);
        }
        case 'GET_PROGRESS': {
            if (tabId == null)
                return err('No tabId in sender');
            return ok(await getProgress(tabId));
        }
        case 'CLEAR_PROGRESS': {
            if (tabId != null)
                await clearProgress(tabId);
            return ok(null);
        }
        default:
            return err(`Unknown message type: ${msg.type}`);
    }
}
// ── Badge management ──────────────────────────────────────────────────────────
async function refreshBadge(tabId) {
    if (tabId == null)
        return;
    try {
        const tab = await chrome.tabs.get(tabId);
        await setBadgeForUrl(tabId, tab.url);
    }
    catch { }
}
async function setBadgeForUrl(tabId, url) {
    if (!url?.startsWith('http')) {
        await chrome.action.setBadgeText({ text: '', tabId });
        return;
    }
    try {
        const origin = new URL(url).origin;
        const list = await getWalkthroughsByOrigin(origin);
        const text = list.length > 0 ? String(list.length) : '';
        await chrome.action.setBadgeText({ text, tabId });
        if (text)
            await chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId });
    }
    catch { }
}
// Refresh badge whenever the user switches tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId)
        .then(tab => setBadgeForUrl(tabId, tab.url))
        .catch(() => { });
});
// Refresh badge when a tab finishes loading (covers SPA navigations that update the URL)
chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete') {
        chrome.tabs.get(tabId)
            .then(tab => setBadgeForUrl(tabId, tab.url))
            .catch(() => { });
    }
});
