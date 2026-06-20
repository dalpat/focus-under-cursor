/* prefs.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

export default class FocusUnderCursorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic'
        });

        const group = new Adw.PreferencesGroup({
            title: 'Focus Behavior'
        });

        const row = new Adw.SwitchRow({
            title: 'Focus window under cursor when no preview was hovered',
            subtitle: 'When disabled, focus remains on the previously focused window unless a window preview was hovered in the overview'
        });

        settings.bind(
            'use-position-fallback',
            row,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        group.add(row);
        page.add(group);
        window.add(page);
    }
}
