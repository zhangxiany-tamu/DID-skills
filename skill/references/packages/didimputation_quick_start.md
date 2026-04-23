# didimputation: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `didimputation.md` at the referenced line.
- For repository-derived implementation tips, read `didimputation-additional.md`.

## Quick Workflow

1. Estimate ATT/event-study effects with `did_imputation(...)`.
2. Confirm balanced panel structure and treatment timing coding.
3. Use simulated datasets for initial checks before production runs.

## Layer 5 Source (GitHub)

- **Repo**: [kylebutts/didimputation](https://github.com/kylebutts/didimputation)
- **Key files**: `R/did_imputation.R`, `R/data.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `df_het` | Simulated dataset with heterogeneous treatment effects | `didimputation.md:25` |
| `df_hom` | Simulated dataset with homogeneous treatment effects | `didimputation.md:26` |
| `did_imputation` | Imputation-based DiD estimator (Borusyak, Jaravel, Spiess) | `didimputation.md:96` |

## Common Use Case Example

This example demonstrates DID imputation estimation for both static and event-study specifications using simulated heterogeneous treatment effect data.

```r
library(didimputation)
library(fixest)

# Load example data
data("df_het", package = "didimputation")

# Static treatment effect estimate
static <- did_imputation(
  data = df_het,
  yname = "dep_var",
  gname = "g",
  tname = "year",
  idname = "unit"
)
static

# Event study with pretrends and dynamic effects
es <- did_imputation(
  data = df_het,
  yname = "dep_var",
  gname = "g",
  tname = "year",
  idname = "unit",
  horizon = TRUE,
  pretrends = -5:-1
)
es

# Plot event study results (manual visualization)
library(ggplot2)
pts <- as.data.frame(es)
pts$rel_year <- as.numeric(pts$term)
pts$ci_lower <- pts$estimate - 1.96 * pts$std.error
pts$ci_upper <- pts$estimate + 1.96 * pts$std.error

ggplot(pts, aes(x = rel_year, y = estimate)) +
  geom_hline(yintercept = 0, linetype = "dashed") +
  geom_vline(xintercept = -0.5, linetype = "dashed") +
  geom_linerange(aes(ymin = ci_lower, ymax = ci_upper), color = "grey30") +
  geom_point(color = "steelblue", size = 2) +
  labs(x = "Relative Time", y = "Estimate") +
  theme_minimal()
```

## Reading Strategy

- Start here to confirm the right estimator entry point.
- Open `didimputation.md` for full argument and example details.
- Use source references for edge-case debugging of preprocessing and SE handling.
