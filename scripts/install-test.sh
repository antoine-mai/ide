#!/usr/bin/env bash
set -e

# ANSI Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}     Zerous - Local Test & Installation Check       ${NC}"
echo -e "${BLUE}====================================================${NC}"

cd "${ROOT_DIR}"

# 1. Environment checks
echo -e "\n${CYAN}[1/5] Checking environment requirements...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js is not installed!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js version:${NC} $(node -v)"

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] npm is not installed!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ npm version:${NC} $(npm -v)"

# 2. Check and install dependencies
echo -e "\n${CYAN}[2/5] Checking npm dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  --> node_modules not found. Installing packages...${NC}"
    npm install
else
    echo -e "${GREEN}  ✓ node_modules exists.${NC}"
fi

# 3. Check native node-pty binary
echo -e "\n${CYAN}[3/5] Verifying native module (node-pty)...${NC}"
PTY_BINARY="node_modules/node-pty/build/Release/pty.node"
PTY_PREBUILD="node_modules/node-pty/prebuilds/linux-x64/pty.node"

if [ ! -f "${PTY_BINARY}" ] && [ ! -f "${PTY_PREBUILD}" ]; then
    echo -e "${YELLOW}  --> Compiling native node-pty...${NC}"
    (cd node_modules/node-pty && npm run install)
fi

mkdir -p node_modules/node-pty/prebuilds/linux-x64
if [ -f "${PTY_BINARY}" ]; then
    cp -f "${PTY_BINARY}" "${PTY_PREBUILD}"
    echo -e "${GREEN}  ✓ node-pty binary verified.${NC}"
else
    echo -e "${YELLOW}  ! node-pty binary build skipped or prebuild in use.${NC}"
fi

# 4. Run TypeScript check & bundle build
echo -e "\n${CYAN}[4/5] Running TypeScript check (tsc) & Vite bundling...${NC}"
npx tsc
npx vite build

# Ensure desktop entry & icon registered for user session
if [ -f "${SCRIPT_DIR}/install-desktop-icon.sh" ]; then
    bash "${SCRIPT_DIR}/install-desktop-icon.sh" || true
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   Zerous installed and verified successfully!      ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can now launch the app anytime from:"
echo -e "  1. Application menu / App launcher (search: ${YELLOW}Zerous${NC})"
echo -e "  2. Or run manually in terminal: ${YELLOW}./node_modules/electron/dist/electron .${NC}\n"
