#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install

echo "Building..."
pnpm run build

echo "Linking globally..."
pnpm link --global

echo "Done! Run 'diff-review' from any git repo."
