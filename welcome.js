// Welcome page script

document.addEventListener('DOMContentLoaded', function () {
    // Load saved confirmation state
    chrome.storage.sync.get(['hasDisabledGoogleTracking'], function (result) {
        if (result.hasDisabledGoogleTracking) {
            document.getElementById('confirmDisabled').checked = true;
            document.getElementById('confirmMessage').style.display = 'block';
        }
    });

    // Handle confirmation checkbox - this also disables warnings
    document.getElementById('confirmDisabled').addEventListener('change', function () {
        const isChecked = this.checked;
        chrome.storage.sync.set({
            hasDisabledGoogleTracking: isChecked,
            googleWarningEnabled: !isChecked  // Warnings disabled when checked
        });

        if (isChecked) {
            document.getElementById('confirmMessage').style.display = 'block';
        } else {
            document.getElementById('confirmMessage').style.display = 'none';
        }
    });

    // Close welcome tab
    document.getElementById('closeWelcome').addEventListener('click', function () {
        window.close();
    });
});
