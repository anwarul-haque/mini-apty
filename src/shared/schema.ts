import { z } from 'zod'

export const SelectorCandidateSchema = z.object({
  strategy: z.string(),
  selector: z.string(),
  score: z.number().min(0).max(100),
})

export const StepSchema = z.object({
  id: z.string().uuid(),
  selector: z.string().min(1),
  candidates: z.array(SelectorCandidateSchema).default([]),
  textHint: z.string().optional(),
  tagHint: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  trigger: z.enum(['next-button', 'click-target', 'input-change']),
})

export const WalkthroughSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  origin: z.string().url(),
  pathPattern: z.string(),
  steps: z.array(StepSchema),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})
