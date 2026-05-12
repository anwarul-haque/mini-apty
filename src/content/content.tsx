import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mountShadow } from './mount'
import { useContentStore } from './store'
import { startRecorder, stopRecorder } from './recorder'
import { startPlayback, stopPlayback } from './player'
import { saveWalkthrough, getWalkthroughs } from '../shared/storage'
import type { AdvanceTrigger, Step, Walkthrough } from '../shared/types'

// ── Shadow DOM boot ───────────────────────────────────────────────────────────

const shadow = mountShadow('mini-apty-root')
const appRoot = document.createElement('div')
appRoot.id = 'mini-apty-app'
shadow.appendChild(appRoot)

// ── Runtime message listener ──────────────────────────────────────────────────
// Registered outside React so it survives re-renders.

function handleMessage(msg: { type: string; payload?: unknown }) {
  if (msg.type === 'START_RECORDING') {
    useContentStore.getState().setMode('recording')
    startRecorder()
    return
  }
  if (msg.type === 'STOP_RECORDING') {
    stopRecorder()
    useContentStore.getState().setMode('idle')
    return
  }
  if (msg.type === 'PLAY_WALKTHROUGH') {
    const { walkthrough, stepIndex = 0 } = (msg.payload ?? {}) as {
      walkthrough: Walkthrough
      stepIndex?: number
    }
    if (walkthrough) startPlayback(walkthrough, stepIndex)
    return
  }
  if (msg.type === 'STOP_PLAYBACK') {
    stopPlayback()
  }
}

if (chrome?.runtime?.id) {
  chrome.runtime.onMessage.addListener(handleMessage)
}

// ── Resume in-progress playback after navigation / page load ─────────────────

async function restoreProgress(): Promise<void> {
  if (!chrome?.runtime?.id) return
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_PROGRESS', payload: {} })
    if (!resp?.ok || !resp.data) return
    const { walkthroughId, stepIndex } = resp.data as {
      walkthroughId: string
      stepIndex: number
    }
    const all = await getWalkthroughs()
    const wt = all.find(w => w.id === walkthroughId)
    if (wt) startPlayback(wt, stepIndex)
  } catch {}
}
restoreProgress()

// ── React overlay ─────────────────────────────────────────────────────────────

function OverlayApp() {
  const mode = useContentStore(s => s.mode)
  if (mode === 'recording') return <RecordingPanel />
  return null
}

function RecordingPanel() {
  const {
    draftSteps, walkthroughName,
    setWalkthroughName, updateDraftStep, removeDraftStep,
    clearDraft, setMode,
  } = useContentStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!walkthroughName.trim()) { setError('Enter a walkthrough name.'); return }
    if (!draftSteps.length) { setError('Capture at least one step.'); return }
    setSaving(true)
    const wt: Walkthrough = {
      id: crypto.randomUUID(),
      name: walkthroughName.trim(),
      origin: location.origin,
      pathPattern: location.pathname,
      steps: draftSteps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    try {
      if (chrome?.runtime?.id) {
        await chrome.runtime.sendMessage({ type: 'SAVE_WALKTHROUGH', payload: wt })
      } else {
        await saveWalkthrough(wt)
      }
      stopRecorder()
      clearDraft()
      setMode('idle')
    } catch {
      setError('Save failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    stopRecorder()
    clearDraft()
    setMode('idle')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 320,
      maxHeight: '72vh', overflowY: 'auto',
      background: '#111827', color: '#f9fafb',
      borderRadius: 12, padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      pointerEvents: 'all',
      zIndex: 2147483647,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
            display: 'inline-block',
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Recording</span>
        </div>
        <span style={{ color: '#6b7280', fontSize: 12 }}>
          {draftSteps.length} step{draftSteps.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 12px' }}>
        Click page elements to capture steps.{' '}
        <kbd style={{ background: '#1f2937', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>Esc</kbd>{' '}
        to exit.
      </p>

      {/* Step list */}
      {draftSteps.map((step, i) => (
        <StepEditor
          key={step.id} step={step} index={i}
          onUpdate={(patch) => { updateDraftStep(step.id, patch); setError('') }}
          onRemove={() => removeDraftStep(step.id)}
        />
      ))}

      {/* Name input */}
      <input
        type="text"
        placeholder="Walkthrough name…"
        value={walkthroughName}
        onChange={e => { setWalkthroughName(e.target.value); setError('') }}
        style={{
          width: '100%', padding: '8px 10px', marginTop: draftSteps.length ? 4 : 0,
          background: '#1f2937', border: '1px solid #374151',
          borderRadius: 7, color: '#f9fafb', fontSize: 13,
          boxSizing: 'border-box', outline: 'none', marginBottom: 8,
        }}
      />

      {error && (
        <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 8px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave} disabled={saving}
          style={{
            flex: 1, padding: '8px 0',
            background: saving ? '#1d4ed8' : '#3b82f6',
            color: '#fff', border: 'none', borderRadius: 7,
            cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          {saving ? 'Saving…' : 'Save Walkthrough'}
        </button>
        <button
          onClick={handleCancel}
          style={{
            padding: '8px 14px', background: 'transparent',
            color: '#6b7280', border: '1px solid #374151',
            borderRadius: 7, cursor: 'pointer', fontSize: 13,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface StepEditorProps {
  step: Step
  index: number
  onUpdate: (patch: Partial<Step>) => void
  onRemove: () => void
}

function StepEditor({ step, index, onUpdate, onRemove }: StepEditorProps) {
  const [expanded, setExpanded] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', marginTop: 5,
    background: '#111827', border: '1px solid #374151',
    borderRadius: 5, color: '#f9fafb', fontSize: 12,
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ background: '#1f2937', borderRadius: 8, padding: 10, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600 }}>STEP {index + 1}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: 0 }}
          >
            {expanded ? '▲ less' : '▼ more'}
          </button>
          <button
            onClick={onRemove}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>

      <input
        type="text"
        value={step.title}
        onChange={e => onUpdate({ title: e.target.value })}
        placeholder="Step title"
        style={inputStyle}
      />

      {expanded && (
        <>
          <textarea
            value={step.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <select
            value={step.trigger}
            onChange={e => onUpdate({ trigger: e.target.value as AdvanceTrigger })}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="next-button">Advance: Next button</option>
            <option value="click-target">Advance: Click element</option>
            <option value="input-change">Advance: Field change</option>
          </select>
          <p style={{ color: '#4b5563', fontSize: 11, margin: '4px 0 0' }}>
            Selector:{' '}
            <code style={{ color: '#6b7280', wordBreak: 'break-all' }}>
              {step.selector.length > 50 ? step.selector.slice(0, 50) + '…' : step.selector}
            </code>
          </p>
        </>
      )}
    </div>
  )
}

createRoot(appRoot).render(<OverlayApp />)
