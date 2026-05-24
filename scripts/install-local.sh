#!/usr/bin/env bash
# Build a nainstaluj mini do ~/.local/ stejným patternem jako Claude Code.
#
# Layout po instalaci:
#   ~/.local/bin/mini                              → symlink
#   ~/.local/share/mini/versions/<verze>/dist/...  → vlastní soubory
#   ~/.local/share/mini/versions/<verze>/node_modules/  → produkční deps
#
# Starší verze zůstávají (rollback). Smaž ručně, kdyby vadily.

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
INSTALL_DIR="$HOME/.local/share/mini/versions/$VERSION"
BIN_PATH="$HOME/.local/bin/mini"

echo "→ npm run build"
npm run build

echo "→ instaluji do $INSTALL_DIR"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/.local/bin"

cp -r dist package.json "$INSTALL_DIR/"

echo "→ produkční npm install (jen runtime deps)"
(cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --silent)

chmod +x "$INSTALL_DIR/dist/cli.js"
ln -sfn "$INSTALL_DIR/dist/cli.js" "$BIN_PATH"

echo ""
echo "mini $VERSION nainstalovaný."
echo "  binary: $BIN_PATH"
echo "  files:  $INSTALL_DIR"
echo ""
echo "Zkus:  mini --version"
