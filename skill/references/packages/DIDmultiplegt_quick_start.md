# DIDmultiplegt: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `DIDmultiplegt.md` at the referenced line.
- For repository-derived caveats and branch differences, read `DIDmultiplegt-additional.md`.

## Quick Workflow

1. Start with `did_multiplegt(mode = ...)` and choose `"dyn"`, `"had"`, or `"old"`.
2. Use `mode = "dyn"` for most modern event-study use cases.
3. Use `did_multiplegt_old(...)` only for legacy replication.
4. Use `wagepan_mgt` for quick smoke tests.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/did_multiplegt](https://github.com/Credible-Answers/did_multiplegt)
- **Key files**: `R/R/did_multiplegt_main.R`, `R/R/did_multiplegt_dyn.R`
- See also: [Credible-Answers/did_multiplegt_dyn](https://github.com/Credible-Answers/did_multiplegt_dyn) (the DYN backend)

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `did_multiplegt` | Heterogeneity-robust DiD estimator for multiple groups and periods | `DIDmultiplegt.md:44` |
| `did_multiplegt_old` | Legacy version of the de Chaisemartin-D'Haultfoeuille estimator | `DIDmultiplegt.md:94` |
| `wagepan_mgt` | Wage panel dataset for package examples | `DIDmultiplegt.md:30` |

## Common Use Case Example

This example demonstrates basic usage with the package's built-in wage panel data, comparing static and dynamic estimators.

```r
# NOTE: DIDmultiplegt v2.0.0+ depends on DIDmultiplegtDYN which requires polars.
# Load polars first to ensure the 'pl' object is on the search path.
library(polars)
library(DIDmultiplegt)

# Load sample data
data("wagepan_mgt", package = "DIDmultiplegt")

# Dynamic/event study estimator via mode = "dyn"
# (a plot is produced automatically unless graph_off = TRUE)
result_dynamic <- did_multiplegt(
  mode = "dyn",
  df = wagepan_mgt,
  outcome = "lwage",        # Outcome variable
  group = "nr",             # Group variable (individual ID)
  time = "year",            # Time variable
  treatment = "union",      # Treatment variable
  effects = 5,              # Number of effects to estimate
  placebo = 2               # Number of placebo tests
)

# View results
summary(result_dynamic)
```

## Reading Strategy

- Pick the estimator mode here first.
- Open `DIDmultiplegt.md` for full argument-level details.
- Use `DIDmultiplegt-additional.md` and source files for implementation differences across branches.
