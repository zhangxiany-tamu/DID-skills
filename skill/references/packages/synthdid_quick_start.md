# synthdid: Quick Start

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
- For full arguments/examples, open `synthdid.md` at the referenced line.
- For repository-derived implementation tips and caveats, read `synthdid-additional.md`.

## Quick Workflow

1. Build `Y`, `N0`, `T0` via `panel.matrices(...)` for balanced panel input.
2. Estimate with `synthdid_estimate(...)` (or `sc_estimate(...)` / `did_estimate(...)`).
3. Compute uncertainty with `vcov(...)` / `synthdid_se(...)`.
4. Diagnose fit and weights with plotting and control-weight functions.

## Repository Highlights (From Additional Notes)

- The repo includes extensive experimental scripts and benchmark checks in addition to package code.
- Inference methods are explicit in `vcov.R` (placebo, bootstrap, jackknife), useful for sensitivity to SE method choice.
- Plotting support is rich (`synthdid_plot`, `synthdid_units_plot`, placebo plots) and can be standardized for reporting.

## Layer 5 Source (GitHub)

- **Repo**: [synth-inference/synthdid](https://github.com/synth-inference/synthdid)
- **Key files**: `R/synthdid.R`, `R/vcov.R`, `R/plot.R`, `R/solver.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `synthdid_estimate` | Synthetic difference-in-differences estimator | `synthdid.md:58` |
| `sc_estimate` | Standard synthetic control estimator | `synthdid.md:134` |
| `did_estimate` | Standard difference-in-differences estimator | `synthdid.md:167` |
| `synthdid_effect_curve` | Extracts time-varying treatment effect curve | `synthdid.md:203` |
| `synthdid_placebo` | Computes placebo treatment effects for inference | `synthdid.md:233` |
| `synthdid_controls` | Extracts control unit weights from synthdid estimation | `synthdid.md:264` |
| `vcov.synthdid_estimate` | Variance-covariance matrix for synthdid estimates (placebo/bootstrap/jackknife) | `synthdid.md:309` |
| `synthdid_se` | Standard errors for synthdid estimates | `synthdid.md:354` |
| `panel.matrices` | Converts long-format panel data to matrix form (Y, N0, T0) | `synthdid.md:377` |
| `timesteps` | Extracts time period labels from panel matrices | `synthdid.md:425` |
| `synthdid_plot` | Detailed plot of synthetic control trajectories and treatment effects | `synthdid.md:459` |
| `plot.synthdid_estimate` | Plot method for synthdid estimate objects | `synthdid.md:553` |
| `synthdid_units_plot` | Plots individual unit contributions to the estimate | `synthdid.md:582` |
| `synthdid_placebo_plot` | Plots placebo treatment effects distribution | `synthdid.md:624` |
| `synthdid_rmse_plot` | Plots RMSE of pre-treatment fit across units | `synthdid.md:654` |
| `summary.synthdid_estimate` | Summary method for synthdid estimate objects | `synthdid.md:685` |
| `print.synthdid_estimate` | Print method for synthdid estimate objects | `synthdid.md:721` |
| `format.synthdid_estimate` | Format method for synthdid estimate objects | `synthdid.md:742` |
| `estimate_dgp` | Estimates data-generating process parameters from data | `synthdid.md:769` |
| `simulate_dgp` | Simulates panel data from estimated DGP parameters | `synthdid.md:797` |
| `randomize_treatment` | Randomizes treatment assignment for placebo tests | `synthdid.md:821` |
| `decompose_Y` | Decomposes outcome matrix into components | `synthdid.md:842` |
| `fit_ar2` | Fits AR(2) model to residuals | `synthdid.md:866` |
| `ar2_correlation_matrix` | Builds correlation matrix from AR(2) parameters | `synthdid.md:885` |
| `lindsey_density_estimate` | Lindsey's method for density estimation | `synthdid.md:905` |
| `sparsify_function` | Zeros out small weights below threshold | `synthdid.md:934` |
| `california_prop99` | California Proposition 99 cigarette consumption dataset (1970-2000) | `synthdid.md:957` |
| `CPS` | Current Population Survey data for placebo simulation studies | `synthdid.md:976` |
| `PENN` | Penn World Table data for placebo simulation studies | `synthdid.md:997` |
| `sc.weight.fw` | Frank-Wolfe solver for synthetic control weights | `synthdid.md:1019` |
| `sc.weight.fw.covariates` | Frank-Wolfe solver with covariate matching | `synthdid.md:1022` |
| `fw.step` | Single Frank-Wolfe optimization step | `synthdid.md:1025` |
| `collapsed.form` | Collapses panel data for computational efficiency | `synthdid.md:1028` |
| `contract3` | Contracts 3-dimensional array along specified dimension | `synthdid.md:1031` |
| `sum_normalize` | Normalizes weights to sum to one | `synthdid.md:1034` |
| `pairwise.sum.decreasing` | Stable pairwise summation in decreasing order | `synthdid.md:1037` |

## Common Use Case Example

This example demonstrates the core functionality of the synthdid package using the built-in California Proposition 99 dataset, which analyzes the effect of California's tobacco tax on cigarette consumption.

```r
library(synthdid)

# Load built-in dataset (California cigarette consumption)
data('california_prop99')

# Prepare data matrices
setup <- panel.matrices(california_prop99)

# Estimate treatment effect
tau.hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Calculate standard errors using placebo method
se <- sqrt(vcov(tau.hat, method='placebo'))

# Display results
sprintf('Point estimate: %1.2f', tau.hat)
sprintf('95%% CI: (%1.2f, %1.2f)',
        tau.hat - 1.96 * se,
        tau.hat + 1.96 * se)

# Plot results
plot(tau.hat)
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Jump directly to the exact function entry in `pkg.md` using the line pointer.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
