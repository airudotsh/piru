# pi-setup

How I run Pi — the packages, the two local extensions, and the settings worth copying.
**Step-by-step instructions are in [SETUP.md](SETUP.md).**

```bash
./setup.sh --dry-run   # preview
./setup.sh             # pi install …  + copy extensions
```

## What's here

```
SETUP.md          install order, per-package rationale, config file guide, verification
packages.txt      the 12 packages, one per line
setup.sh          installs packages and copies extensions (--dry-run supported)
extensions/       the 2 local extensions Pi has no package for
```

## What's deliberately not here

- **`auth.json` / API keys** — credentials are entered with `/login` and never stored
  in this repo.
- **Config file contents** — `models.json`, `mcp.json`, `open-tui.json` and friends are
  described in SETUP.md with example values, not shipped as-is. They contain machine
  paths and provider choices that only make sense here.
- **Skills** — `~/.agents/skills` is a shared network mount.

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
