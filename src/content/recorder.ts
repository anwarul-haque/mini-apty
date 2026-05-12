import { generateSelectors, extractTextHint } from './dom/selector-generator'
import { useContentStore } from './store'
import type { Step } from '../shared/types'

let active = false
let hovered: HTMLElement | null = null

export function startRecorder(): void {
  active = true
  document.addEventListener('mouseover', onHover, true)
  document.addEventListener('mouseout', onHoverOut, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

export function stopRecorder(): void {
  active = false
  clearHighlight()
  document.removeEventListener('mouseover', onHover, true)
  document.removeEventListener('mouseout', onHoverOut, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function clearHighlight(): void {
  if (!hovered) return
  hovered.style.removeProperty('outline')
  hovered.style.removeProperty('outline-offset')
  hovered = null
}

function onHover(e: MouseEvent): void {
  if (!active || fromShadow(e)) return
  clearHighlight()
  const target = e.target as HTMLElement
  target.style.outline = '2px solid #3b82f6'
  target.style.outlineOffset = '2px'
  hovered = target
}

function onHoverOut(e: MouseEvent): void {
  if (!active || fromShadow(e)) return
  const target = e.target as HTMLElement
  target.style.removeProperty('outline')
  target.style.removeProperty('outline-offset')
}

function onClick(e: MouseEvent): void {
  if (!active || fromShadow(e)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  const target = e.target as HTMLElement
  clearHighlight()

  const candidates = generateSelectors(target)
  if (!candidates.length) return

  const { draftSteps, addDraftStep } = useContentStore.getState()
  const step: Step = {
    id: crypto.randomUUID(),
    selector: candidates[0].selector,
    candidates,
    textHint: extractTextHint(target),
    tagHint: target.tagName.toLowerCase(),
    title: `Step ${draftSteps.length + 1}`,
    description: '',
    trigger: 'next-button',
  }
  addDraftStep(step)
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    stopRecorder()
    useContentStore.getState().setMode('idle')
  }
}

// Click originated inside our shadow root — its e.target is retargeted to the
// shadow host, so the deepest composedPath entry differs from e.target.
function fromShadow(e: Event): boolean {
  const path = e.composedPath()
  return path.length > 0 && path[0] !== e.target
}
