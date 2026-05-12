import { create } from 'zustand'
import type { Step, Walkthrough } from '../shared/types'

export type Mode = 'idle' | 'recording' | 'playing'

interface ContentStore {
  mode: Mode
  // Author state
  draftSteps: Step[]
  walkthroughName: string
  // Player state
  activeWalkthrough: Walkthrough | null
  stepIndex: number
  // Actions
  setMode: (mode: Mode) => void
  addDraftStep: (step: Step) => void
  updateDraftStep: (id: string, patch: Partial<Step>) => void
  removeDraftStep: (id: string) => void
  setWalkthroughName: (name: string) => void
  clearDraft: () => void
  startPlay: (wt: Walkthrough, stepIndex?: number) => void
  setStepIndex: (idx: number) => void
  stopPlay: () => void
}

export const useContentStore = create<ContentStore>((set) => ({
  mode: 'idle',
  draftSteps: [],
  walkthroughName: '',
  activeWalkthrough: null,
  stepIndex: 0,

  setMode: (mode) => set({ mode }),

  addDraftStep: (step) =>
    set(s => ({ draftSteps: [...s.draftSteps, step] })),

  updateDraftStep: (id, patch) =>
    set(s => ({
      draftSteps: s.draftSteps.map(st => (st.id === id ? { ...st, ...patch } : st)),
    })),

  removeDraftStep: (id) =>
    set(s => ({ draftSteps: s.draftSteps.filter(st => st.id !== id) })),

  setWalkthroughName: (name) => set({ walkthroughName: name }),

  clearDraft: () => set({ draftSteps: [], walkthroughName: '' }),

  startPlay: (wt, stepIndex = 0) =>
    set({ activeWalkthrough: wt, stepIndex, mode: 'playing' }),

  setStepIndex: (idx) => set({ stepIndex: idx }),

  stopPlay: () => set({ activeWalkthrough: null, stepIndex: 0, mode: 'idle' }),
}))
