# HonestDiD: Quick Start

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
- For full arguments/examples, open `HonestDiD.md` at the referenced line.
- For repository-derived implementation tips and caveats, read `HonestDiD-additional.md`.

## Quick Workflow

1. Prepare event-study `betahat`, `sigma`, and pre/post period counts.
2. Run `createSensitivityResults_relativeMagnitudes(...)` over a grid of M values.
3. Compare with `constructOriginalCS(...)` baseline intervals.
4. Report breakdown M and robust intervals in final inference.

## Repository Highlights (From Additional Notes)

- The repo implements multiple restriction families (RM/RMB/RMM/SD/SDM/SDRM/SDRMB/SDRMM) as separate computational paths.
- There is explicit support code for `fixest::sunab` objects (`sunab_beta_vcv`) in addition to AGGTE workflows.
- Sensitivity plotting and CI construction are centralized in `sensitivityresults.R` with reusable helpers.

## Layer 5 Source (GitHub)

- **Repo**: [asheshrambachan/HonestDiD](https://github.com/asheshrambachan/HonestDiD)
- **Key files**: `R/sensitivityresults.R`, `R/honest_sunab.R` (sunab_beta_vcv), `R/honest_did.R`, `R/flci.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `basisVector` | Creates a standard basis vector. | `HonestDiD.md:61` |
| `BCdata_EventStudy` | Benzarti and Carloni event study dataset | `HonestDiD.md:31` |
| `computeConditionalCS_DeltaRM` | Conditional confidence set under relative magnitudes restrictions | `HonestDiD.md:108` |
| `computeConditionalCS_DeltaRMB` | Conditional confidence set under bounded relative magnitudes restrictions | `HonestDiD.md:139` |
| `computeConditionalCS_DeltaRMM` | Conditional confidence set under monotone relative magnitudes restrictions | `HonestDiD.md:194` |
| `computeConditionalCS_DeltaSD` | Conditional confidence set under smoothness (DeltaSD) restrictions | `HonestDiD.md:256` |
| `computeConditionalCS_DeltaSDB` | Conditional confidence set under bounded smoothness restrictions | `HonestDiD.md:311` |
| `computeConditionalCS_DeltaSDM` | Conditional confidence set under monotone smoothness restrictions | `HonestDiD.md:363` |
| `computeConditionalCS_DeltaSDRM` | Conditional confidence set under smoothness + relative magnitudes restrictions | `HonestDiD.md:415` |
| `computeConditionalCS_DeltaSDRMB` | Conditional confidence set under bounded smoothness + relative magnitudes | `HonestDiD.md:471` |
| `computeConditionalCS_DeltaSDRMM` | Conditional confidence set under monotone smoothness + relative magnitudes | `HonestDiD.md:531` |
| `constructOriginalCS` | Constructs original confidence interval for parameter of interest, theta = l_vec'tau. | `HonestDiD.md:593` |
| `createEventStudyPlot` | Constructs event study plot | `HonestDiD.md:641` |
| `createSensitivityPlot` | Plots sensitivity analysis results (smoothness restrictions) | `HonestDiD.md:698` |
| `createSensitivityPlot_relativeMagnitudes` | Plots sensitivity analysis results (relative magnitudes restrictions) | `HonestDiD.md:760` |
| `createSensitivityResults` | Computes sensitivity analysis under smoothness restrictions | `HonestDiD.md:731` |
| `createSensitivityResults_relativeMagnitudes` | Computes sensitivity analysis under relative magnitudes restrictions | `HonestDiD.md:885` |
| `DeltaSD_lowerBound_Mpre` | Lower bound on M under DeltaSD restrictions using pre-period data | `HonestDiD.md:970` |
| `DeltaSD_upperBound_Mpre` | Upper bound on M under DeltaSD restrictions using pre-period data | `HonestDiD.md:1003` |
| `findOptimalFLCI` | Finds optimal fixed-length confidence interval for treatment effect | `HonestDiD.md:1028` |
| `LWdata_EventStudy` | Event study estimates from baseline female specification on employment in Lovenheim & Willen (2019). See discussion i... | `HonestDiD.md:50` |

## Common Use Case Example

### Example 1: Sensitivity analysis with built-in data

This demonstrates the core HonestDiD workflow: compute sensitivity results over a grid of Mbar values, compare with original (conventional) confidence set, and produce the sensitivity plot that is the main reporting deliverable.

```r
library(HonestDiD)

# Load built-in event study data (Lovenheim & Willen 2019)
data(LWdata_EventStudy)

betahat <- LWdata_EventStudy$betahat
sigma   <- LWdata_EventStudy$sigma

# Sensitivity analysis: how do conclusions change as we allow
# post-treatment violations up to Mbar × max pre-treatment violation?
delta_rm_results <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat,
  sigma = sigma,
  numPrePeriods = length(betahat) - 1,
  numPostPeriods = 1,
  Mbarvec = seq(0.5, 2, by = 0.5)
)

# Original (conventional) confidence set for comparison baseline
original_cs <- constructOriginalCS(
  betahat = betahat,
  sigma = sigma,
  numPrePeriods = length(betahat) - 1,
  numPostPeriods = 1
)

# KEY OUTPUT: Sensitivity plot showing CI widening as Mbar increases
# The "breakdown" Mbar is where CI first includes zero
createSensitivityPlot_relativeMagnitudes(delta_rm_results, original_cs)
```

### Example 2: Extracting betahat/sigma from fixest::sunab

In practice, you start from an event-study model, not pre-packaged data. Here's how to extract the inputs HonestDiD needs from a `fixest::sunab` model.

```r
library(fixest)
library(HonestDiD)

# Fit a Sun-Abraham event study
data(base_stagg)
sa <- feols(y ~ sunab(year_treated, year) | id + year,
            data = base_stagg, cluster = ~id)

# Extract aggregated betahat and vcov using HonestDiD's helper
# (sunab_beta_vcv handles the cohort-to-period aggregation internally)
# NOTE: sunab_beta_vcv is not exported; ::: is required. No public alternative exists.
# This may break if HonestDiD changes internals in a future version.
sa_extract <- HonestDiD:::sunab_beta_vcv(sa)
betahat <- as.numeric(sa_extract$beta)   # convert Nx1 matrix to vector
sigma   <- sa_extract$sigma
cohorts <- sa_extract$cohorts            # relative time periods

numPrePeriods  <- sum(cohorts < 0)
numPostPeriods <- sum(cohorts >= 0)

# Run sensitivity analysis
sens <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat, sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods,
  Mbarvec = seq(0.5, 2, by = 0.5)
)

orig <- constructOriginalCS(
  betahat = betahat, sigma = sigma,
  numPrePeriods = numPrePeriods,
  numPostPeriods = numPostPeriods
)

createSensitivityPlot_relativeMagnitudes(sens, orig)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Jump directly to the exact function entry in `pkg.md` using the line pointer.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
