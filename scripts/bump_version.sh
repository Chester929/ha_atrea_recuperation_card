#!/usr/bin/env bash
# Bump or set version, sync to VERSION and package.json, generate/update CHANGELOG.md from git commits since last tag,
# run pre-release checks, commit, create tag and optionally push.
#
# Usage:
#   scripts/bump_version.sh patch
#   scripts/bump_version.sh minor
#   scripts/bump_version.sh major
#   scripts/bump_version.sh 1.2.3
# Options:
#   --no-push    : do not push commits/tags (local only)
#   --strict     : treat missing optional tools as failures in pre-release checks
#
# Notes:
# - This script stages ALL changes (git add -A) before running pre-release checks to avoid CI failures
#   caused by permission changes (chmod) or other unstaged modifications introduced by the workflow.
# - Requires: git, node
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$REPO_ROOT/VERSION"
PACKAGE_JSON="$REPO_ROOT/package.json"
CHANGELOG="$REPO_ROOT/CHANGELOG.md"
PRECHECK="$REPO_ROOT/scripts/pre_release_checks.sh"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <major|minor|patch|X.Y.Z> [--no-push] [--strict]"
  exit 1
fi

CMD="$1"
shift || true

PUSH="yes"
STRICT_FLAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-push) PUSH="no"; shift ;;
    --strict) STRICT_FLAG="--strict"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# read current version (prefer VERSION file)
if [ -f "$VERSION_FILE" ]; then
  CUR_VER="$(tr -d ' \t\n\r' < "$VERSION_FILE")"
else
  CUR_VER="$(node -e "console.log(require('./package.json').version || '0.0.0')")"
fi

if ! echo "$CUR_VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Current version '$CUR_VER' does not look like semver."
  exit 1
fi

# compute new version
if [ "$CMD" = "major" ] || [ "$CMD" = "minor" ] || [ "$CMD" = "patch" ]; then
  IFS='.' read -r MAJ MIN PAT <<< "$CUR_VER"
  case "$CMD" in
    major) MAJ=$((MAJ + 1)); MIN=0; PAT=0;;
    minor) MIN=$((MIN + 1)); PAT=0;;
    patch) PAT=$((PAT + 1));;
  esac
  NEW_VER="${MAJ}.${MIN}.${PAT}"
else
  if ! echo "$CMD" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Invalid version: $CMD"
    exit 1
  fi
  NEW_VER="$CMD"
fi

echo "Version: $CUR_VER -> $NEW_VER"

# Build changelog entries
set +e
LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
set -e

if [ -n "$LAST_TAG" ]; then
  RANGE="${LAST_TAG}..HEAD"
else
  RANGE="HEAD"
fi

# read git log (no merges)
# Old: mapfile -t LOG_LINES < <(git log --pretty=format:'%h%x09%an%x09%s%x09%b' --no-merges $RANGE || true)
# Replace mapfile with a portable read-loop to avoid "mapfile: command not found"
LOG_RAW="$(git log --pretty=format:'%h%x09%an%x09%s%x09%b' --no-merges $RANGE 2>/dev/null || true)"

COMMIT_LIST=""
if [ -z "$LOG_RAW" ] || [ "$(printf '%s\n' "$LOG_RAW" | wc -l)" -eq 0 ]; then
  COMMIT_LIST="- No user-facing changes."
