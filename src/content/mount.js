// Singleton shadow root reference, set once during content script boot
let _shadow = null;
export function mountShadow(hostId) {
    const host = document.createElement('div');
    host.id = hostId;
    // Zero-footprint host: no layout impact, pointer-events delegated per-child
    host.style.cssText =
        'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;overflow:visible';
    document.documentElement.appendChild(host);
    _shadow = host.attachShadow({ mode: 'open' });
    return _shadow;
}
export function getShadow() {
    if (!_shadow)
        throw new Error('[mini-apty] shadow root not initialized');
    return _shadow;
}
