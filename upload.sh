#!/usr/bin/env bash
# One-click upload for Creator Workbench.
# Usage: ./upload.sh [repo-name]   (default: creator-workbench)
# Safety: aborts if (1) private/business strings are found, or
# (2) the logged-in GitHub user is not the expected owner.
set -euo pipefail

REPO_NAME="${1:-creator-workbench}"
EXPECTED_OWNER="${GITHUB_OWNER:-RoverEva}"
cd "$(dirname "$0")"

echo "== 1. Safety scan: no private / business content =="
if grep -RniE "hatchelite|hatch elite|stantests|furever|2349|9999|isee|ssat|eva\.cyber|emma\.jiang|bobthebob" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude=upload.sh . ; then
  echo "ABORT: found a string above that must not go public. Remove it first."
  exit 1
fi
echo "   clean."

echo "== 2. GitHub identity check =="
command -v git >/dev/null || { echo "ABORT: git not found."; exit 1; }
command -v gh >/dev/null || { echo "ABORT: gh not found. Install it, then run: gh auth login"; exit 1; }
LOGIN="$(gh api user --jq '.login' 2>/dev/null || true)"
if [ -z "$LOGIN" ]; then
  echo "ABORT: gh is not logged in. Run: gh auth login"
  exit 1
fi
echo "   logged in as: $LOGIN (expected: $EXPECTED_OWNER)"
if [ "$LOGIN" != "$EXPECTED_OWNER" ]; then
  echo "ABORT: refusing to push under '$LOGIN' — expected '$EXPECTED_OWNER'."
  echo "Switch accounts (gh auth login) or set GITHUB_OWNER=<your-login> and re-run."
  exit 1
fi

echo "== 3. Commit =="
git init -q 2>/dev/null || true
git add -A
if git diff --cached --quiet; then
  echo "   nothing new to commit."
else
  # Fail loudly here instead of pushing an empty repo: set a repo-local
  # identity first, e.g. git config user.name "RoverEva"
  git commit -qm "chore: open-source creator workbench (minimal, local-first)"
fi
git branch -M main

echo "== 4. Create / push repo: $LOGIN/$REPO_NAME =="
if gh repo view "$LOGIN/$REPO_NAME" >/dev/null 2>&1; then
  echo "   repo already exists, pushing to it."
else
  gh repo create "$LOGIN/$REPO_NAME" --public --source=. --remote=origin --push
  echo "Done: https://github.com/$LOGIN/$REPO_NAME"
  exit 0
fi
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$LOGIN/$REPO_NAME.git"
git push -u origin main
echo "Done: https://github.com/$LOGIN/$REPO_NAME"
