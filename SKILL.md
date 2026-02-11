---
name: did-analysis
description: >
  Guides practitioners through modern Difference-in-Differences (DiD) causal
  inference analysis in R. Implements the 5-step workflow from Roth et al. (2023):
  diagnose TWFE problems, select and run heterogeneity-robust estimators
  (Callaway-Sant'Anna, Sun-Abraham, BJS, Gardner, etc.), conduct power analysis
  for pre-trends, and perform HonestDiD sensitivity analysis. Use when the user
  needs help with DiD estimation, event studies, staggered treatment adoption,
  parallel trends testing, or TWFE diagnostics.
metadata:
  author: Xianyang Zhang
  version: 1.0.0
  category: statistics
  tags: [causal-inference, difference-in-differences, econometrics, R]
---

## Contents
- [Progressive Disclosure](#progressive-disclosure)
- [Before the Analysis](#before-the-analysis)
  - [Quick-Start Decision Tree](#quick-start-decision-tree)
  - [Data Requirements Checklist](#data-requirements-checklist)
- [During the Analysis: The 5-Step Modern DiD Workflow](#during-the-analysis-the-5-step-modern-did-workflow)
  - [Step 1: Assess Treatment Structure](#step-1-assess-treatment-structure)
  - [Step 2: Diagnose TWFE Problems](#step-2-diagnose-twfe-problems)
  - [Step 3: Choose and Run Robust Estimators](#step-3-choose-and-run-robust-estimators)
  - [Step 4: Power Analysis for Pre-Trends](#step-4-power-analysis-for-pre-trends)
  - [Step 5: Sensitivity Analysis (HonestDiD) and Inference](#step-5-sensitivity-analysis-honestdid-and-inference)
- [Personalized Method Selection Advice](#personalized-method-selection-advice)
  - [By Treatment Pattern](#by-treatment-pattern)
  - [By Sample Size](#by-sample-size)
  - [By Priority](#by-priority)
  - [Key Warnings at Each Step](#key-warnings-at-each-step)
- [Cross-Package Coefficient Extraction Cookbook](#cross-package-coefficient-extraction-cookbook)
- [Data Preparation Gotchas Per Estimator](#data-preparation-gotchas-per-estimator)
- [Package Installation Reference](#package-installation-reference)
- [Reference Files (references/)](#reference-files-references)
  - [Step Guides](#step-guides)
  - [Package Documentation (references/packages/)](#package-documentation-referencespackages)
- [Simulating Test Data for DiD Analysis](#simulating-test-data-for-did-analysis)

# Modern Difference-in-Differences Analysis Skill

## Progressive Disclosure

Use this order to keep context small and targeted:

1. **SKILL.md (this file)**: Decision trees, code templates, and routing. Always loaded.
2. **Step guides** (`references/did-step-{1-5}-*.md`): One step at a time. Use `references/did-advanced-methods.md` for non-standard settings.
3. **Package quick starts** (`references/packages/*_quick_start.md`): Package overview, function map, and GitHub source pointers.
4. **Full package docs** (`references/packages/*.md`): Argument-level CRAN documentation.
5. **R source code**: Each `*_quick_start.md` lists the GitHub repo URL and key source files.

---

## Before the Analysis

Verify these prerequisites before starting the 5-step workflow.

### Quick-Start Decision Tree

```
Is treatment staggered (units adopt at different times)?
├─ NO → Standard canonical DiD (TWFE is fine). Go to Step 4.
└─ YES → TWFE may be biased. Continue below.
    │
    Is treatment binary and absorbing (once treated, always treated)?
    ├─ YES → Use core estimators: CS, SA, BJS, Gardner, or Staggered
    │         See references/did-step-3-estimation.md
    └─ NO  → Treatment is non-binary, continuous, or reversible
              Use DIDmultiplegt / DIDmultiplegtDYN
              See references/did-advanced-methods.md
```

### Data Requirements Checklist

Before running any DiD estimator, verify:

1. **Panel structure**: Data has unit identifier (`idname`) and time variable (`tname`)
2. **Treatment timing variable** (`gname`): Period when unit first receives treatment
   - Never-treated units: coding depends on estimator (0, NA, or Inf -- see Data Prep section)
3. **Outcome variable** (`yname`): Numeric, measured for all unit-time pairs
4. **No anticipation**: Units do not change behavior before treatment onset
5. **Sufficient variation**: Multiple treatment cohorts and/or never-treated units
6. **Panel balance**: Some estimators require balanced panels (BJS especially)

---

## During the Analysis: The 5-Step Modern DiD Workflow

### Step 1: Assess Treatment Structure

Determine whether treatment is:
- **Binary absorbing** (once treated, always treated) -- use core estimators
- **Non-binary / reversible / continuous** -- use DIDmultiplegt family
- **Staggered** (different units treated at different times) vs. **canonical** (single treatment date)

See `references/did-step-1-treatment-structure.md` for routing details before diagnostics.

> **Visualize first**: Plot treatment rollout with `panelView` and outcome
> trajectories by cohort before proceeding to diagnostics.

### Step 2: Diagnose TWFE Problems

Run diagnostic tests to quantify TWFE bias. See `references/did-step-2-diagnostics.md` for full details.

**Bacon Decomposition** (forbidden comparison weight):
```r
library(bacondecomp)
bacon_out <- bacon(outcome ~ treatment, data = df,
                   id_var = "unit_id", time_var = "time")
# Check: what share of weight is on "Later vs Earlier" comparisons?
forbidden <- bacon_out[bacon_out$type == "Later vs Earlier Treated", ]
cat("Forbidden comparison weight:", sum(forbidden$weight))
```

**TwoWayFEWeights** (negative weight percentage):
```r
library(TwoWayFEWeights)
weights_out <- twowayfeweights(df, Y = "outcome", G = "unit_id",
                                T = "time", D = "treatment", type = "feTR")
```

**Severity Thresholds** (both diagnostics use the same bands):

| Metric              | >50%   | 25-50%   | 10-25% | <10%    |
|---------------------|--------|----------|--------|---------|
| Forbidden weight %  | SEVERE | MODERATE | MILD   | MINIMAL |
| Negative weight %   | SEVERE | MODERATE | MILD   | MINIMAL |

- SEVERE: Abandon TWFE entirely; use robust estimators
- MODERATE: TWFE likely problematic; strongly prefer robust estimators
- MILD: Use TWFE with caution; run robust estimators as robustness check
- MINIMAL: TWFE may be acceptable; robust estimators still recommended

### Step 3: Choose and Run Robust Estimators

See `references/did-step-3-estimation.md` for full details on all 5 core estimators.

> **Iterative PT assessment**: Start with unconditional parallel trends. If
> implausible, assess selection mechanisms, check covariate overlap, then
> re-estimate with covariates. See "Iterative Parallel Trends Workflow" in
> `references/did-step-3-estimation.md`.

**Estimator Selection Quick Reference:**

| Package         | Function                | Approach             | Best For                              | Control Group     |
|-----------------|-------------------------|----------------------|---------------------------------------|-------------------|
| `did`           | `att_gt()` + `aggte()`  | Callaway-Sant'Anna   | General purpose; transparent          | Not-yet-treated   |
| `fixest`        | `feols()` + `sunab()`   | Sun-Abraham          | Speed; large datasets; regression     | Never/last-treated|
| `didimputation` | `did_imputation()`      | Borusyak-Jaravel-Spiess | Efficiency; imputation logic       | Not-yet-treated   |
| `did2s`         | `did2s()`               | Gardner two-stage    | Speed; intuitive two-stage            | Not-yet-treated   |
| `staggered`     | `staggered()`           | Roth-Sant'Anna       | Random timing; replication            | Not-yet-treated   |

**Top 3 Estimator Code Templates:**

Callaway-Sant'Anna:
```r
library(did)
cs_out <- att_gt(yname = "outcome", tname = "time", idname = "unit_id",
                 gname = "first_treat", data = df,
                 control_group = "notyettreated", est_method = "dr")
cs_es <- aggte(cs_out, type = "dynamic")
ggdid(cs_es)
```

Sun-Abraham:
```r
library(fixest)
# Requires a fixest version that exports sunab(); update fixest if missing.
sa_out <- feols(outcome ~ sunab(first_treat, time) | unit_id + time,
                data = df, cluster = ~unit_id)
iplot(sa_out)
```

Gardner (did2s):
```r
library(did2s)
df$treat <- ifelse(df$time >= df$first_treat & df$first_treat > 0, 1, 0)
gardner_out <- did2s(data = df, yname = "outcome",
                     first_stage = ~ 0 | unit_id + time,
                     second_stage = ~ i(treat, ref = FALSE),
                     treatment = "treat", cluster_var = "unit_id")
```

### Step 4: Power Analysis for Pre-Trends

See `references/did-step-4-power-analysis.md` for full details.

```r
library(pretrends)
# Extract coefficients from robust estimator
beta <- coef(sa_out)
sigma <- vcov(sa_out)
tVec <- as.numeric(gsub(".*::", "", names(beta)))

# What linear trend slope would we detect with 50% power?
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)

# Full power analysis
delta_hyp <- slope_50 * tVec
pt_results <- pretrends(betahat = beta, sigma = sigma,
                        deltatrue = delta_hyp, tVec = tVec)
```

### Step 5: Sensitivity Analysis (HonestDiD) and Inference

See `references/did-step-5-sensitivity-inference.md` for full details including coefficient extraction.

```r
library(HonestDiD)
# Identify period structure
pre_idx  <- which(tVec < -1)
post_idx <- which(tVec >= 0)
base_idx <- which(tVec == -1)  # exactly one required

# Subset betahat and sigma to pre + post (excluding base)
keep <- c(pre_idx, post_idx)
beta_sub  <- beta[keep]
sigma_sub <- sigma[keep, keep]

# Run sensitivity analysis
honest_results <- createSensitivityResults_relativeMagnitudes(
  betahat = beta_sub, sigma = sigma_sub,
  numPrePeriods = length(pre_idx), numPostPeriods = length(post_idx),
  Mbarvec = seq(0.5, 2, by = 0.5))
```

**Breakdown M Interpretation:**

| Breakdown M | Evidence Strength | Meaning |
|-------------|-------------------|---------|
| NULL (none) | Strong            | Effect robust to all tested M values |
| < 1         | Weak              | Effect fragile; even smaller-than-pre violations invalidate |
| 1 - 1.5     | Moderate          | Robust if post-violations similar to pre-violations |
| > 1.5       | Fairly robust     | Post-violations must be substantially larger to invalidate |

**Power Analysis Interpretation** (detectable slope magnitude at 50% power):

| Detectable Slope | Power Quality | Meaning |
|------------------|---------------|---------|
| < 0.001          | Excellent     | Can detect even tiny violations |
| 0.001 - 0.01     | Good          | Good power to detect small violations |
| 0.01 - 0.05      | Moderate      | Economically meaningful violations might go undetected |
| > 0.05           | Poor          | Large violations could go undetected; pre-test is inconclusive |

**Inference Best Practices:**
- Cluster standard errors at the level of treatment assignment
- With few treated clusters, use HonestDiD to handle non-zero average shocks
- Report both point estimates and HonestDiD sensitivity intervals

## Personalized Method Selection Advice

### By Treatment Pattern
- **Canonical (2x2 DiD)**: Standard TWFE is appropriate; focus on parallel trends and DRDID with covariates
- **Staggered adoption**: MANDATORY diagnostics (Step 2); robust estimators required; high-priority sensitivity analysis
- **Complex (non-binary/reversible)**: Use DIDmultiplegt family; standard methods may not apply

### By Sample Size
- **Small (<100 units)**: Power analysis especially important; consider aggregating time periods; sensitivity analysis critical
- **Medium**: Standard workflow applies
- **Large (>10,000 units)**: Use Sun-Abraham (fixest) for speed; fine-grained event studies feasible; can afford flexible specifications

### By Priority
- **Speed**: Sun-Abraham (fixest::sunab) primary, Gardner (did2s) secondary
- **Transparency**: Callaway-Sant'Anna (did) primary; emphasize clear assumptions; detailed reporting
- **Robustness**: Compare multiple estimators; extensive sensitivity analysis; consider alternative identification

### Key Warnings at Each Step
1. **Assessment**: Don't assume TWFE is valid without checking treatment pattern
2. **Diagnostics**: Don't skip even if you plan to use robust estimators; >25% forbidden weight = serious bias risk
3. **Estimation**: Different estimators make different assumptions; large discrepancies between methods indicate model uncertainty; compare at least two
4. **Power**: Non-significant pre-trends does NOT mean parallel trends holds; low power makes pre-test uninformative
5. **Sensitivity**: Don't skip -- crucial for credibility; low breakdown M = fragile results

## Cross-Package Coefficient Extraction Cookbook

Different estimators store results differently. Use these patterns to extract `betahat`, `sigma`, and `tVec` for HonestDiD/pretrends.

**Time Period Parsing** (works across estimators):
```r
extract_time_periods <- function(coef_names) {
  patterns <- c(
    ".*::([+-]?[0-9]+)$",               # fixest sunab: "year::3" -> 3
    "^([+-]?[0-9]+)$",                  # did: "-2" -> -2
    ".*[Tt]ime[^0-9+-]*([+-]?[0-9]+)$"  # generic: "Time_to_treat-3" -> -3
  )
  for (pat in patterns) {
    m <- regmatches(coef_names, regexec(pat, coef_names))
    if (all(lengths(m) > 1)) {
      tVec <- as.numeric(vapply(m, `[[`, character(1), 2))
      if (!any(is.na(tVec))) return(tVec)
    }
  }
  return(NULL)  # No pattern matched -- handle in calling code
}
```

**From fixest (Sun-Abraham):**
```r
betahat <- coef(sa_model)
sigma   <- vcov(sa_model)
tVec    <- extract_time_periods(names(betahat))
```

**From did (Callaway-Sant'Anna):**
```r
es <- aggte(cs_out, type = "dynamic")
betahat <- es$att.egt
names(betahat) <- es$egt
sigma <- diag(es$se^2)  # diagonal covariance from SEs
tVec  <- as.numeric(es$egt)
```

**From didimputation (BJS):**
```r
# BJS returns a fixest object internally -- use same extraction as fixest
betahat <- coef(bjs_model)
sigma   <- vcov(bjs_model)
tVec    <- extract_time_periods(names(betahat))
```

## Data Preparation Gotchas Per Estimator

Each estimator has specific requirements for the `gname` (first treatment period) variable:

| Estimator   | Never-Treated Coding | Special Requirements |
|-------------|---------------------|----------------------|
| CS (`did`)  | `gname = 0`         | Must not be NA for never-treated |
| SA (`fixest`) | NA is OK           | Add `cohort` variable if needed |
| BJS (`didimputation`) | `gname = max(time)+10` | Balanced panel required; data.table format |
| Gardner (`did2s`) | Derive `treat` indicator | `treat = 1` when `time >= gname & gname > 0` |
| Staggered   | `gname = Inf`       | Must not be 0 or NA for never-treated |
| DCDH (`DIDmultiplegt`) | `gname = 0` | Binary 0/1 treatment indicator needed |

**BJS Balanced Panel Preparation** (critical -- didimputation will fail without this):
```r
library(data.table)

# 1. Create balanced grid
unique_ids   <- sort(unique(df[[idname]]))
unique_times <- sort(unique(df[[tname]]))
balanced <- expand.grid(id = unique_ids, time = unique_times,
                        stringsAsFactors = FALSE)
names(balanced) <- c(idname, tname)

# 2. Merge with original data
merged <- merge(balanced, df, by = c(idname, tname), all.x = TRUE)

# 3. Convert to data.table (required by didimputation)
dt <- data.table::as.data.table(merged)

# 4. Set never-treated gname to max(time) + 10 (not 0, NA, or Inf)
max_t <- max(dt[[tname]], na.rm = TRUE)
dt[[gname]][dt[[gname]] == 0 | is.na(dt[[gname]])] <- max_t + 10

# 5. Coerce column types (all required)
dt[[idname]] <- as.integer(dt[[idname]])
dt[[tname]]  <- as.integer(dt[[tname]])
dt[[gname]]  <- as.numeric(dt[[gname]])
dt[[yname]]  <- as.numeric(dt[[yname]])
```

## Package Installation Reference

```r
# Core estimators (all on CRAN)
install.packages(c("did", "fixest", "did2s", "staggered"))
install.packages("didimputation")

# Diagnostics (CRAN)
install.packages(c("bacondecomp", "TwoWayFEWeights"))

# Visualization & covariate balance (CRAN)
install.packages(c("panelView", "cobalt"))

# Sensitivity & power (CRAN + GitHub)
install.packages(c("HonestDiD", "DRDID"))
remotes::install_github("jonathandroth/pretrends")  # GitHub only

# Advanced methods (CRAN + GitHub)
install.packages(c("etwfe", "YatchewTest", "gsynth"))

# DIDmultiplegtDYN requires polars (Rust-based, not on CRAN)
# Step 1: Install Rust if needed (macOS: brew install rust)
# Step 2: Install polars from r-universe
install.packages("polars", repos = "https://community.r-multiverse.org")
# Step 3: Install DIDmultiplegtDYN and DIDmultiplegt
install.packages(c("DIDmultiplegtDYN", "DIDmultiplegt"))
# IMPORTANT: Always load polars before DIDmultiplegtDYN (namespace bug in v2.3.0)
# library(polars); library(DIDmultiplegtDYN)

# Synthetic control methods (GitHub only)
remotes::install_github("synth-inference/synthdid")
```

## Reference Files (`references/`)

### Step Guides

| File | Contents |
|------|----------|
| `references/did-master-guide.md` | Condensed practitioner's guide to the 5-step workflow |
| `references/did-step-1-treatment-structure.md` | Treatment-structure assessment and routing |
| `references/did-step-2-diagnostics.md` | TWFE diagnostics workflow |
| `references/did-step-3-estimation.md` | Robust-estimator selection and execution |
| `references/did-step-4-power-analysis.md` | Pre-trends power analysis |
| `references/did-step-5-sensitivity-inference.md` | HonestDiD sensitivity and final inference |
| `references/did-advanced-methods.md` | DIDmultiplegt/DYN, gsynth, synthdid, etwfe, YatchewTest |
| `references/did-troubleshooting.md` | Runtime errors, installation failures, and fixes |
| `references/package-versions.md` | Version tracking for all 17 packages |

### Package Documentation (`references/packages/`)

Each package has three files. Always read `*_quick_start.md` first, then open `*.md` only for the needed sections.

- **`*_quick_start.md`**: Function map, workflow, GitHub source pointers
- **`*.md`**: Full CRAN-level API documentation
- **`*-additional.md`**: Supplementary notes from GitHub repos

| Package | Quick Start | Full Docs | Additional |
|---------|-------------|-----------|------------|
| bacondecomp | `bacondecomp_quick_start.md` | `bacondecomp.md` | `bacondecomp-additional.md` |
| TwoWayFEWeights | `TwoWayFEWeights_quick_start.md` | `TwoWayFEWeights.md` | `TwoWayFEWeights-additional.md` |
| did | `did_quick_start.md` | `did.md` | `did-additional.md` |
| fixest | `fixest_quick_start.md` | `fixest.md` | `fixest-additional.md` |
| didimputation | `didimputation_quick_start.md` | `didimputation.md` | `didimputation-additional.md` |
| did2s | `did2s_quick_start.md` | `did2s.md` | `did2s-additional.md` |
| staggered | `staggered_quick_start.md` | `staggered.md` | `staggered-additional.md` |
| HonestDiD | `HonestDiD_quick_start.md` | `HonestDiD.md` | `HonestDiD-additional.md` |
| pretrends | `pretrends_quick_start.md` | `pretrends.md` | `pretrends-additional.md` |
| DRDID | `DRDID_quick_start.md` | `DRDID.md` | `DRDID-additional.md` |
| DIDmultiplegt | `DIDmultiplegt_quick_start.md` | `DIDmultiplegt.md` | `DIDmultiplegt-additional.md` |
| DIDmultiplegtDYN | `DIDmultiplegtDYN_quick_start.md` | `DIDmultiplegtDYN.md` | `DIDmultiplegtDYN-additional.md` |
| gsynth | `gsynth_quick_start.md` | `gsynth.md` | `gsynth-additional.md` |
| synthdid | `synthdid_quick_start.md` | `synthdid.md` | `synthdid-additional.md` |
| etwfe | `etwfe_quick_start.md` | `etwfe.md` | `etwfe-additional.md` |
| panelView | `panelView_quick_start.md` | `panelView.md` | `panelView-additional.md` |
| YatchewTest | `YatchewTest_quick_start.md` | `YatchewTest.md` | `YatchewTest-additional.md` |

## Simulating Test Data for DiD Analysis

When the user needs example data to test their code or learn the workflow:

```r
create_did_example_data <- function(n_units = 100, n_periods = 10,
                                    treatment_period = 6, seed = 12345) {
  set.seed(seed)
  data <- expand.grid(unit_id = 1:n_units, time = 1:n_periods)

  # Staggered treatment: 30% never-treated, 30% early, 40% late
  n_never <- floor(n_units * 0.3)
  n_early <- floor(n_units * 0.3)
  first_treat <- c(rep(NA, n_never),
                   rep(treatment_period, n_early),
                   rep(treatment_period + 2, n_units - n_never - n_early))
  data$first_treat <- first_treat[data$unit_id]
  data$treated <- ifelse(is.na(data$first_treat), 0,
                         ifelse(data$time >= data$first_treat, 1, 0))

  # Outcome with true ATT = 2.0
  unit_fe <- rnorm(n_units, mean = 10, sd = 2)
  time_fe <- rnorm(n_periods, mean = 0, sd = 0.5)
  data$outcome <- unit_fe[data$unit_id] + time_fe[data$time] +
                  2.0 * data$treated + rnorm(nrow(data), sd = 1)
  data
}
```
