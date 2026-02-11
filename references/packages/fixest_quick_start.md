# fixest: Quick Start

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
- For full arguments/examples, open `fixest.md` at the referenced line.
- For repository-derived implementation tips and caveats, read `fixest-additional.md`.

## Quick Workflow

1. Fit high-dimensional FE models with `feols(...)` / `feglm(...)`.
2. For DiD/event-study, use interaction tools (`sunab`, `i`).
3. Summarize/infer with `summary(...)`, `coeftable(...)`, `vcov_*`.
4. Export and compare models via table/plot utilities.

## Repository Highlights (From Additional Notes)

- 14 DiD-relevant R source files available in the GitHub source repository for deep function inspection.
- `fixest.md` remains the primary reference for function arguments and usage patterns.
- For DiD usage, center workflows on `feols(..., sunab(...))` and post-estimation plotting.

## Layer 5 Source (GitHub)

- **Repo**: [lrberge/fixest](https://github.com/lrberge/fixest)
- **Key files**: `R/did.R` (sunab), `R/estimation.R` (feols), `R/iplot.R`, `R/coefplot.R`, `R/etable.R`, `R/miscfuns.R` (i, did_means), `R/panel.R`, `R/VCOV.R`, `R/methods.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `aggregate.fixest` | Aggregates the values of DiD coefficients a la Sun and Abraham | `fixest.md:31` |
| `AIC.fixest` | Aikake's an information criterion | `fixest.md:32` |
| `as.dict` | Transforms a character string into a dictionary | `fixest.md:271` |
| `as.list.fixest_multi` | Transforms a fixest_multi object into a list | `fixest.md:34` |
| `base_did` | Sample data for canonical 2x2 difference-in-differences | `fixest.md:35` |
| `base_stagg` | Sample data for staggered difference in difference | `fixest.md:36` |
| `BIC.fixest` | Bayesian information criterion | `fixest.md:37` |
| `bin` | Bins the values of a variable (typically a factor) | `fixest.md:462` |
| `bread.fixest` | Extracts the bread matrix from fixest objects | `fixest.md:39` |
| `check_conv_feols` | Check the fixed-effects convergence of a feols estimation | `fixest.md:612` |
| `coef.fixest` | Extracts the coefficients from a fixest estimation | `fixest.md:41` |
| `coef.fixest_multi` | Extracts the coefficients of fixest_multi objects | `fixest.md:42` |
| `coefplot` | Plots confidence intervals and point estimates | `fixest.md:792` |
| `coeftable` | Extracts the coefficients table from an estimation | `fixest.md:3555` |
| `coeftable.default` | Default method for coefficient table extraction | `fixest.md:45` |
| `coeftable.fixest` | Obtain various statistics from an estimation | `fixest.md:46` |
| `coeftable.fixest_multi` | Coefficient table extraction for fixest_multi objects | `fixest.md:47` |
| `collinearity` | Detects and reports collinearity among variables | `fixest.md:1495` |
| `confint.fixest` | Confidence interval for parameters estimated with fixest | `fixest.md:49` |
| `confint.fixest_multi` | Confidence intervals for fixest_multi objects | `fixest.md:50` |
| `degrees_freedom` | Gets the degrees of freedom of a fixest estimation | `fixest.md:1669` |
| `demean` | Demeans variables with respect to fixed effects | `fixest.md:1734` |
| `demeaning_algo` | Controls the parameters of the demeaning procedure | `fixest.md:1866` |
| `deviance.fixest` | Extracts the deviance of a fixest estimation | `fixest.md:54` |
| `df.residual.fixest` | Residual degrees-of-freedom for fixest objects | `fixest.md:55` |
| `did_means` | Treated and control sample descriptives | `fixest.md:1992` |
| `dsb` | String interpolation utility for dynamic formula construction | `fixest.md:2070` |
| `emmeans_support` | Support for emmeans package | `fixest.md:58` |
| `estfun.fixest` | Extracts the scores from a fixest estimation | `fixest.md:59` |
| `esttable` | Alias for etable; exports estimation results as formatted tables | `fixest.md:2451` |
| `est_env` | Estimates a fixest estimation from a fixest environment | `fixest.md:3131` |
| `extralines_register` | Register extralines macros to be used in etable | `fixest.md:3220` |
| `f` | Alias for fixef; extracts fixed-effects from estimation | `fixest.md:4176` |
| `fdim` | Formatted dimension | `fixest.md:3325` |
| `feglm` | Fixed-effects GLM estimations | `fixest.md:3355` |
| `femlm` | Fixed-effects maximum likelihood models | `fixest.md:3716` |
| `feNmlm` | Fixed effects nonlinear maximum likelihood models | `fixest.md:4033` |
| `feols` | Fixed-effects OLS estimation | `fixest.md:3304` |
| `fitstat` | Computes and displays fit statistics for fixest models | `fixest.md:2718` |
| `fitstat_register` | Register custom fit statistics | `fixest.md:4869` |
| `fitted.fixest` | Extracts fitted values from a fixest fit | `fixest.md:71` |
| `fixef.fixest` | Extract the Fixed-Effects from a fixest estimation. | `fixest.md:72` |
| `fixest_data` | Retrieves the data set used for a fixest estimation | `fixest.md:5084` |
| `fixest_startup_msg` | Permanently removes the fixest package startup message | `fixest.md:5118` |
| `formula.fixest` | Extract the formula of a fixest fit | `fixest.md:75` |
| `hatvalues.fixest` | Hat values for fixest objects | `fixest.md:76` |
| `i` | Creates interactions and indicator variables for use in fixest formulas | `fixest.md:9062` |
| `lag.formula` | Creates lagged/lead variables in panel formulas | `fixest.md:78` |
| `logLik.fixest` | Extracts the log-likelihood from a fixest estimation | `fixest.md:79` |
| `model.matrix.fixest` | Design matrix of a fixest object | `fixest.md:80` |
| `models` | Extracts the models tree from a fixest_mult i object | `fixest.md:5553` |
| `nobs.fixest` | Returns the number of observations used in a fixest estimation | `fixest.md:82` |
| `n_models` | Gets the dimension of fixest_multi objects | `fixest.md:5632` |
| `n_unik` | Prints the number of unique elements in a data set | `fixest.md:5685` |
| `obs` | Extracts the observations used for the estimation | `fixest.md:5793` |
| `osize` | Offset variable specification for count/GLM models | `fixest.md:5830` |
| `panel` | Constructs a fixest panel data base | `fixest.md:7207` |
| `plot.fixest.fixef` | Displaying the most notable fixed-effects | `fixest.md:88` |
| `predict.fixest` | Predict method for fixest fits | `fixest.md:89` |
| `print.fixest` | A print facility for fixest objects. | `fixest.md:90` |
| `print.fixest_fitstat` | Print method for fit statistics of fixest estimations | `fixest.md:91` |
| `print.fixest_multi` | Print method for fixest_multi objects | `fixest.md:92` |
| `r2` | R2s of fixest models | `fixest.md:6250` |
| `ref` | Sets reference level for factor interactions in fixest formulas | `fixest.md:970` |
| `rep.fixest` | Replicates fixest objects | `fixest.md:95` |
| `resid.fixest` | Extracts residuals from a fixest object | `fixest.md:96` |
| `resid.fixest_multi` | Extracts the residuals from a fixest_multi object | `fixest.md:97` |
| `sample_df` | Sample data frame for testing and examples | `fixest.md:6558` |
| `setFixest_coefplot` | Sets the defaults of coefplot | `fixest.md:1116` |
| `setFixest_dict` | Sets/gets the dictionary relabeling the variables | `fixest.md:6752` |
| `setFixest_estimation` | Default arguments for fixest estimations | `fixest.md:4762` |
| `setFixest_fml` | Sets/gets formula macros | `fixest.md:2964` |
| `setFixest_multi` | Sets properties of fixest_multi objects | `fixest.md:7081` |
| `setFixest_notes` | Sets/gets whether to display notes in fixest estimation functions | `fixest.md:7122` |
| `setFixest_nthreads` | Sets/gets the number of threads to use in fixest functions | `fixest.md:7152` |
| `setFixest_vcov` | Sets the default type of standard errors to be used | `fixest.md:7186` |
| `sigma.fixest` | Extracts residual standard error from a fixest estimation | `fixest.md:107` |
| `ssc` | Small-sample correction settings for standard errors | `fixest.md:1310` |
| `stepwise` | Stepwise estimation tools | `fixest.md:109` |
| `style.df` | Styling options for data.frame output from etable | `fixest.md:2752` |
| `style.tex` | Styling options for LaTeX output from etable | `fixest.md:2781` |
| `summary.fixest` | Summary method for fixest estimation objects | `fixest.md:7667` |
| `summary.fixest.fixef` | Summary method for fixed-effects coefficients | `fixest.md:113` |
| `summary.fixest_multi` | Summary for fixest_multi objects | `fixest.md:114` |
| `sunab` | Sun and Abraham interactions | `fixest.md:7946` |
| `terms.fixest` | Extract the terms | `fixest.md:116` |
| `to_integer` | Fast transform of any type of vector(s) into an integer vector | `fixest.md:8097` |
| `trade` | Bilateral trade dataset (38,325 observations of trade flows) | `fixest.md:118` |
| `unpanel` | Dissolves a fixest panel | `fixest.md:8185` |
| `update.fixest` | Updates and re-fits a fixest model with modified formula/data | `fixest.md:120` |
| `vcov.fixest` | Computes the variance/covariance of a fixest object | `fixest.md:121` |
| `vcov_cluster` | Cluster-robust variance-covariance matrix estimator | `fixest.md:8468` |
| `vcov_conley` | Conley VCOV | `fixest.md:8531` |
| `vcov_hac` | HAC (Newey-West) variance-covariance matrix estimator | `fixest.md:8590` |
| `wald` | Wald test of nullity of coefficients | `fixest.md:8712` |
| `weights.fixest` | Extracts the weights from a fixest object | `fixest.md:126` |
| `xpd` | Expands formula macros defined with setFixest_fml | `fixest.md:6943` |
| `[.fixest_multi` | Subsets a fixest_multi object | `fixest.md:128` |
| `[.fixest_panel` | Method to subselect from a fixest_panel | `fixest.md:129` |
| `[[.fixest_multi` | Extracts one element from a fixest_multi object | `fixest.md:130` |

## Common Use Case Example

This example demonstrates the most common fixest DiD workflow: comparing standard TWFE (potentially biased) against the Sun-Abraham heterogeneity-robust estimator, using `etable()` for side-by-side comparison and `iplot()` for event study visualization.

```r
library(fixest)
data(base_stagg)

# Standard TWFE event study (potentially biased under heterogeneous effects)
twfe <- feols(
  y ~ i(time_to_treatment, ref = c(-1, -1000)) | id + year,
  data = base_stagg, cluster = ~id
)

# Sun-Abraham interaction-weighted estimator (heterogeneity-robust)
sa <- feols(
  y ~ sunab(year_treated, year) | id + year,
  data = base_stagg, cluster = ~id
)

# Side-by-side comparison table
etable(twfe, sa, headers = c("TWFE", "Sun-Abraham"))

# Overlaid event study plot — reveals bias in TWFE if present
iplot(list(twfe, sa), sep = 0.2,
      main = "Event Study: TWFE vs Sun-Abraham",
      xlab = "Periods Relative to Treatment",
      ref.line = -0.5)
legend("topleft", col = 1:2, pch = 20, legend = c("TWFE", "Sun-Abraham"))

# Aggregate Sun-Abraham to overall ATT
aggregate(sa, agg = "ATT")
```

## Reading Strategy

- Use this quick-start file to choose the right function first.
- Jump directly to the exact function entry in `pkg.md` using the line pointer.
- Use `-additional.md` for implementation caveats and repository-derived gotchas.
