'use strict';

const settings = document.querySelector('#accessibility-settings');
const form = settings.querySelector('form');
const root = document.documentElement;
const storageKey = 'kksu-accessibility';
const toggles = ['bold', 'rounded', 'contrast', 'simple', 'targets', 'motion'];

function applySettings() {
    const scale = form.elements.scale.value;
    root.style.fontSize = scale + '%';
    form.querySelector('output').value = scale + '%';
    root.dataset.theme = form.elements.theme.value;
    for (const name of toggles) {
        root.classList.toggle('kksu-' + name, form.elements[name].checked);
    }
}

function saveSettings() {
    const preferences = Object.fromEntries(new FormData(form));
    try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
        // Preferences still apply to the open page when storage is unavailable.
    }
}

try {
    const preferences = JSON.parse(localStorage.getItem(storageKey));
    if (preferences && typeof preferences === 'object') {
        const scale = Number(preferences.scale);
        if (Number.isInteger(scale) && scale >= 80 && scale <= 200 && scale % 10 === 0) {
            form.elements.scale.value = scale;
        }
        if (['system', 'light', 'dark'].includes(preferences.theme)) {
            form.elements.theme.value = preferences.theme;
        }
        for (const name of toggles) {
            form.elements[name].checked = preferences[name] === 'on';
        }
    }
} catch {
    // Use the form defaults if preferences cannot be restored.
}

form.addEventListener('input', () => {
    applySettings();
    saveSettings();
});
form.addEventListener('reset', () => {
    setTimeout(() => {
        applySettings();
        saveSettings();
    }, 0);
});
applySettings();
settings.hidden = false;
