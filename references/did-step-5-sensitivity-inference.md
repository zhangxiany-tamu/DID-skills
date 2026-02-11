# Step 5: Sensitivity Analysis and Inference (HonestDiD + DRDID)

## Contents
- [Coefficient Extraction Cookbook](#coefficient-extraction-cookbook)
- [HonestDiD: Sensitivity Analysis](#honestdid-sensitivity-analysis)
- [DRDID: Doubly-Robust DiD with Covariates](#drdid-doubly-robust-did-with-covariates)
- [Full Sensitivity Workflow Template](#full-sensitivity-workflow-template)

## Coefficient Extraction Cookbook

Before running HonestDiD or pretrends, you need three objects from your estimator:
- `betahat`: Named numeric vector of event study coefficients
- `sigma`: Variance-covariance matrix of those coefficients
- `tVec`: Numeric vector of relative time periods

### Time Period Parsing Utility

This function extracts relative time periods from coefficient names across different estimator output formats:

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
  return(NULL)  # No pattern matched -- caller must handle this
}
```

### From fixest / Sun-Abraham

```r
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)

betahat <- coef(sa_model)
sigma   <- vcov(sa_model)
tVec    <- extract_time_periods(names(betahat))
```

### From did / Callaway-Sant'Anna

```r
cs_out <- att_gt(yname = "outcome", tname = "time", idname = "id",
                 gname = "first_treat", data = df,
                 control_group = "notyettreated")
es <- aggte(cs_out, type = "dynamic")

betahat <- es$att.egt
names(betahat) <- es$egt
sigma <- diag(es$se^2)   # Diagonal covariance from standard errors
tVec  <- as.numeric(es$egt)
```

Note: The `did` package returns standard errors, not a full covariance matrix. Using `diag(se^2)` assumes zero covariance between event-study coefficients. For CS, use `es$V.analytical` if available for the full matrix.

### From didimputation / BJS

BJS internally produces a fixest-compatible object, so use the same extraction as fixest:

```r
bjs_model <- did_imputation(data = dt, yname = "outcome",
                            gname = "first_treat", tname = "year",
                            idname = "unit_id", horizon = TRUE)

betahat <- coef(bjs_model)
sigma   <- vcov(bjs_model)
tVec    <- extract_time_periods(names(betahat))
```

### Period Structure Validation

Before passing coefficients to HonestDiD, validate the period structure:

```r
validate_periods <- function(tVec) {
  pre_indices  <- which(tVec < -1)
  post_indices <- which(tVec >= 0)
  base_index   <- which(tVec == -1)

  if (length(pre_indices) == 0)
    stop("At least one pre-treatment period (t < -1) required")
  if (length(base_index) != 1)
    stop("Exactly one base period (t = -1) required for HonestDiD")
  if (length(post_indices) == 0)
    stop("At least one post-treatment period (t >= 0) required")

  list(pre = pre_indices, post = post_indices, base = base_index)
}
```

### Subsetting for HonestDiD

HonestDiD expects coefficients with the base period (t = -1) **excluded**. Subset betahat and sigma to pre + post indices only:

```r
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)

betahat_sub <- betahat[keep]
sigma_sub   <- sigma[keep, keep]

numPrePeriods  <- length(ps$pre)
numPostPeriods <- length(ps$post)
```

---

## HonestDiD: Sensitivity Analysis

### Installation

```r
install.packages("HonestDiD")  # now on CRAN
```

### Core Functions

**`createSensitivityResults_relativeMagnitudes(betahat, sigma, numPrePeriods, numPostPeriods, Mbarvec, ...)`**

Constructs robust confidence intervals under the assumption that post-treatment trend violations are bounded by M times the maximum pre-treatment violation.

Parameters:
- `betahat`: Coefficient vector (pre + post periods, **excluding** base period)
- `sigma`: Corresponding covariance matrix
- `numPrePeriods`: Number of pre-treatment periods in betahat
- `numPostPeriods`: Number of post-treatment periods in betahat
- `Mbarvec`: Vector of M values to test (e.g., `seq(0.5, 2, by = 0.5)`)
- `l_vec`: Weights on post-treatment periods (default: equal weights)

**`createSensitivityResults(betahat, sigma, numPrePeriods, numPostPeriods, method, Mvec)`**

Alternative using smoothness restrictions on trend violations.
- `method`: `"FLCI"` (fixed-length CIs) or `"conditional"`
- `Mvec`: Smoothness parameter values

**`constructOriginalCS(betahat, sigma, numPrePeriods, numPostPeriods)`**

Constructs the original (non-robust) confidence set for comparison.

### Complete Example

```r
library(HonestDiD)
library(fixest)

# Step 1: Estimate event study
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
betahat <- coef(sa_model)
sigma   <- vcov(sa_model)
tVec    <- extract_time_periods(names(betahat))

# Step 2: Validate and subset
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)
beta_sub  <- betahat[keep]
sigma_sub <- sigma[keep, keep]

