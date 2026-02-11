# Modern Difference-in-Differences: A Practitioner's Guide

## Contents
- [1. From Canonical DiD to Modern Best Practice](#1-from-canonical-did-to-modern-best-practice)
- [2. Diagnosing the Flaws of TWFE](#2-diagnosing-the-flaws-of-twfe)
- [3. The Modern Toolkit: Heterogeneity-Robust Estimators](#3-the-modern-toolkit-heterogeneity-robust-estimators)
- [4. Ensuring Credibility: Parallel Trends Assessment](#4-ensuring-credibility-parallel-trends-assessment)
- [5. Step-by-Step Workflow Checklist](#5-step-by-step-workflow-checklist)
- [6. Best Practices for Inference](#6-best-practices-for-inference)

Condensed from Roth et al. (2023) framework. This guide covers the complete workflow for credible DiD analysis in R.

## 1. From Canonical DiD to Modern Best Practice

The canonical DiD model compares outcome changes between treated and control groups across two time periods. The key identifying assumption is **parallel trends**: absent treatment, both groups would have followed the same trajectory.

The standard implementation uses Two-Way Fixed Effects (TWFE) regression:

```
Y_it = alpha_i + lambda_t + beta * D_it + epsilon_it
```

where `alpha_i` are unit fixed effects, `lambda_t` are time fixed effects, and `D_it` is a treatment indicator.

**The problem**: When treatment is staggered (units adopt at different times) and treatment effects are heterogeneous across units or over time, TWFE can produce severely biased estimates. This happens because TWFE implicitly makes "forbidden comparisons" -- using already-treated units as controls for newly-treated units -- and can assign negative weights to some group-time treatment effects.

## 2. Diagnosing the Flaws of TWFE

### 2.1 Forbidden Comparisons and Negative Weighting

Goodman-Bacon (2021) showed that the TWFE estimator is a weighted average of all possible 2x2 DiD comparisons. Three types of comparisons arise:

1. **Earlier-treated vs. never-treated** (valid)
2. **Later-treated vs. never-treated** (valid)
3. **Earlier vs. later-treated** and vice versa (problematic -- "forbidden comparisons")

The third type uses already-treated units as controls, which biases estimates when treatment effects change over time.

de Chaisemartin and D'Haultfoeuille (2020) showed that TWFE assigns weights to group-time effects, and some weights can be **negative**. A positive treatment effect in one group-period can enter the overall estimate with a negative sign.

### 2.2 Practical Diagnostics in R

**Goodman-Bacon Decomposition:**
```r
library(bacondecomp)
library(ggplot2)

data(castle)
bacon_out <- bacon(l_homicide ~ post, data = castle,
                   id_var = "sid", time_var = "year")
print(bacon_out)

ggplot(bacon_out) +
  aes(x = weight, y = estimate, shape = type) +
  geom_point(size = 2) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(x = "Weight", y = "Estimate") +
  theme_minimal()
```

**TwoWayFEWeights:**
```r
library(TwoWayFEWeights)

twfe_weights <- twowayfeweights(castle, Y = "l_homicide", G = "sid",
                                 T = "year", D = "post", type = "feTR")
print(twfe_weights)
```

### Severity Assessment

Both diagnostics use the same severity bands but measure different things:

| Threshold | Bacon: Forbidden Weight % | TwoWayFEWeights: Negative Weight % |
|-----------|---------------------------|-------------------------------------|
| >50%      | SEVERE -- abandon TWFE     | SEVERE -- abandon TWFE               |
| 25-50%    | MODERATE -- TWFE problematic | MODERATE -- TWFE problematic       |
| 10-25%    | MILD -- use TWFE with caution | MILD -- use TWFE with caution     |
| <10%      | MINIMAL -- TWFE acceptable  | MINIMAL -- TWFE acceptable          |

## 3. The Modern Toolkit: Heterogeneity-Robust Estimators

### Table 1: Summary of R Packages for Heterogeneity-Robust DiD

| Package | Core Function(s) | Approach | Key Feature | Default Control | Primary Use Case |
|---------|-------------------|----------|-------------|-----------------|------------------|
| `did` | `att_gt()`, `aggte()` | Callaway-Sant'Anna | Flexible aggregation, transparent assumptions | Not-yet-treated | General staggered DiD; transparency paramount |
| `didimputation`/`did2s` | `did_imputation()`, `did2s()` | BJS / Gardner | Two-stage imputation; efficient | Not-yet-treated | Efficiency; parallel trends plausible over all pre-periods |
| `fixest` | `feols()` + `sunab()` | Sun-Abraham | Extremely fast; convenient syntax; `iplot()` | Never/last-treated | Large-scale event studies; regression-comfortable users |
| `DIDmultiplegt` | `did_multiplegt()` | de Chaisemartin-D'Haultfoeuille | Non-binary, reversible, continuous treatments | Stayers | Complex treatment that doesn't fit binary absorbing framework |
| `staggered` | `staggered()` | Roth-Sant'Anna | Efficient when timing is quasi-random; replication tool | Not-yet-treated | Random timing; robustness checks; comparing estimators |

### 3.1 Callaway & Sant'Anna (`did`)

```r
library(did)
data(castle)

cs_att <- att_gt(yname = "l_homicide", tname = "year", idname = "sid",
                 gname = "effyear", data = castle,
                 control_group = "notyettreated", xformla = ~1)

cs_es <- aggte(cs_att, type = "dynamic")
summary(cs_es)
ggdid(cs_es, title = "Event Study: Callaway & Sant'Anna")
```

Key choices:
- `control_group`: `"notyettreated"` (preferred when few never-treated) or `"nevertreated"`
- `est_method`: `"dr"` (doubly robust, recommended), `"ipw"`, or `"reg"`
- `xformla`: Covariate formula for conditional parallel trends

### 3.2 Imputation Estimators (BJS and Gardner)

```r
# BJS (didimputation)
library(didimputation)
bjs_es <- did_imputation(data = castle, yname = "l_homicide",
                         gname = "effyear", tname = "year", idname = "sid",
                         horizon = TRUE, pretrends = TRUE)

# Gardner (did2s)
library(did2s)
castle$treat <- ifelse(castle$year >= castle$effyear, 1, 0)
castle$treat[is.na(castle$effyear)] <- 0

gardner_es <- did2s(data = castle, yname = "l_homicide",
                    first_stage = ~ 0 | sid + year,
                    second_stage = ~ i(treat, ref = 0),
                    treatment = "treat", cluster_var = "sid")
```

Both use a two-stage approach: (1) estimate unit and time fixed effects from untreated observations, (2) impute counterfactual outcomes and compute treatment effects.

### 3.3 Sun & Abraham (`fixest`)

```r
library(fixest)

sa_es <- feols(l_homicide ~ sunab(effyear, year) | sid + year, data = castle)
iplot(sa_es, main = "Event Study: Sun & Abraham",
      xlab = "Time to treatment", ylab = "Estimate")
```

`sunab()` automatically creates the correct interaction-weighted estimator. Uses `iplot()` for built-in event study visualization.

### 3.4 Handling Complex Treatments (DIDmultiplegt)

For non-binary, non-absorbing (reversible), or continuous treatments, use the de Chaisemartin-D'Haultfoeuille family. See `did-advanced-methods.md`.

### 3.5 Staggered (Roth & Sant'Anna)

```r
library(staggered)

stag_es <- staggered(df = castle, y = "l_homicide", g = "effyear",
                     i = "sid", t = "year", estimand = "eventstudy")
print(stag_es)
```

Provides efficient estimators when treatment timing is quasi-random. Excellent for robustness checks and replicating CS/SA estimates.

## 4. Ensuring Credibility: Parallel Trends Assessment

### 4.1 The Problem with Traditional Pre-Trend Tests

Simply testing whether pre-treatment coefficients are individually or jointly significant is insufficient. Roth (2022) showed that:
- Low power means "no significant pre-trend" does not imply parallel trends hold
- Conditioning on passing a pre-test can bias post-treatment estimates

### 4.2 Power Analysis with `pretrends`

Quantify what violations your design can detect:

```r
library(pretrends)

# Get beta and sigma from a robust estimator (e.g., fixest)
sa_es <- feols(l_homicide ~ sunab(effyear, year) | sid + year,
               data = castle, se = "cluster")
beta  <- coef(sa_es)
sigma <- vcov(sa_es)
tVec  <- as.numeric(gsub("year::", "", names(beta)))

# Slope of linear trend detectable with 50% power
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)

# Full power analysis
delta_hyp <- slope_50 * tVec
pt_results <- pretrends(betahat = beta, sigma = sigma,
                        deltatrue = delta_hyp, tVec = tVec)
print(pt_results$df_power)
```

### 4.3 Sensitivity Analysis with HonestDiD

Construct confidence intervals robust to specified levels of parallel trends violations:

```r
library(HonestDiD)

pre_periods  <- which(tVec < -1)
post_periods <- which(tVec >= 0)
base_period  <- which(tVec == -1)

# Subset to pre + post (exclude base period)
keep <- c(pre_periods, post_periods)

honest_results <- createSensitivityResults_relativeMagnitudes(
  betahat = beta[keep], sigma = sigma[keep, keep],
  numPrePeriods = length(pre_periods),
  numPostPeriods = length(post_periods),
  Mbarvec = seq(0.5, 2, by = 0.5))
```

The parameter M bounds how much post-treatment violations can exceed pre-treatment violations. Report the **breakdown value** -- the smallest M where the confidence interval includes zero.

### 4.4 Conditional Parallel Trends with DRDID

When unconditional parallel trends is implausible, condition on covariates using the doubly-robust estimator:

```r
library(DRDID)

dr_att <- drdid(yname = "re", tname = "year", idname = "id",
                dname = "treated",
                xformla = ~ age + educ + black + married + nodegree,
                data = nsw_long, panel = TRUE)
summary(dr_att)
```

## 5. Step-by-Step Workflow Checklist

### Phase 1: Setup
- [ ] Identify unit, time, treatment timing, and outcome variables
- [ ] Determine treatment structure (binary absorbing vs. complex)
- [ ] Check panel balance; create balanced panel if needed

### Phase 2: Diagnostics (if staggered)
- [ ] Run Bacon decomposition -- report forbidden comparison weight
- [ ] Run TwoWayFEWeights -- report negative weight percentage
- [ ] Assess severity using threshold table
- [ ] Motivate the choice of robust estimator based on diagnostics

### Phase 3: Estimation
- [ ] Select primary robust estimator (CS recommended as default)
- [ ] Estimate group-time ATTs and aggregate to event study
- [ ] Produce event-study plot with confidence intervals
- [ ] Run at least one additional estimator as robustness check
- [ ] Compare estimates across methods

### Phase 4: Pre-Trends Assessment
- [ ] Inspect pre-treatment coefficients visually
- [ ] Run `pretrends` power analysis -- report detectable slope at 50% and 80% power
- [ ] Contextualize: is the detectable trend economically meaningful relative to the treatment effect?

### Phase 5: Sensitivity and Inference
- [ ] Run HonestDiD sensitivity analysis with relative magnitudes
- [ ] Report breakdown M value and interpret strength of evidence
- [ ] Consider conditional parallel trends (DRDID) if covariates help
- [ ] Cluster standard errors at the level of treatment assignment
- [ ] If few treated clusters: acknowledge limitation, use HonestDiD approach
- [ ] Report: point estimate, clustered SEs, HonestDiD intervals, breakdown M

## 6. Best Practices for Inference

### Clustering Rule-of-Thumb

Cluster standard errors at the level at which treatment is independently assigned. This follows from the design-based framework where randomness comes from treatment assignment, not sampling.

### The Few Treated Clusters Problem

With few treated clusters, standard cluster-robust variance estimators are unreliable. Solutions:

1. **Wild cluster bootstrap** -- requires strong homogeneity assumptions
2. **Permutation tests** -- requires exchangeability
3. **HonestDiD approach** (pragmatic): Treat non-zero average cluster-level shocks as a parallel trends violation. Use pre-treatment deviations to calibrate the magnitude, then construct HonestDiD robust intervals.

This reframes the inference problem as a sensitivity analysis problem, leveraging the tools from Section 4.3.
