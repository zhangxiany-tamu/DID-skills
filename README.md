# DID

Monorepo for Difference-in-Differences causal inference tooling:

- **`skill/`** — the `did-analysis` Claude Code skill (pure markdown). A 5-step workflow covering treatment structure assessment, TWFE diagnostics, heterogeneity-robust estimation, power analysis, and HonestDiD sensitivity — with per-package reference docs for 17 R packages.
- **`mcp/`** — the companion `did-mcp` server (TypeScript + persistent R subprocess). Executes the skill's workflow end-to-end via ~9 workflow-shaped tools. *v1 in progress.*

The two halves are designed to work independently or together:
- **Skill only**: install the skill, Claude reads it, writes R code for you to run.
- **Skill + MCP**: install both, Claude calls tools to execute the workflow and returns interpreted results.

## Install

Clone and run `install.sh`:

```bash
git clone https://github.com/zhangxiany-tamu/DID.git
cd DID
./install.sh
```

The script symlinks `skill/` into `~/.claude/skills/did-analysis/` and optionally builds the MCP server.

Manual install (skill only):

```bash
ln -s "$(pwd)/skill" ~/.claude/skills/did-analysis
```

## How the skill and MCP interact

The skill does not call the MCP directly — Claude does. When `did-mcp` is configured as an MCP server, tools named `did_*` appear in Claude's tool list. The skill's `SKILL.md` and step guides tell Claude to prefer those tools when available, and to fall back to code generation when not.

See `skill/SKILL.md` for the full routing logic.

## Migration from flat-layout `DID-skills`

This repo was previously `github.com/zhangxiany-tamu/DID-skills` with all skill files at the repo root. The skill has moved to `skill/`. See `MIGRATION.md` for upgrade instructions.

## Contributing

- Skill maintenance: see `skill/CLAUDE.md`, `skill/NEXT_STEPS.md`, `skill/BACKLOG.md`.
- MCP maintenance: see `mcp/README.md` (coming with v1 scaffold).

## License

MIT
