// Background script with localStorage cache management

// Update cache in all tabs when custom sites or settings change
async function updateCacheInAllTabs() {
    const result = await chrome.storage.sync.get(['customSites', 'extensionEnabled']);
    const customSites = result.customSites || [];
    const extensionEnabled = result.extensionEnabled !== false; // Default to enabled

    // Get all tabs
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;

        // Skip chrome:// and other restricted URLs
        if (tab.url.startsWith('chrome://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('chrome-extension://')) {
            continue;
        }

        try {
            // Inject the cache update script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (sites, enabled) => {
                    try {
                        // Update custom sites cache
                        localStorage.setItem('canvas_privacy_sites', JSON.stringify({
                            sites: sites,
                            timestamp: Date.now()
                        }));

                        // Update settings cache (including enabled state)
                        localStorage.setItem('canvas_privacy_settings', JSON.stringify({
                            extensionEnabled: enabled,
                            timestamp: Date.now()
                        }));
                    } catch (e) {
                    }
                },
                args: [customSites, extensionEnabled],
                world: 'MAIN'
            });
        } catch (e) {
            // Ignore injection errors for restricted pages
        }
    }

}

// Check if URL is a Canvas site
function isCanvasSite(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname.includes('canvas') ||
            hostname.includes('instructure') ||
            hostname.includes('canvaslms');
    } catch {
        return false;
    }
}

// Check if URL is Google Docs/Slides
function isGoogleDocsSite(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        return hostname === 'docs.google.com' || hostname === 'slides.google.com';
    } catch {
        return false;
    }
}

// Check if URL matches custom sites
async function matchesCustomSite(url) {
    if (!url) return false;

    const result = await chrome.storage.sync.get(['customSites']);
    const customSites = result.customSites || [];

    for (const site of customSites) {
        if (matchesPattern(url, site)) {
            return true;
        }
    }
    return false;
}

// Helper function to match patterns
function matchesPattern(url, pattern) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;

        if (pattern === '*') return true;
        if (pattern === 'localhost' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true;
        if (pattern.endsWith('.html') || pattern.endsWith('.htm')) {
            return pathname.includes(pattern) || url.includes(pattern);
        }
        if (pattern.startsWith('*.')) {
            const domain = pattern.substring(2);
            return hostname.endsWith(domain) || hostname === domain;
        }
        return hostname === pattern || hostname === 'www.' + pattern || hostname.endsWith('.' + pattern);
    } catch (e) {
        return false;
    }
}

// Check if URL should have protection active
async function isProtectedSite(url) {
    if (!url) return false;

    // Check if extension is enabled
    const result = await chrome.storage.sync.get(['extensionEnabled']);
    if (result.extensionEnabled === false) {
        return false; // Extension is disabled
    }

    const isCanvas = isCanvasSite(url);
    const isGoogle = isGoogleDocsSite(url);
    const customMatch = await matchesCustomSite(url);

    return isCanvas || isGoogle || customMatch;
}

// Inject Google warning script
async function injectGoogleWarning(tabId) {
    try {
        // Check if extension is enabled
        const result = await chrome.storage.sync.get(['extensionEnabled']);
        if (result.extensionEnabled === false) {
            return; // Don't inject if disabled
        }

        await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: false },
            files: ['google-warning.js']
        });
    } catch (e) {
    }
}

