import { computePosition, flip, shift, offset } from '@floating-ui/dom'
import { resolveElement } from './dom/selector-resolver'
import { watchForElement, watchSpaNavigation } from './mutation-observer'
import { useContentStore } from './store'
import { getShadow } from './mount'
import type { AdvanceTrigger, Step, Walkthrough } from '../shared/types'

let tooltipEl: HTMLDivElement | null = null
let watchHandle: { stop: () => void } | null = null
let spaUnlisten: (() => void) | null = null
let triggerCleanup: (() => void) | null = null
let highlightCleanup: (() => void) | null = null

// ── Public API ────────────────────────────────────────────────────────────────

export function startPlayback(wt: Walkthrough, initialStep = 0): void {
  cleanupAll()
  useContentStore.getState().startPlay(wt, initialStep)

  spaUnlisten = watchSpaNavigation(() => {
    // Give the SPA framework a tick to finish its DOM update before we retry
    setTimeout(renderCurrentStep, 400)
  })

  renderCurrentStep()
}

export function stopPlayback(): void {
  cleanupAll()
  clearProgressInSW()
  useContentStore.getState().stopPlay()
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderCurrentStep(): void {
  const { activeWalkthrough, stepIndex } = useContentStore.getState()
  if (!activeWalkthrough) return

  const step = activeWalkthrough.steps[stepIndex]
  if (!step) { finishPlayback(); return }

  removeTooltip()
  highlightCleanup?.()
  highlightCleanup = null
  triggerCleanup?.()
  triggerCleanup = null
  watchHandle?.stop()

  watchHandle = watchForElement(
    () => resolveElement(step.selector, step.candidates, {
      textHint: step.textHint,
      tagHint: step.tagHint,
    }),
    (el) => { attachHighlight(el); renderTooltip(el, step) },
    () => renderErrorTooltip(step),
  )
}

function renderTooltip(target: HTMLElement, step: Step): void {
  const shadow = getShadow()
  removeTooltip()

  const { stepIndex, activeWalkthrough } = useContentStore.getState()
  const total = activeWalkthrough!.steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex + 1 >= total

  tooltipEl = document.createElement('div')
  tooltipEl.style.cssText = `
    position: fixed;
    width: 300px;
    background: #111827;
    color: #f9fafb;
    border-radius: 12px;
    padding: 16px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
    pointer-events: all;
    z-index: 2147483647;
  `

  const prevStyle = `
    padding:7px 14px;
    background:${isFirst ? 'transparent' : '#1f2937'};
    color:${isFirst ? '#374151' : '#d1d5db'};
    border:1px solid ${isFirst ? '#1f2937' : '#374151'};
    border-radius:7px;
    cursor:${isFirst ? 'not-allowed' : 'pointer'};
    font-size:12px;font-weight:500;
  `
  const nextStyle = `
    padding:7px 16px;
    background:#3b82f6;
    color:#fff;
    border:none;
    border-radius:7px;
    cursor:pointer;
    font-size:12px;font-weight:600;
  `
  const triggerStyle = `
    font-size:11px;color:#6b7280;font-style:italic;text-align:right;flex:1;
  `

  tooltipEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;color:#6b7280;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Step ${stepIndex + 1} / ${total}</span>
      <button data-a="stop" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:20px;line-height:1;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px">&times;</button>
    </div>
    <div style="font-weight:600;font-size:15px;margin-bottom:6px;color:#f9fafb">${esc(step.title)}</div>
    <div style="color:#9ca3af;margin-bottom:16px;font-size:13px">${esc(step.description)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <button data-a="prev" ${isFirst ? 'disabled' : ''} style="${prevStyle}">← Prev</button>
      ${step.trigger === 'next-button'
        ? `<button data-a="next" style="${nextStyle}">${isLast ? 'Finish ✓' : 'Next →'}</button>`
        : `<span style="${triggerStyle}">${triggerHint(step.trigger)}</span>`
      }
    </div>
  `

  tooltipEl.addEventListener('click', handleTooltipClick)
  shadow.appendChild(tooltipEl)

  computePosition(target, tooltipEl, {
    placement: 'bottom',
    middleware: [offset(12), flip({ padding: 8 }), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    if (!tooltipEl) return
    tooltipEl.style.left = `${x}px`
    tooltipEl.style.top = `${y}px`
  })

  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  triggerCleanup = attachTrigger(target, step.trigger, () => advance(1))
  persistProgress()
}

function renderErrorTooltip(step: Step): void {
  const shadow = getShadow()
  removeTooltip()

  const { stepIndex, activeWalkthrough } = useContentStore.getState()
  const total = activeWalkthrough!.steps.length

  tooltipEl = document.createElement('div')
  tooltipEl.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    width: 280px; background: #1f2937; color: #f9fafb;
    border-radius: 10px; padding: 14px;
    font-family: system-ui, sans-serif; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    border: 1px solid #dc2626;
    pointer-events: all; z-index: 2147483647;
  `
  tooltipEl.innerHTML = `
    <div style="color:#fca5a5;font-weight:600;margin-bottom:6px">⚠ Element not found</div>
    <div style="color:#9ca3af;margin-bottom:12px;font-size:12px">"${esc(step.title)}" (step ${stepIndex + 1}/${total})</div>
    <div style="display:flex;gap:8px">
      <button data-a="skip" style="padding:5px 12px;background:#374151;color:#d1d5db;border:none;border-radius:6px;cursor:pointer;font-size:12px">Skip →</button>
      <button data-a="stop" style="padding:5px 12px;background:transparent;color:#6b7280;border:1px solid #374151;border-radius:6px;cursor:pointer;font-size:12px">Stop</button>
    </div>
  `
  tooltipEl.addEventListener('click', handleTooltipClick)
  shadow.appendChild(tooltipEl)
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleTooltipClick(e: MouseEvent): void {
  const btn = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null
  if (!btn) return
  const a = btn.dataset.a
  if (a === 'stop') { stopPlayback(); return }
  if (a === 'skip' || a === 'next') { advance(1); return }
  if (a === 'prev') { advance(-1); return }
}

function advance(delta: number): void {
  highlightCleanup?.()
  highlightCleanup = null
  const { stepIndex, activeWalkthrough, setStepIndex } = useContentStore.getState()
  if (!activeWalkthrough) return
  const next = stepIndex + delta
  if (next < 0) return
  if (next >= activeWalkthrough.steps.length) { finishPlayback(); return }
  setStepIndex(next)
  renderCurrentStep()
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

function finishPlayback(): void {
  cleanupAll()
  clearProgressInSW()
  useContentStore.getState().stopPlay()
  showCompletionBanner()
}

function showCompletionBanner(): void {
  const shadow = getShadow()
  const banner = document.createElement('div')
  banner.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #065f46; color: #d1fae5; padding: 10px 24px;
    border-radius: 8px; font-family: system-ui, sans-serif; font-size: 14px;
    font-weight: 500; pointer-events: none; z-index: 2147483647;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `
  banner.textContent = '✓ Walkthrough complete'
  shadow.appendChild(banner)
  setTimeout(() => banner.remove(), 3000)
}

function attachHighlight(el: HTMLElement): void {
  const prev = { outline: el.style.outline, offset: el.style.outlineOffset }
  el.style.outline = '2px solid #3b82f6'
  el.style.outlineOffset = '2px'
  highlightCleanup = () => {
    el.style.outline = prev.outline
    el.style.outlineOffset = prev.offset
    highlightCleanup = null
  }
}

function removeTooltip(): void {
  tooltipEl?.remove()
  tooltipEl = null
}

function attachTrigger(el: HTMLElement, trigger: AdvanceTrigger, onAdvance: () => void): () => void {
  if (trigger === 'click-target') {
    const h = () => { cleanup(); onAdvance() }
    const cleanup = () => el.removeEventListener('click', h)
    el.addEventListener('click', h, { once: true })
    return cleanup
  }
  if (trigger === 'input-change') {
    const h = () => { cleanup(); onAdvance() }
    const cleanup = () => el.removeEventListener('change', h)
    el.addEventListener('change', h, { once: true })
    return cleanup
  }
  return () => {}
}

function cleanupAll(): void {
  watchHandle?.stop()
  watchHandle = null
  spaUnlisten?.()
  spaUnlisten = null
  triggerCleanup?.()
  triggerCleanup = null
  highlightCleanup?.()
  highlightCleanup = null
  removeTooltip()
}

function persistProgress(): void {
  if (!chrome?.runtime?.id) return
  const { activeWalkthrough, stepIndex } = useContentStore.getState()
  if (!activeWalkthrough) return
  chrome.runtime.sendMessage({
    type: 'SET_PROGRESS',
    payload: { walkthroughId: activeWalkthrough.id, stepIndex, savedAt: Date.now() },
  }).catch(() => {})
}

function clearProgressInSW(): void {
  if (!chrome?.runtime?.id) return
  chrome.runtime.sendMessage({ type: 'CLEAR_PROGRESS', payload: {} }).catch(() => {})
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function triggerHint(t: AdvanceTrigger): string {
  if (t === 'click-target') return 'Click the highlighted element to advance'
  if (t === 'input-change') return 'Update the field value to advance'
  return ''
}
