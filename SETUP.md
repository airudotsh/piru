# Setup — rebuild this Pi configuration on a new machine

Step-by-step. Values below are what this machine runs; adjust where noted.
**No secrets are stored here** — every key is either entered via `/login` or read
from a file on the machine.

---

## 0. Prerequisites

```bash
node --version     # 22+
pi --version       # 0.85+
```

Pi itself: see the official quickstart. Install method does not matter here.

---

## 1. Packages

```bash
./setup.sh --dry-run   # preview
./setup.sh             # install + copy local extensions
```

Or manually, one line each (`packages.txt` has the same list):

```bash
pi install git:github.com/kashyab12/pi-devin
pi install npm:pi-web-access
pi install npm:pi-mcp-adapter
pi install npm:pi-open-tui
pi install npm:pi-session-summary
pi install npm:pi-image-preview
pi install npm:pi-antigravity
pi install npm:@tintinweb/pi-subagents
pi install npm:pi-memory@0.4.2
pi install git:github.com/NVlabs/SoL-Pi@bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1
pi install npm:@narumitw/pi-plan-mode
pi install npm:@tintinweb/pi-tasks
```

### Why each one

| Package | What it gives you |
|---|---|
| `pi-web-access` | `web_search`, `fetch_content`, `source_check` — works with **no API key** (Exa MCP + Codex auth) |
| `pi-mcp-adapter` | MCP server support. Reads `~/.pi/agent/mcp.json` |
| `pi-open-tui` | Header/footer chrome, telemetry line, thinking peek. Configure with `/open-tui` |
| `pi-devin` | Devin provider (Claude/GPT/Gemini via Devin) |
| `pi-antigravity` | Google Antigravity / Cloud Code Assist models (Gemini, Claude, GPT-OSS) via **Google login** |
| `@narumitw/pi-plan-mode` | **Read-only `/plan` mode** — explore, write a plan, get approval before edits. `/plan export` writes the plan to Markdown |
| `@tintinweb/pi-tasks` | **Task list above the editor** with dependencies (`blocked by #1`), spinners, and `TaskExecute` to run a task as a subagent |
| `@tintinweb/pi-subagents` | `Agent` tool — spawn isolated subagents, run them in the background, steer mid-run. Pairs with `pi-tasks` |
| `pi-memory` | Persistent project memory |
| `SoL-Pi` | Context/observation management |
| `pi-session-summary` | Generates a one-line session name from the first request, shown in the footer |
| `pi-image-preview` | Renders pasted images as thumbnails above the editor |

**Related but not installed:** `@gamaraan/todos-tool` (an OMP-style phased todo HUD —
nice, but 1 GitHub star) and the retired `pi-plan-todo` (see its own STATUS.md).

---

## 2. Authentication

Nothing here stores credentials. After installing, run `pi` and use `/login` for the
providers you actually have:

```
/login openai-codex     # ChatGPT Plus/Pro
/login antigravity      # Google (Antigravity / Cloud Code Assist)
/login xai              # X / Grok
/login devin            # Devin
/login opencode-go      # API key
/login bai              # API key
```

`pi-antigravity` in particular is an **unofficial** integration — it is not endorsed
by Google. Use it only with an account you are authorized to use that way.

---

## 3. Config files

Create these under `~/.pi/agent/`. Only what you need.

### `settings.json` — theme, startup model, package list

```json
{
  "theme": "titanium",
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.5",
  "packages": [ "..." ],
  "tuiMode": "regular"
}
```

`packages` is written by `pi install`; the rest you can set with `/settings`.
To also set a startup thinking level, use `/thinking` + `Ctrl+S`, which writes
`defaultThinkingLevel`.

### `models.json` — extra providers and models

Custom providers live here. Each entry needs `baseUrl`, `api`, and either an `apiKey`
or auth from `/login`.

```json
{
  "providers": {
    "bai": {
      "baseUrl": "https://api.b.ai/v1",
      "api": "openai-responses",
      "authHeader": true,
      "models": [
        { "id": "deepseek-v4.1-flash", "reasoning": true,
          "thinkingLevelMap": { "off": "none", "low": "low", "high": "high", "max": "max" },
          "contextWindow": 1000000, "maxTokens": 384000,
          "cost": { "input": 0.015, "output": 0.06, "cacheRead": 0.0003, "cacheWrite": 0.015 } }
      ]
    }
  }
}
```

