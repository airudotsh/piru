#!/usr/bin/env bash
# pi-setup — install the packages from packages.txt and copy the local extensions.
#
# Usage:
#   ./setup.sh            # install + copy
#   ./setup.sh --dry-run  # show what would change, touch nothing
#
# Config files are NOT copied. See SETUP.md — auth and per-machine settings
# (models.json, mcp.json, …) are described there instead.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

say() { printf '  %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then say "[dry] $*"; else eval "$@"; fi; }

echo "pi-setup → $AGENT_DIR"
[ "$DRY" = 1 ] && echo "  (dry run — nothing will be written)"

# ── 1. packages ──────────────────────────────────────────────────────
echo
echo "1) packages"
while IFS= read -r pkg; do
  [ -z "$pkg" ] && continue
  case "$pkg" in \#*) continue ;; esac
  run "pi install '$pkg'"
done < "$HERE/packages.txt"

# ── 2. local extensions ──────────────────────────────────────────────
echo
echo "2) local extensions → $AGENT_DIR/extensions"
run "mkdir -p '$AGENT_DIR/extensions'"
for f in "$HERE"/extensions/*.ts; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  if [ -f "$AGENT_DIR/extensions/$base" ] && ! cmp -s "$f" "$AGENT_DIR/extensions/$base"; then
    run "cp '$AGENT_DIR/extensions/$base' '$AGENT_DIR/extensions/$base.bak.$(date +%Y%m%d-%H%M%S)'"
    say "backed up existing $base"
  fi
  run "cp '$f' '$AGENT_DIR/extensions/'"
done

# ── 3. notes ─────────────────────────────────────────────────────────
cat <<'NOTES'

3) what this does NOT do
   - config files: see SETUP.md (models.json, mcp.json, open-tui.json, …)
   - authentication: run `pi`, then /login per provider
   - skills: ~/.agents/skills is a shared mount, not copied here
   - MCP servers: install the server binary, then declare it in mcp.json

Restart Pi after this script, then check /plan, /tasks, /agents, /mcp.
NOTES
