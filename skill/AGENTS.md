# Project: DID_Skills

This is a **skills-only repository**. It contains one installable skill, `did-analysis`, plus the markdown docs needed to maintain it.

## What This Repo Is

- A knowledge base for modern Difference-in-Differences workflows in R
- A root-installable skill: Codex users copy or subtree this repo directly into `.codex/skills/did-analysis/`
- A passive documentation repo: code blocks are reference templates, not runnable project scripts

## What This Repo Is NOT

- Not an R package
- Not an MCP server or executable runtime
- Not a dataset repository

## Repo Map

- `SKILL.md` — thin runtime router; keep it concise
- `references/` — step guides, advanced methods, troubleshooting, package docs
- `METHOD_MATRIX.md` — method/package priority tiers
- `FAILURE_BUCKETS.md` — workflow failure taxonomy
- `BACKLOG.md` — current queue and maintenance rules
- `VALIDATION_RUNBOOK.md` — lean real-workflow validation prompts
- `NEXT_STEPS.md` — shortest maintainer handoff

## Maintainer Read Order

1. `NEXT_STEPS.md`
2. `BACKLOG.md`
3. `METHOD_MATRIX.md`
4. `VALIDATION_RUNBOOK.md`
5. `SKILL.md`
6. Relevant step guides in `references/`

## Editing Rules

- Keep the repo root installable exactly as it is now.
- Keep `SKILL.md` as a router, not a second full manual.
- Put new workflow detail in the relevant step guide, not back into `SKILL.md`.
- Read `*_quick_start.md` before `*.md` when you need package-specific detail.
- Do not add a new package without updating `SKILL.md`, the relevant step guide, `METHOD_MATRIX.md`, and the full 3-file package doc set when appropriate.
- Files over 100 lines must have a `## Contents` section with markdown-linked anchors.
- Prefer built-in package datasets or standard package examples in docs and validation notes.

## Style Rules For Reference Files

- Include `library()` calls in runnable examples.
- Use consistent DiD parameter names such as `yname`, `tname`, `idname`, and `gname` where possible.
- Treat the step guides as the authoritative workflow contracts.

## Current State (2026-04-09)

### Completed

- Root install path preserved
- `SKILL.md` slimmed into a routing-focused entry point
- Added maintainer docs: `NEXT_STEPS.md`, `BACKLOG.md`, `METHOD_MATRIX.md`, `FAILURE_BUCKETS.md`, `VALIDATION_RUNBOOK.md`
- Kept workflow detail centered in the existing step guides
- Expanded installation troubleshooting for macOS/Homebrew and toolchain issues
- Recorded the first lean validation cycle and synced `references/package-versions.md` to that pass

### Known Limitations

- `HonestDiD_quick_start.md` still relies on `HonestDiD:::sunab_beta_vcv`
- `pretrends` and `synthdid` remain GitHub-only packages
- `panelView` is still missing from the local validation environment
- Newer `DIDmultiplegtDYN` `polars` behavior has not been revalidated locally

### Next Work

- Run the follow-up workflows in `VALIDATION_RUNBOOK.md`
- Refresh `references/package-versions.md` only after the next validation pass
- Keep `BACKLOG.md` evidence-driven rather than expanding scope speculatively
