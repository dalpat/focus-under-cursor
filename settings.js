/* settings.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SETTINGS_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'focus-under-cursor']);
const SETTINGS_FILE = GLib.build_filenamev([SETTINGS_DIR, 'settings.json']);

const DEFAULT_SETTINGS = {
    'use-position-fallback': true
};

export function getSettings() {
    // Ensure directory exists
    if (!GLib.file_test(SETTINGS_DIR, GLib.FileTest.EXISTS)) {
        GLib.mkdir_with_parents(SETTINGS_DIR, 0o755);
    }

    // Create default file if it doesn't exist
    if (!GLib.file_test(SETTINGS_FILE, GLib.FileTest.EXISTS)) {
        saveSettings(DEFAULT_SETTINGS);
        return {...DEFAULT_SETTINGS};
    }

    try {
        const file = Gio.File.new_for_path(SETTINGS_FILE);
        const [success, contents] = file.load_contents(null);
        if (success) {
            const decoder = new TextDecoder('utf-8');
            const json = decoder.decode(contents);
            const settings = JSON.parse(json);
            // Merge with defaults
            return {...DEFAULT_SETTINGS, ...settings};
        }
    } catch (e) {
        console.error(`[FocusUnderCursor] Failed to load settings: ${e.message}`);
    }

    return {...DEFAULT_SETTINGS};
}

export function saveSettings(settings) {
    try {
        // Ensure directory exists
        if (!GLib.file_test(SETTINGS_DIR, GLib.FileTest.EXISTS)) {
            GLib.mkdir_with_parents(SETTINGS_DIR, 0o755);
        }

        const file = Gio.File.new_for_path(SETTINGS_FILE);
        const json = JSON.stringify(settings, null, 2);
        const bytes = new TextEncoder().encode(json);
        
        file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        return true;
    } catch (e) {
        console.error(`[FocusUnderCursor] Failed to save settings: ${e.message}`);
        return false;
    }
}

export function getSetting(key) {
    const settings = getSettings();
    return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
}

export function setSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    return saveSettings(settings);
}
