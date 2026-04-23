# etwfe: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `etwfe.md` at the referenced line.
- For repository-derived caveats and workflow notes, read `etwfe-additional.md`.

## Quick Workflow

1. Estimate extended TWFE with `etwfe(...)`.
2. Recover interpretable effects using `emfx(...)`.
3. Visualize dynamic effects with `plot.emfx(...)`.

## Layer 5 Source (GitHub)

- **Repo**: [grantmcdermott/etwfe](https://github.com/grantmcdermott/etwfe)
- **Key files**: `R/etwfe.R`, `R/emfx.R`, `R/plot.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `etwfe` | Fits Wooldridge-style extended TWFE models | `etwfe.md:57` |
| `emfx` | Extracts ATT/event-study marginal effects from `etwfe` fits | `etwfe.md:167` |
| `plot.emfx` | Plot method for `emfx` treatment-effect outputs | `etwfe.md:291` |

## Common Use Case Example

This example demonstrates extended TWFE estimation and effect extraction using the mpdta dataset from the did package.

```r
library(etwfe)

# Load sample data from did package
data("mpdta", package = "did")

# Basic extended TWFE estimation
mod <- etwfe(
  fml = lemp ~ lpop,           # log employment ~ log population
  tvar = year,                 # time variable
  gvar = first.treat,          # first treatment period
  data = mpdta,                # dataset
  vcov = ~countyreal          # clustered standard errors
)

# View model summary
summary(mod)

# Simple average treatment effect
simple_att <- emfx(mod, type = "simple")
print(simple_att)

# Event study effects
event_effects <- emfx(mod, type = "event")
print(event_effects)

# Group-specific effects
group_effects <- emfx(mod, type = "group")
print(group_effects)
```

## Reading Strategy

- Use this file for rapid estimator selection.
- Open `etwfe.md` for full argument details and examples.
- Use source references for FE specification and VCOV behavior checks.
