/* prefs.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import * as FileSettings from './settings.js';

export default class FocusUnderCursorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Read current setting
        const fallbackEnabled = FileSettings.getSetting('use-position-fallback');

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic'
        });

        const group = new Adw.PreferencesGroup({
            title: 'Focus Behavior'
        });

        const row = new Adw.SwitchRow({
            title: 'Focus window under cursor when no preview was hovered',
            subtitle: 'When disabled, focus remains on the previously focused window unless a window preview was hovered in the overview',
            active: fallbackEnabled
        });

        // Connect to changes and save immediately
        row.connect('notify::active', () => {
            const newValue = row.get_active();
            const success = FileSettings.setSetting('use-position-fallback', newValue);
            if (success) {
                console.log(`[FocusUnderCursor] Setting updated: use-position-fallback = ${newValue}`);
            }
        });

        group.add(row);
        page.add(group);
        window.add(page);
    }
}
