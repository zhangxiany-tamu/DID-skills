# DID

**Modern Difference-in-Differences, agent-driven.** A Claude Code skill and companion MCP server that guide an AI agent through the Roth–Sant'Anna–Bilinski-Poe 5-step DiD workflow on your data — treatment-structure profiling, TWFE diagnostics, heterogeneity-robust estimation, pre-trends power, and HonestDiD sensitivity — using the canonical R tooling (`did`, `fixest`, `didimputation`, `did2s`, `staggered`, `bacondecomp`, `TwoWayFEWeights`, `HonestDiD`, `pretrends`, `DRDID`).

## Contents

- [What's in the repo](#whats-in-the-repo)
- [Install](#install)
- [Quick start](#quick-start)
- [Use with other agents](#use-with-other-agents)
- [How the skill and MCP interact](#how-the-skill-and-mcp-interact)
- [Validation](#validation)
- [Requirements](#requirements)
- [Migration from `DID-skills`](#migration-from-did-skills)
- [License](#license)

## What's in the repo

| Path | What it is |
|---|---|
| `skill/` | Installable `did-analysis` Claude Code skill — pure markdown. Contains the workflow router, 5 step guides, per-package references, failure taxonomy, and validation runbook. |
| `mcp/` | Optional companion `did-mcp` server — TypeScript MCP server + persistent R subprocess. Exposes 16 `did_*` tools that execute the skill's workflow end-to-end. |
| `AGENTS.md` | Monorepo conventions and maintainer read order. |
| `install.sh` | Symlinks `skill/` into `~/.claude/skills/did-analysis/` and optionally builds the MCP. |
| `MIGRATION.md` | Upgrade notes for users coming from the flat-layout `DID-skills` v1. |

The two halves work independently or together:

- **Skill only**: install `skill/`; the agent reads the docs and writes R code for you to run.
- **Skill + MCP**: install both; the agent calls `did_*` tools to execute the workflow and returns interpreted results, event-study plots, and a narrative markdown report.

## Install

```bash
git clone https://github.com/zhangxiany-tamu/DID.git
cd DID
./install.sh
```

The installer symlinks `skill/` into `~/.claude/skills/did-analysis/` and, if you say yes, runs `npm install && npm run build` inside `mcp/`.

**Skill-only install (no MCP):**

```bash
ln -s "$(pwd)/skill" ~/.claude/skills/did-analysis
```

**Register the MCP with Claude Code** — copy the `did-mcp` block from `mcp/mcp-config.example.json` into your `~/.claude/settings.json` (`mcpServers` key), adjust the absolute paths to your Node and `Rscript` binaries, then restart Claude Code.

## Quick start

In a Claude Code session inside your project directory:

```
I have a state-year panel at data/expansion.csv with columns state, year, treatment_year, outcome.
Run the did-analysis workflow end-to-end — profile the treatment structure, check TWFE bias,
estimate ATT with a heterogeneity-robust method, test pre-trends power, and report HonestDiD
sensitivity bounds. Flag any estimator disagreement.
```

With the MCP registered, Claude will call `did_load_panel` → `did_profile_design` → `did_diagnose_twfe` → `did_estimate` (per estimator) → `did_extract_event_study` → `did_power_analysis` → `did_honest_sensitivity` → `did_plot` → `did_report`, returning a markdown narrative with ATTs, event-study coefficients, breakdown M̄, and a flagged estimator-agreement table.

Without the MCP, Claude reads `skill/SKILL.md` + the step guides and produces runnable R code for the same pipeline.

## Use with other agents

The MCP server is not Claude-specific. Any client that can launch a stdio MCP server can register `did-mcp` by running:

```bash
node /absolute/path/to/DID/mcp/dist/index.js
```

with `R_PATH` pointing at your `Rscript` binary. Tool schemas are standard MCP JSON Schema.

The skill is portable as context: agents without a Claude-style skill mechanism can load `skill/SKILL.md` and the `references/` guides as normal prompt context and prefer `did_*` tools when the MCP is registered. Native skill-install formats are client-specific; the bundled installer currently targets Claude Code's `~/.claude/skills/did-analysis/` layout.

## How the skill and MCP interact

The skill does not call the MCP directly — the MCP client does. When `did-mcp` is registered, tools named `did_*` appear in the client's tool list. `SKILL.md` instructs the agent to prefer those tools when available and to fall back to R code generation when they are not. The two execution paths are contract-identical: R backends under `mcp/r/` mirror the R bodies documented in `skill/references/did-step-*.md`, so the MCP-driven and code-gen paths produce the same results.

See `skill/SKILL.md` for the routing logic and `mcp/README.md` for MCP build, configuration, and development details.

## Validation

The MCP's verification suite covers unit tests, smoke tests, estimator smokes, edge cases, and a six-scenario real-data audit covering every tool × dataset combination. From `mcp/`:

```bash
npm test                 # vitest unit tests
npm run build            # TypeScript build
npm run smoke:all        # smoke-test.mjs + smoke-estimators.mjs + smoke-edgecases.mjs
npm run validate:real    # 6 real datasets × 16 tools, emits a markdown matrix
```

`npm run validate:real` writes ignored reports under `mcp/validation-output/`. See `mcp/REAL_DATA_VALIDATION.md` for scenario details.

An additional harness validates the skill's R code-gen fallback recipes:

```bash
cd skill && node scripts/audit-skill-recipes.mjs
```

Both audit scripts pass on all 6 DID Examples datasets (96/96 MCP cells, 30/30 skill cells as of 2026-04-24).

## Requirements

- **R** 4.x with the P0 packages: `did`, `fixest`, `didimputation`, `did2s`, `staggered`, `bacondecomp`, `TwoWayFEWeights`, `HonestDiD`, `pretrends`, `panelView`, `DRDID`, `data.table`, `jsonlite`. Install with `Rscript mcp/r/install_packages.R`.
- **Node** 22.x (see `mcp/.nvmrc`) — only required for the MCP server.
- **Claude Code** or any MCP-compatible client — required only to use the skill interactively.

## Migration from `DID-skills`

This repo was previously `github.com/zhangxiany-tamu/DID-skills` with all skill files at the repo root. The skill is now under `skill/` and the MCP lives under `mcp/`. The flat-layout v1 is frozen at tag `skill-v1.1.0-flat`. See `MIGRATION.md` for upgrade steps.

## License

MIT — see `LICENSE`.
