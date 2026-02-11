# DRDID: Quick Start

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
- For full arguments/examples, open `DRDID.md` at the referenced line.
- For repository-derived implementation tips and caveats, read `DRDID-additional.md`.

## Quick Workflow

1. Use `drdid(...)` as the primary doubly robust ATT entry point.
2. Choose `panel = TRUE/FALSE` to match data structure.
3. Use bootstrap options when inference assumptions are fragile.
4. Use low-level `*_panel` / `*_rc` functions only for diagnostics.

## Repository Highlights (From Additional Notes)

- The repo separates many low-level estimators (`*_panel`, `*_rc`, `*_imp_*`) from high-level wrappers (`drdid`, `ipwdid`, `ordid`).
- Bootstrap is deeply implemented via dedicated worker functions (`wboot_*`) across panel and repeated-cross-section settings.
- C++ hooks (`RcppExports`) are present for treatment uniqueness checks and preprocessing support.

## Layer 5 Source (GitHub)

- **Repo**: [pedrohcgs/DRDID](https://github.com/pedrohcgs/DRDID)
- **Key files**: `R/drdid.R`, `R/drdid_imp_panel.R`, `R/wboot_drdid_rc.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `drdid` | Locally efficient doubly robust DiD estimators for the ATT | `DRDID.md:60` |
| `drdid_imp_panel` | Improved locally efficient doubly robust DiD estimator for the ATT, with panel data | `DRDID.md:173` |
| `drdid_imp_rc` | Improved doubly robust DiD estimator for the ATT, with repeated cross-section data | `DRDID.md:251` |
| `drdid_imp_rc1` | Improved doubly robust DiD estimator for the ATT, with repeated cross-section data | `DRDID.md:339` |
| `drdid_panel` | Locally efficient doubly robust DiD estimator for the ATT, with panel data | `DRDID.md:420` |
| `drdid_rc` | Locally efficient doubly robust DiD estimator for the ATT, with repeated cross-section data | `DRDID.md:503` |
| `drdid_rc1` | Doubly robust DiD estimator for the ATT, with stationary repeated cross-section data | `DRDID.md:574` |
| `ipwdid` | Inverse probability weighted DiD estimators for the ATT | `DRDID.md:650` |
| `ipw_did_panel` | Inverse probability weighted DiD estimator, with panel data | `DRDID.md:751` |
| `ipw_did_rc` | Inverse probability weighted DiD estimator, with repeated crosssection data | `DRDID.md:831` |
| `nsw` | National Supported Work Demonstration dataset (Smith and Todd subsamples) | `DRDID.md:40` |
| `nsw_long` | National Supported Work Demonstration dataset, in long format | `DRDID.md:41` |
| `ordid` | Outcome regression DiD estimators for the ATT | `DRDID.md:971` |
| `reg_did_panel` | Outcome regression DiD estimator for the ATT, with panel data | `DRDID.md:1067` |
| `reg_did_rc` | Outcome regression DiD estimator for the ATT, with repeated cross-section data | `DRDID.md:1147` |
| `sim_rc` | Simulated repeated cross-section dataset (Sant'Anna and Zhao 2020 DGP1) | `DRDID.md:45` |
| `std_ipw_did_panel` | Standardized inverse probability weighted DiD estimator, with panel data | `DRDID.md:1247` |
| `std_ipw_did_rc` | Standardized inverse probability weighted DiD estimator, with repeated cross-section data | `DRDID.md:1323` |
| `twfe_did_panel` | Two-way fixed effects DiD estimator, with panel data | `DRDID.md:1390` |
| `twfe_did_rc` | Two-way fixed effects DiD estimator, with repeated cross-section data | `DRDID.md:1459` |

## Common Use Case Example

### Example 1: Panel data (matched units observed in both periods)

```r
library(DRDID)
data(nsw_long)

# Create evaluation dataset (treatment group + comparison group)
eval_lalonde_cps <- subset(nsw_long,
                          nsw_long$treated == 0 | nsw_long$sample == 2)

# Doubly robust DiD estimation with panel data
dr_panel <- drdid(
  yname = "re",              # Real earnings outcome
  tname = "year",            # Time variable
  idname = "id",             # Individual identifier
  dname = "experimental",    # Treatment group indicator
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = eval_lalonde_cps,
  panel = TRUE,              # Panel data structure
  boot = TRUE,               # Bootstrap inference
  nboot = 999
)

summary(dr_panel)
```

### Example 2: Repeated cross-section (different units across periods)

When individuals are not tracked over time, use `panel = FALSE`.

```r
library(DRDID)
data(sim_rc)   # Simulated repeated cross-section data

# Doubly robust DiD with repeated cross-section
dr_rc <- drdid(
  yname = "y",               # Outcome variable
  tname = "post",            # Time indicator (0 = pre, 1 = post)
  idname = "id",             # Unit identifier
  dname = "d",               # Treatment group indicator
  xformla = ~ x1 + x2 + x3 + x4,
  data = sim_rc,
  panel = FALSE              # Repeated cross-section
)

summary(dr_rc)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Jump directly to the exact function entry in `pkg.md` using the line pointer.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
