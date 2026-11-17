#!/usr/bin/env bash
set -e

echo "==> Cleaning old 'Zerous IDE' desktop entries and application caches..."

APP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons"

# Remove any old desktop entries with 'zerous-ide' or 'ide'
rm -f "${APP_DIR}/zerous-ide.desktop"
rm -f "${APP_DIR}/ide.desktop"
rm -f "${APP_DIR}/com.zerous.ide.desktop"
rm -f "${APP_DIR}/appimagekit"*zerous* 2>/dev/null || true
rm -f "${APP_DIR}/appimagekit"*ide* 2>/dev/null || true

# Remove old icons
rm -f "${ICON_DIR}/hicolor/512x512/apps/zerous-ide.png"
rm -f "${ICON_DIR}/hicolor/256x256/apps/zerous-ide.png"
rm -f "${ICON_DIR}/hicolor/128x128/apps/zerous-ide.png"
rm -f "${ICON_DIR}/hicolor/64x64/apps/zerous-ide.png"
rm -f "${ICON_DIR}/hicolor/32x32/apps/zerous-ide.png"

# Check and clean any desktop file having "Zerous IDE" in Name
if [ -d "${APP_DIR}" ]; then
    for f in "${APP_DIR}"/*.desktop; do
        if [ -f "$f" ] && grep -qi "Name=Zerous IDE" "$f"; then
            echo "Removing: $f"
            rm -f "$f"
        fi
    done
fi

# Update desktop databases and icon caches
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${APP_DIR}" 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "${ICON_DIR}/hicolor" 2>/dev/null || true
fi

echo "✓ Old 'Zerous IDE' entries cleaned successfully!"
echo "Only 'Zerous' is kept."
