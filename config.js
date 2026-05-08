/* config.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CONFIG_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'focus-under-cursor']);
const CONFIG_FILE = GLib.build_filenamev([CONFIG_DIR, 'config.json']);

const DEFAULT_CONFIG = {
    'use-position-fallback': true
};

export function loadConfig() {
    // Ensure directory exists
    if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.EXISTS)) {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
    }

    // Create default file if it doesn't exist
    if (!GLib.file_test(CONFIG_FILE, GLib.FileTest.EXISTS)) {
        writeConfig(DEFAULT_CONFIG);
        return {...DEFAULT_CONFIG};
    }

    try {
        const file = Gio.File.new_for_path(CONFIG_FILE);
        const [success, contents] = file.load_contents(null);
        if (success) {
            const decoder = new TextDecoder('utf-8');
            const json = decoder.decode(contents);
            const config = JSON.parse(json);
            // Merge with defaults
            return {...DEFAULT_CONFIG, ...config};
        }
    } catch (e) {
        console.error(`[FocusUnderCursor] Failed to load config: ${e.message}`);
    }

    return {...DEFAULT_CONFIG};
}

export function writeConfig(config) {
    try {
        // Ensure directory exists
        if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.EXISTS)) {
            GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
        }

        const file = Gio.File.new_for_path(CONFIG_FILE);
        const json = JSON.stringify(config, null, 2);
        const bytes = new TextEncoder().encode(json);
        
        file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        return true;
    } catch (e) {
        console.error(`[FocusUnderCursor] Failed to save config: ${e.message}`);
        return false;
    }
}

export function getConfigValue(key) {
    const config = loadConfig();
    return config[key] !== undefined ? config[key] : DEFAULT_CONFIG[key];
}

export function setConfigValue(key, value) {
    const config = loadConfig();
    config[key] = value;
    return writeConfig(config);
}
