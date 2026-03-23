# Focus Under Cursor on Overview Exit

A GNOME Shell extension that focuses the window under the cursor when exiting the overview — like macOS Mission Control.

## Behavior

By default, GNOME always returns focus to the previously focused window when exiting the overview, regardless of where your cursor is. This extension changes that:

1. **Hover tracking** — If your cursor is over a window thumbnail in the overview, that window gets focus on exit.
2. **Position fallback** — If your cursor isn't over any thumbnail (e.g., empty space), the extension finds the real window at your cursor's screen position and focuses it.

Touchpad gestures are handled safely so hover tracking doesn't fight with gesture-based navigation.

## Installation

### From extensions.gnome.org

Coming soon.

### Manual

```bash
git clone https://github.com/dalpat/focus-under-cursor.git
cd focus-under-cursor
mkdir -p ~/.local/share/gnome-shell/extensions/focus-under-cursor@extension
cp extension.js metadata.json ~/.local/share/gnome-shell/extensions/focus-under-cursor@extension/
```

Then enable:

```bash
gnome-extensions enable focus-under-cursor@extension
```

On Wayland, you need to log out and log back in for GNOME Shell to discover the extension.

## Compatibility

| GNOME Shell | Status |
|---|---|
| 45 | ✅ |
| 46 | ✅ |
| 47 | ✅ |
| 48 | ✅ |
| 49 | ✅ |

## License

GPL-2.0-or-later