**`thinkingLevelMap` matters.** Without it Pi assumes `off`…`high` are supported and
hides `max`. If the provider actually only supports `low`/`high`/`max` (as b.ai does),
declare it — otherwise `max` is unreachable and `medium` is sent as an unsupported value.

`apiKey` can be a literal, `$ENV_VAR`, or `!command` (e.g. `!cat ~/.bai-api-key`).
**Prefer `/login`** — omit `apiKey` entirely and Pi reads `auth.json` instead.

### `mcp.json` — MCP servers

```json
{ "mcpServers": { "macos-computer-use": { "command": "macos-computer-use-mcp" } } }
```

That server (installed with `uv tool install macos-computer-use-mcp`) exposes ~146
macOS tools — screenshots, input, window management, app semantics, OCR. It needs
Screen Recording + Accessibility (and Automation for app control) granted to your
terminal. Check with `/mcp`.

### `open-tui.json` — footer and telemetry

```json
{
  "enabled": true,
  "icons": { "mode": "nerd" },
  "footerSegments": { "cwd": true, "sessionName": false, "gitBranch": true,
                      "gitStatus": true, "runtime": false, "context": true,
                      "tokens": true, "cost": false, "extensionStatuses": true },
  "telemetry": { "enabled": false },
  "thinkingPeek": { "lines": 2 }
}
```

`telemetry.enabled: false` removes the per-turn `TPS … TTFT …` line.
`footerSegments` controls the bottom bar; set `sessionName: false` if you would
rather see the name only in the terminal title.

### `session-summary.json` — which model writes the session name

```json
{ "provider": "antigravity", "model": "gemini-3.8-flash", "showWidget": true }
```

Without this, the package auto-detects a cheap model from a built-in list
(`gpt-5.4-nano`, `gemini-3-flash`, `claude-haiku-4.5`, …). Pick a small model —
summarizing a first request does not need a frontier model.

### `web-search.json` — stop the curator from stealing the browser

```json
{ "autoOpenBrowser": false }
```

By default `web_search` opens a local curator UI in your browser.
This keeps it from launching one (the URL is still printed if you want it).

### `keybindings.json` — queue a follow-up

```json
{ "app.message.followUp": ["ctrl+enter", "alt+enter"] }
```

### `APPEND_SYSTEM.md` — additions to Pi's system prompt

Plain Markdown appended to the system prompt. This machine keeps its own rules there
(communication style, approval gates, project context). Keep it short — it rides on
every request.

---

## 4. Local extensions

Pi has no package for these two, so they are copied from `extensions/` into
`~/.pi/agent/extensions/` by `setup.sh`.

| File | Why it exists |
|---|---|
| `last-model.ts` | Pi stores only a *startup default* (`Ctrl+S` in `/model`). This records the **last used** model + thinking level and restores them on the next `startup`. No open-source equivalent found. |
| `project-memory.ts` | `pi-memory` has one global store. This adapter points it at `~/.pi/agent/memory/projects/<sha256(git-root)>/` so each project gets separate memory. Required if you use `pi-memory`. |

Notes:
- `last-model.ts` skips restoration when you launch with `--model` / `--provider`.
- `project-memory.ts` sets `PI_MEMORY_*` env vars before importing `pi-memory`, and
  throws if the memory scope changes mid-process (restart Pi when switching projects).

---

## 5. Verify

After a restart:

| Check | Expected |
|---|---|
| `/plan` | enters read-only plan mode; edits blocked except the plan file |
| `/plan export` | writes the plan to a Markdown file |
| `/tasks` | task widget above the editor; `blocked by` shows dependencies |
| `/agents` | subagent list with a model column |
| `/mcp` | macos-computer-use, 146 tools |
| `/open-tui` | footer/telemetry settings |
| paste image (`ctrl+v`) | thumbnail above the editor |
| `/settings` | theme, default model |

## 6. Notes on this snapshot

- `auth.json` is never shared.
- Skills live in `~/.agents/skills` (shared mount) — not part of this repo.
- `models.json` on this machine also defines two local providers whose keys come from
  other files (`~/.glm-api-key`, `~/.gari/config.toml`). Recreate those if you use them.
