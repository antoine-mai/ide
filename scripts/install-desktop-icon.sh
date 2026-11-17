#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Setting up Desktop Icon and Application Entry for Zerous..."

# Clean old entries first
APP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

rm -f "${APP_DIR}/zerous-ide.desktop"
rm -f "${APP_DIR}/ide.desktop"
rm -f "${APP_DIR}/com.zerous.ide.desktop"
rm -f "${HOME}/.local/share/icons/hicolor/"*"/apps/zerous-ide.png" 2>/dev/null || true

mkdir -p "${ICON_DIR}"
mkdir -p "${APP_DIR}"

# Copy icon
cp -f "${ROOT_DIR}/build/icons/512x512.png" "${ICON_DIR}/zerous.png"
cp -f "${ROOT_DIR}/build/icons/512x512.png" "${ROOT_DIR}/release/linux-unpacked/zerous.png" 2>/dev/null || true

# Determine execution path
EXEC_PATH="${ROOT_DIR}/release/linux-unpacked/ide"
if [ ! -f "${EXEC_PATH}" ]; then
    EXEC_PATH="${ROOT_DIR}/node_modules/electron/dist/electron ${ROOT_DIR}"
fi

# Create .desktop file
DESKTOP_FILE="${APP_DIR}/zerous.desktop"
cat << DESKTOP_EOF > "${DESKTOP_FILE}"
[Desktop Entry]
Name=Zerous
Comment=AI-Powered Multi-Agent Coding Workspace
Exec=${EXEC_PATH} %U
Icon=${ICON_DIR}/zerous.png
Terminal=false
Type=Application
Categories=Development;IDE;
StartupWMClass=zerous
MimeType=text/plain;inode/directory;
DESKTOP_EOF

chmod +x "${DESKTOP_FILE}"

# Update desktop database if available
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${APP_DIR}" 2>/dev/null || true
fi

echo "✓ Successfully installed Desktop Entry at: ${DESKTOP_FILE}"
echo "✓ Icon registered at: ${ICON_DIR}/zerous.png"
echo "You can now find 'Zerous' in your application menu / search launcher!"
