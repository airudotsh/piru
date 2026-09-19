# piru

How I run [Pi](https://pi.dev) — the packages, the MCP server, the two local
extensions, and the settings worth copying.

**Full install steps: [SETUP.md](SETUP.md)**

```bash
./setup.sh --dry-run   # preview
./setup.sh             # packages + local extensions + MCP server
```

This installs the packages, local adapters, and MCP server. Add
`--with-memory-search` to install QMD for local memory search (if absent).
Personal choices — models, instructions, skills, and optional UI/tool settings —
are documented in SETUP.md but not installed. Memory contents are never copied.

---

## Packages (10)

### Search and context

| Package | Provides | Notes |
|---|---|---|
| **pi-web-access** | `web_search`, `fetch_content`, `source_check`, `get_search_content` | Works with **no API key** (Exa MCP + Codex auth). 20+ optional providers. |
| **pi-mcp-adapter** | MCP server support | Reads `~/.pi/agent/mcp.json`; `/mcp` shows servers and tool counts |
| **SoL-Pi** | Context and observation management | Pinned to a git commit; `sol-pi.json` toggles each feature |

### Planning and execution

| Package | Provides | Notes |
|---|---|---|
| **@narumitw/pi-plan-mode** | Read-only plan mode | Start with `/plan` or `/plan <request>`. `plan_mode_question`, `plan_mode_complete` support review; `/plan export` writes Markdown. Planning does not automatically create Tasks. |
| **@tintinweb/pi-tasks** | Task list above the editor | `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, dependencies, and the `/tasks` menu. `TaskExecute` remains registered by the package but has no subagent backend in this setup. |

### Providers

| Package | Provides | Notes |
|---|---|---|
| **pi-antigravity** | Google Antigravity / Cloud Code Assist | Gemini, Claude, and GPT-OSS via a **Google login** (`/login antigravity`). **Unofficial** — not endorsed by Google. Use only with an account you are authorized to use that way. |
| **pi-devin** | Devin provider | Claude/GPT/Gemini through Devin |

### Interface

| Package | Provides | Notes |
|---|---|---|
| **pi-open-tui** | Header, footer, telemetry, thinking peek | `/open-tui` → General / Appearance / Footer / Telemetry. This setup disables the per-turn telemetry line. |
| **pi-image-preview** | Pasted-image thumbnails | `Ctrl+V` an image → thumbnail above the editor. Works in Kitty and Ghostty. |

### Memory

| Package | Provides | Notes |
|---|---|---|
| **pi-memory** | Persistent project memory and local search | Pinned to `0.4.2`, loaded only through `project-memory.ts`. Each project gets separate Markdown memory plus QMD config/index. Stable snapshots; background indexing; no automatic exit/transition summaries. |

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

`setup.sh` copies these three local adapters into `~/.pi/agent/extensions/`.
The last-model adapter also has a [standalone source repository](https://github.com/airudotsh/pi-last-model).

| File | Why it exists |
|---|---|
| **last-model.ts** | Pi stores only a *startup default* (`Ctrl+S` in `/model`). This records the **last used** model + thinking level and restores them on the next `startup`. Skips restoration when you launch with `--model`/`--provider`. No open-source equivalent found. |
| **session-recap.ts** | Replaces `pi-session-summary`. An **OMP-style idle recap**: after a run settles and the session stays idle, one short plain-text recap is generated and shown as a **single** line below the editor. `/recap` runs it on demand. Config: `session-recap.json`. |
| **project-memory.ts** | Scopes memory to the nearest Git root, or launch directory outside Git. QMD config and SQLite index live in that store's `.qmd/`; downloaded models remain shared. Sets the environment before import and rejects a different scope in the same adapter instance. Fully restart Pi when changing projects. |

QMD is optional for file-based memory and required for `memory_search`.
The current reference version is **2.8.3**. First-time local model downloads and
background embedding can take time and disk space; this is not a cloud search API.
See [memory setup and recovery](SETUP.md#memory-search-and-isolation) for details.

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

## Everyday workflow

- Need to review a plan before implementation? Use `/plan <request>`, review it,
  then choose implementation.
- Small changes and questions: send a normal request.
- Choose the main model in Pi and use Tasks to track multi-step work.
  Plan approval does **not** mechanically generate a task list.
- Task reminders are guidance, not an execution gate. Completed lists may be
  auto-cleared by pi-tasks; disappearing completed tasks are not necessarily a failure.
- Memory recall is explicit with stable snapshots: search relevant history and
  read the matching source. Check `memory_status` before treating empty results as
  proof that no memory exists.

## Restore on a new machine

```bash
git clone https://github.com/airudotsh/piru
cd piru
./setup.sh --dry-run     # see the plan
./setup.sh --with-memory-search  # include optional local QMD search
pi                              # then /login for each provider
```

Then grant the MCP permissions above and fully restart Pi. For file-only memory,
use `./setup.sh` without the search option.

## Verify this repository

```bash
bash -n setup.sh
node --test tests/*.test.mjs  # Node 22.13+; no package installs or model calls
```

The tests use temporary settings, mocked installers, a mocked pi-memory import,
and the recap extension loaded with its two Pi imports stubbed; they do not change
your Pi installation, call a model, or index real memory.

## License

MIT
