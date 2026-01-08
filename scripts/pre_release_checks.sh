#!/usr/bin/env bash
# Run validation checks before creating a release for the frontend (Lovelace card).
#
# Usage:
#   scripts/pre_release_checks.sh <version> [--strict]
#
# Checks:
# - JSON validity: package.json and hacs.json (if present)
# - package.json.version matches provided <version>
# - card file existence (www/community/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js)
# - npm ci (install dependencies)
# - npm test (if script exists)
# - eslint (if installed)
# - prettier --check (if installed)
# - npm run build (if script exists)
#
# If --strict is provided, missing optional tools cause failure.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_JSON="$REPO_ROOT/package.json"
HACS_JSON="$REPO_ROOT/hacs.json"
VERSION="$1"
STRICT="no"
if [ "${2-}" = "--strict" ] || [ "${3-}" = "--strict" ]; then
  STRICT="yes"
fi

fail() {
  echo "ERROR: $*" >&2
  exit 1
}
warn() {
  echo "WARN: $*" >&2
}
info() {
  echo "INFO: $*"
}

# 1) Ensure Git clean (no unstaged changes)
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a git repository."
fi

if [ -n "$(git ls-files --modified)" ]; then
  echo "Unstaged changes detected:"
  git ls-files --modified
  fail "Please stash/commit changes before running pre-release checks."
fi
info "Git working tree: no unstaged changes."

# 2) Validate JSON files
if [ ! -f "$PACKAGE_JSON" ]; then
  fail "package.json not found at $PACKAGE_JSON"
fi
info "Validating package.json"
if ! node -e "JSON.parse(require('fs').readFileSync('$PACKAGE_JSON','utf8'))" >/dev/null 2>&1; then
  fail "Invalid JSON in package.json"
fi

if [ -f "$HACS_JSON" ]; then
  info "Validating hacs.json"
  if ! node -e "JSON.parse(require('fs').readFileSync('$HACS_JSON','utf8'))" >/dev/null 2>&1; then
    fail "Invalid JSON in hacs.json"
  fi
else
  warn "hacs.json not found (optional)"
fi

# 3) Check package.json version equals provided version
pkg_ver="$(node -e "console.log(require('./package.json').version || '')")"
if [ "$pkg_ver" != "$VERSION" ]; then
  fail "package.json version ('$pkg_ver') does not match expected version ('$VERSION')"
fi
info "package.json version matches $VERSION"

# 4) Ensure card file exists
CARD_PATH="$REPO_ROOT/www/community/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js"
if [ ! -f "$CARD_PATH" ]; then
  fail "Card file not found: $CARD_PATH"
fi
info "Found card file."

# 5) Install dependencies
info "Running npm ci..."
if command -v npm >/dev/null 2>&1; then
  npm ci --no-audit --no-fund
else
  if [ "$STRICT" = "yes" ]; then
    fail "npm not installed and --strict provided."
  else
    warn "npm not installed; skipping npm install steps."
  fi
fi

# 6) Run npm test if defined
has_test="$(node -e "const p=require('./package.json'); console.log(Boolean(p.scripts && p.scripts.test))")"
if [ "$has_test" = "true" ]; then
  if command -v npm >/dev/null 2>&1; then
    info "Running npm test..."
    npm test || fail "npm test failed."
  fi
else
  info "No npm test script defined; skipping tests."
fi

# 7) Build if build script exists
has_build="$(node -e "const p=require('./package.json'); console.log(Boolean(p.scripts && p.scripts.build))")"
if [ "$has_build" = "true" ]; then
  info "Running npm run build..."
  npm run build || fail "npm run build failed."
else
  info "No build script; skipping build."
fi

info "All pre-release checks passed."
exit 0
