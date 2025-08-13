// Google Docs/Slides Warning Script
// This script warns about document owner view tracking

(function () {
  'use strict';

  // Check if this is an actual document page (not the main page)
  const isDocumentPage = window.location.pathname.includes('/d/');

  if (!isDocumentPage) {
    // Don't show warnings on main pages
    return;
  }

  // Check if user has disabled tracking (which means don't show warnings)
  chrome.storage.sync.get(['hasDisabledGoogleTracking'], function (result) {
    // Show banner if user has NOT disabled tracking (checkbox unchecked)
    if (result.hasDisabledGoogleTracking !== true) {
      setTimeout(() => {
        createWarningBanner();
      }, 1500);
    }
  });

  // Listen for storage changes to show/hide banner
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.hasDisabledGoogleTracking) {
      if (changes.hasDisabledGoogleTracking.newValue === true) {
        // Remove banner if user confirms they disabled tracking
        const banner = document.getElementById('privacy-warning-banner');
        if (banner) banner.remove();
      } else if (changes.hasDisabledGoogleTracking.newValue === false) {
        // Show banner if user unchecks
        const banner = document.getElementById('privacy-warning-banner');
        if (!banner) {
          createWarningBanner();
        }
      }
    }
  });

  // Create warning banner
  function createWarningBanner() {
    // Remove existing banner if any
    const existing = document.getElementById('privacy-warning-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'privacy-warning-banner';
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 400px;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <strong>⚠️ Document Owner Can Track Your Views</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">
            The owner of this document can see when you view this file unless you disable view history in Google Account settings.
          </p>
          <button id="disable-tracking-btn" style="
            margin-top: 8px;
            background: white;
            color: #ff4444;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
          ">How to Disable View History</button>
        </div>
        <span id="close-banner" style="font-size: 20px; margin-left: 10px; cursor: pointer;">&times;</span>
      </div>
    `;

    document.body.appendChild(banner);

    // Event handlers
    document.getElementById('disable-tracking-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      // Open the welcome page
      chrome.runtime.sendMessage({ action: 'openWelcomePage' });
    });

    document.getElementById('close-banner').addEventListener('click', function (e) {
      e.stopPropagation();
      banner.style.transform = 'translateX(500px)';
      setTimeout(() => banner.remove(), 300);
    });
  }
})();
