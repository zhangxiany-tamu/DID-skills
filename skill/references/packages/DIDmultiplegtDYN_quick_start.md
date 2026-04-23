# DIDmultiplegtDYN: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `DIDmultiplegtDYN.md` at the referenced line.
- For repository-derived caveats and branch/version notes, read `DIDmultiplegtDYN-additional.md`.

## Quick Workflow

1. Estimate dynamic effects with `did_multiplegt_dyn(...)`.
2. Use design/placebo options before interpreting effects.
3. Summarize and print results with the package S3 helpers.
4. Test scripts quickly with `favara_imbs`.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/did_multiplegt_dyn](https://github.com/Credible-Answers/did_multiplegt_dyn)
- **Key files**: `R/R/did_multiplegt_dyn.R`, `R/R/did_multiplegt_bootstrap.R`, `R/R/did_multiplegt_dyn_design.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `did_multiplegt_dyn` | Core heterogeneity-robust dynamic DID estimator | `DIDmultiplegtDYN.md:45` |
| `favara_imbs` | Example dataset used by package examples | `DIDmultiplegtDYN.md:28` |
| `print.did_multiplegt_dyn` | Print method for model results | `DIDmultiplegtDYN.md:29` |
| `rnames.did_multiplegt_dyn` | Helper for result naming/output formatting | `DIDmultiplegtDYN.md:30` |
| `summary.did_multiplegt_dyn` | Summary method for model results | `DIDmultiplegtDYN.md:31` |

## Common Use Case Example

This example shows dynamic DiD estimation using the Favara and Imbs banking deregulation dataset included in the package.

```r
# NOTE: DIDmultiplegtDYN v2.3.0+ requires the polars package.
# Load polars first to ensure the 'pl' object is on the search path.
library(polars)
library(DIDmultiplegtDYN)

# Load sample data
data(favara_imbs)

# Basic dynamic estimation (a plot is produced automatically unless graph_off = TRUE)
result <- did_multiplegt_dyn(
  df = favara_imbs,
  outcome = "Dl_vloans_b",      # Change in log loan volume
  group = "county",             # County identifier
  time = "year",                # Year
  treatment = "inter_bra",      # Interstate branching deregulation
  effects = 8,                  # Estimate effects up to 8 periods
  placebo = 3,                  # Test 3 pre-treatment periods
  cluster = "state_n"           # Cluster by state
)

# View results
summary(result)
```

## Reading Strategy

- Use this file to pick core options quickly.
- Jump to `DIDmultiplegtDYN.md` for full parameter details.
- Use `DIDmultiplegtDYN-additional.md` when branch/version behavior matters.
