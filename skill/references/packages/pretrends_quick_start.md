# pretrends: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `pretrends.md` at the referenced line.
- For repository-derived implementation notes, read `pretrends-additional.md`.

## Quick Workflow

1. Use `slope_for_power(...)` for detectable-trend calibration.
2. Run `pretrends(...)` with a hypothesized violation vector.
3. Use the NIS helper functions for analytical power diagnostics.
4. Report detectable slope alongside pre-trend p-values.

## Layer 5 Source (GitHub)

- **Repo**: [jonathandroth/pretrends](https://github.com/jonathandroth/pretrends)
- **Key files**: `R/pretrends-plot.R`, `R/power-calculation-fns.R`, `R/utility_functions.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `pretrends` | Power and rejection-probability analysis for event-study pre-trend tests | `pretrends.md:58` |
| `slope_for_power` | Returns linear trend slope detectable at target power | `pretrends.md:172` |
| `rejectionProbability_NIS` | Computes rejection probability under null-imposed slope scenarios | `pretrends.md:246` |
| `meanBetaPre_NIS` | Computes expected pre-period coefficients under NIS setup | `pretrends.md:264` |
| `meanBetaPost_NIS` | Computes expected post-period coefficients under NIS setup | `pretrends.md:282` |
| `betaPostNullRejectionProbability_NIS` | Post-period null rejection-probability helper | `pretrends.md:305` |
| `findSlopeForPower_NIS` | NIS helper to solve for slope at target power | `pretrends.md:329` |
| `HeAndWangResults` | Included example object/data for replication | `pretrends.md:354` |

## Common Use Case Example

This example shows the full pretrends workflow: (1) find the detectable trend slope at a given power level, (2) compute conditional power and bias using `pretrends()`, and (3) visualize the results. The goal is to assess how informative a pre-trends test is — if even a large violation would go undetected, the test is weak.

```r
library(pretrends)

# Load example data (He and Wang event-study results)
beta <- pretrends::HeAndWangResults$beta
sigma <- pretrends::HeAndWangResults$sigma
tVec  <- pretrends::HeAndWangResults$tVec    # e.g., -4, -3, -2, 0, 1, 2, 3
referencePeriod <- -1

# Step 1: What linear trend slope would we detect 50% of the time?
slope50 <- slope_for_power(
  sigma = sigma,
  targetPower = 0.5,
  tVec = tVec,
  referencePeriod = referencePeriod
)
cat("Linear trend slope detectable with 50% power:", round(slope50, 4), "\n")

# Step 2: Full power analysis — given this hypothesized violation,
# what is the power, Bayes factor, and conditional bias?
pretrendsResults <- pretrends(
  betahat = beta,
  sigma = sigma,
  tVec = tVec,
  referencePeriod = referencePeriod,
  deltatrue = slope50 * tVec     # hypothesized linear violation
)

# Key outputs from df_power:
cat(sprintf("Power of pre-test: %.1f%%\n",
            100 * pretrendsResults$df_power$Power))
cat(sprintf("Bayes factor: %.3f\n",
            pretrendsResults$df_power$Bayes.Factor))

# df_eventplot shows event-study coefficients alongside hypothesized violation
# and the mean after pre-testing (conditional bias)
print(pretrendsResults$df_eventplot)

# Step 3: Visualize — the event_plot shows observed coefficients
# with the hypothesized trend overlaid
pretrendsResults$event_plot

# Compare across power levels
power_levels <- c(0.5, 0.8, 0.9)
slopes <- sapply(power_levels, function(p) {
  slope_for_power(sigma = sigma, targetPower = p,
                 tVec = tVec, referencePeriod = referencePeriod)
})
data.frame(Power = power_levels, Detectable_Slope = round(slopes, 4))
```

## Reading Strategy

- Use this file to pick the right power function.
- Open `pretrends.md` for complete arguments and plotting options.
- Use source references when validating matrix alignment and numerical routines.
