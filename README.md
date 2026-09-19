# pi-setup

How I run Pi — the packages, the two local extensions, and the settings worth copying.
**Step-by-step instructions are in [SETUP.md](SETUP.md).**

```bash
./setup.sh --dry-run   # preview
./setup.sh             # pi install …  + copy extensions + install MCP server
```

## What's here

```
SETUP.md          install order, per-package rationale, config file guide,
                  instructions & prompts, verification
packages.txt      the 12 packages, one per line
mcp.json          MCP server declaration (macos-computer-use)
setup.sh          installs packages, copies extensions, installs the MCP server
                  (--dry-run, --no-mcp)
extensions/       the 2 local extensions Pi has no package for
```

## What's deliberately not here

- **`auth.json` / API keys** — credentials are entered with `/login` and never stored
  in this repo.
- **Personal choices** — which model to run, your instructions, your skills. `SETUP.md`
  walks through each with example values instead of shipping them.
- **Skills** — `~/.agents/skills` is a shared network mount.

## Functional vs personal

`setup.sh` restores the **functional** parts — packages, the MCP server, the two local
extensions. It does not set anything that is a matter of taste:

| Installed automatically | You decide |
|---|---|
| 12 packages | which model / provider to use |
| MCP server binary + declaration | which MCP servers you want |
| `last-model.ts`, `project-memory.ts` | your instructions (`APPEND_SYSTEM.md`, `AGENTS.md`) |
| — | your prompt templates |
| — | project-level `.pi/` config |

## The shape of this setup

- **Search & fetch** without API keys (`pi-web-access`)
- **Plan before editing** — read-only plan mode with approval (`@narumitw/pi-plan-mode`)
- **Tasks with dependencies**, optionally executed as subagents
  (`@tintinweb/pi-tasks` + `@tintinweb/pi-subagents`)
- **Extra providers** — Antigravity via Google login, plus b.ai models
  (`pi-antigravity`, `models.json`)
- **Memory scoped per project** (`pi-memory` + `project-memory.ts`)

## The two local extensions

Pi has no package for either:

- `last-model.ts` — Pi remembers a *startup default* only. This restores the **last used**
  model and thinking level on the next start.
- `project-memory.ts` — points `pi-memory` at a per-git-root directory so projects do not
  share one memory store.

## License

MIT
