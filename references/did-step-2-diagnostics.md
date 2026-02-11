# Step 2: Diagnose TWFE Problems (bacondecomp + TwoWayFEWeights)

## Contents
- [bacondecomp: Goodman-Bacon Decomposition](#bacondecomp-goodman-bacon-decomposition)
- [TwoWayFEWeights: de Chaisemartin-D'Haultfoeuille Weights](#twowayfeweights-de-chaisemartin-dhaultfoeuille-weights)
- [Severity Threshold Tables](#severity-threshold-tables)
- [Treatment Monotonicity Validation](#treatment-monotonicity-validation)
- [Fallback When Panel Cannot Be Balanced](#fallback-when-panel-cannot-be-balanced)
- [When Diagnostics Are Not Needed](#when-diagnostics-are-not-needed)
- [Scalability: Large Panels (>1,000 Units)](#scalability-large-panels-1000-units)

Two complementary diagnostic tools for detecting problems with TWFE regression under staggered treatment adoption.

## bacondecomp: Goodman-Bacon Decomposition

### What It Does

Decomposes the TWFE coefficient into a weighted average of all 2x2 DiD estimates. Reveals how much weight falls on "forbidden comparisons" (already-treated vs. newly-treated), which can bias TWFE when treatment effects are heterogeneous.

### Installation

```r
install.packages("bacondecomp")
# Development version:
# devtools::install_github("evanjflack/bacondecomp")
```

### Key Functions

**`bacon(formula, data, id_var, time_var)`**
- `formula`: `outcome ~ treatment` (binary treatment indicator, not the timing variable)
- `data`: Panel data frame
- `id_var`: Unit identifier (string)
- `time_var`: Time period variable (string)
- Returns: Data frame with columns `type`, `weight`, `estimate` for each 2x2 comparison

**`bacon_summary(bacon_df)`**
- Summarizes the decomposition by comparison type

### Complete Working Example

```r
library(bacondecomp)
library(ggplot2)

# Load built-in castle doctrine dataset
data(castle)

# Run decomposition
# NOTE: 'post' is a binary 0/1 treatment indicator, not the treatment timing
bacon_out <- bacon(l_homicide ~ post, data = castle,
                   id_var = "sid", time_var = "year")

# View the 2x2 comparisons
print(bacon_out)

# Summary by comparison type
bacon_summary(bacon_out)

# Diagnostic plot
ggplot(bacon_out) +
  aes(x = weight, y = estimate, shape = factor(type)) +
  geom_point(size = 2) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(x = "Weight", y = "Estimate", shape = "Comparison Type",
       title = "Bacon Decomposition Results") +
  theme_minimal()
```

### Interpretation Guide

The decomposition produces three types of comparisons:

| Type | Description | Problematic? |
|------|-------------|-------------|
| Treated vs. Never Treated | Standard DiD, clean comparison | No |
| Earlier Treated vs. Later Treated | Uses not-yet-treated as control | Can be OK |
| Later Treated vs. Earlier Treated | Uses already-treated as control ("forbidden") | Yes |

The key diagnostic is the **total weight on forbidden comparisons** (Later vs. Earlier types):

```r
# Calculate forbidden comparison weight
forbidden_idx <- bacon_out$type == "Later vs Earlier Treated"
forbidden_weight <- sum(bacon_out$weight[forbidden_idx])
forbidden_pct <- 100 * forbidden_weight
cat(sprintf("Forbidden comparison weight: %.1f%%\n", forbidden_pct))
```

### Data Preparation Notes

- Requires a **binary treatment indicator** (0/1), not the treatment timing variable
- The treatment variable should equal 1 for all post-treatment observations of treated units
- **Balanced panel strongly preferred**: `bacon()` may error or produce unreliable results with unbalanced panels. Balance the panel first (restrict year range, drop units with heavy missingness) or use TwoWayFEWeights as a fallback diagnostic.
- The `id_var` and `time_var` must uniquely identify observations

---

## TwoWayFEWeights: de Chaisemartin-D'Haultfoeuille Weights

### What It Does

Directly estimates the weights that TWFE assigns to each group-time average treatment effect. Identifies which group-time cells receive negative weights, meaning their treatment effects enter the TWFE estimate with the wrong sign.

### Installation

```r
install.packages("TwoWayFEWeights")
```

### Data Preparation Notes

- **G must be numeric/integer**: Character group IDs (e.g., state abbreviations) cause cryptic errors. Convert first:
  ```r
  df$unit_num <- as.integer(as.factor(df$unit_id))
  ```
- All other variables (`Y`, `T`, `D`) should also be numeric.

### Key Function

**`twowayfeweights(data, Y, G, T, D, type, ...)`**
- `Y`: Outcome variable name (string)
- `G`: Group identifier (string)
- `T`: Time variable (string)
- `D`: Treatment variable (string)
- `type`: Regression type specification:
  - `"feTR"`: Fixed effects, time-varying treatment effects (most common)
  - `"feS"`: Fixed effects, constant treatment effect
  - `"fdTR"`: First differences, time-varying treatment effects
  - `"fdS"`: First differences, constant treatment effect
- `summary_measures`: Show detailed diagnostics (logical)
- `controls`: Vector of control variable names

### Complete Working Example

```r
library(TwoWayFEWeights)
library(haven)

# Load wage panel data
url <- paste0("https://raw.githubusercontent.com/Credible-Answers/",
              "twowayfeweights/main/wagepan_twfeweights.dta")
wagepan <- haven::read_dta(url)

# Basic TWFE weights analysis
weights_result <- twowayfeweights(
  wagepan,
  Y = "lwage", G = "nr", T = "year", D = "union",
  type = "feTR", summary_measures = TRUE)

print(weights_result)
```

### Comparing Multiple Specifications

```r
# Compare all four regression types
types <- c("feTR", "feS", "fdTR", "fdS")
for (reg_type in types) {
  cat(sprintf("\n--- Type: %s ---\n", reg_type))
  result <- twowayfeweights(wagepan, Y = "lwage", G = "nr",
                             T = "year", D = "union", type = reg_type)
  print(result)
}
```

### Interpretation Guide

Key output fields from the `twowayfeweights` result object:

| Field | Description |
|-------|-------------|
| `$nr_plus` | Number of group-time cells with positive weights |
| `$nr_minus` | Number of group-time cells with negative weights |
| `$sum_plus` | Sum of positive weights |
| `$sum_minus` | Sum of negative weights (negative number) |
| `$beta` | TWFE coefficient |
| `$sensibility` | Min treatment effect heterogeneity for sign reversal |

Calculate the negative weight share (absolute weight sums, not counts):
```r
wt <- weights_result
neg_share <- abs(wt$sum_minus) / (wt$sum_plus + abs(wt$sum_minus)) * 100
cat(sprintf("Negative weight share: %.1f%%\n", neg_share))
cat(sprintf("Negative cells: %d of %d\n", wt$nr_minus, wt$nr_plus + wt$nr_minus))
```

---

## Severity Threshold Tables

Both diagnostics use identical severity bands but measure different quantities:

### Bacon Decomposition: Forbidden Comparison Weight

| Weight % | Severity | Action |
|----------|----------|--------|
| >50%     | SEVERE   | Abandon TWFE entirely; mandatory robust estimators |
| 25-50%   | MODERATE | TWFE likely biased; strongly prefer robust estimators |
| 10-25%   | MILD     | Use TWFE with caution; run robust estimators as check |
| <10%     | MINIMAL  | TWFE may be acceptable; robust estimators still recommended |

### TwoWayFEWeights: Negative Weight Percentage

| Weight % | Severity | Action |
|----------|----------|--------|
| >50%     | SEVERE   | TWFE estimate may have wrong sign; use robust estimators |
| 25-50%   | MODERATE | Substantial negative weighting; robust estimators preferred |
| 10-25%   | MILD     | Some concern; compare TWFE with robust estimates |
| <10%     | MINIMAL  | Negative weights unlikely to substantially bias TWFE |

### Combined Diagnostic Workflow

```r
diagnose_twfe <- function(data, outcome, unit, time, treatment) {
  cat("=== TWFE Diagnostic Report ===\n\n")

  # 1. Bacon decomposition
  fml <- as.formula(paste(outcome, "~", treatment))
  bacon_out <- bacondecomp::bacon(fml, data = data,
                                   id_var = unit, time_var = time)
  forbidden_idx <- bacon_out$type == "Later vs Earlier Treated"
  forbidden_pct <- 100 * sum(bacon_out$weight[forbidden_idx])

  bacon_sev <- {
    if (forbidden_pct > 50) "SEVERE"
    else if (forbidden_pct > 25) "MODERATE"
    else if (forbidden_pct > 10) "MILD"
    else "MINIMAL"
  }
  cat(sprintf("Bacon: Forbidden weight = %.1f%% [%s]\n", forbidden_pct, bacon_sev))

  # 2. TwoWayFEWeights
  wt <- TwoWayFEWeights::twowayfeweights(
    data, Y = outcome, G = unit, T = time, D = treatment, type = "feTR")
  neg_pct <- {
    if (wt$sum_plus + abs(wt$sum_minus) > 0)
      100 * abs(wt$sum_minus) / (wt$sum_plus + abs(wt$sum_minus)) else 0
  }

  wt_sev <- {
    if (neg_pct > 50) "SEVERE"
    else if (neg_pct > 25) "MODERATE"
    else if (neg_pct > 10) "MILD"
    else "MINIMAL"
  }
  cat(sprintf("Weights: Negative %% = %.1f%% [%s]\n", neg_pct, wt_sev))

  # 3. Overall recommendation
  worst <- max(match(bacon_sev, c("MINIMAL","MILD","MODERATE","SEVERE")),
               match(wt_sev, c("MINIMAL","MILD","MODERATE","SEVERE")))
  overall <- c("MINIMAL","MILD","MODERATE","SEVERE")[worst]
  cat(sprintf("\nOverall severity: %s\n", overall))

  if (overall %in% c("SEVERE", "MODERATE")) {
    cat("Recommendation: Use heterogeneity-robust estimators (CS, SA, BJS, Gardner).\n")
  } else if (overall == "MILD") {
    cat("Recommendation: Report TWFE alongside robust estimators.\n")
  } else {
    cat("Recommendation: TWFE likely acceptable; robust estimators for robustness.\n")
  }
}
```

## Treatment Monotonicity Validation

Before running Bacon decomposition, verify that treatment is **weakly increasing** (binary absorbing). Units must not revert from treated to untreated. This is a hard requirement -- `bacondecomp` is designed only for absorbing treatments.

```r
validate_treatment_monotonicity <- function(data, id_var, time_var, treat_var) {
  violations <- character()
  for (uid in unique(data[[id_var]])) {
    mask <- data[[id_var]] == uid
    unit_data <- data[mask, ]
    unit_data <- unit_data[order(unit_data[[time_var]]), ]
    diffs <- diff(unit_data[[treat_var]])
    if (any(diffs < 0)) {
      violations <- c(violations, as.character(uid))
    }
  }
  if (length(violations) > 0) {
    warning(sprintf(
      "Treatment reverts for %d unit(s): %s\nBacon decomposition requires absorbing treatment. Use DIDmultiplegt for reversible treatments.",
      length(violations), paste(head(violations, 5), collapse = ", ")))
  }
  length(violations) == 0
}
```

## Fallback When Panel Cannot Be Balanced

When significant missingness prevents easy panel balancing, Bacon decomposition may be infeasible. Use this fallback strategy:

1. **Use TwoWayFEWeights alone**: It handles unbalanced panels. The negative weight share provides a sufficient diagnostic of TWFE bias severity.
2. **Partial balancing**: Restrict to time periods with >= 90% unit coverage. This preserves most of the panel while enabling Bacon.
   ```r
   obs_per_period <- table(df[[tname]])
   keep_periods <- as.numeric(names(obs_per_period[obs_per_period >= 0.9 * n_units]))
   df_partial <- df[df[[tname]] %in% keep_periods, ]
   ```
3. **Skip diagnostics entirely**: If you plan to use robust estimators regardless (severity is assumed MODERATE+), proceed directly to Step 3. Document that diagnostics were skipped due to panel imbalance.

> **Decision rule**: If TwoWayFEWeights shows > 25% negative weight share, the diagnostic conclusion is clear (use robust estimators) regardless of whether Bacon is also available.

---

## When Diagnostics Are Not Needed

- **Non-staggered (canonical) DiD**: Only one treatment date -- no forbidden comparisons possible
- **Only two time periods**: Standard 2x2 DiD -- TWFE is equivalent to simple DiD
- **Already using robust estimators**: Diagnostics motivate the switch; if you've already switched, they serve as documentation

---

## Scalability: Large Panels (>1,000 Units)

When panels contain thousands of units (e.g., county-level data with 3,000+ counties), diagnostics can become extremely slow or infeasible. Use this section to choose the right approach.

### Performance Expectations

| Units | Cohorts | Bacon Runtime | TWFE Weights Runtime | Recommendation |
|-------|---------|---------------|---------------------|----------------|
| < 500 | < 10 | Seconds | Seconds | Run both |
| 500 - 1,000 | < 15 | Minutes | Seconds | Run both |
| 1,000 - 5,000 | < 20 | 10+ minutes or fails | Minutes | TwoWayFEWeights only, or aggregate first |
| > 5,000 | Any | Likely infeasible | Minutes | TwoWayFEWeights only, or aggregate first |

> **Bacon is O(N^2)** in the number of units because it computes all pairwise 2x2 comparisons. TwoWayFEWeights is based on a single TWFE regression and scales much better.

### Strategy 1: Aggregate to Treatment Level

If treatment is assigned at a higher level (e.g., state-level policy, county-level data), aggregate the outcome to the treatment level before running diagnostics:

```r
library(dplyr)

# Aggregate county-level data to state-level (population-weighted)
df_state <- df %>%
  group_by(state_id, year) %>%
  summarise(
    outcome = weighted.mean(outcome, w = population, na.rm = TRUE),
    treatment = first(treatment),     # same within state-year
    first_treat = first(first_treat), # same within state
    .groups = "drop"
  )

# Now run Bacon on the aggregated data (51 units, not 3,000)
bacon_out <- bacon(outcome ~ treatment, data = df_state,
                   id_var = "state_id", time_var = "year")
```

> **Caveat**: Aggregated Bacon decomposes a *different* TWFE regression than the unit-level one. The weights and forbidden comparison shares may differ because aggregation changes the effective sample. Report this when comparing diagnostics across levels.

### Strategy 2: Subsample

Draw a random sample of units, preserving the treatment structure:

```r
# Stratified subsample: keep all treated units, sample 500 controls
set.seed(42)
treated_ids <- unique(df$unit_id[df$first_treat > 0 & !is.na(df$first_treat)])
control_ids <- unique(df$unit_id[is.na(df$first_treat) | df$first_treat == 0])
sampled_controls <- sample(control_ids, min(500, length(control_ids)))

df_sub <- df[df$unit_id %in% c(treated_ids, sampled_controls), ]
bacon_out <- bacon(outcome ~ treatment, data = df_sub,
                   id_var = "unit_id", time_var = "year")
```

### Strategy 3: Skip Bacon, Use TwoWayFEWeights Only

TwoWayFEWeights scales to large panels because it only requires one TWFE regression. If Bacon is infeasible:

```r
# TwoWayFEWeights works on the full panel
wt <- twowayfeweights(df, Y = "outcome", G = "unit_id",
                       T = "year", D = "treatment", type = "feTR")
neg_share <- abs(wt$sum_minus) / (wt$sum_plus + abs(wt$sum_minus)) * 100
cat(sprintf("Negative weight share: %.1f%%\n", neg_share))

# If neg_share > 25%, the conclusion is clear: use robust estimators
# Bacon would add granularity but not change the recommendation
```

> **Decision rule**: If TwoWayFEWeights shows > 25% negative weight share, the diagnostic conclusion is definitive regardless of whether Bacon is also available. Proceed to Step 3.
