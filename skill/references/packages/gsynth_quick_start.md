# gsynth: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `gsynth.md` at the referenced line.
- For repository-derived computational notes, read `gsynth-additional.md`.

## Quick Workflow

1. Estimate counterfactuals with `gsynth(...)`.
2. Use `interFE(...)` for direct interactive fixed-effects modeling.
3. Plot and print using built-in S3 methods.
4. Use `cumuEff(...)` for cumulative/subgroup effect summaries.

## Layer 5 Source (GitHub)

- **Repo**: [xuyiqing/gsynth](https://github.com/xuyiqing/gsynth)
- **Key files**: `R/default.R`, `R/core.R`, `R/interFE.R`, `R/plot.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `gsynth-package` | Package overview and documentation entry point | `gsynth.md:24` |
| `cumuEff` | Computes cumulative treatment effects from gsynth output | `gsynth.md:64` |
| `gsynth` | Generalized synthetic control estimator with interactive fixed effects | `gsynth.md:104` |
| `gsynth-internal` | Internal helper functions for gsynth estimation | `gsynth.md:27` |
| `interFE` | Interactive fixed-effects estimator for panel data | `gsynth.md:277` |
| `plot.gsynth` | Plot method for gsynth estimation results | `gsynth.md:29` |
| `print.gsynth` | Print method for gsynth estimation results | `gsynth.md:30` |
| `print.interFE` | Print method for interFE estimation results | `gsynth.md:31` |
| `simdata` | Simulated panel dataset for gsynth examples | `gsynth.md:32` |
| `turnout` | Voter turnout dataset for gsynth examples | `gsynth.md:33` |

## Common Use Case Example

This example shows how to perform Generalized Synthetic Control estimation with cross-validation for factor selection and bootstrap standard errors using the built-in simulated dataset.

```r
library(gsynth)

# Load sample data (simulated dataset)
data(gsynth)

# Basic GSC estimation
gsc_result <- gsynth(
  formula = Y ~ D + X1 + X2,     # Outcome ~ Treatment + Controls
  data = simdata,                # Panel dataset
  index = c("id", "time"),       # Unit and time identifiers
  force = "two-way",             # Two-way fixed effects
  r = c(0, 5),                   # Test 0 to 5 factors
  CV = TRUE,                     # Cross-validation for r selection
  se = TRUE,                     # Calculate standard errors
  nboots = 500,                  # Bootstrap replications
  seed = 02139
)

# View results
print(gsc_result)
plot(gsc_result)
```

## Reading Strategy

- Use this file to choose `gsynth` vs `interFE` quickly.
- Open `gsynth.md` for full parameter-level detail.
- Use source references for solver/bootstrapping behavior checks.
