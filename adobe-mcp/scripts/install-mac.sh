#!/usr/bin/env bash
#
# Installs the MCP Bridge CEP panel on macOS.
#
#   ./scripts/install-mac.sh          copy the panel into place
#   ./scripts/install-mac.sh --link   symlink instead, so edits apply live
#   ./scripts/install-mac.sh --uninstall
#
set -euo pipefail

BUNDLE_ID="com.idatsuka.adobebridge"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$REPO_DIR/cep/$BUNDLE_ID"
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET="$TARGET_DIR/$BUNDLE_ID"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -rf "$TARGET"
  echo "Removed $TARGET"
  exit 0
fi

if [[ ! -d "$SOURCE" ]]; then
  echo "Cannot find the panel at $SOURCE" >&2
  exit 1
fi

# Unsigned panels only load when PlayerDebugMode is on. The CSXS version differs
# per application release, so set it for every version currently in the wild.
echo "Enabling PlayerDebugMode..."
for v in 6 7 8 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done
killall cfprefsd 2>/dev/null || true

mkdir -p "$TARGET_DIR"
rm -rf "$TARGET"

if [[ "${1:-}" == "--link" ]]; then
  ln -s "$SOURCE" "$TARGET"
  echo "Linked $TARGET -> $SOURCE"
else
  cp -R "$SOURCE" "$TARGET"
  echo "Copied panel to $TARGET"
fi

cat <<'DONE'

Done. Next:
  1. Quit and relaunch Premiere Pro (a full quit, not just closing the project).
  2. Window > Extensions > MCP Bridge.
  3. The panel should read "接続済み" once the MCP server is running.
DONE
