// Canvas Privacy Protection - Synchronous Early Inject with localStorage Cache
(function () {
    'use strict';

    // Check if extension is enabled (from localStorage cache)
    try {
        const settings = localStorage.getItem('canvas_privacy_settings');
        if (settings) {
            const data = JSON.parse(settings);
            if (data.extensionEnabled === false) {
                console.log('[Canvas Privacy] Extension is disabled, skipping protection');
                return; // Exit immediately if extension is disabled
            }
        }
    } catch (e) {
        // If we can't read settings, assume enabled
    }


    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname;
    const fullUrl = window.location.href;

    // Check if this is a Canvas site (synchronous)
    function isCanvasSite() {
        return hostname.includes('canvas') ||
            hostname.includes('instructure') ||
            hostname.includes('canvaslms');
    }

    // Check if URL matches pattern (synchronous)
    function matchesPattern(url, pattern) {
        try {
            const urlObj = new URL(url);
            const host = urlObj.hostname;
            const path = urlObj.pathname;

            if (pattern === '*') return true;
            if (pattern === 'localhost' && (host === 'localhost' || host === '127.0.0.1')) return true;
            if (pattern.endsWith('.html') || pattern.endsWith('.htm')) {
                return path.includes(pattern) || url.includes(pattern);
            }
            if (pattern.startsWith('*.')) {
                const domain = pattern.substring(2);
                return host.endsWith(domain) || host === domain;
            }
            return host === pattern || host === 'www.' + pattern || host.endsWith('.' + pattern);
        } catch (e) {
            return false;
        }
    }

    // Check custom sites from localStorage cache (synchronous!)
    function matchesCustomSite() {
        try {
            const cached = localStorage.getItem('canvas_privacy_sites');
            if (!cached) {
                return false;
            }

            const data = JSON.parse(cached);
            const customSites = data.sites || [];

            // Check if cache is still fresh (24 hours)
            const cacheAge = Date.now() - data.timestamp;
            if (cacheAge > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('canvas_privacy_sites');
                return false;
            }

            // Check if current URL matches any custom site
            for (const pattern of customSites) {
                if (matchesPattern(fullUrl, pattern)) {
                    return true;
                }
            }
        } catch (e) {
        }
        return false;
    }

    // Determine if protection should be applied (completely synchronous!)
    const shouldProtect = isCanvasSite() || matchesCustomSite();

    if (!shouldProtect) {
        return; // Exit early - no protection needed
    }


    // Apply full protection
    function applyProtection() {
        // Override visibility properties
        const overrideProperty = (obj, prop, value) => {
            try {
                Object.defineProperty(obj, prop, {
                    get: typeof value === 'function' ? value : () => value,
                    set: () => { },
                    configurable: false
                });
            } catch (e) {
            }
        };

        overrideProperty(document, 'visibilityState', 'visible');
        overrideProperty(document, 'hidden', false);
        overrideProperty(document, 'webkitVisibilityState', 'visible');
        overrideProperty(document, 'webkitHidden', false);

        try {
            document.hasFocus = () => true;
        } catch (err) {
        }

        // Block tracking event listeners
        const realAddEventListener = EventTarget.prototype.addEventListener;
        const realRemoveEventListener = EventTarget.prototype.removeEventListener;
        const blockedEvents = [
            'visibilitychange',
            'webkitvisibilitychange',
            'blur',
            'focus',
            'pagehide',
            'pageshow',
            'mouseleave',
            'mouseout'
        ];
        let blockedCount = 0;

        EventTarget.prototype.addEventListener = function (type, listener, options) {
            if (blockedEvents.includes(type)) {
                blockedCount++;
                return;
            }
            return realAddEventListener.call(this, type, listener, options);
        };

        EventTarget.prototype.removeEventListener = function (type, listener, options) {
            if (blockedEvents.includes(type)) {
                return;
            }
            return realRemoveEventListener.call(this, type, listener, options);
        };

        // Block event properties
        blockedEvents.forEach(eventName => {
            const propertyName = 'on' + eventName;

            try {
                Object.defineProperty(window, propertyName, {
                    get: () => null,
                    set: () => {
                        return null;
                    },
                    configurable: true
                });
            } catch (e) { }

            try {
                Object.defineProperty(document, propertyName, {
                    get: () => null,
                    set: () => {
                        return null;
                    },
                    configurable: true
                });
            } catch (e) { }
        });

        // Intercept event dispatching
        const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
        EventTarget.prototype.dispatchEvent = function (event) {
            if (event && blockedEvents.includes(event.type)) {
                return true;
            }
            return originalDispatchEvent.call(this, event);
        };


        // Periodically ensure protection remains active
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            if (checkCount++ > 10) {
                clearInterval(checkInterval);
                return;
            }

            if (document.hidden !== false || document.visibilityState !== 'visible') {
                overrideProperty(document, 'visibilityState', 'visible');
                overrideProperty(document, 'hidden', false);
            }
        }, 1000);
    }

    // Apply protection immediately
    applyProtection();

    // Also listen for storage updates to refresh cache
    window.addEventListener('storage', (e) => {
        if (e.key === 'canvas_privacy_sites' && e.newValue) {
        }
    });
})();
