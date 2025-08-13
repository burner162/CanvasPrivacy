// Popup script for managing extension settings

document.addEventListener('DOMContentLoaded', function () {
  // Load saved settings
  loadSettings();

  // Check current site
  checkCurrentSite();

  // Handle extension on/off toggle
  document.getElementById('extensionEnabled').addEventListener('change', function () {
    const isEnabled = this.checked;
    chrome.storage.sync.set({
      extensionEnabled: isEnabled
    }, () => {
      // Update UI
      updatePowerUI(isEnabled);

      // Notify background script to update all tabs
      chrome.runtime.sendMessage({ action: 'toggleExtension', enabled: isEnabled });
    });
  });

  // Save tracking disabled confirmation
  document.getElementById('hasDisabledTracking').addEventListener('change', function () {
    const isChecked = this.checked;
    chrome.storage.sync.set({
      hasDisabledGoogleTracking: isChecked
    });
  });

  // Open instructions
  document.getElementById('openInstructions').addEventListener('click', function () {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html#google-instructions')
    });
    window.close();
  });

  // Add custom site
  document.getElementById('addSiteBtn').addEventListener('click', function () {
    addCustomSite();
  });
  document.getElementById('newSiteInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addCustomSite();
    }
  });
});

function loadSettings() {
  chrome.storage.sync.get(['extensionEnabled', 'hasDisabledGoogleTracking', 'customSites'], function (result) {
    // Load extension enabled state (default to true)
    const isEnabled = result.extensionEnabled !== false; // Default to enabled
    document.getElementById('extensionEnabled').checked = isEnabled;
    updatePowerUI(isEnabled);

    // Load Google tracking setting
    document.getElementById('hasDisabledTracking').checked = result.hasDisabledGoogleTracking || false;

    // Load custom sites
    const customSites = result.customSites || [];
    updateCustomSitesList(customSites);
  });
}

function updatePowerUI(isEnabled) {
  const powerStatus = document.getElementById('powerStatus');
  const canvasIndicator = document.getElementById('canvasIndicator');
  const customIndicator = document.getElementById('customIndicator');
  const canvasStatus = document.getElementById('canvasStatus');

  if (isEnabled) {
    powerStatus.textContent = 'Extension Enabled Globally (click to toggle)';
    powerStatus.style.color = '#000000';

    // Green check mark
    if (canvasIndicator) {
      canvasIndicator.textContent = '✓';
      canvasIndicator.style.color = '#4CAF50';
    }
    if (customIndicator) {
      customIndicator.textContent = '✓';
      customIndicator.style.color = '#4CAF50';
    }
    canvasStatus.textContent = 'Canvas tracking blocked';
  } else {
    powerStatus.textContent = 'Extension Disabled Globally (click to toggle)';
    powerStatus.style.color = '#000000';

    // Red X
    if (canvasIndicator) {
      canvasIndicator.textContent = '✗';
      canvasIndicator.style.color = '#d32f2f';
    }
    if (customIndicator) {
      customIndicator.textContent = '✗';
      customIndicator.style.color = '#d32f2f';
    }
    canvasStatus.textContent = 'Canvas tracking blocked';
  }

  // Disable/enable other inputs (your existing logic)
  const inputs = document.querySelectorAll('input:not(#extensionEnabled), button');
  inputs.forEach(input => {
    input.disabled = !isEnabled;
    if (!isEnabled) {
      input.style.opacity = '0.5';
      input.style.cursor = 'not-allowed';
    } else {
      input.style.opacity = '1';
      input.style.cursor = input.tagName === 'BUTTON' ? 'pointer' : 'auto';
    }
  });
}


function reloadAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      // Skip chrome:// and other system pages
      if (tab.url && !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') &&
        !tab.url.startsWith('chrome-extension://')) {
        chrome.tabs.reload(tab.id);
      }
    });
  });
  window.close();
}

function addCustomSite() {
  const input = document.getElementById('newSiteInput');
  const site = input.value.trim();
  const errorEl = document.getElementById('siteError');

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (!site) return;

  // Basic validation
  if (!isValidPattern(site)) {
    errorEl.textContent = 'Please enter a valid domain (e.g., example.com or *.example.com)';
    errorEl.style.display = 'block';
    return;
  }

  // Check if already exists
  chrome.storage.sync.get(['customSites'], function (result) {
    const customSites = result.customSites || [];

    if (customSites.includes(site)) {
      alert('This site is already in your list');
      return;
    }

    // Add the site
    customSites.push(site);
    chrome.storage.sync.set({ customSites }, function () {
      // Update UI
      updateCustomSitesList(customSites);
      input.value = '';

      // Notify background script to update protection
      chrome.runtime.sendMessage({ action: 'updateProtection' });
    });
  });
}

function removeSite(site) {
  chrome.storage.sync.get(['customSites'], function (result) {
    const customSites = result.customSites || [];
    const index = customSites.indexOf(site);

    if (index > -1) {
      customSites.splice(index, 1);
      chrome.storage.sync.set({ customSites }, function () {
        updateCustomSitesList(customSites);

        // Notify background script to update protection
        chrome.runtime.sendMessage({ action: 'updateProtection' });
      });
    }
  });
}

