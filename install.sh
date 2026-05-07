#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install

echo "Building..."
pnpm run build

echo "Ensuring grammars directory exists..."
mkdir -p grammars

BIN_DIR="${HOME}/bin"
mkdir -p "$BIN_DIR"

LINK="${BIN_DIR}/diff-review"
TARGET="$(pwd)/bin/diff-review.js"

chmod +x "$TARGET"
ln -sf "$TARGET" "$LINK"
echo "Linked: $LINK -> $TARGET"

SKILL_DIR="${HOME}/.claude/skills/diff-review"
mkdir -p "$SKILL_DIR"
cp "$(pwd)/SKILL.md" "$SKILL_DIR/SKILL.md"
echo "Installed Claude skill: $SKILL_DIR/SKILL.md"

echo "Done! Run 'diff-review' from any git repo. Use 'diff-review --help' for all commands."
