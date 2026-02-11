# DID Analysis Skill for Claude Code

A Claude Code skill that guides practitioners through modern Difference-in-Differences (DiD) causal inference analysis in R.

Covers the full workflow from Roth et al. (2023): treatment structure assessment, TWFE diagnostics, heterogeneity-robust estimation, power analysis for pre-trends, and HonestDiD sensitivity analysis.

## Packages Covered

bacondecomp, did, did2s, didimputation, DIDmultiplegt, DIDmultiplegtDYN, DRDID, etwfe, fixest, gsynth, HonestDiD, panelView, pretrends, staggered, synthdid, TwoWayFEWeights, YatchewTest

## Installation

### Personal skill (available in all your projects)

```bash
git clone https://github.com/zhangxiany-tamu/DID-skills.git \
  ~/.claude/skills/did-analysis
```

### Project skill (available to all collaborators)

```bash
git clone https://github.com/zhangxiany-tamu/DID-skills.git \
  .claude/skills/did-analysis
```

### Git subtree (for version-tracked project integration)

```bash
# First-time install
git subtree add --prefix=.claude/skills/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash

# Later updates
git subtree pull --prefix=.claude/skills/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash
```

## Usage

Once installed, the skill activates automatically when you discuss DiD topics with Claude Code. You can also invoke it directly:

```
/did-analysis
```

Example prompts that trigger the skill:
- "I have panel data with staggered treatment adoption. Help me estimate the ATT."
- "Run a Bacon decomposition to check for negative weights."
- "Set up a HonestDiD sensitivity analysis for my event study."

## Structure

```
SKILL.md                          # Entry point: decision trees, code templates
references/
├── did-step-{1-5}-*.md           # Step-level guides
├── did-advanced-methods.md       # Non-standard treatment patterns
├── did-troubleshooting.md        # Common errors and fixes
└── packages/                     # Per-package docs (17 packages x 3 files)
    ├── *_quick_start.md          # Package overview and function map
    ├── *.md                      # Full API documentation
    └── *-additional.md           # Supplementary notes
```

## License

MIT
