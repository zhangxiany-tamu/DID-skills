# TwoWayFEWeights: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `TwoWayFEWeights.md` at the referenced line.
- For repository-derived caveats and internal pipeline notes, read `TwoWayFEWeights-additional.md`.

## Quick Workflow

1. Run `twowayfeweights(...)` on your TWFE specification.
2. Choose `type` (`feTR`, `feS`, `fdTR`, `fdS`) to match design assumptions.
3. Inspect negative weights and summary measures as diagnostics.
4. Use the print method for standardized reporting.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/twowayfeweights](https://github.com/Credible-Answers/twowayfeweights)
- **Key files**: `R/TwoWayFEWeights.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `print.twowayfeweights` | Print method for TWFE weights objects | `TwoWayFEWeights.md:36` |
| `twowayfeweights` | Computes de Chaisemartin-D'Haultfoeuille weights for TWFE regressions | `TwoWayFEWeights.md:96` |

## Common Use Case Example

This example demonstrates how to diagnose TWFE bias using the de Chaisemartin-D'Haultfoeuille weight decomposition. The key output is whether **negative weights** exist and how large they are — negative weights mean the TWFE estimate can be of opposite sign to every individual treatment effect.

```r
library(TwoWayFEWeights)
library(haven)

# Load wage panel data
url <- "https://raw.githubusercontent.com/Credible-Answers/twowayfeweights/main/wagepan_twfeweights.dta"
wagepan <- haven::read_dta(url)

# TWFE weight decomposition
weights_result <- twowayfeweights(
  wagepan,
  Y = "lwage",              # Log wage outcome
  G = "nr",                 # Individual identifier
  T = "year",               # Time variable
  D = "union",              # Union membership treatment
  type = "feTR",            # Fixed effects, time-varying treatment
  summary_measures = TRUE   # Show sensitivity measures
)

# View formatted summary (prints diagnostics automatically)
print(weights_result)

# KEY DIAGNOSTIC: Interpret the weight decomposition
cat(sprintf("TWFE beta: %.4f\n", weights_result$beta))
cat(sprintf("Positive weights: %d (sum = %.4f)\n",
            weights_result$nr_plus, weights_result$sum_plus))
cat(sprintf("Negative weights: %d (sum = %.4f)\n",
            weights_result$nr_minus, weights_result$sum_minus))

# If negative weights exist, check sensitivity:
# sensibility = minimum treatment effect heterogeneity needed
# for TWFE to be of opposite sign to the true average effect
if (weights_result$nr_minus > 0) {
  cat(sprintf("\nSensitivity: TWFE and true ATT could have opposite signs if\n"))
  cat(sprintf("  treatment effect std dev >= %.4f (sigma_fe)\n",
              weights_result$sensibility))
}
```

## Reading Strategy

- Use this file to select `type` and diagnostics workflow.
- Read `TwoWayFEWeights.md` for full argument details.
- Use source file references when debugging edge-case input handling.
