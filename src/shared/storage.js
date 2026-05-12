import { WalkthroughSchema } from './schema';
const WT_KEY = 'mini-apty:walkthroughs';
const PROGRESS_KEY = 'mini-apty:progress';
export async function getWalkthroughs() {
    const raw = await chrome.storage.local.get(WT_KEY);
    const arr = raw[WT_KEY] ?? [];
    if (!Array.isArray(arr))
        return [];
    // Validate each item at runtime so corrupted data doesn't crash
    return arr.filter((item) => WalkthroughSchema.safeParse(item).success);
}
export async function getWalkthroughsByOrigin(origin) {
    const all = await getWalkthroughs();
    return all.filter(wt => wt.origin === origin);
}
export async function saveWalkthrough(wt) {
    const items = await getWalkthroughs();
    const idx = items.findIndex(w => w.id === wt.id);
    if (idx !== -1)
        items[idx] = wt;
    else
        items.push(wt);
    await chrome.storage.local.set({ [WT_KEY]: items });
}
export async function deleteWalkthrough(id) {
    const items = await getWalkthroughs();
    await chrome.storage.local.set({ [WT_KEY]: items.filter(w => w.id !== id) });
}
// Progress uses session storage — cleared automatically when the browser closes
export async function getProgress(tabId) {
    const raw = await chrome.storage.session.get(PROGRESS_KEY);
    const map = raw[PROGRESS_KEY] ?? {};
    return map[String(tabId)] ?? null;
}
export async function setProgress(progress) {
    const raw = await chrome.storage.session.get(PROGRESS_KEY);
    const map = raw[PROGRESS_KEY] ?? {};
    map[String(progress.tabId)] = progress;
    await chrome.storage.session.set({ [PROGRESS_KEY]: map });
}
export async function clearProgress(tabId) {
    const raw = await chrome.storage.session.get(PROGRESS_KEY);
    const map = raw[PROGRESS_KEY] ?? {};
    delete map[String(tabId)];
    await chrome.storage.session.set({ [PROGRESS_KEY]: map });
}
