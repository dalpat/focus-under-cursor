#!/usr/bin/env bash
# install.sh - Install Focus Under Cursor extension for GNOME Shell 46+
# Supports both user (--user, default) and system (--system) installation

set -euo pipefail

# Extension metadata
EXT_UUID="focus-under-cursor@extension"
EXT_NAME="Focus Under Cursor on Overview Exit"
MIN_GNOME_VER=45

# Installation paths
USER_EXT_DIR="$HOME/.local/share/gnome-shell/extensions"
SYSTEM_EXT_DIR="/usr/share/gnome-shell/extensions"

# Default mode
INSTALL_MODE="user"
FORCE=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install ${EXT_NAME} for GNOME Shell.

Options:
  --user      Install for current user only (default)
  --system    Install system-wide (requires root)
  --force     Overwrite existing installation
  -h, --help  Show this help message

Examples:
  $(basename "$0")              # User install
  $(basename "$0") --system     # System install (run with sudo)
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user)
            INSTALL_MODE="user"
            shift
            ;;
        --system)
            INSTALL_MODE="system"
            shift
            ;;
        --force)
            FORCE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# Determine target directory
if [[ "$INSTALL_MODE" == "user" ]]; then
    TARGET_DIR="${USER_EXT_DIR}/${EXT_UUID}"
    MKDIR_CMD="mkdir -p"
    CP_CMD="cp"
else
    TARGET_DIR="${SYSTEM_EXT_DIR}/${EXT_UUID}"
    MKDIR_CMD="mkdir -p"
    CP_CMD="cp"

    # Check for root privileges
    if [[ "$EUID" -ne 0 ]]; then
        echo "Error: System install requires root privileges. Run with sudo." >&2
        exit 1
    fi
fi

# Check GNOME Shell version (if running in a GNOME session)
if command -v gnome-shell &>/dev/null; then
    GNOME_VER=$(gnome-shell --version 2>/dev/null | awk '{print $3}' | cut -d. -f1 || true)
    if [[ -n "$GNOME_VER" && "$GNOME_VER" =~ ^[0-9]+$ ]]; then
        if [[ "$GNOME_VER" -lt "$MIN_GNOME_VER" ]]; then
            echo "Warning: GNOME Shell ${GNOME_VER} detected. This extension requires GNOME ${MIN_GNOME_VER}+." >&2
            echo "Continuing anyway, but the extension may not work." >&2
        else
            echo "GNOME Shell ${GNOME_VER} detected."
        fi
    fi
else
    echo "Warning: gnome-shell not found in PATH. Cannot verify version compatibility." >&2
fi

# Check if already installed
if [[ -d "$TARGET_DIR" ]]; then
    if [[ "$FORCE" -eq 0 ]]; then
        echo "Error: Extension already installed at ${TARGET_DIR}" >&2
        echo "Use --force to overwrite." >&2
        exit 1
    fi
    echo "Removing existing installation..."
    rm -rf "$TARGET_DIR"
fi

# Get script directory (repository root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify required files exist
if [[ ! -f "${SCRIPT_DIR}/metadata.json" ]]; then
    echo "Error: metadata.json not found in ${SCRIPT_DIR}" >&2
    exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/extension.js" ]]; then
    echo "Error: extension.js not found in ${SCRIPT_DIR}" >&2
    exit 1
fi

# Create target directory
echo "Creating directory: ${TARGET_DIR}"
$MKDIR_CMD "$TARGET_DIR"

# Copy extension files
echo "Copying extension files..."
$CP_CMD "${SCRIPT_DIR}/extension.js" "${SCRIPT_DIR}/metadata.json" "$TARGET_DIR/"

if [[ -f "${SCRIPT_DIR}/prefs.js" ]]; then
    $CP_CMD "${SCRIPT_DIR}/prefs.js" "$TARGET_DIR/"
fi

if [[ -f "${SCRIPT_DIR}/config.js" ]]; then
    $CP_CMD "${SCRIPT_DIR}/config.js" "$TARGET_DIR/"
fi

if [[ -d "${SCRIPT_DIR}/icons" ]]; then
    $CP_CMD -r "${SCRIPT_DIR}/icons" "$TARGET_DIR/"
fi

if [[ -f "${SCRIPT_DIR}/stylesheet.css" ]]; then
    $CP_CMD "${SCRIPT_DIR}/stylesheet.css" "$TARGET_DIR/"
fi

# Set permissions
if [[ "$INSTALL_MODE" == "system" ]]; then
    chmod -R 644 "${TARGET_DIR}/"*
    find "$TARGET_DIR" -type d -exec chmod 755 {} +
fi

echo "Extension installed to: ${TARGET_DIR}"

# Enable the extension
echo "Enabling extension..."
if command -v gnome-extensions &>/dev/null; then
    if [[ "$INSTALL_MODE" == "user" ]]; then
        gnome-extensions enable "$EXT_UUID" || {
            echo "Note: Could not enable extension automatically. You may need to log out and back in first (Wayland), or restart GNOME Shell (Alt+F2, type 'r', Enter on X11)." >&2
        }
    else
        # System extensions may need manual enable or dconf/gsettings configuration
        echo "System extension installed. You may need to enable it with:"
        echo "  gnome-extensions enable ${EXT_UUID}"
    fi
else
    echo "Warning: gnome-extensions command not found. Please enable manually." >&2
fi

# Final instructions
cat <<EOF

============================================
  Installation Complete!
============================================

Extension: ${EXT_NAME}
UUID:      ${EXT_UUID}
Location:  ${TARGET_DIR}

Next steps:
  1. If you are on Wayland (default in GNOME 46+):
     Log out and log back in for GNOME Shell to discover the extension.

  2. If you are on X11:
     Press Alt+F2, type 'r', and press Enter to restart GNOME Shell.

  3. Verify the extension is enabled:
     gnome-extensions list --enabled | grep ${EXT_UUID}

  4. Open preferences (optional):
     gnome-extensions prefs ${EXT_UUID}

============================================
EOF
