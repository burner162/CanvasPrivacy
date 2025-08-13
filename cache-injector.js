// Cache Injector - Injects custom sites list into localStorage for synchronous access
// This script is injected by the background script when custom sites change

(function () {
    // Receive custom sites from background script and store in localStorage
    const customSites = CUSTOM_SITES_PLACEHOLDER;

    try {
        // Store in localStorage with a timestamp
        localStorage.setItem('canvas_privacy_sites', JSON.stringify({
            sites: customSites,
            timestamp: Date.now()
        }));
    } catch (e) {

    }
})();
