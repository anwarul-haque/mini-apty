import { create } from 'zustand';
export const useContentStore = create((set) => ({
    mode: 'idle',
    draftSteps: [],
    walkthroughName: '',
    activeWalkthrough: null,
    stepIndex: 0,
    setMode: (mode) => set({ mode }),
    addDraftStep: (step) => set(s => ({ draftSteps: [...s.draftSteps, step] })),
    updateDraftStep: (id, patch) => set(s => ({
        draftSteps: s.draftSteps.map(st => (st.id === id ? { ...st, ...patch } : st)),
    })),
    removeDraftStep: (id) => set(s => ({ draftSteps: s.draftSteps.filter(st => st.id !== id) })),
    setWalkthroughName: (name) => set({ walkthroughName: name }),
    clearDraft: () => set({ draftSteps: [], walkthroughName: '' }),
    startPlay: (wt, stepIndex = 0) => set({ activeWalkthrough: wt, stepIndex, mode: 'playing' }),
    setStepIndex: (idx) => set({ stepIndex: idx }),
    stopPlay: () => set({ activeWalkthrough: null, stepIndex: 0, mode: 'idle' }),
}));
