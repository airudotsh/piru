# Setup — rebuild this Pi configuration on a new machine

Step-by-step. Examples reflect the current setup, but are not a full machine backup;
adjust personal choices where noted.
**No secrets are stored here** — every key is either entered via `/login` or read
from a file on the machine.

---

## 0. Prerequisites

```bash
node --version     # 22.13+ for the included tests
pi --version       # 0.85+
```

Pi itself: see the official quickstart. Install method does not matter here.

---

## 1. Packages

```bash
./setup.sh --dry-run                  # preview, no writes
./setup.sh                            # packages + adapters + MCP
./setup.sh --with-memory-search       # also install QMD if absent
./setup.sh --no-mcp                   # skip MCP installation
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

The installer disables the pi-memory package's own extension entry: only the local
adapter must load it, after choosing the project's memory directory. It backs up
`settings.json` before making this narrow change and preserves unrelated settings.
For manual installation, apply the package filter shown in §4 before starting Pi.

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
        { "id": "deepseek-v4.1-flash", "api": "openai-completions", "reasoning": true,
          "compat": { "supportsStore": false, "supportsDeveloperRole": false,
                      "supportsReasoningEffort": true, "maxTokensField": "max_tokens",
                      "thinkingFormat": "deepseek", "requiresReasoningContentOnAssistantMessages": true },
          "thinkingLevelMap": { "off": "none", "minimal": null, "low": "low",
                                "medium": null, "high": "high", "xhigh": null, "max": "max" },
          "contextWindow": 1000000, "maxTokens": 384000,
          "cost": { "input": 0.015, "output": 0.06, "cacheRead": 0.0003, "cacheWrite": 0.015 } }
      ]
    }
  }
}
```

**`thinkingLevelMap` matters.** Without it Pi assumes `off`…`high` are supported and
hides `max`. If the provider actually only supports `low`/`high`/`max` (as b.ai does),
declare supported levels and mark unsupported levels `null`. Verify the provider's
actual supported levels. The `cost` fields are local display metadata, **not proof of
actual billing or a free subscription**; confirm prices with the provider.

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

### `subagents.json` — optional workflow and description settings

```json
{ "workflowsEnabled": false, "toolDescriptionMode": "compact" }
```

This disables scripted `SubagentWorkflow`, not ordinary `Agent` delegation,
background execution, steering, or resume. Compact mode shortens the Agent tool's
description; do not assume a fixed token saving across versions. Fully restart Pi
to verify the loaded tools after changing it. This example is not auto-installed.

The current delegation preference is `bai/deepseek-v4.1-flash` with high thinking.
It is an instruction, not a change to the main model or to all agent profiles.
With the installed `Agent` tool, use separate `model` and `thinking` arguments.
A profile-pinned model takes precedence over a call's model argument. Model lookup
fallback is not API-error failover: b.ai → opencode-go → parent is **not** an
installed automatic runtime chain.

### `sol-pi.json` — observation archives only

```json
{
  "version": 1,
  "actionFusion": false,
  "observationPack": true,
  "evidencePreservingReducer": false,
  "onlineContextCompact": false
}
```

ObservationPack archives large tool results for `obs_recall`. It is separate from
project memory and from the terminal's visual output folding.

### `APPEND_SYSTEM.md` — additions to Pi's system prompt

Plain Markdown appended to the system prompt. This machine keeps its own rules there
(communication style, approval gates, project context). Keep it short — it rides on
every request.

---

## 4. Local extensions

These two local adapters are copied from `extensions/` into
`~/.pi/agent/extensions/` by `setup.sh`. The last-model code also has a standalone
source repository at <https://github.com/airudotsh/pi-last-model>.

| File | Why it exists |
|---|---|
| `last-model.ts` | Pi stores only a *startup default* (`Ctrl+S` in `/model`). This records the **last used** model + thinking level and restores them on the next `startup`. No open-source equivalent found. |
| `project-memory.ts` | `pi-memory` has one global store. This adapter points it at `~/.pi/agent/memory/projects/<sha256(git-root)>/` so each project gets separate memory. Required if you use `pi-memory`. |

Notes:
- `last-model.ts` skips restoration when you launch with `--model` / `--provider`.
- `project-memory.ts` sets its environment before importing `pi-memory`, and
  rejects a different memory scope in the same adapter instance. Fully restart Pi
  when switching projects; do not rely on `/reload` to clear imported module state.

### Memory search and isolation

The store is `~/.pi/agent/memory/projects/<sha256(project-root)>/`. The adapter uses
the nearest directory containing `.git` (a directory or worktree file), falling
back to the real launch directory outside Git. Different worktrees and moved
projects have different stores. `.project.json` records the local identity.

Keep pi-memory installed but disable its direct extension in `settings.json`:

```json
{
  "packages": [
    { "source": "npm:pi-memory@0.4.2", "extensions": [] }
  ]
}
```

This is a fragment: preserve all your other package entries. `setup.sh` applies it
automatically. Without the filter, the global package can initialize before the
adapter sets the scope and can register duplicate memory tools.

The current adapter sets:

| Setting | Value / purpose |
|---|---|
| `PI_MEMORY_SNAPSHOT` | `stable` — stable prompt snapshots, not per-prompt search injection |
| `PI_MEMORY_EXIT_SUMMARY` / `PI_MEMORY_SUMMARIZE_TRANSITIONS` | `0` — no automatic model summaries on exit or transition |
| `PI_MEMORY_QMD_UPDATE` | `background` — index and embed after writes |
| `PI_MEMORY_QMD_SEARCH_TIMEOUT_MS` | `180000` — allow local searches up to three minutes |
| `QMD_CONFIG_DIR` | `<store>/.qmd` — per-project QMD collection configuration |
| `INDEX_PATH` | `<store>/.qmd/index.sqlite` — per-project search index |

