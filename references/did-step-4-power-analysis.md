# Step 4: Power Analysis for Pre-Trends (pretrends)

## Contents
- [pretrends: Power Analysis for Pre-Trend Tests](#pretrends-power-analysis-for-pre-trend-tests)

This step focuses on statistical power for pre-trend testing. For coefficient extraction patterns and period validation helpers, see `did-step-5-sensitivity-inference.md`.

## pretrends: Power Analysis for Pre-Trend Tests

### Installation

```r
# install.packages("devtools")
devtools::install_github("jonathandroth/pretrends")
```

### Coefficient Time Parsing Helper

Use this utility if your coefficient names come from `fixest::sunab()` output:

```r
extract_time_periods <- function(coef_names) {
  m <- regmatches(coef_names, regexec(".*::([+-]?[0-9]+)$", coef_names))
  if (all(lengths(m) > 1)) {
    tVec <- as.numeric(vapply(m, `[[`, character(1), 2))
    if (!any(is.na(tVec))) return(tVec)
  }
  stop("Could not parse relative-time periods from coefficient names.")
}
```

### Core Functions

**`slope_for_power(sigma, targetPower, tVec, referencePeriod, alpha)`**

Finds the slope of a linear trend that would be detected with the specified power.

- `sigma`: Covariance matrix of event study estimates
- `targetPower`: Target power level (e.g., 0.5 or 0.8)
- `tVec`: Vector of relative time periods
- `referencePeriod`: Reference (omitted) period, typically -1
- `alpha`: Significance level (default: 0.05)

**`pretrends(betahat, sigma, tVec, referencePeriod, deltatrue)`**

Full power analysis for a hypothesized trend violation.

- `betahat`: Event study coefficients
- `deltatrue`: Hypothesized trend violation vector

### Complete Example

```r
library(fixest)
library(pretrends)

# Extract from robust estimator
sa_model <- feols(outcome ~ sunab(cohort, period) | id + period,
                  data = df, cluster = ~id)
beta  <- coef(sa_model)
sigma <- vcov(sa_model)
tVec  <- extract_time_periods(names(beta))

# What linear trend slope would we detect with 50% power?
slope_50 <- slope_for_power(
  sigma = sigma, targetPower = 0.50,
  tVec = tVec, referencePeriod = -1)

# What about 80% power?
slope_80 <- slope_for_power(
  sigma = sigma, targetPower = 0.80,
  tVec = tVec, referencePeriod = -1)

cat(sprintf("Slope detectable at 50%% power: %.4f\n", slope_50))
cat(sprintf("Slope detectable at 80%% power: %.4f\n", slope_80))

# Full power analysis for the 50%-power slope
delta_hyp <- slope_50 * tVec
pt_results <- pretrends(
  betahat = beta, sigma = sigma,
  deltatrue = delta_hyp, tVec = tVec)

# View power diagnostics
print(pt_results$df_power)

# Visualization
print(pt_results$event_plot)
```

### Interpreting Power Results

| Power Level | Interpretation |
|-------------|---------------|
| > 80% | Good: likely to detect meaningful pre-trends if they exist |
| 50-80% | Moderate: some ability to detect, but not highly reassuring |
| < 50% | Low: "no significant pre-trend" is not very informative |

**Key question**: Is the detectable slope economically meaningful relative to the treatment effect? If the smallest detectable trend would produce a bias comparable to the estimated effect, the pre-trend test has limited value.

### Detectable Slope Magnitude Assessment

| Detectable Slope (abs) | Power Quality | Implication |
|------------------------|---------------|-------------|
| < 0.001                | Excellent     | Can detect even tiny violations |
| 0.001 - 0.01           | Good          | Good power to detect small violations |
| 0.01 - 0.05            | Moderate      | Economically meaningful violations might go undetected |
| > 0.05                 | Poor          | Large violations could go undetected; pre-test result is inconclusive |

### Joint F-Test for Pre-Treatment Coefficients

A complement to power analysis -- test whether pre-treatment coefficients are jointly significantly different from zero:

```r
joint_pretrends_test <- function(betahat_pre, sigma_pre, alpha = 0.05) {
  k <- length(betahat_pre)
  se <- sqrt(diag(sigma_pre))

  # Individual t-tests
  t_stats <- betahat_pre / se
  z_crit <- qnorm(1 - alpha / 2)
  sig_individual <- abs(t_stats) > z_crit

  # Joint F-test: beta' * inv(sigma) * beta / k
  sigma_inv <- solve(sigma_pre)
  f_stat <- as.numeric(t(betahat_pre) %*% sigma_inv %*% betahat_pre) / k
  p_value <- 1 - pf(f_stat, df1 = k, df2 = Inf)

  cat(sprintf("Individual tests: %d/%d significant at alpha=%.2f\n",
              sum(sig_individual), k, alpha))
  cat(sprintf("Joint F-test: F=%.3f, p=%.4f\n", f_stat, p_value))

  if (p_value < alpha) {
    cat("WARNING: Significant pre-trends detected. Parallel trends may not hold.\n")
  } else {
    cat("No significant pre-trends (but check power before concluding).\n")
  }

  list(individual_significant = sig_individual, f_stat = f_stat,
       p_value = p_value, assessment = ifelse(p_value < alpha,
       "FAIL - Significant pre-trends", "PASS - No significant pre-trends"))
}

# Usage: separate pre-treatment coefficients, then test
pre_idx <- which(tVec < 0)
joint_pretrends_test(betahat[pre_idx], sigma[pre_idx, pre_idx])
```

### Comprehensive Pre-Trends Assessment

Combine visual inspection, joint testing, and power analysis for a complete picture:

1. **Visual**: Plot pre-treatment coefficients with CIs. Look for systematic patterns.
2. **Joint F-test**: Test whether pre-treatment coefficients are jointly zero.
3. **Power analysis**: Calculate detectable slope at 50% and 80% power.
4. **Contextualize**: Compare detectable slope to treatment effect magnitude.

If the joint test fails: parallel trends is questionable. Consider alternative identification, different control groups, or covariate adjustment (DRDID).

If the joint test passes but power is low: the test is uninformative. The "pass" does not validate parallel trends. Report power analysis prominently.

If the joint test passes and power is high: stronger (but not conclusive) evidence for parallel trends. Proceed with main analysis and sensitivity.

---
