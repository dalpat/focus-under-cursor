/* extension.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {WindowPreview} from 'resource:///org/gnome/shell/ui/windowPreview.js';
import {ControlsManager} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import * as Config from './config.js';

export default class FocusUnderCursorExtension extends Extension {
    #injectionManager;
    #hoveredWindow;
    #hoveredWindowId;
    #isGesturing;
    #windowToFocus;
    #lastPointerX;
    #lastPointerY;

    enable() {
        this.#injectionManager = new InjectionManager();
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
        this.#isGesturing = false;
        this.#windowToFocus = null;

        this.#patchOverview();

        Main.overview.connectObject(
            'showing', () => {
                [this.#lastPointerX, this.#lastPointerY] = global.get_pointer();
            },
            'hiding', () => {
                this.#captureWindowForFocus();
                if (this.#windowToFocus) {
                    this.#activateWindow(this.#windowToFocus);
                    this.#windowToFocus = null;
                }
            },
            this
        );
    }

    disable() {
        Main.overview.disconnectObject(this);
        this.#injectionManager?.clear();
        this.#injectionManager = null;
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
        this.#isGesturing = false;
        this.#windowToFocus = null;
        this.#lastPointerX = null;
        this.#lastPointerY = null;
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

    #captureWindowForFocus() {
        const [currentX, currentY] = global.get_pointer();
        const pointerMoved = (currentX !== this.#lastPointerX || currentY !== this.#lastPointerY);
        
        // Read config fresh each time (no caching)
        const focusWithoutMovement = Config.getConfigValue('use-position-fallback');

        // If pointer hasn't moved and setting is OFF, don't change focus (issue #2)
        if (!pointerMoved && !focusWithoutMovement) {
            this.#windowToFocus = null;
            this.#hoveredWindow = null;
            this.#hoveredWindowId = null;
            return;
        }

        // 1. Use hover-tracked window from overview previews
        if (this.#hoveredWindow) {
            this.#windowToFocus = this.#hoveredWindow;
            this.#hoveredWindow = null;
            this.#hoveredWindowId = null;
            return;
        }

        // 2. Fall back: find the real window at the cursor's screen position
        if (focusWithoutMovement) {
            this.#windowToFocus = this.#findWindowAtPosition(currentX, currentY);
        } else {
            this.#windowToFocus = null;
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
