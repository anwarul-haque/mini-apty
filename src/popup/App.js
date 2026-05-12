import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export default function App() {
    const [walkthroughs, setWalkthroughs] = useState([]);
    const [tabId, setTabId] = useState(null);
    const [origin, setOrigin] = useState('');
    const [loading, setLoading] = useState(true);
    const [sendError, setSendError] = useState('');
    useEffect(() => {
        async function init() {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const tid = tab?.id ?? null;
            setTabId(tid);
            let org = '';
            try {
                org = new URL(tab?.url ?? '').origin;
            }
            catch { }
            setOrigin(org);
            const resp = await chrome.runtime.sendMessage({
                type: 'LIST_WALKTHROUGHS',
                payload: { origin: org },
            });
            setWalkthroughs(resp?.data ?? []);
            setLoading(false);
        }
        init().catch(console.error);
    }, []);
    async function handleRecord() {
        if (!tabId)
            return;
        setSendError('');
        try {
            await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
            window.close();
        }
        catch {
            setSendError('Cannot record on this page. Navigate to a regular website first.');
        }
    }
    async function handlePlay(wt) {
        if (!tabId)
            return;
        setSendError('');
        try {
            await chrome.tabs.sendMessage(tabId, {
                type: 'PLAY_WALKTHROUGH',
                payload: { walkthrough: wt, stepIndex: 0 },
            });
            window.close();
        }
        catch {
            setSendError('Cannot play on this page.');
        }
    }
    async function handleDelete(id) {
        await chrome.runtime.sendMessage({ type: 'DELETE_WALKTHROUGH', payload: { id } });
        setWalkthroughs(prev => prev.filter(w => w.id !== id));
    }
    const hostname = origin ? (() => { try {
        return new URL(origin).hostname;
    }
    catch {
        return '';
    } })() : '';
    return (_jsxs("div", { style: {
            padding: 16, width: 340,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 13, color: '#111827',
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, children: [_jsx("span", { style: { fontSize: 16, fontWeight: 700 }, children: "Mini Apty" }), hostname && (_jsx("span", { style: { fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10 }, children: hostname }))] }), _jsx("button", { onClick: handleRecord, disabled: !tabId || loading, style: {
                    width: '100%', padding: '9px 0',
                    background: (!tabId || loading) ? '#6b7280' : '#111827',
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: (!tabId || loading) ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: 13, marginBottom: 12,
                }, children: "\u23FA Record New Walkthrough" }), sendError && (_jsx("p", { style: { color: '#dc2626', fontSize: 12, margin: '0 0 10px' }, children: sendError })), loading ? (_jsx("p", { style: { color: '#9ca3af', textAlign: 'center', padding: '16px 0' }, children: "Loading\u2026" })) : walkthroughs.length === 0 ? (_jsx("p", { style: { color: '#9ca3af', textAlign: 'center', padding: '16px 0', fontSize: 13 }, children: "No walkthroughs for this site yet." })) : (walkthroughs.map(wt => (_jsxs("div", { style: {
                    border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '10px 12px', marginBottom: 8,
                }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 2 }, children: wt.name }), _jsxs("div", { style: { color: '#9ca3af', fontSize: 11, marginBottom: 8 }, children: [wt.steps.length, " step", wt.steps.length !== 1 ? 's' : '', wt.pathPattern ? ` · ${wt.pathPattern}` : ''] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: () => handlePlay(wt), style: {
                                    padding: '4px 12px', background: '#2563eb', color: '#fff',
                                    border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                }, children: "\u25B6 Play" }), _jsx("button", { onClick: () => handleDelete(wt.id), style: {
                                    padding: '4px 10px', background: '#fff', color: '#dc2626',
                                    border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: 12,
                                }, children: "Delete" })] })] }, wt.id))))] }));
}
