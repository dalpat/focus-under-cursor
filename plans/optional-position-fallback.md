# Plan: Optional Position Fallback

> Source PRD: GitHub issues #1 and #2 by F-i-f

## Architectural decisions

Durable decisions that apply across all phases:

- **Extension type:** GNOME Shell Extension (JavaScript, GObject, GSettings)
- **Settings backend:** GSettings via `gschema.xml`
- **Preferences UI toolkit:** libadwaita (`Adw.SwitchRow` or equivalent)
- **Default behavior:** `use-position-fallback` defaults to `true` to preserve backward compatibility
- **Key setting:** `use-position-fallback` (boolean) controls whether `#captureWindowForFocus()` falls back to `#findWindowAtPosition()` when no window preview was hovered

---

## Phase 1: GSettings Schema + Logic Wiring

**User stories:**
- Issue #1 — Position fallback should be optional
- Issue #2 — Do not change the focus if the pointer does not move (addressed when fallback is disabled)

### What to build

A complete vertical slice that makes the fallback behavior configurable end-to-end via GSettings, without a GUI yet.

1. Create `schemas/org.gnome.shell.extensions.focus-under-cursor.gschema.xml` with a `use-position-fallback` boolean key (default `true`).
2. Wire `Gio.Settings` into `extension.js`:
   - Initialize in `enable()`
   - Clean up in `disable()`
3. Refactor `#captureWindowForFocus()` to check the setting:
   - If `true`, run existing fallback logic
   - If `false`, skip fallback and set `this.#windowToFocus = null`
4. Compile the schema (`glib-compile-schemas schemas/`).
5. Verify by toggling the key via `gsettings set ...` and observing behavior in GNOME Shell.

### Acceptance criteria

- [x] Schema exists and compiles without errors
- [x] Extension reads the setting on `enable()`
- [x] When `use-position-fallback` is `false`, `#captureWindowForFocus()` skips the fallback and `this.#windowToFocus` is `null`
- [x] When `use-position-fallback` is `true`, behavior is identical to current logic
- [x] No JS errors in Looking Glass or `journalctl` after enabling/disabling the extension
- [x] Behavior verified via `gsettings set/get` CLI

**Estimated AI-agent time:** 3–5 minutes

---

## Phase 2: Preferences UI (Toggle Switch)

**User stories:**
- Issue #1 — Provide a user-facing preference to enable/disable the fallback

### What to build

A complete preferences window bound to the existing GSettings key.

1. Create `prefs.js` using libadwaita (`Adw.PreferencesWindow` + `Adw.SwitchRow`).
2. Bind the switch to `use-position-fallback` via `Gio.Settings.bind()`.
3. Ensure the preference shows up in GNOME Extensions app / GNOME Settings.
4. Verify that toggling the switch immediately updates the setting and the extension reacts on the next overview cycle.

### Acceptance criteria

- [x] `prefs.js` loads without errors when opening the extension preferences
- [x] Preferences window shows a labeled toggle for "Focus window under cursor when no preview was hovered" (or similar clear label)
- [x] Toggle state reflects the current GSettings value
- [x] Changing the toggle updates the GSettings key immediately
- [x] Extension behavior changes on the next overview exit without requiring a Shell restart

**Estimated AI-agent time:** 5–8 minutes
