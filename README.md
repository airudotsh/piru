# piru

How I run [Pi](https://pi.dev) — the packages, the MCP server, the two local
extensions, and the settings worth copying.

**Full install steps: [SETUP.md](SETUP.md)**

```bash
./setup.sh --dry-run   # preview
./setup.sh             # packages + local extensions + MCP server
```

That one command restores everything **functional**. Personal choices — which model,
your instructions, your skills — are documented in SETUP.md but not installed.

---

## Packages (12)

### Search and context

| Package | Provides | Notes |
|---|---|---|
| **pi-web-access** | `web_search`, `fetch_content`, `source_check`, `get_search_content` | Works with **no API key** (Exa MCP + Codex auth). 20+ optional providers. |
| **pi-mcp-adapter** | MCP server support | Reads `~/.pi/agent/mcp.json`; `/mcp` shows servers and tool counts |
| **SoL-Pi** | Context and observation management | Pinned to a git commit; `sol-pi.json` toggles each feature |

### Planning and execution

| Package | Provides | Notes |
|---|---|---|
| **@narumitw/pi-plan-mode** | Read-only plan mode | `plan_mode_question`, `plan_mode_complete`. Blocks edits except the plan file. `/plan export` writes the plan to Markdown. Review offers *Implement here / Start fresh / Save / Export*. |
| **@tintinweb/pi-tasks** | Task list above the editor | `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`. Bidirectional `blocks`/`blockedBy` with cycle warnings. `TaskExecute` runs a task as a subagent. `/tasks` menu. |
| **@tintinweb/pi-subagents** | `Agent` tool | Isolated subagent sessions, background by default, mid-run steering, resume, scheduled jobs, `SubagentWorkflow` scripts. Same author as pi-tasks — they talk over an event bus, so `agentType` on a task runs there. |

### Providers

| Package | Provides | Notes |
|---|---|---|
| **pi-antigravity** | Google Antigravity / Cloud Code Assist | Gemini, Claude, and GPT-OSS via a **Google login** (`/login antigravity`). **Unofficial** — not endorsed by Google. Use only with an account you are authorized to use that way. |
| **pi-devin** | Devin provider | Claude/GPT/Gemini through Devin |

### Interface

| Package | Provides | Notes |
|---|---|---|
| **pi-open-tui** | Header, footer, telemetry, thinking peek | `/open-tui` → General / Appearance / Footer / Telemetry. This setup disables the per-turn telemetry line. |
| **pi-session-summary** | Session name from the first request | Writes a one-line summary and sets it as the session name (footer + `/resume`). `/summary:cost`. |
| **pi-image-preview** | Pasted-image thumbnails | `Ctrl+V` an image → thumbnail above the editor. Works in Kitty and Ghostty. |

### Memory

| Package | Provides | Notes |
|---|---|---|
| **pi-memory** | Persistent project memory | Pinned to `0.4.2`. Paired with `project-memory.ts` so each git root gets its own store. |

**Deliberately not installed:** `@gamaraan/todos-tool` (an OMP-style phased todo HUD —
appealing, but 1 GitHub star) and a hand-written `pi-plan-todo` that has since been
retired in favour of `pi-plan-mode` + `pi-tasks`.

---

## MCP

### `macos-computer-use`

Declared in [`mcp.json`](mcp.json), installed by `setup.sh`:

```json
{ "mcpServers": { "macos-computer-use": { "command": "macos-computer-use-mcp" } } }
```

**~146 tools** across three layers:

| Layer | Examples |
|---|---|
| OS primitives | screenshots, mouse move/click/drag, keyboard, scroll, clipboard, window management |
| Deterministic helpers | OCR, focus/activate apps, wait for elements, coordinate mapping |
| App semantics | Safari, Calendar, Mail, Messages, Notes, Reminders, Contacts, Music, Finder — real AppleScript interfaces, not screen scraping |

**Permissions** (grant to your terminal app, not to Pi):

```
System Settings → Privacy & Security
  Screen Recording    screenshots
  Accessibility       mouse, keyboard, window, UI elements
  Automation          Calendar, Mail, Safari, Notes, …
```

The server runs on demand — `pi /mcp` shows it as `cached; not listening` plus its
tool count. Without the permissions the server still starts; only the affected tools
fail.

**Alternatives considered:** Peekaboo (separate CLI + MCP, not installed here) and a
lightweight vision-grounding extension (~20 tools). This one was chosen for the app
semantics layer and the OCR built in.

---

## Local extensions

Pi has no package for either, so `setup.sh` copies them into
`~/.pi/agent/extensions/`.

| File | Why it exists |
|---|---|
| **last-model.ts** | Pi stores only a *startup default* (`Ctrl+S` in `/model`). This records the **last used** model + thinking level and restores them on the next `startup`. Skips restoration when you launch with `--model`/`--provider`. No open-source equivalent found. |
| **project-memory.ts** | `pi-memory` has one global store; this adapter points it at `~/.pi/agent/memory/projects/<sha256(git-root)>/` so projects do not share memory. Sets `PI_MEMORY_*` before importing, and throws if the scope changes mid-process. |

---

## What `setup.sh` does not do

| Not installed | Why |
|---|---|
| Authentication | Credentials go through `/login`; `auth.json` is never committed |
| Model / provider choice | Personal — SETUP.md §3 shows `models.json` with a worked example |
| Instructions | `APPEND_SYSTEM.md` and `AGENTS.md` encode machine-specific paths; SETUP.md §5 has minimal templates |
| Prompt templates | None configured here; SETUP.md §5 shows the format |
| Skills | `~/.agents/skills` (87 skills) is a shared network mount |
| Extra MCP servers | Add them to `mcp.json` with their own `command` |

---

## Restore on a new machine

```bash
git clone https://github.com/airudotsh/piru
cd piru
./setup.sh --dry-run     # see the plan
./setup.sh               # do it
pi                       # then /login for each provider
```

Then grant the MCP permissions above and restart Pi.

## License

MIT
