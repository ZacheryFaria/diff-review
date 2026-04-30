#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install

echo "Building..."
pnpm run build

BIN_DIR="${HOME}/bin"
mkdir -p "$BIN_DIR"

LINK="${BIN_DIR}/diff-review"
TARGET="$(pwd)/bin/diff-review.js"

chmod +x "$TARGET"
ln -sf "$TARGET" "$LINK"
echo "Linked: $LINK -> $TARGET"
echo "Done! Run 'diff-review' from any git repo."
