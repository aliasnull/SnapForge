#!/usr/bin/env bash
# ============================================================================
# SnapForge — Android/Termux build helper
#
# Why this exists
# ---------------
# On Android, /storage/emulated/0 is a FUSE mount with two restrictions that
# break Vite's native bundler (rolldown):
#   1. Symlinks cannot be created, so `node_modules/.bin` cannot be populated.
#   2. Native `.node` addons cannot be dlopen'd from that mount, because it is
#      outside the dynamic linker's permitted_paths.
#
# This script mirrors the project into $HOME (a real ext4 filesystem inside the
# Termux sandbox), runs the build there, and copies `dist/` back. The source of
# truth stays in the project directory.
#
# Usage:  bash scripts/android-build.sh [build|dev|preview|typecheck]
# ============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${SNAPFORGE_WORK_DIR:-$HOME/.snapforge-build}"
TASK="${1:-build}"

# Directories/files that must be mirrored (node_modules is large but is a
# one-time copy; subsequent runs reuse it).
MIRROR_ITEMS=(index.html vite.config.ts tsconfig.json package.json package-lock.json public src scripts)

echo "SnapForge build helper"
echo "  project : $PROJECT_DIR"
echo "  workdir : $WORK_DIR"
echo "  task    : $TASK"
echo

mkdir -p "$WORK_DIR"

# --- 1. Mirror node_modules once (or when package-lock.json changes) --------
LOCK_HASH_FILE="$WORK_DIR/.lock-hash"
CURRENT_HASH="$( (md5sum "$PROJECT_DIR/package-lock.json" 2>/dev/null || echo none) | cut -d' ' -f1)"

if [ ! -d "$WORK_DIR/node_modules" ] || [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE")" != "$CURRENT_HASH" ]; then
  echo "→ syncing node_modules…"
  rm -rf "$WORK_DIR/node_modules"
  cp -R "$PROJECT_DIR/node_modules" "$WORK_DIR/node_modules"
  echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
else
  echo "→ node_modules up to date"
fi

# --- 2. Mirror the sources --------------------------------------------------
echo "→ syncing sources…"
for item in "${MIRROR_ITEMS[@]}"; do
  if [ -e "$PROJECT_DIR/$item" ]; then
    rm -rf "$WORK_DIR/$item"
    cp -R "$PROJECT_DIR/$item" "$WORK_DIR/$item"
  fi
done

# --- 3. Run the requested task ---------------------------------------------
cd "$WORK_DIR"

case "$TASK" in
  build)
    node node_modules/typescript/bin/tsc --noEmit
    node node_modules/vite/bin/vite.js build
    ;;
  typecheck)
    node node_modules/typescript/bin/tsc --noEmit
    ;;
  dev)
    exec node node_modules/vite/bin/vite.js --host
    ;;
  preview)
    exec node node_modules/vite/bin/vite.js preview --host
    ;;
  *)
    echo "Unknown task: $TASK" >&2
    exit 1
    ;;
esac

# --- 4. Copy the build output back -----------------------------------------
if [ -d "$WORK_DIR/dist" ]; then
  echo "→ copying dist back to $PROJECT_DIR/dist"
  rm -rf "$PROJECT_DIR/dist"
  cp -R "$WORK_DIR/dist" "$PROJECT_DIR/dist"
  echo
  echo "Build complete:"
  find "$PROJECT_DIR/dist" -type f | sed "s|$PROJECT_DIR/||" | sort
fi