else
  # attempt to resolve PR author via gh when PR number present
  GH_AVAILABLE="no"
  if command -v gh >/dev/null 2>&1; then
    GH_AVAILABLE="yes"
    # try to detect owner/repo from origin
    ORIG_URL="$(git remote get-url origin 2>/dev/null || true)"
    OWNER_REPO=""
    if echo "$ORIG_URL" | grep -qE 'github.com[:/].+/.+'; then
      OWNER_REPO="$(echo "$ORIG_URL" | sed -E 's#(git@|https://)([^:]+)[:/]+([^/]+)/([^/]+)(\.git)?#\3/\4#')"
    fi
  fi

  # iterate over each git-log line (tab-separated fields)
  while IFS=$'\t' read -r c_hash c_author c_subject c_body; do
    prnum=""
    if echo "$c_subject" | grep -qE '\(#([0-9]+)\)'; then
      prnum="$(echo "$c_subject" | sed -nE 's/.*\(#([0-9]+)\).*/\1/p')"
    elif echo "$c_subject" | grep -qE '#[0-9]+'; then
      prnum="$(echo "$c_subject" | grep -oE '#[0-9]+' | head -n1 | tr -d '#')"
    elif echo "$c_body" | grep -qE '#[0-9]+'; then
      prnum="$(echo "$c_body" | grep -oE '#[0-9]+' | head -n1 | tr -d '#')"
    fi

    pr_display=""
    author_display="$c_author"

    if [ -n "$prnum" ] && [ "$GH_AVAILABLE" = "yes" ] && [ -n "$OWNER_REPO" ]; then
      pr_author="$(gh api "repos/$OWNER_REPO/pulls/$prnum" -q '.user.login' 2>/dev/null || true)"
      if [ -n "$pr_author" ]; then
        author_display="$pr_author"
      fi
    fi

    if [ -n "$prnum" ]; then
      pr_display=" (#${prnum})"
    else
      pr_display=" (${c_hash})"
    fi

    subj_single="$(echo "$c_subject" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    COMMIT_LIST="${COMMIT_LIST}- ${subj_single}${pr_display} — ${author_display}\n"
  done <<< "$LOG_RAW"
fi

DATE="$(date -u +%Y-%m-%d)"
NEW_HEADER="## v${NEW_VER} — ${DATE}"
NEW_SECTION="${NEW_HEADER}\n\n${COMMIT_LIST}\n"

# Prepend to CHANGELOG.md
if [ -f "$CHANGELOG" ]; then
  if grep -qF "$NEW_HEADER" "$CHANGELOG"; then
    echo "CHANGELOG already contains header '$NEW_HEADER' — skipping."
  else
    TMP="$(mktemp)"
    {
      echo -e "$NEW_SECTION"
      echo ""
      cat "$CHANGELOG"
    } > "$TMP"
    mv "$TMP" "$CHANGELOG"
    echo "Updated $CHANGELOG"
  fi
else
  cat > "$CHANGELOG" <<EOF
# Changelog

$NEW_SECTION
EOF
  echo "Created $CHANGELOG"
fi

# Update VERSION file
echo "$NEW_VER" > "$VERSION_FILE"
echo "Updated $VERSION_FILE"

# Update package.json version
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='${NEW_VER}'; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n'); console.log('Updated package.json')"

# Stage all changes (including permission changes) BEFORE running pre-release checks
# This avoids CI failures when chmod in the workflow changes file modes (unstaged).
git add -A

# Run pre-release checks
if [ ! -x "$PRECHECK" ]; then
  echo "Pre-check script not found or not executable at $PRECHECK"
  exit 1
fi

echo "Running pre-release checks..."
if ! "$PRECHECK" "$NEW_VER" $STRICT_FLAG; then
  echo "Pre-release checks failed. Fix issues and retry. (Files are staged.)"
  exit 1
fi
echo "Pre-release checks passed."

# Commit
COMMIT_MESSAGE="Bump version to v${NEW_VER} and update changelog"
if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "$COMMIT_MESSAGE"
  echo "Committed: $COMMIT_MESSAGE"
fi

# Tag
TAG="v${NEW_VER}"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists locally."
else
  git tag -a "$TAG" -m "Release $TAG"
  echo "Created tag $TAG"
fi

# Push
if [ "$PUSH" = "yes" ]; then
  if git remote | grep -q origin; then
    echo "Pushing commits and tags to origin..."
    git push origin --follow-tags
    echo "Pushed."
  else
    echo "No 'origin' remote configured. Please add remote and push manually:"
    echo "  git remote add origin git@github.com:<owner>/<repo>.git"
    echo "  git push -u origin main --follow-tags"
  fi
else
  echo "PUSH disabled (--no-push). Local commit and tag created but not pushed."
fi

echo "Done: version is $NEW_VER (tag: $TAG)."
