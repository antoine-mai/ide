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
echo -e "${BLUE}   Zerous - Production Builder        ${NC}"
echo -e "${BLUE}======================================${NC}"

cd "${ROOT_DIR}"

# 1. Clean previous build artifacts
echo -e "${YELLOW}--> Cleaning dist & dist-electron directories...${NC}"
rm -rf dist dist-electron

# 2. Type Check TypeScript
echo -e "\n${YELLOW}--> Running TypeScript compiler check (tsc)...${NC}"
npx tsc

# 3. Vite Build (Renderer + Electron Main & Preload)
echo -e "\n${YELLOW}--> Bundling assets via Vite...${NC}"
npx vite build

# 4. Packaging via Electron-Builder
# Optional arguments passed to build.sh (e.g. --linux, --dir, -mwl)
BUILD_ARGS="${@:---linux dir}"

echo -e "\n${YELLOW}--> Packaging with electron-builder (${BUILD_ARGS})...${NC}"
npx electron-builder build ${BUILD_ARGS}

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}   Build completed successfully!      ${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Artifacts generated in: ${YELLOW}${ROOT_DIR}/release${NC}\n"
