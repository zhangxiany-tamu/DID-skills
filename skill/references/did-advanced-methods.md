# DiD Advanced Methods Reference

## Contents
- [Method Selection Table](#method-selection-table)
- [1. de Chaisemartin-D'Haultfoeuille Family](#1-de-chaisemartin-dhaultfoeuille-family)
- [2. Generalized Synthetic Control (gsynth)](#2-generalized-synthetic-control-gsynth)
- [3. Synthetic Difference-in-Differences (synthdid)](#3-synthetic-difference-in-differences-synthdid)
- [4. Extended TWFE (etwfe)](#4-extended-twfe-etwfe)
- [5. Yatchew Linearity Test (YatchewTest)](#5-yatchew-linearity-test-yatchewtest)
- [Choosing the Right Advanced Method](#choosing-the-right-advanced-method)

Methods for special cases: non-binary/reversible treatments, synthetic control hybrids, extended TWFE, and functional form testing.

## Method Selection Table

| Method | Package | When to Use |
|--------|---------|-------------|
| de Chaisemartin-D'Haultfoeuille | `DIDmultiplegt` / `DIDmultiplegtDYN` | Non-binary, reversible, or continuous treatment |
| Generalized Synthetic Control | `gsynth` | Multiple treated units with interactive fixed effects |
| Synthetic DiD | `synthdid` | Block treatment (all treated units start simultaneously) |
| Extended TWFE | `etwfe` | Staggered adoption; Wooldridge's approach |
| Yatchew Linearity Test | `YatchewTest` | Testing functional form assumptions in DiD |

---

## 1. de Chaisemartin-D'Haultfoeuille Family

This family handles the most general treatment structures: non-binary, non-absorbing (reversible), and continuous treatments. Two packages implement different versions.

### When to Use Which

| Package | Function | Best For |
|---------|----------|----------|
| `DIDmultiplegt` | `did_multiplegt(..., estimator = "dyn")` | Event studies; also offers `"stat"`, `"had"` modes |
| `DIDmultiplegtDYN` | `did_multiplegt_dyn()` | Pure dynamic/event study analysis (newer, standalone) |

Use **DIDmultiplegtDYN** for straightforward dynamic event studies. Use **DIDmultiplegt** when you need static (`"stat"`) or heterogeneity-adjusted (`"had"`) modes, or when you want all modes from one interface.

### DIDmultiplegt

#### Installation
```r
install.packages("DIDmultiplegt", force = TRUE)
```

#### Key Function
```r
did_multiplegt(
  df,              # Data frame
  Y,               # Outcome variable name
  G,               # Group identifier
  T,               # Time variable
  D,               # Treatment variable (can be non-binary)
  estimator,       # "stat", "dyn", "had", or "old"
  effects = NULL,  # Number of dynamic effects (for "dyn")
  placebo = NULL,  # Number of placebo tests
  cluster = NULL,  # Clustering variable
  controls = NULL  # Control variables
)
```

#### Complete Example
```r
library(DIDmultiplegt)

data("wagepan", package = "DIDmultiplegt")

# Static estimator
result_static <- did_multiplegt(
  df = wagepan, Y = "lwage", G = "nr", T = "year", D = "union",
  estimator = "stat")
print(result_static)

# Dynamic / event study estimator
result_dynamic <- did_multiplegt(
  df = wagepan, Y = "lwage", G = "nr", T = "year", D = "union",
  estimator = "dyn", effects = 5, placebo = 2)
plot(result_dynamic)
```

### DIDmultiplegtDYN

#### Installation
```r
install.packages("DIDmultiplegtDYN")
# Development version:
# devtools::install_github("Credible-Answers/did_multiplegt_dyn/R")
```

#### Key Function
```r
did_multiplegt_dyn(
  df,              # Data frame
  outcome,         # Outcome variable name
  group,           # Group identifier
  time,            # Time variable
  treatment,       # Treatment variable
  effects,         # Number of post-treatment effects
  placebo,         # Number of pre-treatment periods
  controls = NULL, # Control variables
  cluster = NULL   # Clustering variable
)
```

#### Complete Example
```r
library(DIDmultiplegtDYN)

data(favara_imbs)

# Dynamic estimation with placebo tests
result <- did_multiplegt_dyn(
  df = favara_imbs,
  outcome = "Dl_vloans_b",
  group = "county",
  time = "year",
  treatment = "inter_bra",
  effects = 8,
  placebo = 3,
  cluster = "state_n")

summary(result)
plot(result,
     main = "Banking Deregulation Effects",
     xlab = "Years Since Deregulation",
     ylab = "Effect on Log Loan Volume Change")
```

### Data Preparation for DCDH Estimators
```r
# Create binary 0/1 treatment indicator from timing variable
df$treat <- ifelse(df$first_treat > 0 & df$time >= df$first_treat, 1, 0)
df$treat[is.na(df$first_treat)] <- 0

# For continuous treatment: use the treatment intensity directly
# did_multiplegt handles non-binary D natively
```

---

## 2. Generalized Synthetic Control (`gsynth`)

Extends the synthetic control method to handle multiple treated units with interactive fixed effects (factor models). Useful when parallel trends is implausible but a low-dimensional factor structure captures the common trends.

### Installation
```r
install.packages("gsynth", type = "source")
# Development: devtools::install_github("xuyiqing/gsynth")
```

### Key Function
```r
gsynth(
  formula,           # Y ~ D + X1 + X2
  data,              # Panel data frame
  index,             # c("unit", "time")
  force = "two-way", # "none", "unit", "time", "two-way"
  r = c(0, 5),       # Number of latent factors (or range for CV)
  CV = TRUE,         # Cross-validation for factor selection
  estimator = "ife", # "ife" (interactive FE) or "mc" (matrix completion)
  se = TRUE,         # Standard errors
  nboots = 500,      # Bootstrap replications
  parallel = FALSE,  # Parallel computing
  cores = NULL       # Number of cores
)
```

### Complete Example
```r
library(gsynth)

data(gsynth)  # Built-in simulated dataset

# Interactive fixed effects with cross-validated factor selection
gsc_result <- gsynth(
  formula = Y ~ D + X1 + X2,
  data = simdata,
  index = c("id", "time"),
  force = "two-way",
  r = c(0, 5),     # Test 0 to 5 factors
  CV = TRUE,
  se = TRUE,
  nboots = 500,
  seed = 42)

print(gsc_result)
plot(gsc_result)                  # Treatment effect over time
plot(gsc_result, type = "ct")     # Counterfactual trajectories
plot(gsc_result, type = "gap")    # Treatment effect gaps
```

### Matrix Completion Alternative
```r
# For settings where interactive FE is too restrictive
gsc_mc <- gsynth(
  formula = Y ~ D,
  data = simdata,
  index = c("id", "time"),
  force = "two-way",
  estimator = "mc",
  lambda = seq(0.1, 2, 0.1),
  CV = TRUE,
  se = TRUE,
  nboots = 500,
  parallel = TRUE, cores = 4)
```

---

## 3. Synthetic Difference-in-Differences (`synthdid`)

Combines synthetic control (unit weights) with DiD (time weights) for a doubly-robust estimator. Designed for block treatment: all treated units begin treatment simultaneously.

### Installation
```r
# install.packages("devtools")
devtools::install_github("synth-inference/synthdid")
```

### Key Functions
```r
# Data preparation
panel.matrices(data, unit, time, outcome, treatment)
# Returns: list with Y (outcome matrix), N0 (n control units), T0 (n pre-periods)

# Estimation
synthdid_estimate(Y, N0, T0)

# Standard errors
vcov(estimate, method = c("placebo", "bootstrap", "jackknife"))
```

### Complete Example
```r
library(synthdid)

# California Proposition 99 (cigarette tax)
data("california_prop99")

# Prepare data matrices
setup <- panel.matrices(california_prop99)

# Estimate treatment effect
tau_hat <- synthdid_estimate(setup$Y, setup$N0, setup$T0)

# Standard errors
se <- sqrt(vcov(tau_hat, method = "placebo"))

cat(sprintf("SDID estimate: %.2f (SE: %.2f)\n", tau_hat, se))
cat(sprintf("95%% CI: (%.2f, %.2f)\n",
            tau_hat - 1.96 * se, tau_hat + 1.96 * se))

# Visualization
plot(tau_hat)
```

### Custom Data
```r
# Prepare your own panel data
# Requires: unit, time, outcome, treatment columns
setup <- panel.matrices(
  my_data,
  unit = "state",
  time = "year",
  outcome = "packs_per_capita",
  treatment = "policy_indicator")

tau <- synthdid_estimate(setup$Y, setup$N0, setup$T0)
se <- sqrt(vcov(tau, method = "bootstrap"))
```

---

## 4. Extended TWFE (`etwfe`)

Implements Wooldridge's (2021) extended TWFE approach, which correctly handles heterogeneous treatment effects by including cohort-time interactions. Provides a simple interface that feels like standard TWFE but produces heterogeneity-robust estimates.

### Installation
```r
install.packages("etwfe")
# Development: install.packages("etwfe", repos = "https://grantmcdermott.r-universe.dev")
```

### Key Functions
```r
# Estimation
etwfe(fml, tvar, gvar, data, vcov = NULL)
# fml: outcome ~ controls (not treatment -- handled automatically)
# tvar: time variable (unquoted)
# gvar: first treatment period (unquoted); Inf for never-treated

# Extract marginal effects
emfx(object, type = c("simple", "event", "group", "calendar"))
```

### Complete Example
```r
library(etwfe)
library(ggplot2)

data("mpdta", package = "did")

# Estimate extended TWFE
mod <- etwfe(
  fml = lemp ~ lpop,
  tvar = year,
  gvar = first.treat,
  data = mpdta,
  vcov = ~countyreal)

# Overall ATT
simple_att <- emfx(mod, type = "simple")
print(simple_att)

# Event study
event_eff <- emfx(mod, type = "event")
print(event_eff)

# Plot event study
ggplot(event_eff, aes(x = event, y = estimate)) +
  geom_pointrange(aes(ymin = conf.low, ymax = conf.high)) +
  geom_hline(yintercept = 0, linetype = "dashed", color = "red") +
  labs(title = "Extended TWFE Event Study",
       x = "Years Since Treatment", y = "Effect") +
  theme_minimal()

# Group-specific effects
group_eff <- emfx(mod, type = "group")
print(group_eff)
```

### Data Preparation
```r
# etwfe expects Inf for never-treated
df$first_treat[df$first_treat == 0 | is.na(df$first_treat)] <- Inf
```

---

## 5. Yatchew Linearity Test (`YatchewTest`)

Tests whether the relationship between treatment intensity and outcome is linear. Useful for validating functional form assumptions in DiD designs with continuous or multi-valued treatments.

### Installation
```r
install.packages("YatchewTest")
```

### Key Function
```r
yatchew_test(
  data,              # Data frame
  Y,                 # Outcome variable name
  D,                 # Treatment variable name(s)
  het_robust = FALSE, # Heteroskedasticity-robust test
  path_plot = FALSE,  # Show relationship graphically
  order = 1          # Polynomial order to test (1 = linear)
)
```

### Complete Example
```r
library(YatchewTest)

# Test linearity of treatment-outcome relationship
set.seed(123)
n <- 1000
x <- rnorm(n)
y <- 2 + 0.5 * x + 0.3 * x^2 + rnorm(n)  # True relationship is quadratic
test_data <- data.frame(x = x, y = y)

result <- yatchew_test(
  data = test_data, Y = "y", D = "x",
  het_robust = TRUE)
print(result)

if (result$p_value < 0.05) {
  cat("Reject linearity: consider nonlinear specification.\n")
  # Possible next steps: polynomial terms or splines
  fit_quad <- lm(y ~ x + I(x^2), data = test_data)
  summary(fit_quad)
} else {
  cat("Linearity assumption appears reasonable.\n")
}
```

### Policy Application
```r
# Test if policy effect is linear in treatment intensity
policy_test <- yatchew_test(
  data = policy_data,
  Y = "outcome",
  D = "policy_intensity",
  het_robust = TRUE,
  path_plot = TRUE)

# If linearity holds: simple dose-response
# If rejected: consider flexible specifications or bin treatment
```

---

## Choosing the Right Advanced Method

| Scenario | Recommended Method |
|----------|--------------------|
| Treatment can switch on/off (reversible) | DIDmultiplegt / DIDmultiplegtDYN |
| Continuous or multi-valued treatment | DIDmultiplegt + YatchewTest for linearity |
| Multiple treated units, factor structure | gsynth |
| All treated units start treatment at same time | synthdid |
| Want TWFE-like syntax but robust | etwfe |
| Need to test dose-response linearity | YatchewTest |
| Staggered binary absorbing treatment | Use core estimators (see `did-step-3-estimation.md`) |
