#!/usr/bin/env bash
# Build and install mini into ~/.local/ using the same pattern as Claude Code.
#
# Layout after installation:
#   ~/.local/bin/mini                                → symlink
#   ~/.local/share/mini/versions/<version>/dist/...  → the package's own files
#   ~/.local/share/mini/versions/<version>/node_modules/  → production deps
#
# Older versions are kept around (rollback). Delete them manually if they get in the way.

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
INSTALL_DIR="$HOME/.local/share/mini/versions/$VERSION"
BIN_PATH="$HOME/.local/bin/mini"

echo "→ npm run build"
npm run build

echo "→ installing into $INSTALL_DIR"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/.local/bin"

cp -r dist package.json "$INSTALL_DIR/"

echo "→ production npm install (runtime deps only)"
# --ignore-scripts: only dist/ + package.json are copied here, not scripts/, so the
# package's own `postinstall` (scripts/postinstall.mjs, the slash-command hook)
# would crash with MODULE_NOT_FOUND. That hook is for end users installing mini via
# npm, not for the local install of the tool itself.
(cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --silent --ignore-scripts)

chmod +x "$INSTALL_DIR/dist/cli.js"
ln -sfn "$INSTALL_DIR/dist/cli.js" "$BIN_PATH"

echo ""
echo "mini $VERSION installed."
echo "  binary: $BIN_PATH"
echo "  files:  $INSTALL_DIR"
echo ""
echo "Try:  mini --version"
