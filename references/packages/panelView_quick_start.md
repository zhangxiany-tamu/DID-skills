# panelView: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `panelView.md` at the referenced line.
- For repository-derived implementation and testing notes, read `panelView-additional.md`.

## Quick Workflow

1. Load panel data and create a binary treatment indicator (0/1 per unit-time).
2. Run `panelview(type = "treat")` to visualize the treatment rollout heatmap.
3. Run `panelview(type = "outcome")` to plot outcome trajectories by cohort.
4. Check for data issues (missing periods, tiny cohorts, irregular timing).
5. Proceed to Step 1 profiling and Step 2 diagnostics.

## Layer 5 Source (GitHub)

- **Repo**: [xuyiqing/panelView](https://github.com/xuyiqing/panelView)
- **Key files**: `R/panelview.R`
- **Documentation site**: [yiqingxu.org/packages/panelView/](https://yiqingxu.org/packages/panelView/)

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `panelview` | Visualize panel data: treatment status, outcomes, or missingness | `panelView.md:25` |

**Note**: The function name is lowercase (`panelview`) while the package name is uppercase (`panelView`).

## Common Use Case Example

This example demonstrates treatment rollout visualization and outcome trajectory plots using the `did::mpdta` dataset (minimum wage employment data).

```r
library(panelView)
library(did)

data(mpdta)

# Create binary treatment indicator from timing variable
mpdta$treat <- ifelse(mpdta$first.treat > 0 & mpdta$year >= mpdta$first.treat, 1, 0)

# 1. Treatment rollout heatmap (Item 1 of Sant'Anna's checklist)
#    Shows which units are treated in which periods
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "treat", by.timing = TRUE,
          main = "Treatment Rollout: Minimum Wage Policy")

# 2. Outcome trajectories by treatment cohort (Item 3)
#    Shows pre-treatment parallel trends visually
panelview(lemp ~ treat, data = mpdta,
          index = c("countyreal", "year"),
          type = "outcome",
          main = "Log Employment Trajectories by Treatment Status")
```

### What To Look For

**In the treatment heatmap:**
- Are cohorts cleanly separated (staggered adoption)?
- Are there any units that switch treatment on and off (reversals)?
- Are any cohorts extremely small (may cause estimation problems)?

**In the outcome trajectories:**
- Do treated and control groups trend similarly before treatment?
- Is there a visible shift at treatment onset?
- Are there outlier units driving the results?

## Reading Strategy

- Start with `panelview(type = "treat")` to understand the treatment design.
- Open `panelView.md` for full argument details (display options, subsetting, themes).
- Use repo vignettes for publication-ready plot customization.
