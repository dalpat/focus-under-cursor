/* extension.js
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {WindowPreview} from 'resource:///org/gnome/shell/ui/windowPreview.js';
import {ControlsManager} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';

export default class FocusUnderCursorExtension extends Extension {
    #injectionManager;
    #hoveredWindow;
    #hoveredWindowId;
    #isGesturing;
    #windowToFocus;
    #settings;
    #lastPointerX;
    #lastPointerY;

    enable() {
        this.#injectionManager = new InjectionManager();
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
        this.#isGesturing = false;
        this.#windowToFocus = null;
        this.#settings = this.getSettings();

        this.#patchOverview();

        Main.overview.connectObject(
            'showing', () => {
                [this.#lastPointerX, this.#lastPointerY] = global.get_pointer();
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
        this.#settings = null;
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
                    if (this.metaWindow) {
                        const [currentX, currentY] = global.get_pointer();
                        const pointerMoved =
                            currentX !== self.#lastPointerX ||
                            currentY !== self.#lastPointerY;

                        // Raise the target's z-order only (no focus) so it LEADS
                        // the overview exit flight instead of popping above the
                        // other windows mid-animation. Keyboard focus is
                        // committed once on exit (see #captureWindowForFocus),
                        // which keeps the change invisible and avoids the "flip".
                        if (self.#isGesturing || pointerMoved) {
                            self.#raiseWindow(this.metaWindow);
                            self.#hoveredWindow = this.metaWindow;
                            self.#hoveredWindowId = this.metaWindow.get_id();
                        }
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
                        self.#clearHover();
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

        // Activate the window under cursor AFTER prepareToLeaveOverview.
        // This ensures the correct window keeps focus during the exit
        // animation, fixing the "flip" where GNOME Shell briefly focuses
        // the previously focused window after we activate on 'hiding'.
        this.#injectionManager.overrideMethod(
            ControlsManager.prototype,
            'prepareToLeaveOverview',
            original =>
                function () {
                    const result = original.apply(this, arguments);
                    self.#captureWindowForFocus();
                    if (self.#windowToFocus) {
                        self.#activateWindow(self.#windowToFocus);
                        self.#windowToFocus = null;
                    }
                    return result;
                }
        );
    }

    #captureWindowForFocus() {
        // 1. A hover-/gesture-tracked preview is an explicit choice (it is only
        //    set after real pointer movement or a gesture), so honour it
        //    regardless of the position-fallback setting.
        if (this.#hoveredWindow) {
            this.#windowToFocus = this.#hoveredWindow;
            this.#clearHover();
            return;
        }

        // 2. No preview was hovered. Optionally fall back to the real window at
        //    the cursor's screen position. When the setting is OFF, leave focus
        //    on the previously focused window (issue #2: don't steal focus on a
        //    stationary peek).
        const focusWithoutMovement = this.#settings.get_boolean('use-position-fallback');
        if (focusWithoutMovement) {
            const [currentX, currentY] = global.get_pointer();
            this.#windowToFocus = this.#findWindowAtPosition(currentX, currentY);
        } else {
            this.#windowToFocus = null;
        }
        this.#clearHover();
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

    // Raise z-order only — no input focus. Cheap enough to call repeatedly as
    // the cursor crosses previews during a gesture, so the exit animation flies
    // with the correct stacking from the first frame.
    #raiseWindow(window) {
        try {
            window.raise();
        } catch (e) {
            console.error(`Focus Under Cursor: failed to raise window: ${e.message}`);
        }
    }

    #activateWindow(window) {
        try {
            window.activate(global.get_current_time());
        } catch (e) {
            console.error(`Focus Under Cursor: failed to activate window: ${e.message}`);
        }
    }

    #clearHover() {
        this.#hoveredWindow = null;
        this.#hoveredWindowId = null;
    }
}
