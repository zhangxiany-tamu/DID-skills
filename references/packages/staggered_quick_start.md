# staggered: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `staggered.md` at the referenced line.
- For repository-derived implementation notes, read `staggered-additional.md`.

## Quick Workflow

1. Run `balance_checks(...)` before estimating treatment effects.
2. Estimate with `staggered(...)` and compare with `staggered_cs(...)`/`staggered_sa(...)`.
3. Use helper builders when auditing internals or replicating formulas.

## Layer 5 Source (GitHub)

- **Repo**: [jonathandroth/staggered](https://github.com/jonathandroth/staggered)
- **Key files**: `R/balance_checks.R`, `R/compute_efficient_estimator_and_se.R`, `R/create_A0_lists.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `balance_checks` | Pre-estimation balance diagnostics for staggered rollout | `staggered.md:62` |
| `compute_balance_test` | Wald-style balance test helper | `staggered.md:163` |
| `compute_Betastar` | Plug-in efficient estimator helper | `staggered.md:182` |
| `compute_g_level_summaries` | Cohort-level summary builder | `staggered.md:206` |
| `compute_Xhat` | Pre-treatment difference vector builder | `staggered.md:227` |
| `create_A0_list` | Constructs A0 matrices used by estimators | `staggered.md:248` |
| `pj_officer_level_balanced` | Included example dataset | `staggered.md:44` |
| `staggered` | Main Roth-Sant'Anna staggered DID estimator | `staggered.md:304` |
| `staggered_cs` | Callaway-Sant'Anna-style staggered estimand variant | `staggered.md:407` |
| `staggered_sa` | Sun-Abraham-style staggered estimand variant | `staggered.md:496` |

## Common Use Case Example

This example demonstrates the core functionality of the staggered package using the included police training dataset. It shows how to estimate treatment effects and create an event study showing dynamic effects over time.

```r
library(staggered)
library(ggplot2)

# Load sample data (police training dataset)
df <- staggered::pj_officer_level_balanced

# Simple weighted average treatment effect
result_simple <- staggered(
  df = df,
  i = "uid",                    # Officer identifier
  t = "period",                 # Time period
  g = "first_trained",          # First training period
  y = "complaints",             # Outcome: number of complaints
  estimand = "simple"           # Simple weighted average
)

# View results
print(result_simple)

# Event study showing effects over time since treatment
event_results <- staggered(
  df = df,
  i = "uid",
  t = "period",
  g = "first_trained",
  y = "complaints",
  estimand = "eventstudy",
  eventTime = 0:23              # Effects for 24 months post-treatment
)

# Plot event study results
ggplot(event_results, aes(x = eventTime, y = estimate)) +
  geom_pointrange(aes(ymin = estimate - 1.96 * se,
                      ymax = estimate + 1.96 * se)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  labs(
    title = "Effect of Police Training on Complaints",
    x = "Months Since Training",
    y = "Effect on Number of Complaints"
  ) +
  theme_minimal()
```

## Reading Strategy

- Use this file to select the estimator variant quickly.
- Open `staggered.md` for complete argument details.
- Use source references for internal matrix/variance debugging.
