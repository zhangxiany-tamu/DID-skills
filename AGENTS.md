# Project: DID

This is a monorepo for modern Difference-in-Differences workflows in R. It has
two coordinated parts:

- `skill/` — the installable `did-analysis` skill. It is pure markdown and
  contains the runtime router, workflow guides, package docs, and maintainer
  docs needed by the skill.
- `mcp/` — the optional companion `did-mcp` server. It exposes the skill's
  core workflow as agent-callable tools backed by a TypeScript MCP server and a
  persistent R subprocess.

## What This Repo Is

- A knowledge base for modern Difference-in-Differences workflows in R.
- A root-managed monorepo whose installable skill lives under `skill/`.
- An optional MCP runtime that can execute the same workflow through `did_*`
  tools when registered with an MCP client.

## What This Repo Is Not

- Not an R package.
- Not a dataset repository.
- Not root-installable as a skill; install or symlink `skill/`, not the repo
  root.

## Repo Map

- `skill/SKILL.md` — thin runtime router; keep it concise.
- `skill/references/` — step guides, advanced methods, troubleshooting, and
  package docs.
- `skill/METHOD_MATRIX.md` — method/package priority tiers and MCP coverage.
- `skill/FAILURE_BUCKETS.md` — workflow failure taxonomy.
- `skill/BACKLOG.md` — current queue and maintenance rules.
- `skill/VALIDATION_RUNBOOK.md` — lean real-workflow validation prompts.
- `skill/NEXT_STEPS.md` — shortest maintainer handoff.
- `mcp/` — `did-mcp` TypeScript/R implementation, smoke tests, and MCP config
  example.
- `install.sh` — symlinks `skill/` into `~/.claude/skills/did-analysis/` and
  optionally builds `mcp/`.

## Maintainer Read Order

1. `skill/NEXT_STEPS.md`
2. `skill/BACKLOG.md`
3. `skill/METHOD_MATRIX.md`
4. `skill/VALIDATION_RUNBOOK.md`
5. `skill/SKILL.md`
6. Relevant step guides in `skill/references/`
7. `mcp/README.md` when changing MCP behavior

## Editing Rules

- Keep `skill/` self-contained: every path referenced by `skill/SKILL.md` must
  exist under `skill/` after `install.sh` symlinks it.
- Keep `skill/SKILL.md` as a router, not a second full manual.
- Put new workflow detail in the relevant step guide, not back into
  `skill/SKILL.md`.
- Keep the MCP tool names in `mcp/src/server.ts` synchronized with the tool map
  in `skill/SKILL.md` and `skill/METHOD_MATRIX.md`.
- Read `*_quick_start.md` before `*.md` when you need package-specific detail.
- Do not add a new package without updating `skill/SKILL.md`, the relevant step
  guide, `skill/METHOD_MATRIX.md`, and the full 3-file package doc set when
  appropriate.
- Files over 100 lines must have a `## Contents` section with markdown-linked
  anchors.
- Prefer built-in package datasets or standard package examples in docs and
  validation notes.

## Current State (2026-04-24)

### Completed

- `skill/` is the installable skill root and contains its `references/` docs.
- `SKILL.md` routes between tool-aware MCP execution and code-generation
  fallback.
- `mcp/` ships the full advertised 5-step workflow surface: session/ping,
  Step 1 loading/checking/profiling/recode/rollout, Step 2 TWFE diagnostics,
  Step 3 estimators/comparison/event-study extraction, Step 4 power analysis,
  Step 5 HonestDiD sensitivity, plus plotting, DRDID, and narrative reports.

### Known Limitations

- `HonestDiD_quick_start.md` still relies on `HonestDiD:::sunab_beta_vcv`.
- `pretrends` and `synthdid` remain GitHub-only packages.
- Some advanced-method workflows remain code-generation only; use MCP tools
  for covered `did_*` workflow steps and fall back to step-guide R code outside
  that surface.

### Next Work

- Keep `skill/METHOD_MATRIX.md`, `skill/SKILL.md`, and MCP tool registration in
  sync whenever a tool is added, renamed, or removed.
- Refresh `skill/references/package-versions.md` only after validation passes.
- Keep `skill/BACKLOG.md` evidence-driven rather than expanding scope
  speculatively.
