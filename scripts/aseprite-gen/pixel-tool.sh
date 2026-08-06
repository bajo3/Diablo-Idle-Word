#!/bin/bash
# Thin wrapper around MCP Inspector's CLI mode, targeting the pixel-mcp (Aseprite) server.
# Usage: pixel-tool.sh <tool_name> key=value key=value ...
BIN="/c/Users/felip/.claude/plugins/cache/pixel-plugin/pixel-plugin/0.5.0/bin/pixel-mcp"
TOOL="$1"; shift
ARGS=()
for kv in "$@"; do ARGS+=(--tool-arg "$kv"); done
npx --yes @modelcontextprotocol/inspector --cli "$BIN" --method tools/call --tool-name "$TOOL" "${ARGS[@]}" 2>/dev/null