# Step 3: Relative magnitudes sensitivity analysis
honest_rm <- createSensitivityResults_relativeMagnitudes(
  betahat = beta_sub,
  sigma = sigma_sub,
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post),
  Mbarvec = seq(0.5, 2, by = 0.5))

print(honest_rm)

# Step 4: Construct original CI for comparison
original_ci <- constructOriginalCS(
  betahat = beta_sub,
  sigma = sigma_sub,
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post))

# Step 5: Sensitivity plot
createSensitivityPlot_relativeMagnitudes(
  original_ci, honest_rm,
  Mbarvec = seq(0.5, 2, by = 0.5))
```

### Finding the Breakdown M

The breakdown M is the smallest value where the robust CI includes zero (effect becomes insignificant):

```r
find_breakdown_M <- function(honest_results) {
  # Check if results include zero for each M
  for (i in seq_len(nrow(honest_results))) {
    lb <- honest_results$lb[i]
    ub <- honest_results$ub[i]
    if (lb <= 0 && ub >= 0) {
      return(honest_results$Mbar[i])
    }
  }
  return(NULL)  # Effect robust to all tested M values
}

breakdown <- find_breakdown_M(honest_rm)
```

### Breakdown M Interpretation

| Breakdown M | Evidence Strength | Interpretation |
|-------------|-------------------|----------------|
| NULL (none) | **Strong** | Effect remains significant for all tested M values. Robust to substantial parallel trends violations. |
| < 1 | **Weak** | Effect fragile. Even if post-treatment violations are *smaller* than pre-treatment, the effect could be spurious. |
| 1 - 1.5 | **Moderate** | Effect robust if post-treatment violations are similar in magnitude to pre-treatment violations. |
| > 1.5 | **Fairly robust** | Post-treatment violations would need to be substantially *larger* than pre-treatment violations to invalidate the finding. |

**Recommendations based on breakdown M:**
- NULL or > 2: Results appear robust to parallel trends violations
- 1 to 2: Moderate robustness; report sensitivity analysis prominently
- < 1: Results are fragile; interpret with substantial caution

---


## DRDID: Doubly-Robust DiD with Covariates

> **Prerequisites**: Before using DRDID with covariates, complete the
> selection assessment and overlap checks in `references/did-step-3-estimation.md`
> (Section "Iterative Parallel Trends Workflow", Steps A-C).

### Installation

```r
install.packages("DRDID")  # now on CRAN
```

### When to Use

Use DRDID when:
- Unconditional parallel trends is implausible but conditional parallel trends (after controlling for covariates) is more credible
- You have a 2x2 DiD setup (2 periods, 2 groups) with covariates
- You want double robustness: consistent if either the outcome model OR the propensity score model is correct
- You have assessed selection mechanisms and checked covariate overlap (Step 3)

### Core Functions

**`drdid(yname, tname, idname, dname, xformla, data, panel, ...)`**
- `dname`: Treatment group indicator (string)
- `xformla`: Covariate formula (e.g., `~ age + educ + black`)
- `panel`: TRUE for panel data, FALSE for repeated cross-sections
- `boot`: Bootstrap inference (logical)
- `nboot`: Bootstrap replications

**`ipwdid()`** -- Inverse probability weighting DiD
**`ordid()`** -- Outcome regression DiD

### Complete Example

```r
library(DRDID)

