#!/bin/sh
set -eu
: "${AGENT_BROWSER_CDP:?Set AGENT_BROWSER_CDP to a separately isolated, patched, sandboxed browser; open-web browsing must not launch inside the credential-bearing agent container}"
unset AGENT_BROWSER_NATIVE AGENT_BROWSER_EXECUTABLE_PATH AGENT_BROWSER_PROFILE AGENT_BROWSER_AUTO_CONNECT
exec node /opt/agent-browser/node_modules/agent-browser/bin/agent-browser.js --cdp "$AGENT_BROWSER_CDP" "$@"
