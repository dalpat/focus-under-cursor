#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Focus Under Cursor — Dev Testing Script
# ═══════════════════════════════════════════════════════════
# Run from a regular terminal (not IDE terminal).
#
# Usage:
#   ./dev.sh              (default 1920x1080)
#   ./dev.sh 1280x720     (custom resolution)
#
# SAFETY: this script deploys a *copy* of the source into the
# GNOME extensions dir — it NEVER symlinks the repo there.
# A symlink lets GNOME's "remove/uninstall extension" recurse
# straight into this repo and wipe .git (that's what kept
# nuking your git history). A copy is disposable; the repo is
# never reachable from the extensions folder.
# ═══════════════════════════════════════════════════════════

set -euo pipefail

EXT_UUID="focus-under-cursor@extension"
# Derive the repo dir from this script's location — not hardcoded,
# so it works no matter what the folder is named.
EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
RESOLUTION="${1:-1920x1080}"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Focus Under Cursor — Dev Launch    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ── Guard: make sure git is healthy before we touch anything ──
if [ -d "$EXT_DIR/.git" ]; then
    if ! git -C "$EXT_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
        echo "⚠️  WARNING: git HEAD is unborn/broken in this repo."
        echo "    Your history may have been damaged. Fix git before deploying."
        exit 1
    fi
else
    echo "⚠️  WARNING: no .git directory found here — refusing to run."
    echo "    Something may have deleted it. Aborting to be safe."
    exit 1
fi

# ── Deploy: COPY only, never symlink ──
# If an old dangerous symlink exists, remove just the link (no
# trailing slash → does NOT follow into the repo).
if [ -L "$DEST" ]; then
    echo "🧹 Removing old (dangerous) symlink deploy..."
    rm "$DEST"
fi

echo "📦 Deploying a fresh copy → $DEST"
mkdir -p "$DEST"
if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
        --exclude='.git' \
        --exclude='.github' \
        --exclude='node_modules' \
        --exclude='docs' \
        --exclude='*.sh' \
        "$EXT_DIR"/ "$DEST"/
else
    # Fallback without rsync: wipe contents and copy (still excludes dotfiles via glob)
    rm -rf "${DEST:?}"/*
    cp -r "$EXT_DIR"/* "$DEST"/ 2>/dev/null || true
fi
echo "✅ Copy deployed (repo is NOT reachable from the extensions dir)."

# ── Compile schemas (in the deployed copy) ──
if [ -d "$DEST/schemas" ]; then
    echo "🔧 Compiling schemas..."
    glib-compile-schemas "$DEST/schemas/" 2>/dev/null || true
fi

echo ""
echo "🚀 Launching nested GNOME Shell ($RESOLUTION)..."
echo ""
echo "   Inside the nested window:"
echo "   → gnome-extensions enable $EXT_UUID"
echo ""
echo "   Close the window when done."
echo "   Edit code → run ./dev.sh again (it re-copies)."
echo ""
echo "📋 Logs:"
echo "─────────────────────────────────────────────────"

MUTTER_DEBUG_DUMMY_MODE_SPECS="$RESOLUTION" \
SHELL_DEBUG=backtrace-warnings \
  dbus-run-session -- gnome-shell --devkit

echo ""
echo "✅ Done. Edit code → run ./dev.sh again."