function updateCustomSitesList(sites) {
  const listContainer = document.getElementById('customSitesList');
  const statusDiv = document.getElementById('customSitesStatus');
  const countSpan = document.getElementById('customSitesCount');

  if (!listContainer) return;

  if (sites.length === 0) {
    listContainer.innerHTML = '<p class="no-sites">No custom sites added yet</p>';
    if (statusDiv) statusDiv.style.display = 'none';
  } else {
    if (statusDiv) {
      statusDiv.style.display = 'block';
      if (countSpan) {
        countSpan.textContent = `${sites.length} custom site${sites.length !== 1 ? 's' : ''} protected`;
      }
    }

    listContainer.innerHTML = sites.map(site => `
      <div class="custom-site-item">
        <span>${site}</span>
        <button class="remove-btn" data-site="${site}">×</button>
      </div>
    `).join('');

    // Add remove handlers
    listContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        removeSite(this.getAttribute('data-site'));
      });
    });
  }
}

function isValidPattern(pattern) {
  // Allow domain patterns like example.com or *.example.com
  const domainRegex = /^(\*\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

  // Also allow some special patterns
  if (pattern === '*') return true; // Allow wildcard for all sites
  if (pattern === 'localhost') return true; // Allow localhost
  if (pattern.endsWith('.html') || pattern.endsWith('.htm')) return true; // Allow HTML filenames
  if (pattern.includes('file://')) return false; // Don't allow file:// protocols

  return domainRegex.test(pattern);
}

// Check if current site can be added
async function checkCurrentSite() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url) return;

    const url = new URL(activeTab.url);
    const hostname = url.hostname;

    // Don't show button for chrome:// or other special URLs
    if (!hostname || url.protocol === 'chrome:' || url.protocol === 'edge:' ||
      url.protocol === 'about:' || url.protocol === 'chrome-extension:') {
      return;
    }

    // Check if already protected (Canvas, Google Docs, or custom site)
    const result = await chrome.storage.sync.get(['customSites']);
    const customSites = result.customSites || [];

    // Check if it's already a Canvas or Google Docs site
    const isCanvas = hostname.includes('canvas') ||
      hostname.includes('instructure') ||
      hostname.includes('canvaslms');
    const isGoogleDocs = hostname === 'docs.google.com' || hostname === 'slides.google.com';

    // Check if already in custom sites
    const alreadyAdded = customSites.some(site => {
      if (site.startsWith('*.')) {
        const domain = site.substring(2);
        return hostname.endsWith(domain) || hostname === domain;
      } else {
        return hostname === site || hostname === 'www.' + site || hostname.endsWith('.' + site);
      }
    });

    // Show add current site section
    const currentSiteSection = document.createElement('div');
    currentSiteSection.className = 'current-site-section';
    currentSiteSection.style.cssText = `
      margin-bottom: 15px;
      padding: 12px;
      background: #f0f7ff;
      border-radius: 6px;
      border: 1px solid #d0e3ff;
    `;

    if (isCanvas || isGoogleDocs || alreadyAdded) {
      currentSiteSection.innerHTML = `
        <div style="font-size: 13px; color: #4CAF50; display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">✓</span>
          <span>This site is protected${isCanvas ? ' (Canvas site)' : isGoogleDocs ? ' (Google Docs/Slides)' : ''}</span>
        </div>
      `;
    } else {
      currentSiteSection.innerHTML = `
        <div style="font-size: 13px; color: #333; margin-bottom: 8px;">Current site: <strong>${hostname}</strong></div>
        <button id="addCurrentSiteBtn" style="
          width: 100%;
          padding: 8px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">Add This Site to Protection</button>
      `;
    }

    // Insert after the h3 "Custom Websites" heading
    const customSitesSection = document.getElementById('custom-sites-section');
    if (!customSitesSection) {
      console.error('Could not find custom sites section');
      return;
    }

    // Find the h3 element and insert after it
    const h3Element = customSitesSection.querySelector('h3');
    if (h3Element && h3Element.nextSibling) {
      h3Element.parentNode.insertBefore(currentSiteSection, h3Element.nextSibling);
    } else {
      // Fallback: insert at the beginning of the section
      customSitesSection.insertBefore(currentSiteSection, customSitesSection.firstChild);
    }

    // Add event listener if button exists
    if (!isCanvas && !isGoogleDocs && !alreadyAdded) {
      document.getElementById('addCurrentSiteBtn').addEventListener('click', function () {
        addCurrentSite();
      });
    }

  } catch (error) {
    console.error('Error checking current site:', error);
  }
}

// Add current site to custom sites
async function addCurrentSite() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url) return;

    const url = new URL(activeTab.url);
    const hostname = url.hostname;

    // Remove www. if present for cleaner entries
    const site = hostname.startsWith('www.') ? hostname.substring(4) : hostname;

    // Add to custom sites
    chrome.storage.sync.get(['customSites'], function (result) {
      const customSites = result.customSites || [];

      if (!customSites.includes(site)) {
        customSites.push(site);
        chrome.storage.sync.set({ customSites }, function () {
          // Update UI
          updateCustomSitesList(customSites);

          // Update the current site section to show it's now protected
          checkCurrentSite();

          // Notify background script to update protection
          chrome.runtime.sendMessage({ action: 'updateProtection' });
        });
      }
    });
  } catch (error) {
    console.error('Error adding current site:', error);
  }
}
