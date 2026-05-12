import type { Walkthrough, PlayProgress } from './types'
import { WalkthroughSchema } from './schema'

const WT_KEY = 'mini-apty:walkthroughs'
const PROGRESS_KEY = 'mini-apty:progress'

export async function getWalkthroughs(): Promise<Walkthrough[]> {
  const raw = await chrome.storage.local.get(WT_KEY)
  const arr: unknown[] = raw[WT_KEY] ?? []
  if (!Array.isArray(arr)) return []
  // Validate each item at runtime so corrupted data doesn't crash
  return arr.filter((item): item is Walkthrough => WalkthroughSchema.safeParse(item).success)
}

export async function getWalkthroughsByOrigin(origin: string): Promise<Walkthrough[]> {
  const all = await getWalkthroughs()
  return all.filter(wt => wt.origin === origin)
}

export async function saveWalkthrough(wt: Walkthrough): Promise<void> {
  const items = await getWalkthroughs()
  const idx = items.findIndex(w => w.id === wt.id)
  if (idx !== -1) items[idx] = wt
  else items.push(wt)
  await chrome.storage.local.set({ [WT_KEY]: items })
}

export async function deleteWalkthrough(id: string): Promise<void> {
  const items = await getWalkthroughs()
  await chrome.storage.local.set({ [WT_KEY]: items.filter(w => w.id !== id) })
}

// Progress uses session storage — cleared automatically when the browser closes
export async function getProgress(tabId: number): Promise<PlayProgress | null> {
  const raw = await chrome.storage.session.get(PROGRESS_KEY)
  const map: Record<string, PlayProgress> = raw[PROGRESS_KEY] ?? {}
  return map[String(tabId)] ?? null
}

export async function setProgress(progress: PlayProgress): Promise<void> {
  const raw = await chrome.storage.session.get(PROGRESS_KEY)
  const map: Record<string, PlayProgress> = raw[PROGRESS_KEY] ?? {}
  map[String(progress.tabId)] = progress
  await chrome.storage.session.set({ [PROGRESS_KEY]: map })
}

export async function clearProgress(tabId: number): Promise<void> {
  const raw = await chrome.storage.session.get(PROGRESS_KEY)
  const map: Record<string, PlayProgress> = raw[PROGRESS_KEY] ?? {}
  delete map[String(tabId)]
  await chrome.storage.session.set({ [PROGRESS_KEY]: map })
}
