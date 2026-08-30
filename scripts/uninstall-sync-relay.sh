#!/bin/bash
# Removes the imago sync relay LaunchAgent installed by install-sync-relay.sh.
set -euo pipefail

PLIST_LABEL="com.imago.syncrelay"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
  rm -f "$PLIST_PATH"
  echo "Uninstalled: $PLIST_LABEL"
else
  echo "Not installed (no $PLIST_PATH)."
fi
