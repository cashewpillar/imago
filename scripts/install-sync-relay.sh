#!/bin/bash
# Installs the imago sync relay as a macOS LaunchAgent so it's always running
# in the background — no need to remember to start it manually. Safe to
# re-run any time (e.g. after moving the repo) to refresh the paths.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
PLIST_LABEL="com.imago.syncrelay"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$REPO_DIR/scripts/.sync-relay-logs"

mkdir -p "$LOG_DIR"

if [ -z "$NODE_BIN" ]; then
  echo "node not found on PATH — install Node.js first." >&2
  exit 1
fi

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/scripts/sync-relay.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load -w "$PLIST_PATH"

echo "Installed and started: $PLIST_LABEL"
echo "  Relay listens on: http://<this-mac-lan-ip>:8791"
echo "  Logs:              $LOG_DIR/{out,err}.log"
echo "  Uninstall with:    scripts/uninstall-sync-relay.sh"
