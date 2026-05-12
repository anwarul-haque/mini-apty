export type AdvanceTrigger = 'next-button' | 'click-target' | 'input-change'

// A single selector attempt with a confidence score
export type SelectorCandidate = {
  strategy: string
  selector: string
  score: number
}

export type Step = {
  id: string
  selector: string            // best candidate's selector
  candidates: SelectorCandidate[]
  textHint?: string           // stable text snippet for disambiguation
  tagHint?: string            // element tag for text-scan fallback
  title: string
  description: string
  trigger: AdvanceTrigger
}

export type Walkthrough = {
  id: string
  name: string
  origin: string              // e.g. "https://app.example.com"
  pathPattern: string         // e.g. "/dashboard" — recorded path
  steps: Step[]
  createdAt: number
  updatedAt: number
}

export type PlayProgress = {
  walkthroughId: string
  stepIndex: number
  tabId: number
  savedAt: number
}
