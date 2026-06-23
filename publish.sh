#!/usr/bin/env bash
# Publish the latest AI Marketing Pulse issue to the live site.
#
# Run this AFTER /pulse (or `python backend/pipeline.py --write backend/curated.json`)
# has written the dated issue into frontend/public/issues/. It commits the new/
# changed issue files and pushes to the deploy branch, which triggers Vercel to
# rebuild production. One command = live.
#
#   ./publish.sh
#
# Override the deploy branch with: PUBLISH_BRANCH=main ./publish.sh
set -euo pipefail

cd "$(dirname "$0")"

ISSUES_DIR="frontend/public/issues"
BRANCH="${PUBLISH_BRANCH:-main}"

# Must be on the deploy branch — Vercel builds production from it.
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT" != "$BRANCH" ]; then
  echo "You're on '$CURRENT', not the deploy branch '$BRANCH'."
  echo "Switch first:  git checkout $BRANCH   (or set PUBLISH_BRANCH=$CURRENT)"
  exit 1
fi

# Nothing to do if no issue files are new or changed.
if git diff --quiet -- "$ISSUES_DIR" \
   && git diff --cached --quiet -- "$ISSUES_DIR" \
   && [ -z "$(git ls-files --others --exclude-standard -- "$ISSUES_DIR")" ]; then
  echo "No new or changed issues in $ISSUES_DIR — nothing to publish."
  echo "Run /pulse (or pipeline.py --write) first, then re-run ./publish.sh."
  exit 0
fi

# Latest issue id = first entry in the rebuilt index (newest first).
LATEST="$(python3 -c "import json; print(json.load(open('$ISSUES_DIR/index.json'))[0]['id'])" 2>/dev/null || true)"
[ -n "$LATEST" ] || LATEST="$(date +%Y-%m-%d)"

git add "$ISSUES_DIR"
git commit -q \
  -m "content: publish issue ${LATEST}" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
echo "Committed issue ${LATEST}."

git push origin "$BRANCH"
echo
echo "Pushed to ${BRANCH}. Vercel is rebuilding — issue ${LATEST} goes live in ~1–2 min."
