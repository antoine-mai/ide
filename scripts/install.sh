#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   Zerous - Dependencies Installer    ${NC}"
echo -e "${BLUE}======================================${NC}"

cd "${ROOT_DIR}"

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js is not installed. Please install Node.js >= 18 first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK] Node.js detected: ${NODE_VERSION}${NC}"

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] npm is not installed.${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}[OK] npm detected: ${NPM_VERSION}${NC}"

# Install dependencies
echo -e "\n${YELLOW}--> Installing npm dependencies...${NC}"
if [ -f "package-lock.json" ]; then
    npm ci || npm install
else
    npm install
fi

# Rebuild native modules if needed (e.g. node-pty)
echo -e "\n${YELLOW}--> Ensuring native node-pty binary is built...${NC}"
if [ -d "node_modules/node-pty" ]; then
    (cd node_modules/node-pty && npm run install)
    mkdir -p node_modules/node-pty/prebuilds/linux-x64
    if [ -f "node_modules/node-pty/build/Release/pty.node" ]; then
        cp node_modules/node-pty/build/Release/pty.node node_modules/node-pty/prebuilds/linux-x64/pty.node
    fi
fi

# Register desktop entry & icon if desktop environment exists
if [ -f "${SCRIPT_DIR}/install-desktop-icon.sh" ]; then
    bash "${SCRIPT_DIR}/install-desktop-icon.sh" || true
fi

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}   Installation completed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "To run in development mode:"
echo -e "  ${YELLOW}npm run dev${NC} or launch electron via ./node_modules/electron/dist/electron ."
echo -e "To build for production:"
echo -e "  ${YELLOW}./scripts/build.sh${NC}\n"
