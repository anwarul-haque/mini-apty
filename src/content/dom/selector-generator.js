const STABLE_DATA_ATTRS = [
    'data-testid', 'data-cy', 'data-qa', 'data-e2e', 'data-id', 'data-test',
];
const SEMANTIC_FORM_TAGS = new Set(['input', 'select', 'textarea', 'button']);
// Tags that make reliable structural anchors (have semantic meaning)
const ANCHOR_TAGS = new Set([
    'button', 'a', 'input', 'select', 'textarea', 'form',
    'nav', 'main', 'header', 'footer', 'section', 'article',
    'dialog', 'li', 'td', 'th', 'label',
]);
// Returns candidates ranked by score (highest = most stable)
export function generateSelectors(el) {
    const candidates = [];
    // Priority 1 — explicit automation/test attributes
    for (const attr of STABLE_DATA_ATTRS) {
        const val = el.getAttribute(attr);
        if (val) {
            candidates.push({
                strategy: attr,
                selector: `[${attr}="${escapeAttr(val)}"]`,
                score: 95,
            });
            break; // one stable automation attr is sufficient at this tier
        }
    }
    // Priority 2 — non-auto-generated id
    if (el.id && !isAutoId(el.id)) {
        candidates.push({ strategy: 'id', selector: `#${CSS.escape(el.id)}`, score: 90 });
    }
    // Priority 3 — role + aria-label combo
    const role = el.getAttribute('role') ?? inferImplicitRole(el);
    const ariaLabel = el.getAttribute('aria-label')?.trim();
    if (role && ariaLabel) {
        candidates.push({
            strategy: 'role+aria-label',
            selector: `[role="${role}"][aria-label="${escapeAttr(ariaLabel)}"]`,
            score: 85,
        });
    }
    // Priority 4 — aria-label alone
    if (ariaLabel) {
        candidates.push({
            strategy: 'aria-label',
            selector: `[aria-label="${escapeAttr(ariaLabel)}"]`,
            score: 75,
        });
    }
    // Priority 5 — placeholder (form elements)
    const placeholder = el.getAttribute('placeholder')?.trim();
    if (placeholder) {
        const tag = el.tagName.toLowerCase();
        candidates.push({
            strategy: 'placeholder',
            selector: `${tag}[placeholder="${escapeAttr(placeholder)}"]`,
            score: 70,
        });
    }
    // Priority 6 — name attr (form elements with optional type refinement)
    const name = el.getAttribute('name');
    if (name && SEMANTIC_FORM_TAGS.has(el.tagName.toLowerCase())) {
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type');
        const typeClause = type ? `[type="${type}"]` : '';
        candidates.push({
            strategy: 'name',
            selector: `${tag}${typeClause}[name="${escapeAttr(name)}"]`,
            score: 65,
        });
    }
    // Priority 7 — structural path (last resort, bounded depth, semantic anchors)
    const structural = buildStructuralPath(el);
    if (structural) {
        candidates.push({ strategy: 'structural', selector: structural, score: 30 });
    }
    return dedupe(candidates).sort((a, b) => b.score - a.score);
}
// Returns a short stable text snippet from the element's text content.
// Undefined if the text looks dynamic (numbers, long strings).
export function extractTextHint(el) {
    const text = el.textContent?.trim();
    if (!text || text.length > 100 || /\d{4,}/.test(text))
        return undefined;
    return text.slice(0, 50);
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function isAutoId(id) {
    return (/^:\w+:$/.test(id) || // React 18 hydration ids (:r0:)
        /^[a-z]+-\d+$/.test(id) || // comp-123 style
        /^[0-9a-f]{8,}$/i.test(id) || // hex hashes
        id.length > 60);
}
function inferImplicitRole(el) {
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type')?.toLowerCase();
    if (tag === 'input') {
        if (type === 'checkbox')
            return 'checkbox';
        if (type === 'radio')
            return 'radio';
        if (type === 'submit' || type === 'button')
            return 'button';
        return 'textbox';
    }
    const map = {
        a: 'link', button: 'button', nav: 'navigation',
        main: 'main', header: 'banner', footer: 'contentinfo',
        section: 'region', article: 'article', aside: 'complementary',
        form: 'form', dialog: 'dialog', select: 'listbox', textarea: 'textbox',
    };
    return map[tag] ?? null;
}
// Build a short CSS path using semantic anchors.
// Uses nth-of-type (more stable than nth-child when siblings are added/removed).
// Stops early at a semantic tag or an element with stable attributes.
function buildStructuralPath(el) {
    const MAX_DEPTH = 4;
    const parts = [];
    let current = el;
    let depth = 0;
    while (current.parentElement && depth < MAX_DEPTH) {
        const tag = current.tagName.toLowerCase();
        let seg = tag;
        // Attach stable BEM-style class names, skip Tailwind/utility tokens
        const stableClasses = Array.from(current.classList)
            .filter(c => isStableClass(c))
            .slice(0, 2);
        if (stableClasses.length)
            seg += '.' + stableClasses.join('.');
        // nth-of-type only when disambiguation is needed
        const parent = current.parentElement;
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
            seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(seg);
        depth++;
        // Stop climbing at a semantic anchor or an element with a stable selector attr
        const parentHasStable = parent.id ||
            STABLE_DATA_ATTRS.some(a => parent.getAttribute(a));
        if (ANCHOR_TAGS.has(tag) || parentHasStable)
            break;
        current = parent;
    }
    return parts.length ? parts.join(' > ') : null;
}
// Return false for utility-first class names (Tailwind, Bootstrap utilities, etc.)
function isStableClass(cls) {
    if (cls.length > 40)
        return false;
    return !/^(flex|grid|block|inline|hidden|text-|bg-|p-|m-|w-|h-|max-|min-|rounded|border|shadow|font-|items-|justify-|gap-|space-|overflow-|z-|top-|bottom-|left-|right-|absolute|relative|fixed|sticky|cursor-|transition|duration-|ease-|opacity-|scale-|rotate-|translate-|hover:|focus:|active:|disabled:|dark:|sm:|md:|lg:|xl:|2xl:|\w+:)/.test(cls);
}
function escapeAttr(val) {
    return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function dedupe(list) {
    const seen = new Set();
    return list.filter(c => {
        if (seen.has(c.selector))
            return false;
        seen.add(c.selector);
        return true;
    });
}
