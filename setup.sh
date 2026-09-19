#!/usr/bin/env bash
# pi-setup — install packages, local extensions, and MCP servers.
#
# Usage:
#   ./setup.sh            # install everything
#   ./setup.sh --dry-run  # show what would change, touch nothing
#   ./setup.sh --no-mcp   # skip MCP server installation
#   ./setup.sh --with-memory-search  # also install QMD if absent (local model downloads later)
#
# Personal choices (which model, which instructions, which skills) are NOT set
# here. See SETUP.md.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
DRY=0
SKIP_MCP=0
MEMORY_SEARCH=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --no-mcp)  SKIP_MCP=1 ;;
    --with-memory-search) MEMORY_SEARCH=1 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

say() { printf '  %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then say "[dry] $*"; else eval "$@"; fi; }
have() { command -v "$1" >/dev/null 2>&1; }

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

# Prevent the package and adapter from registering the same memory tools twice.
if [ "$DRY" = 1 ]; then
  say "[dry] disable direct pi-memory extensions in $AGENT_DIR/settings.json (backup before changing)"
else
  node "$HERE/scripts/configure-memory.mjs" "$AGENT_DIR"
fi

if [ "$MEMORY_SEARCH" = 1 ]; then
  if have qmd; then
    say "QMD already installed — keeping the existing version"
  else
    say "QMD search: first embedding/semantic use may download large local models and use CPU/disk"
    run "npm install -g @tobilu/qmd@2.8.3"
  fi
else
  say "QMD not installed by default; add --with-memory-search for local memory search"
fi

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

# ── 3. MCP servers ───────────────────────────────────────────────────
echo
if [ "$SKIP_MCP" = 1 ]; then
  echo "3) MCP servers — skipped (--no-mcp)"
else
  echo "3) MCP servers"
  if have uv; then
    run "uv tool install macos-computer-use-mcp"
    say "binary → $(command -v macos-computer-use-mcp 2>/dev/null || echo '~/.local/bin/macos-computer-use-mcp')"
  else
    say "⚠ uv not found — install it, then re-run: uv tool install macos-computer-use-mcp"
    say "   (macos-computer-use-mcp is a Python package; uv is the simplest runner)"
  fi
  if [ -f "$HERE/mcp.json" ]; then
    if [ -f "$AGENT_DIR/mcp.json" ] && ! cmp -s "$HERE/mcp.json" "$AGENT_DIR/mcp.json"; then
      run "cp '$AGENT_DIR/mcp.json' '$AGENT_DIR/mcp.json.bak.$(date +%Y%m%d-%H%M%S)'"
      say "backed up existing mcp.json"
    fi
    run "cp '$HERE/mcp.json' '$AGENT_DIR/mcp.json'"
  fi
  cat <<'MCPNOTE'
  Permissions the server needs (grant to your TERMINAL app):
    System Settings → Privacy & Security →
      Screen Recording   (screenshots)
      Accessibility      (mouse, keyboard, window, UI elements)
      Automation         (Calendar, Mail, Safari, Notes …)
  It runs on demand; `pi /mcp` shows the server and its tool count.
MCPNOTE
fi

# ── 4. notes ─────────────────────────────────────────────────────────
cat <<'NOTES'

4) what this does NOT do
   - authentication: run `pi`, then /login per provider
   - model choices, instructions, skills: see SETUP.md — those are personal,
     not functional, so they are not installed here
   - extra MCP servers: declare them in mcp.json with their own command

Fully restart Pi, then check /plan, /tasks, /agents, /mcp and memory_status.
Memory files and indexes are never copied by this installer.
NOTES