data(nsw_long)

# Panel data: Doubly-robust estimator
dr_panel <- drdid(
  yname = "re", tname = "year", idname = "id",
  dname = "experimental",
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = nsw_long, panel = TRUE, boot = TRUE, nboot = 999)
summary(dr_panel)

# Repeated cross-section
rcs_data <- nsw_long
rcs_data$id <- NULL
dr_rcs <- drdid(
  yname = "re", tname = "year", dname = "experimental",
  xformla = ~ age + educ + black + married + nodegree + hisp + re74,
  data = rcs_data, panel = FALSE, boot = TRUE, nboot = 999)
summary(dr_rcs)
```

### Extracting Results for Downstream Use

```r
# Extract ATT and SE from DRDID output
att <- dr_panel$ATT   # or dr_panel$att depending on version
se  <- dr_panel$se

# Calculate confidence interval
ci <- att + c(-1, 1) * 1.96 * se

# p-value
z <- att / se
p_value <- 2 * (1 - pnorm(abs(z)))

cat(sprintf("ATT: %.3f (SE: %.3f)\n", att, se))
cat(sprintf("95%% CI: [%.3f, %.3f]\n", ci[1], ci[2]))
cat(sprintf("p-value: %.4f\n", p_value))
```

### Comparing Estimators

```r
# Compare DR, IPW, and OR estimators
dr  <- drdid(yname = "re", tname = "year", idname = "id",
             dname = "experimental",
             xformla = ~ age + educ + black + married + nodegree,
             data = nsw_long, panel = TRUE)

ipw <- ipwdid(yname = "re", tname = "year", idname = "id",
              dname = "experimental",
              xformla = ~ age + educ + black + married + nodegree,
              data = nsw_long, panel = TRUE)

orr <- ordid(yname = "re", tname = "year", idname = "id",
             dname = "experimental",
             xformla = ~ age + educ + black + married + nodegree,
             data = nsw_long, panel = TRUE)

cat(sprintf("Doubly Robust ATT:        %.1f\n", dr$ATT))
cat(sprintf("IPW ATT:                  %.1f\n", ipw$ATT))
cat(sprintf("Outcome Regression ATT:   %.1f\n", orr$ATT))
```

---

## Full Sensitivity Workflow Template

Putting it all together -- from estimation through sensitivity analysis:

```r
library(fixest)
library(pretrends)
library(HonestDiD)

# === 1. Estimate robust event study ===
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
betahat <- coef(sa_model)
sigma   <- vcov(sa_model)
tVec    <- extract_time_periods(names(betahat))

# === 2. Power analysis ===
slope_50 <- slope_for_power(sigma = sigma, targetPower = 0.50,
                            tVec = tVec, referencePeriod = -1)
slope_80 <- slope_for_power(sigma = sigma, targetPower = 0.80,
                            tVec = tVec, referencePeriod = -1)
cat(sprintf("Detectable slope at 50%% power: %.4f\n", slope_50))
cat(sprintf("Detectable slope at 80%% power: %.4f\n", slope_80))

# === 3. HonestDiD sensitivity ===
ps <- validate_periods(tVec)
keep <- c(ps$pre, ps$post)

honest_rm <- createSensitivityResults_relativeMagnitudes(
  betahat = betahat[keep], sigma = sigma[keep, keep],
  numPrePeriods = length(ps$pre),
  numPostPeriods = length(ps$post),
  Mbarvec = seq(0.5, 2, by = 0.5))

breakdown <- find_breakdown_M(honest_rm)

# === 4. Report ===
if (is.null(breakdown)) {
  cat("Strong evidence: effect robust to all tested M values.\n")
} else if (breakdown < 1) {
  cat(sprintf("Weak evidence: breakdown at M = %.2f.\n", breakdown))
} else if (breakdown <= 1.5) {
  cat(sprintf("Moderate evidence: breakdown at M = %.2f.\n", breakdown))
} else {
  cat(sprintf("Fairly robust: breakdown at M = %.2f.\n", breakdown))
}
```
