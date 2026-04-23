# DID Analysis Agent Skill

A general agent skill that guides practitioners through modern Difference-in-Differences (DiD) causal inference analysis in R.

Covers an expanded modern DiD workflow: treatment structure assessment, TWFE diagnostics, heterogeneity-robust estimation, power analysis for pre-trends, HonestDiD sensitivity analysis, and practical extensions developed in this skill.

## Packages Covered

bacondecomp, did, did2s, didimputation, DIDmultiplegt, DIDmultiplegtDYN, DRDID, etwfe, fixest, gsynth, HonestDiD, panelView, pretrends, staggered, synthdid, TwoWayFEWeights, YatchewTest

## Installation

Clone or subtree this repo into the skills directory used by your agent.

### Personal skill

- Codex: `~/.codex/skills/did-analysis`
- Claude Code: `~/.claude/skills/did-analysis`

### Project skill

- Codex: `.codex/skills/did-analysis`
- Claude Code: `.claude/skills/did-analysis`

### Git subtree

Use the matching project prefix for your agent:

```bash
# First-time install
git subtree add --prefix=<skills-dir>/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash

# Later updates
git subtree pull --prefix=<skills-dir>/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash
```

Replace `<skills-dir>` with `.codex/skills` or `.claude/skills`.

## Usage

Once installed, the skill activates automatically when you discuss DiD topics. In clients that support explicit skill invocation, use `did-analysis` (for example `/did-analysis` in Claude Code).

```
/did-analysis
```

Example prompts that trigger the skill:
- "I have panel data with staggered treatment adoption. Help me estimate the ATT."
- "Run a Bacon decomposition to check for negative weights."
- "Set up a HonestDiD sensitivity analysis for my event study."

## Maintainer Docs

The skill remains installable from repo root. Maintainer docs now live alongside it:

- `AGENTS.md` — repo-level instructions for Codex-compatible agents
- `NEXT_STEPS.md` — shortest maintainer handoff
- `BACKLOG.md` — active priorities and maintenance rules
- `METHOD_MATRIX.md` — method/package priority tiers
- `FAILURE_BUCKETS.md` — failure taxonomy for triage
- `VALIDATION_RUNBOOK.md` — lean workflow validation prompts

## Structure

```
SKILL.md                          # Runtime router: trigger conditions + workflow routing
AGENTS.md                         # Repo-level instructions for Codex-compatible agents
NEXT_STEPS.md                     # Short maintainer handoff
BACKLOG.md                        # Current priorities and validation queue
METHOD_MATRIX.md                  # Package/workflow tiers
FAILURE_BUCKETS.md                # Failure taxonomy
VALIDATION_RUNBOOK.md             # Manual validation prompts
references/
├── did-step-{1-5}-*.md           # Step-level guides
├── did-advanced-methods.md       # Non-standard treatment patterns
├── did-troubleshooting.md        # Common errors and fixes
└── packages/                     # Per-package docs (17 packages x 3 files)
    ├── *_quick_start.md          # Package overview and function map
    ├── *.md                      # Full API documentation
    └── *-additional.md           # Supplementary notes
```

## Maintenance Philosophy

This repo is intentionally a passive skill repository, not an executable product. The goal is to keep a small set of real DiD workflows highly trustworthy, update docs from real validation failures, and avoid over-engineering the maintenance layer.

## License

MIT
