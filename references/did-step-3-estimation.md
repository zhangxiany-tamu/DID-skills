# Step 3: Choose and Run Robust Estimators (5 Core Methods)

## Contents
- [Estimator Comparison Table](#estimator-comparison-table)
- [1. Callaway & Sant'Anna (did)](#1-callaway--santanna-did)
- [2. Sun & Abraham (fixest)](#2-sun--abraham-fixest)
- [3. Borusyak-Jaravel-Spiess / BJS (didimputation)](#3-borusyak-jaravel-spiess--bjs-didimputation)
- [4. Gardner Two-Stage (did2s)](#4-gardner-two-stage-did2s)
- [5. Roth & Sant'Anna (staggered)](#5-roth--santanna-staggered)
- [Multi-Estimator Comparison Template](#multi-estimator-comparison-template)
- [Common Pitfalls](#common-pitfalls)
- [Iterative Parallel Trends Workflow](#iterative-parallel-trends-workflow)
  - [Step A: Assess Selection Mechanisms](#step-a-assess-selection-mechanisms)
  - [Step B: Estimate Without Covariates First](#step-b-estimate-without-covariates-first)
  - [Step C: Check Covariate Overlap](#step-c-check-covariate-overlap)
  - [Step D: Re-Estimate with Covariates](#step-d-re-estimate-with-covariates)
  - [Step E: Formal Conditional Pre-Test](#step-e-formal-conditional-pre-test)

This file covers the five core heterogeneity-robust estimators for staggered DiD with binary, absorbing treatment. For non-binary, reversible, or continuous treatments, see `did-advanced-methods.md`.

## Estimator Comparison Table

| Package | Function | Approach | Speed | Control Group | Data Requirement |
|---------|----------|----------|-------|---------------|------------------|
| `did` | `att_gt()` + `aggte()` | Callaway-Sant'Anna | Moderate | Not-yet or never | gname = 0 for never-treated |
| `fixest` | `feols()` + `sunab()` | Sun-Abraham | Very fast | Never or last cohort | NA OK for gname |
| `didimputation` | `did_imputation()` | Borusyak-Jaravel-Spiess | Moderate | Not-yet-treated | Balanced panel; data.table; gname = max(t)+10 |
| `did2s` | `did2s()` | Gardner two-stage | Fast | Not-yet-treated | Binary `treat` indicator |
| `staggered` | `staggered()` | Roth-Sant'Anna | Moderate | Not-yet-treated | gname = Inf for never-treated |

---

## 1. Callaway & Sant'Anna (`did`)

### Installation
```r
install.packages("did")
```

### Key Functions

**`att_gt(yname, tname, idname, gname, data, ...)`** -- Group-time ATTs

Key parameters:
- `control_group`: `"notyettreated"` (preferred when few never-treated) or `"nevertreated"`
- `est_method`: `"dr"` (doubly robust, recommended), `"ipw"`, or `"reg"`
- `xformla`: Covariate formula (e.g., `~ age + educ`)
- `anticipation`: Periods of possible anticipation (default: 0)
- `bstrap`: Bootstrap inference (default: TRUE)
- `clustervars`: Clustering variables

**`aggte(MP, type, ...)`** -- Aggregate treatment effects
- `type`: `"simple"` (overall ATT), `"dynamic"` (event study), `"group"`, `"calendar"`
- `balance_e`: Balance event time across groups
- `min_e`, `max_e`: Restrict event time window

**`ggdid(object)`** -- Event study plot

### Data Preparation
```r
# CS requires gname = 0 for never-treated (not NA)
df$first_treat[is.na(df$first_treat)] <- 0
```

### Complete Example
```r
library(did)
library(ggplot2)

data(mpdta)

# Step 1: Group-time ATTs
cs_out <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  est_method = "dr", xformla = ~ lpop,
  bstrap = TRUE, biters = 1000, clustervars = "countyreal")

summary(cs_out)

# Step 2: Event study aggregation
cs_es <- aggte(cs_out, type = "dynamic")
summary(cs_es)

# Step 3: Plot
ggdid(cs_es, title = "Event Study: Callaway & Sant'Anna")

# Step 4: Overall ATT
cs_overall <- aggte(cs_out, type = "simple")
summary(cs_overall)

# Step 5: Group-specific effects
cs_group <- aggte(cs_out, type = "group")
summary(cs_group)
```

---

## 2. Sun & Abraham (`fixest`)

### Installation
```r
install.packages("fixest")
```

If `sunab()` is unavailable, your installed `fixest` is too old for this workflow. Update `fixest` before running Sun-Abraham examples.

### Key Functions

**`feols(fml, data, ...)`** with `sunab(cohort, period)` -- Event study estimation
- `sunab(cohort, period)`: Automatically creates interaction-weighted estimator
- Fixed effects specified after `|` (e.g., `| unit + time`)
- `cluster`: Clustering specification (e.g., `~unit`)

**`iplot(model, ...)`** -- Event study coefficient plot
**`etable(...)`** -- Publication-ready regression tables

### Data Preparation
```r
# SA can work with NA for never-treated
# If needed, add cohort variable:
df$cohort <- df$first_treat
```

### Complete Example
```r
library(fixest)

data(base_stagg)

# Event study with Sun-Abraham
sa_out <- feols(
  y ~ sunab(year_treated, year) | id + year,
  data = base_stagg, cluster = ~id)

summary(sa_out)

# Built-in event study plot
iplot(sa_out,
      main = "Event Study: Sun & Abraham",
      xlab = "Periods Relative to Treatment",
      ylab = "Treatment Effect")

# Extract coefficients for use with HonestDiD/pretrends
beta  <- coef(sa_out)
sigma <- vcov(sa_out)
```

### Multiple Specifications
```r
# Compare different outcomes
multi <- feols(c(y1, y2, y3) ~ sunab(cohort, period) | id + year,
               data = df, cluster = ~id)
etable(multi)

# Two-way clustering
sa_2way <- feols(y ~ sunab(cohort, period) | id + year,
                 data = df, cluster = ~id + year)
```

---

## 3. Borusyak-Jaravel-Spiess / BJS (`didimputation`)

### Installation
```r
install.packages("didimputation")
```

### Key Function

**`did_imputation(data, yname, gname, tname, idname, ...)`**
- `horizon`: Logical, estimate event study effects (default: FALSE)
- `pretrends`: Vector of pre-treatment periods or TRUE for all

### Data Preparation (Critical)

BJS is the most demanding estimator for data preparation. It requires:
1. A **balanced panel** (all units observed at all times)
2. Data in **data.table** format
3. Never-treated coded as `gname = max(time) + 10` (not 0, NA, or Inf)
4. Specific column types: idname as integer, tname as integer, gname as numeric, yname as numeric

```r
library(data.table)

prepare_bjs_data <- function(df, yname, tname, idname, gname) {
  # 1. Create balanced grid
  unique_ids   <- sort(unique(df[[idname]]))
  unique_times <- sort(unique(df[[tname]]))
  balanced <- expand.grid(
    temp_id = unique_ids, temp_time = unique_times,
    stringsAsFactors = FALSE)
  names(balanced) <- c(idname, tname)

  # 2. Merge with original data
  merged <- merge(balanced, df, by = c(idname, tname), all.x = TRUE)

  # 3. Convert to data.table (required by didimputation)
  dt <- data.table::as.data.table(merged)

  # 4. Set never-treated gname to max(time) + 10
  max_t <- max(dt[[tname]], na.rm = TRUE)
  dt[[gname]][dt[[gname]] == 0 | is.na(dt[[gname]])] <- max_t + 10

  # 5. Coerce column types (all required)
  dt[[idname]] <- as.integer(dt[[idname]])
  dt[[tname]]  <- as.integer(dt[[tname]])
  dt[[gname]]  <- as.numeric(dt[[gname]])
  dt[[yname]]  <- as.numeric(dt[[yname]])

  dt
}
```

### Complete Example
```r
library(didimputation)
library(data.table)

# Prepare data (assuming df has: unit_id, year, outcome, first_treat)
dt <- prepare_bjs_data(df, yname = "outcome", tname = "year",
                       idname = "unit_id", gname = "first_treat")

# Static estimation
bjs_static <- did_imputation(
  data = dt, yname = "outcome", gname = "first_treat",
  tname = "year", idname = "unit_id")
print(bjs_static)

# Event study
bjs_es <- did_imputation(
  data = dt, yname = "outcome", gname = "first_treat",
  tname = "year", idname = "unit_id",
  horizon = TRUE, pretrends = -5:-1)
print(bjs_es)
```

---

## 4. Gardner Two-Stage (`did2s`)

### Installation
```r
install.packages("did2s")
```

### Key Function

**`did2s(data, yname, first_stage, second_stage, treatment, cluster_var, ...)`**
- `first_stage`: Formula for fixed effects (e.g., `~ 0 | unit + time`)
- `second_stage`: Treatment specification (e.g., `~ i(treat, ref = FALSE)`)
- `treatment`: Name of binary treatment indicator (string)
- `cluster_var`: Clustering variable (string)
- `bootstrap`, `n_bootstraps`: Bootstrap inference options

### Data Preparation
```r
# Gardner needs an explicit binary treat indicator
df$treat <- ifelse(df$first_treat > 0 & df$year >= df$first_treat, 1, 0)
# Never-treated units:
df$treat[is.na(df$first_treat) | df$first_treat == 0] <- 0
```

### Complete Example
```r
library(did2s)
library(fixest)

# Create treatment indicator
df$treat <- ifelse(!is.na(df$first_treat) & df$first_treat > 0 &
                   df$year >= df$first_treat, 1, 0)

# Static estimation
gardner_static <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id")
summary(gardner_static)

# Event study (need relative time variable)
df$rel_time <- ifelse(df$first_treat > 0, df$year - df$first_treat, Inf)

gardner_es <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(rel_time, ref = c(-1, Inf)),
  treatment = "treat", cluster_var = "unit_id")

# Plot using fixest's iplot
iplot(gardner_es,
      main = "Event Study: Gardner (did2s)",
      xlab = "Periods Relative to Treatment",
      ylab = "Treatment Effect")
```

### With Controls and Weights
```r
# Include controls in first stage
gardner_ctrl <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ x1 + x2 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id")

# With sampling weights
gardner_wt <- did2s(
  data = df, yname = "outcome",
  first_stage = ~ 0 | unit_id + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat", cluster_var = "unit_id",
  weights = "sample_weight")
```

---

## 5. Roth & Sant'Anna (`staggered`)

### Installation
```r
install.packages("staggered")  # now on CRAN
```

### Key Function

**`staggered(df, i, t, g, y, estimand, ...)`**
- `i`: Unit identifier (string)
- `t`: Time variable (string)
- `g`: First treatment period (string); `Inf` for never-treated
- `y`: Outcome variable (string)
- `estimand`: `"simple"`, `"cohort"`, `"calendar"`, or `"eventstudy"`
- `eventTime`: Vector of event times (for `"eventstudy"`)

### Data Preparation
```r
# Staggered requires Inf for never-treated (not 0 or NA)
df$first_treat[is.na(df$first_treat) | df$first_treat == 0] <- Inf
```

### Complete Example
```r
library(staggered)
library(ggplot2)

# Load sample data
df <- staggered::pj_officer_level_balanced

# Simple weighted average
stag_simple <- staggered(
  df = df, i = "uid", t = "period",
  g = "first_trained", y = "complaints",
  estimand = "simple")
print(stag_simple)

# Event study
stag_es <- staggered(
  df = df, i = "uid", t = "period",
  g = "first_trained", y = "complaints",
  estimand = "eventstudy", eventTime = 0:12)

ggplot(stag_es, aes(x = eventTime, y = estimate)) +
  geom_pointrange(aes(ymin = estimate - 1.96 * se,
                      ymax = estimate + 1.96 * se)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(title = "Event Study: Staggered (Roth & Sant'Anna)",
       x = "Periods Since Treatment", y = "Effect") +
  theme_minimal()

# Compare different estimands
for (est in c("simple", "cohort", "calendar")) {
  result <- staggered(df = df, i = "uid", t = "period",
                      g = "first_trained", y = "complaints",
                      estimand = est)
  cat(sprintf("%s: estimate = %.4f (SE = %.4f)\n",
              est, result$estimate, result$se))
}
```

---

## Multi-Estimator Comparison Template

Run multiple estimators on the same dataset and compare results:

```r
run_did_comparison <- function(df, yname, tname, idname, gname) {

  results <- data.frame(Method = character(), ATT = numeric(),
                        SE = numeric(), stringsAsFactors = FALSE)

  # 1. Callaway-Sant'Anna
  tryCatch({
    df_cs <- df; df_cs[[gname]][is.na(df_cs[[gname]])] <- 0
    cs <- did::att_gt(yname = yname, tname = tname, idname = idname,
                      gname = gname, data = df_cs,
                      control_group = "notyettreated")
    cs_agg <- did::aggte(cs, type = "simple")
    results <- rbind(results,
      data.frame(Method = "CS", ATT = cs_agg$overall.att,
                 SE = cs_agg$overall.se))
  }, error = function(e) message("CS failed: ", e$message))

  # 2. Sun-Abraham
  tryCatch({
    sa <- fixest::feols(
      as.formula(paste(yname, "~ sunab(", gname, ",", tname, ") |",
                       idname, "+", tname)),
      data = df, cluster = as.formula(paste("~", idname)))
    beta_sa <- coef(sa)
    # Average post-treatment coefficients
    tVec_sa <- as.numeric(gsub(".*::", "", names(beta_sa)))
    post_idx <- which(tVec_sa >= 0)
    results <- rbind(results,
      data.frame(Method = "SA", ATT = mean(beta_sa[post_idx]),
                 SE = NA))
  }, error = function(e) message("SA failed: ", e$message))

  # 3. Staggered
  tryCatch({
    df_stag <- df
    df_stag[[gname]][is.na(df_stag[[gname]]) | df_stag[[gname]] == 0] <- Inf
    stag <- staggered::staggered(
      df = df_stag, i = idname, t = tname,
      g = gname, y = yname, estimand = "simple")
    results <- rbind(results,
      data.frame(Method = "Staggered", ATT = stag$estimate, SE = stag$se))
  }, error = function(e) message("Staggered failed: ", e$message))

  results
}
```

## Common Pitfalls

1. **Forgetting to recode never-treated**: Each estimator has a different convention (0, NA, Inf, max+10)
2. **Unbalanced panels with BJS**: `didimputation` will fail silently or give wrong results
3. **Missing treatment indicator for Gardner**: `did2s` needs an explicit 0/1 `treat` column
4. **Wrong clustering**: Always cluster at the treatment assignment level
5. **Confusing `gname` with `treat`**: `gname` is the timing variable (when treatment starts); `treat` is a 0/1 indicator for whether the unit-time is treated
6. **Large never-treated gname for BJS**: Must be `max(time) + 10` (not 0, Inf, or NA)

---

## Iterative Parallel Trends Workflow

This section implements Sant'Anna's practitioner checklist Items 4-8: a structured, iterative approach to deciding whether and how to condition on covariates when estimating DiD. The key insight is that **unconditional parallel trends should be the starting point**, and covariates should be added only when there is a substantive reason and adequate overlap.

### Step A: Assess Selection Mechanisms

Before choosing between unconditional and conditional parallel trends, ask: **why do units receive treatment at different times?**

| Question | If YES → | If NO → |
|----------|----------|---------|
| Is treatment timing effectively random (lottery, administrative cutoff)? | Unconditional PT likely holds. Skip to Step B. | Continue assessment. |
| Do observable characteristics predict treatment timing? | Conditioning on covariates may be needed. | Unconditional PT may suffice. |
| Are there known confounders that affect both timing and outcome trends? | Conditional PT required. Go to Step C. | Unconditional PT may suffice. |

**Quick diagnostic**: Compare covariate means across treatment cohorts to check whether timing is correlated with observables.

```r
library(did)
library(dplyr)

data(mpdta)

# Compare baseline covariates across treatment cohorts
baseline <- mpdta %>%
  filter(year == min(year)) %>%
  group_by(first.treat) %>%
  summarise(
    n = n(),
    mean_lpop = mean(lpop, na.rm = TRUE),
    sd_lpop = sd(lpop, na.rm = TRUE),
    .groups = "drop"
  )
print(baseline)
# If means differ substantially across cohorts, selection on observables
# is likely and conditional PT should be considered.
```

**Decision rule**: If covariate means are similar across cohorts (standardized differences < 0.1), treatment timing is likely unrelated to observables and unconditional PT is a reasonable starting point. If means differ substantially (standardized differences > 0.25), proceed to Steps C-D.

### Step B: Estimate Without Covariates First

Always start with the unconditional (no covariates) estimator as a baseline. This establishes what the data say under the simplest assumptions.

```r
library(did)

data(mpdta)

# Unconditional Callaway-Sant'Anna (xformla = ~1 means no covariates)
cs_uncond <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  xformla = ~1)

cs_es_uncond <- aggte(cs_uncond, type = "dynamic")
summary(cs_es_uncond)
ggdid(cs_es_uncond, title = "Event Study: Unconditional PT")
```

**Decision rule**:
- If pre-treatment coefficients are near zero AND the selection assessment (Step A) supports unconditional PT → **stop here**. Report the unconditional estimates.
- If pre-treatment coefficients show a trend or the selection story suggests confounding → proceed to Steps C-D.

### Step C: Check Covariate Overlap

Before conditioning on covariates, verify that treated and control groups have adequate **covariate overlap** (common support). Poor overlap means the doubly-robust or IPW estimator will rely heavily on extrapolation, producing unreliable estimates.

**Using `cobalt` for standardized mean differences:**

```r
library(cobalt)
library(did)

data(mpdta)

# Create a treatment group indicator (ever-treated vs never-treated)
mpdta$ever_treated <- ifelse(mpdta$first.treat > 0, 1, 0)

# Use baseline period only for balance checking
baseline_data <- mpdta[mpdta$year == min(mpdta$year), ]

# Standardized mean differences
bal <- bal.tab(
  ever_treated ~ lpop,
  data = baseline_data,
  s.d.denom = "pooled"
)
print(bal)
```

**Interpretation of standardized mean differences:**

| Std. Mean Diff | Quality | Action |
|----------------|---------|--------|
| < 0.10 | Good | Covariates are well-balanced; conditioning unlikely to change results much |
| 0.10 - 0.25 | Moderate | Some imbalance; conditioning may improve estimates |
| 0.25 - 0.50 | Caution | Substantial imbalance; conditioning important but check overlap carefully |
| > 0.50 | Severe | Poor overlap; doubly-robust estimator may extrapolate heavily; consider trimming |

**Propensity score overlap check:**

```r
library(ggplot2)

# Estimate propensity score (probability of being ever-treated)
baseline_data$pscore <- predict(
  glm(ever_treated ~ lpop, data = baseline_data, family = binomial),
  type = "response"
)

# Visualize overlap
ggplot(baseline_data, aes(x = pscore, fill = factor(ever_treated))) +
  geom_density(alpha = 0.5) +
  labs(title = "Propensity Score Overlap",
       x = "Propensity Score", fill = "Ever Treated") +
  theme_minimal()

# Check for extreme propensity scores
extreme <- mean(baseline_data$pscore < 0.05 | baseline_data$pscore > 0.95)
if (extreme > 0.10) {
  warning(sprintf("%.0f%% of units have extreme propensity scores (< 0.05 or > 0.95). Consider trimming.", 100 * extreme))
}
```

**If overlap is poor** (>10% of units have extreme propensity scores):
1. Trim the sample to the common support region
2. Use fewer covariates (the most theoretically important ones)
3. Report sensitivity of results to trimming choices

### Step D: Re-Estimate with Covariates

If Steps A-C indicate that conditioning on covariates is warranted and overlap is adequate, re-estimate with covariates.

```r
library(did)

data(mpdta)

# Conditional Callaway-Sant'Anna (with covariates)
cs_cond <- att_gt(
  yname = "lemp", tname = "year", idname = "countyreal",
  gname = "first.treat", data = mpdta,
  control_group = "notyettreated",
  xformla = ~ lpop,        # Add covariates here
  est_method = "dr")        # Doubly robust (recommended)

cs_es_cond <- aggte(cs_cond, type = "dynamic")
summary(cs_es_cond)
ggdid(cs_es_cond, title = "Event Study: Conditional PT (with lpop)")
```

**Comparing unconditional vs conditional estimates:**

```r
# Compare overall ATTs
uncond_att <- aggte(cs_uncond, type = "simple")
cond_att   <- aggte(cs_cond, type = "simple")

cat(sprintf("Unconditional ATT: %.4f (SE: %.4f)\n",
            uncond_att$overall.att, uncond_att$overall.se))
cat(sprintf("Conditional ATT:   %.4f (SE: %.4f)\n",
            cond_att$overall.att, cond_att$overall.se))

# Relative change
pct_change <- 100 * abs(cond_att$overall.att - uncond_att$overall.att) /
              abs(uncond_att$overall.att)
cat(sprintf("Relative change: %.1f%%\n", pct_change))
```

**Reporting guidance:**
- **Always report both** unconditional and conditional estimates
- If results are similar (relative change < 10%), prefer the simpler unconditional model
- If results differ substantially, discuss which PT assumption is more credible given the selection mechanism
- For the 2x2 case (single treatment date), also consider `DRDID::drdid()` for the doubly-robust panel estimator (see `references/did-step-5-sensitivity-inference.md`, Section "DRDID: Doubly-Robust DiD with Covariates")

### Step E: Formal Conditional Pre-Test

The `did` package provides `conditional_did_pretest()` to formally test the conditional parallel trends assumption across all pre-treatment periods and groups.

```r
library(did)

data(mpdta)

# Formal test of conditional parallel trends
cond_pretest <- conditional_did_pretest(
  yname = "lemp",
  tname = "year",
  idname = "countyreal",
  gname = "first.treat",
  xformla = ~ lpop,
  data = mpdta,
  control_group = "notyettreated",
  est_method = "ipw"
)

# The test returns a p-value for the null hypothesis that
# conditional parallel trends holds in all pre-treatment periods
summary(cond_pretest)
```

**Interpretation:**
- High p-value (> 0.05): Fail to reject conditional PT — consistent with the assumption holding
- Low p-value (< 0.05): Evidence against conditional PT — covariates may not be sufficient, or the PT assumption may be fundamentally violated
- **Caution**: A non-significant pre-test does NOT prove that parallel trends holds — it may simply lack power. Always complement with Step 4 (power analysis) and Step 5 (HonestDiD sensitivity).
