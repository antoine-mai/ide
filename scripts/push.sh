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
echo -e "${BLUE}          Zerous - Git Commit & Push                ${NC}"
echo -e "${BLUE}====================================================${NC}"

cd "${ROOT_DIR}"

# 1. Check if git repository is initialized
if [ ! -d ".git" ]; then
    echo -e "${RED}[ERROR] .git directory not found. Initializing repository...${NC}"
    git init
    git branch -m main
    git remote add origin https://github.com/antoine-mai/ide.git || true
fi

# 2. Get commit message (default if not provided as argument)
if [ -n "$*" ]; then
    COMMIT_MSG="$*"
else
    COMMIT_MSG="feat: update Zerous multi-agent workspace, branding and build pipelines"
fi

# 3. Show current status
echo -e "\n${YELLOW}--> Current Git Status:${NC}"
git status -s

# 4. Stage all changes
echo -e "\n${YELLOW}--> Staging all changes...${NC}"
git add .

# 5. Check if there are changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}[INFO] No changes staged to commit.${NC}"
else
    echo -e "\n${YELLOW}--> Committing changes with message:${NC} \"${COMMIT_MSG}\""
    git commit -m "${COMMIT_MSG}"
fi

# 6. Push to remote
CURRENT_BRANCH=$(git branch --show-current || echo "main")
echo -e "\n${YELLOW}--> Pushing to origin/${CURRENT_BRANCH}...${NC}"

# If remote repository has divergent history (e.g. initial README on github), pull with rebase first or push
if ! git push -u origin "${CURRENT_BRANCH}"; then
    echo -e "${YELLOW}[NOTICE] Push rejected. Trying pull --rebase to sync remote changes...${NC}"
    git pull --rebase origin "${CURRENT_BRANCH}" || {
        echo -e "${RED}[ERROR] Rebase conflict occurred. Overriding with force push if intended, or resolve conflicts.${NC}"
        echo -e "${YELLOW}To force push your new codebase to GitHub, you can run:${NC}"
        echo -e "  git push -u origin ${CURRENT_BRANCH} --force"
        exit 1
    }
    git push -u origin "${CURRENT_BRANCH}"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   Successfully pushed to GitHub:                   ${NC}"
echo -e "${GREEN}   https://github.com/antoine-mai/ide               ${NC}"
echo -e "${GREEN}====================================================${NC}\n"
