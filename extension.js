/* extension.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {WindowPreview} from 'resource:///org/gnome/shell/ui/windowPreview.js';
import {ControlsManager} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import Meta from 'gi://Meta';

export default class FocusUnderCursorExtension extends Extension {
    #injectionManager;
    #hoveredWindow;
    #hoveredWindowId;
    #isGesturing;

    enable() {
        this.#injectionManager = new InjectionManager();
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
        this.#isGesturing = false;

        this.#patchOverview();
    }

    disable() {
        this.#injectionManager?.clear();
        this.#injectionManager = null;
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
        this.#isGesturing = false;
    }

    #patchOverview() {
        const self = this;

        // Track which WindowPreview the cursor hovers over
        this.#injectionManager.overrideMethod(
            WindowPreview.prototype,
            'vfunc_enter_event',
            original =>
                function () {
                    if (!self.#isGesturing && this.metaWindow) {
                        self.#hoveredWindow = this.metaWindow;
                        self.#hoveredWindowId = this.metaWindow.get_id();
                    }
                    return original.apply(this, arguments);
                }
        );

        // Clear tracked window when cursor leaves the preview
        this.#injectionManager.overrideMethod(
            WindowPreview.prototype,
            'vfunc_leave_event',
            original =>
                function () {
                    if (!self.#isGesturing &&
                        this.metaWindow?.get_id() === self.#hoveredWindowId) {
                        self.#hoveredWindow = null;
                        self.#hoveredWindowId = null;
                    }
                    return original.apply(this, arguments);
                }
        );

        // Activate hovered/fallback window before overview exits
        this.#injectionManager.overrideMethod(
            ControlsManager.prototype,
            'prepareToLeaveOverview',
            original =>
                function () {
                    self.#focusWindowUnderCursor();
                    return original.apply(this, arguments);
                }
        );

        // Track gesture state so hover tracking doesn't fight with gestures
        this.#injectionManager.overrideMethod(
            ControlsManager.prototype,
            'gestureBegin',
            original =>
                function () {
                    self.#isGesturing = true;
                    return original.apply(this, arguments);
                }
        );

        this.#injectionManager.overrideMethod(
            ControlsManager.prototype,
            'gestureEnd',
            original =>
                function () {
                    self.#isGesturing = false;
                    return original.apply(this, arguments);
                }
        );
    }

    #focusWindowUnderCursor() {
        // 1. Use hover-tracked window from overview previews
        if (this.#hoveredWindow) {
            this.#activateWindow(this.#hoveredWindow);
            this.#hoveredWindow = null;
            this.#hoveredWindowId = null;
            return;
        }

        // 2. Fall back: find the real window at the cursor's screen position
        const [x, y] = global.get_pointer();
        const window = this.#findWindowAtPosition(x, y);
        if (window) {
            this.#activateWindow(window);
        }

        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
    }

    #findWindowAtPosition(x, y) {
        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();
        const windows = global.display.sort_windows_by_stacking(
            global.display.get_tab_list(
                Meta.TabList.NORMALS,
                activeWorkspace
            )
        );

        // Iterate topmost-first
        for (let i = windows.length - 1; i >= 0; i--) {
            const win = windows[i];
            if (!win.showing_on_its_workspace())
                continue;
            if (win.is_skip_taskbar())
                continue;

            const rect = win.get_frame_rect();
            if (x >= rect.x && x < rect.x + rect.width &&
                y >= rect.y && y < rect.y + rect.height) {
                return win;
            }
        }

        return null;
    }

    #activateWindow(window) {
        try {
            window.activate(global.get_current_time());
        } catch (e) {
            console.error(`Focus Under Cursor: failed to activate window: ${e.message}`);
        }
    }
}
