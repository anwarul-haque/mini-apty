import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mountShadow } from './mount';
import { useContentStore } from './store';
import { startRecorder, stopRecorder } from './recorder';
import { startPlayback, stopPlayback } from './player';
import { saveWalkthrough, getWalkthroughs } from '../shared/storage';
// ── Shadow DOM boot ───────────────────────────────────────────────────────────
const shadow = mountShadow('mini-apty-root');
const appRoot = document.createElement('div');
appRoot.id = 'mini-apty-app';
shadow.appendChild(appRoot);
// ── Runtime message listener ──────────────────────────────────────────────────
// Registered outside React so it survives re-renders.
function handleMessage(msg) {
    if (msg.type === 'START_RECORDING') {
        useContentStore.getState().setMode('recording');
        startRecorder();
        return;
    }
    if (msg.type === 'STOP_RECORDING') {
        stopRecorder();
        useContentStore.getState().setMode('idle');
        return;
    }
    if (msg.type === 'PLAY_WALKTHROUGH') {
        const { walkthrough, stepIndex = 0 } = (msg.payload ?? {});
        if (walkthrough)
            startPlayback(walkthrough, stepIndex);
        return;
    }
    if (msg.type === 'STOP_PLAYBACK') {
        stopPlayback();
    }
}
if (chrome?.runtime?.id) {
    chrome.runtime.onMessage.addListener(handleMessage);
}
// ── Resume in-progress playback after navigation / page load ─────────────────
async function restoreProgress() {
    if (!chrome?.runtime?.id)
        return;
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_PROGRESS', payload: {} });
        if (!resp?.ok || !resp.data)
            return;
        const { walkthroughId, stepIndex } = resp.data;
        const all = await getWalkthroughs();
        const wt = all.find(w => w.id === walkthroughId);
        if (wt)
            startPlayback(wt, stepIndex);
    }
    catch { }
}
restoreProgress();
// ── React overlay ─────────────────────────────────────────────────────────────
function OverlayApp() {
    const mode = useContentStore(s => s.mode);
    if (mode === 'recording')
        return _jsx(RecordingPanel, {});
    return null;
}
function RecordingPanel() {
    const { draftSteps, walkthroughName, setWalkthroughName, updateDraftStep, removeDraftStep, clearDraft, setMode, } = useContentStore();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    async function handleSave() {
        if (!walkthroughName.trim()) {
            setError('Enter a walkthrough name.');
            return;
        }
        if (!draftSteps.length) {
            setError('Capture at least one step.');
            return;
        }
        setSaving(true);
        const wt = {
            id: crypto.randomUUID(),
            name: walkthroughName.trim(),
            origin: location.origin,
            pathPattern: location.pathname,
            steps: draftSteps,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        try {
            if (chrome?.runtime?.id) {
                await chrome.runtime.sendMessage({ type: 'SAVE_WALKTHROUGH', payload: wt });
            }
            else {
                await saveWalkthrough(wt);
            }
            stopRecorder();
            clearDraft();
            setMode('idle');
        }
        catch {
            setError('Save failed. Try again.');
        }
        finally {
            setSaving(false);
        }
    }
    function handleCancel() {
        stopRecorder();
        clearDraft();
        setMode('idle');
    }
    return (_jsxs("div", { style: {
            position: 'fixed', bottom: 20, right: 20, width: 320,
            maxHeight: '72vh', overflowY: 'auto',
            background: '#111827', color: '#f9fafb',
            borderRadius: 12, padding: 16,
            fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
            pointerEvents: 'all',
            zIndex: 2147483647,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: {
                                    width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                                    display: 'inline-block',
                                } }), _jsx("span", { style: { fontWeight: 600, fontSize: 14 }, children: "Recording" })] }), _jsxs("span", { style: { color: '#6b7280', fontSize: 12 }, children: [draftSteps.length, " step", draftSteps.length !== 1 ? 's' : ''] })] }), _jsxs("p", { style: { color: '#6b7280', fontSize: 12, margin: '0 0 12px' }, children: ["Click page elements to capture steps.", ' ', _jsx("kbd", { style: { background: '#1f2937', padding: '1px 5px', borderRadius: 3, fontSize: 11 }, children: "Esc" }), ' ', "to exit."] }), draftSteps.map((step, i) => (_jsx(StepEditor, { step: step, index: i, onUpdate: (patch) => { updateDraftStep(step.id, patch); setError(''); }, onRemove: () => removeDraftStep(step.id) }, step.id))), _jsx("input", { type: "text", placeholder: "Walkthrough name\u2026", value: walkthroughName, onChange: e => { setWalkthroughName(e.target.value); setError(''); }, style: {
                    width: '100%', padding: '8px 10px', marginTop: draftSteps.length ? 4 : 0,
                    background: '#1f2937', border: '1px solid #374151',
                    borderRadius: 7, color: '#f9fafb', fontSize: 13,
                    boxSizing: 'border-box', outline: 'none', marginBottom: 8,
                } }), error && (_jsx("p", { style: { color: '#f87171', fontSize: 12, margin: '0 0 8px' }, children: error })), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: handleSave, disabled: saving, style: {
                            flex: 1, padding: '8px 0',
                            background: saving ? '#1d4ed8' : '#3b82f6',
                            color: '#fff', border: 'none', borderRadius: 7,
                            cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13,
                        }, children: saving ? 'Saving…' : 'Save Walkthrough' }), _jsx("button", { onClick: handleCancel, style: {
                            padding: '8px 14px', background: 'transparent',
                            color: '#6b7280', border: '1px solid #374151',
                            borderRadius: 7, cursor: 'pointer', fontSize: 13,
                        }, children: "Cancel" })] })] }));
}
function StepEditor({ step, index, onUpdate, onRemove }) {
    const [expanded, setExpanded] = useState(false);
    const inputStyle = {
        width: '100%', padding: '5px 8px', marginTop: 5,
        background: '#111827', border: '1px solid #374151',
        borderRadius: 5, color: '#f9fafb', fontSize: 12,
        boxSizing: 'border-box', outline: 'none',
    };
    return (_jsxs("div", { style: { background: '#1f2937', borderRadius: 8, padding: 10, marginBottom: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("span", { style: { color: '#6b7280', fontSize: 11, fontWeight: 600 }, children: ["STEP ", index + 1] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: () => setExpanded(e => !e), style: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: 0 }, children: expanded ? '▲ less' : '▼ more' }), _jsx("button", { onClick: onRemove, style: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }, children: "\u00D7" })] })] }), _jsx("input", { type: "text", value: step.title, onChange: e => onUpdate({ title: e.target.value }), placeholder: "Step title", style: inputStyle }), expanded && (_jsxs(_Fragment, { children: [_jsx("textarea", { value: step.description, onChange: e => onUpdate({ description: e.target.value }), placeholder: "Description (optional)", rows: 2, style: { ...inputStyle, resize: 'vertical' } }), _jsxs("select", { value: step.trigger, onChange: e => onUpdate({ trigger: e.target.value }), style: { ...inputStyle, cursor: 'pointer' }, children: [_jsx("option", { value: "next-button", children: "Advance: Next button" }), _jsx("option", { value: "click-target", children: "Advance: Click element" }), _jsx("option", { value: "input-change", children: "Advance: Field change" })] }), _jsxs("p", { style: { color: '#4b5563', fontSize: 11, margin: '4px 0 0' }, children: ["Selector:", ' ', _jsx("code", { style: { color: '#6b7280', wordBreak: 'break-all' }, children: step.selector.length > 50 ? step.selector.slice(0, 50) + '…' : step.selector })] })] }))] }));
}
createRoot(appRoot).render(_jsx(OverlayApp, {}));
