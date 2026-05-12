// Priority waterfall: try primary selector, then candidates by score, then text scan
export function resolveElement(primary, candidates, opts = {}) {
    const fromPrimary = tryCss(primary, opts.textHint);
    if (fromPrimary)
        return fromPrimary;
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    for (const c of sorted) {
        if (c.selector === primary)
            continue;
        const el = tryCss(c.selector, opts.textHint);
        if (el)
            return el;
    }
    // Last resort: scan by tag + text content
    if (opts.textHint && opts.tagHint) {
        return scanByText(opts.tagHint, opts.textHint);
    }
    return null;
}
function tryCss(selector, textHint) {
    let matches;
    try {
        matches = document.querySelectorAll(selector);
    }
    catch {
        return null; // malformed selector
    }
    if (matches.length === 0)
        return null;
    if (matches.length === 1)
        return matches[0];
    // Multiple matches — use textHint to disambiguate
    if (textHint) {
        const prefix = textHint.slice(0, 30).toLowerCase();
        for (const el of Array.from(matches)) {
            if (el.textContent?.trim().toLowerCase().startsWith(prefix))
                return el;
        }
    }
    return matches[0];
}
function scanByText(tagHint, textHint) {
    const prefix = textHint.slice(0, 30).toLowerCase();
    try {
        const els = Array.from(document.querySelectorAll(tagHint));
        for (const el of els) {
            if (el.textContent?.trim().toLowerCase().startsWith(prefix))
                return el;
        }
    }
    catch { }
    return null;
}
