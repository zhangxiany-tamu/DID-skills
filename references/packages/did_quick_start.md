# did: Quick Start

## Contents
- [How To Use This File](#how-to-use-this-file)
- [Quick Workflow](#quick-workflow)
- [Repository Highlights (From Additional Notes)](#repository-highlights-from-additional-notes)
- [Layer 5 Source (GitHub)](#layer-5-source-github)
- [Complete Function Map](#complete-function-map)
- [Common Use Case Example](#common-use-case-example)
- [Reading Strategy](#reading-strategy)

Read this file first. It gives the fast workflow, then a complete function index with pointers into the full manual.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `did.md` at the referenced line.
- For repository-derived implementation tips and caveats, read `did-additional.md`.

## Quick Workflow

1. Estimate ATT(g,t) with `att_gt(...)`.
2. Aggregate with `aggte(...)` (`dynamic`, `group`, `calendar`, `simple`).
3. Plot/report with `ggdid(...)` and summary helpers.
4. For robustness, pair with pretests and sensitivity workflows.

## Repository Highlights (From Additional Notes)

- The repo includes an internal `R/honest_did/` bridge (`honest_did.AGGTEobj`) for direct sensitivity workflows after `aggte`.
- There is an explicit pretest pipeline (`conditional_did_pretest`, multiplier bootstrap helpers) beyond core ATT estimation.
- Test suite is broad: point estimates, inference, pretest behavior, simulation consistency, and user bug regressions.

## Layer 5 Source (GitHub)

- **Repo**: [bcallaway11/did](https://github.com/bcallaway11/did)
- **Key files**: `R/att_gt.R`, `R/aggte.R`, `R/conditional_did_pretest.R`, `R/honest_did/honest_did.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `aggte` | Aggregate Group-Time Average Treatment Effects | `did.md:947` |
| `AGGTEobj` | Constructor for aggregate treatment effect objects | `did.md:254` |
| `att_gt` | Group-Time Average Treatment Effects | `did.md:308` |
| `build_sim_dataset` | build_sim_dataset | `did.md:515` |
| `conditional_did_pretest` | Conditional pre-trend test for DiD designs | `did.md:547` |
| `did` | Difference in Differences | `did.md:30` |
| `DIDparams` | Constructor for DID estimation parameter objects | `did.md:290` |
| `ggdid` | Plot did objects using ggplot2 | `did.md:716` |
| `ggdid.AGGTEobj` | Plot AGGTEobj objects | `did.md:33` |
| `ggdid.MP` | Plot MP objects using ggplot2 | `did.md:34` |
| `glance.AGGTEobj` | glance model characteristics from AGGTEobj objects | `did.md:35` |
| `glance.MP` | Glance method for MP (group-time ATT) objects | `did.md:36` |
| `indicator` | indicator | `did.md:856` |
| `mboot` | Multiplier Bootstrap | `did.md:884` |
| `MP` | MP | `did.md:83` |
| `MP.TEST` | MP.TEST | `did.md:963` |
| `mpdta` | County Teen Employment Dataset | `did.md:41` |
| `pre_process_did` | Process did Function Arguments | `did.md:1031` |
| `print.AGGTEobj` | print.AGGTEobj | `did.md:43` |
| `print.MP` | Print method for MP (group-time ATT) objects | `did.md:1117` |
| `process_attgt` | Process Results from compute.att_gt() | `did.md:1144` |
| `reset.sim` | Resets simulation parameters to defaults | `did.md:1179` |
| `sim` | Simulation function for DGP testing | `did.md:1200` |
| `summary.AGGTEobj` | Summary Aggregate Treatment Effect Parameter Objects | `did.md:48` |
| `summary.MP` | Summary method for MP (group-time ATT) objects | `did.md:1246` |
| `summary.MP.TEST` | summary.MP.TEST | `did.md:50` |
| `test.mboot` | Multiplier Bootstrap for Conditional Moment Test | `did.md:1291` |
| `tidy.AGGTEobj` | tidy results from AGGTEobj objects | `did.md:52` |
| `tidy.MP` | tidy results from MP objects | `did.md:53` |
| `trimmer` | Trims extreme propensity score values for robust estimation | `did.md:1348` |

## Common Use Case Example

This example estimates group-time average treatment effects using county-level teen employment data with staggered minimum wage adoption, then aggregates to an event study and an overall ATT. Uses `control_group = "notyettreated"` (the recommended default when there are few never-treated units) and doubly robust estimation.

```r
library(did)
data(mpdta)

# Estimate group-time ATTs
out <- att_gt(
  yname = "lemp",
  gname = "first.treat",
  idname = "countyreal",
  tname = "year",
  xformla = ~1,
  data = mpdta,
  est_method = "dr",                       # doubly robust (default)
  control_group = "notyettreated"          # recommended over "nevertreated"
)

# View group-time ATT estimates
summary(out)

# Plot group-time effects
ggdid(out, ylim = c(-.25, .1))

# Aggregate to event study (most common reporting format)
es <- aggte(out, type = "dynamic")
summary(es)
ggdid(es)

# Simple weighted ATT (single number summary)
simple <- aggte(out, type = "simple")
cat(sprintf("Overall ATT: %.4f (SE: %.4f)\n", simple$overall.att, simple$overall.se))

# Group-specific effects
group_effects <- aggte(out, type = "group")
summary(group_effects)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Jump directly to the exact function entry in `pkg.md` using the line pointer.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
