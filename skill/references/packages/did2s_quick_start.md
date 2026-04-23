# did2s: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `did2s.md` at the referenced line.
- For repository-derived caveats and HonestDiD integration notes, read `did2s-additional.md`.

## Quick Workflow

1. Estimate treatment effects using `did2s(...)`.
2. Build event-study summaries with `event_study(...)` when needed.
3. Use `gen_data(...)` and bundled datasets for smoke tests.
4. For sensitivity analysis, use the package's HonestDiD bridge helpers.

## Layer 5 Source (GitHub)

- **Repo**: [kylebutts/did2s](https://github.com/kylebutts/did2s)
- **Key files**: `R/did2s.R`, `R/event_study.R`, `R/gen_data.R`, `R/honest_did.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `castle` | Castle doctrine example panel dataset | `did2s.md:29` |
| `df_het` | Simulated heterogeneous-effects dataset | `did2s.md:31` |
| `df_hom` | Simulated homogeneous-effects dataset | `did2s.md:32` |
| `did2s` | Two-stage DID estimator following Gardner | `did2s.md:33` |
| `event_study` | Builds comparable event-study summaries across estimators | `did2s.md:34` |
| `gen_data` | Simulates panel data for two-stage DID examples | `did2s.md:35` |

## Common Use Case Example

This example demonstrates the two-stage difference-in-differences estimator for both static and event-study specifications using simulated heterogeneous treatment effect data.

```r
library(did2s)
data("df_het", package = "did2s")

# Static treatment effect estimate
static <- did2s(
  df_het,
  yname = "dep_var",
  first_stage = ~ 0 | unit + year,
  second_stage = ~ i(treat, ref = FALSE),
  treatment = "treat",
  cluster_var = "state"
)

fixest::etable(static)

# Event study specification
es <- did2s(
  df_het,
  yname = "dep_var",
  first_stage = ~ 0 | unit + year,
  second_stage = ~ i(rel_year, ref = c(-1, Inf)),
  treatment = "treat",
  cluster_var = "state"
)

# Plot event study results
fixest::iplot(es,
  main = "Event study: Staggered treatment",
  xlab = "Relative time to treatment",
  col = "steelblue",
  ref.line = -0.5,
  drop = "Inf"
)
```

## Reading Strategy

- Use this file to choose the function quickly.
- Open `did2s.md` for complete argument documentation.
- Use `did2s-additional.md` and source files for implementation-level debugging.