QMD **2.8.3** is the reference version. Install with
`./setup.sh --with-memory-search`, or `npm install -g @tobilu/qmd@2.8.3`.
The installer keeps an existing QMD version rather than replacing it. Without QMD,
file-based memory still works; `memory_search` reports the missing dependency.
QMD uses local models: first-time downloads, indexing, and embedding may consume
substantial disk, CPU, and time. Model downloads are shared; project indexes are not.

After a full Pi restart, use `memory_status` to verify the directory, QMD collection,
embeddings, background updates, and 180000 ms timeout. Search exact terms first,
then use semantic/deep search when helpful and read the matching source. With
stable snapshots, the agent must explicitly request recall; no automatic search
runs for every user prompt.

If indexing is incomplete, do not interpret an empty result as missing memory.
Use the store path reported by `memory_status` to target a manual refresh:

```bash
STORE="<absolute memory directory reported by memory_status>"
QMD_CONFIG_DIR="$STORE/.qmd" INDEX_PATH="$STORE/.qmd/index.sqlite" qmd update
QMD_CONFIG_DIR="$STORE/.qmd" INDEX_PATH="$STORE/.qmd/index.sqlite" qmd embed
```

Do not run bare QMD refresh commands expecting them to select the Pi project's
index. Do not commit memory contents, `.project.json`, SQLite indexes, sessions,
or downloaded models to this repository.

---

## 5. Instructions and prompts

Instructions and reusable prompt templates have different discovery paths.
This snapshot uses `APPEND_SYSTEM.md`; project instructions depend on the repository.

### `~/.pi/agent/APPEND_SYSTEM.md` — personal, always on

Plain Markdown appended to Pi's system prompt. Sections this machine keeps:

```
User and communication      how to address me, language, tone
Fixed environment           which terminal / browser / CLI to use, and what not to
Work and verification       inspect first, verify the smallest scope, report evidence
Approval and safety         what needs explicit approval; never handle credentials
Browser — … CLI             which browser automation tool is authoritative
Delegation and parallel work  subagent rules, worktree isolation
Project context and session names
Existing shared resources and knowledge
Project memory and output archives
```

Keep it short — every line rides on every request. Start minimal:

```markdown
# Pi instructions

## Communication
- Address me as <name>. Reply in <language>, conclusion first.

## Verification
- For any change: inspect the files, make the edit, verify the smallest scope
  that proves it works, then report evidence.

## Approval
- Ask before commit, push, PR, merge, deploy, or destructive operations.
- Never handle credentials on my behalf.
```

### `AGENTS.md` — project-level, discovered automatically

Pi loads `AGENTS.md` or `CLAUDE.md` from the working directory and ancestors,
plus `~/.pi/agent/AGENTS.md` for global instructions. `AGENTS.override.md` replaces
the normal context file from its directory. Use project instructions for branch
policy, test commands, and record-keeping.

`~/.agents/AGENTS.md` is **not** Pi's documented global instruction path. Do not
count it as injected merely because that file exists. This is distinct from
`~/.agents/skills/`, which Pi does discover for skills.

### Prompt templates — `/name` shortcuts (not used here)

Markdown snippets that expand into a full prompt. Drop a file in
`~/.pi/agent/prompts/<name>.md` and type `/name`:

```markdown
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Correctness bugs
- Missing tests
- Anything that looks like an accidental change
```

Also discoverable from `.pi/prompts/*.md` (project) and packages. This machine has
none configured, so only package-provided ones appear.

### What is not portable

`APPEND_SYSTEM.md` and `AGENTS.md` are **not** shipped in this repo — they encode
machine-specific paths and personal working style. Treat the list above as a
checklist and write your own; keep them under version control in your own place.

---

## 6. Verify

After a restart:

| Check | Expected |
|---|---|
| `/plan <request>` | starts planning; review before implementation; planning tools enforce the active mode |
| `/plan export` | writes the plan to a Markdown file |
| `/tasks` | task widget above the editor; `blocked by` shows dependencies |
| `/agents` | subagent list; scripted Workflows absent if the optional setting above is applied |
| `/mcp` | macos-computer-use, 146 tools |
| `/open-tui` | footer/telemetry settings |
| paste image (`ctrl+v`) | thumbnail above the editor |
| `/settings` | theme, default model |
| `memory_status` | correct project store; QMD ready if installed; background update; 180000 ms timeout |
| `memory_search` | search a non-sensitive fact already saved in this project's memory |

For everyday work: use `/plan <request>` when you want to review the approach;
use a normal request for small fixes and questions. The main agent manages Tasks
and decides when to delegate. Plan approval does not automatically generate Tasks,
and reminders do not block implementation. pi-tasks defaults to clearing an
all-completed list after four turns or at the next post-run task batch.

Repository checks (temporary fixtures only; no API calls or real installation):

```bash
bash -n setup.sh
node --test tests/*.test.mjs
```

## 7. Notes on this snapshot
- `auth.json` is never shared.
- Skills live in `~/.agents/skills` (shared mount) — not part of this repo.
- `models.json` on this machine also defines two local providers whose keys come from
  other files (`~/.glm-api-key`, `~/.gari/config.toml`). Recreate those if you use them.