// Update badge for a specific tab
async function updateBadgeForTab(tabId, url) {
    try {
        const isProtected = await isProtectedSite(url);

        if (isProtected) {
            chrome.action.setBadgeText({
                text: ' ',
                tabId: tabId
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#4CAF50',
                tabId: tabId
            });
        } else {
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    } catch (e) {
        console.error('Error updating badge:', e);
    }
}

// Ensure cache is fresh in a specific tab
async function ensureCacheInTab(tabId) {
    const result = await chrome.storage.sync.get(['customSites', 'extensionEnabled']);
    const customSites = result.customSites || [];
    const extensionEnabled = result.extensionEnabled !== false;

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (sites, enabled) => {
                try {
                    // Check if cache exists and is fresh
                    const cached = localStorage.getItem('canvas_privacy_sites');
                    const settingsCached = localStorage.getItem('canvas_privacy_settings');

                    if (cached && settingsCached) {
                        const data = JSON.parse(cached);
                        const settingsData = JSON.parse(settingsCached);
                        // If cache is recent (less than 1 minute old) and has same data, skip update
                        if (Date.now() - data.timestamp < 60000 &&
                            Date.now() - settingsData.timestamp < 60000 &&
                            JSON.stringify(data.sites) === JSON.stringify(sites) &&
                            settingsData.extensionEnabled === enabled) {
                            return;
                        }
                    }

                    // Update cache
                    localStorage.setItem('canvas_privacy_sites', JSON.stringify({
                        sites: sites,
                        timestamp: Date.now()
                    }));

                    localStorage.setItem('canvas_privacy_settings', JSON.stringify({
                        extensionEnabled: enabled,
                        timestamp: Date.now()
                    }));

                } catch (e) {
                    console.error('[Canvas Privacy] Failed to ensure cache:', e);
                }
            },
            args: [customSites, extensionEnabled],
            world: 'MAIN'
        });
    } catch (e) {
        // Ignore for restricted pages
    }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url) return;

    // When URL changes, ensure cache is fresh before page loads
    if (changeInfo.url) {
        await ensureCacheInTab(tabId);
        await updateBadgeForTab(tabId, tab.url);
    }

    // Update badge and inject Google warning if needed
    if (changeInfo.status === 'complete') {
        await updateBadgeForTab(tabId, tab.url);

        if (isGoogleDocsSite(tab.url)) {
            await injectGoogleWarning(tabId);
        }
    }
});

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            await updateBadgeForTab(tab.id, tab.url);
            // Ensure cache is fresh when switching tabs
            await ensureCacheInTab(tab.id);
        }
    } catch (e) {
        console.error('Error on tab activation:', e);
    }
});

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Open welcome page on first install
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });

        // Set default settings
        chrome.storage.sync.set({
            hasDisabledGoogleTracking: false,
            customSites: [],
            extensionEnabled: true // Default to enabled
        });
    }

    // Update cache in all tabs on install/update
    await updateCacheInAllTabs();

    // Update all existing tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.id && tab.url) {
            await updateBadgeForTab(tab.id, tab.url);
        }
    }
});

// Handle startup
chrome.runtime.onStartup.addListener(async () => {
    // Update cache in all tabs on browser startup
    await updateCacheInAllTabs();

    // Update all existing tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.id && tab.url) {
            await updateBadgeForTab(tab.id, tab.url);
        }
    }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openGoogleSettings') {
        chrome.tabs.create({
            url: 'https://myaccount.google.com/activitycontrols/docsactivity'
        });
    } else if (request.action === 'openWelcomePage') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html#google-instructions')
        });
    } else if (request.action === 'updateProtection') {
        // Update cache in all tabs when settings change
        updateCacheInAllTabs().then(() => {
            // Re-check all tabs
            chrome.tabs.query({}, async (tabs) => {
                for (const tab of tabs) {
                    if (tab.id && tab.url) {
                        await updateBadgeForTab(tab.id, tab.url);
                    }
                }
            });
        });
    } else if (request.action === 'toggleExtension') {
        // Extension was toggled on/off
        chrome.storage.sync.set({ extensionEnabled: request.enabled }, () => {
            // Update cache in all tabs
            updateCacheInAllTabs().then(() => {
                // Update badges
                chrome.tabs.query({}, async (tabs) => {
                    for (const tab of tabs) {
                        if (tab.id && tab.url) {
                            await updateBadgeForTab(tab.id, tab.url);
                        }
                    }
                });
            });
        });
    } else if (request.action === 'checkIfProtected' && request.url) {
        isProtectedSite(request.url).then(isProtected => {
            sendResponse({ isProtected: isProtected });
        });
        return true; // Keep the message channel open for async response
    }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.customSites || changes.extensionEnabled) {
        // Update cache in all tabs when custom sites or enabled state changes
        updateCacheInAllTabs();
    }
});
