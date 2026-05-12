import type { Walkthrough, PlayProgress } from './types'

// Discriminated union of every message sent over chrome.runtime
export type ExtMessage =
  | { type: 'SAVE_WALKTHROUGH'; payload: Walkthrough }
  | { type: 'LIST_WALKTHROUGHS'; payload: { origin: string } }
  | { type: 'DELETE_WALKTHROUGH'; payload: { id: string } }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'PLAY_WALKTHROUGH'; payload: { walkthrough: Walkthrough; stepIndex?: number } }
  | { type: 'STOP_PLAYBACK' }
  | { type: 'SET_PROGRESS'; payload: Omit<PlayProgress, 'tabId'> }
  | { type: 'GET_PROGRESS'; payload: Record<string, never> }
  | { type: 'CLEAR_PROGRESS'; payload: Record<string, never> }

export type ExtResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export function ok<T>(data: T): ExtResponse<T> {
  return { ok: true, data }
}

export function err(message: string): ExtResponse<never> {
  return { ok: false, error: message }
}
