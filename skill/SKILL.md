---
name: did-analysis
description: >
  Guides practitioners through modern Difference-in-Differences (DiD) causal
  inference analysis in R. Routes users through a 5-step workflow for treatment
  structure assessment, TWFE diagnostics, heterogeneity-robust estimation,
  pre-trend power analysis, and HonestDiD sensitivity analysis.
metadata:
  author: Xianyang Zhang
  version: 2.0.0
  category: statistics
  tags: [causal-inference, difference-in-differences, econometrics, R]
---

## Contents
- [Progressive Disclosure](#progressive-disclosure)
- [When To Use This Skill](#when-to-use-this-skill)
- [Start Here](#start-here)
- [The 5-Step Workflow](#the-5-step-workflow)
  - [Step 1: Assess Treatment Structure](#step-1-assess-treatment-structure)
  - [Step 2: Diagnose TWFE Problems](#step-2-diagnose-twfe-problems)
  - [Step 3: Choose and Run Robust Estimators](#step-3-choose-and-run-robust-estimators)
  - [Step 4: Power Analysis for Pre-Trends](#step-4-power-analysis-for-pre-trends)
  - [Step 5: Sensitivity Analysis and Inference](#step-5-sensitivity-analysis-and-inference)
- [High-Level Routing Rules](#high-level-routing-rules)
- [Default Recommendations](#default-recommendations)
- [Method Selection Heuristics](#method-selection-heuristics)
- [Key Warnings at Each Step](#key-warnings-at-each-step)
- [Common Data Coding Gotchas](#common-data-coding-gotchas)
- [Reference Map](#reference-map)

# Modern Difference-in-Differences Analysis Skill

## Progressive Disclosure

Load only what the user needs:

1. **`SKILL.md`**: Always load first. It provides trigger conditions, routing logic, and the high-level workflow.
2. **Step guides** (`references/did-step-{1-5}-*.md`): Load the current step's guide as the source of truth for execution details.
3. **Advanced methods** (`references/did-advanced-methods.md`): Load when treatment is non-binary, reversible, continuous, or otherwise outside the core binary absorbing workflow.
4. **Package quick starts** (`references/packages/*_quick_start.md`): Load when you need package orientation, key functions, or a compact function map.
5. **Full package docs** (`references/packages/*.md`) and `*-additional.md`: Load only when argument-level details, implementation caveats, or source-derived behavior matter.
6. **Troubleshooting** (`references/did-troubleshooting.md`): Load when installs fail, estimators error, or post-estimation objects are malformed.

Do not load the whole repo by default. Keep context small and step-specific.

## When To Use This Skill

Use this skill when the user needs help with:

- Difference-in-Differences design or estimation in R
- Staggered treatment adoption
- Event-study design or interpretation
- TWFE diagnostics such as Bacon decomposition or negative weights
- Choosing among `did`, `fixest`, `did2s`, `didimputation`, or `staggered`
- `pretrends` power analysis
- `HonestDiD` sensitivity analysis
- Routing non-binary, continuous, or reversible treatment designs to the right alternative method

Do not rely on this skill alone for:

- Generic R package development or system administration
- Non-DiD causal designs that need a different workflow
- Running code inside this repo; all code blocks here are reference templates

## Start Here

Before recommending any estimator, confirm the minimum design facts:

1. Panel identifiers exist: unit ID and time variable.
2. The outcome is numeric and measured at the unit-time level.
3. Treatment timing or treatment intensity is defined clearly.
4. The user can state whether treatment is binary vs. non-binary and absorbing vs. reversible.
5. The user has enough variation: more than one cohort, never-treated or not-yet-treated observations, or a justified alternative design.
6. The user can describe the treatment level relative to the unit level, especially for state-treatment/county-outcome panels.

Fast routing tree:

```text
Is treatment staggered across units?
├─ NO
│  ├─ Canonical 2x2 or single adoption date -> standard DiD is acceptable.
│  └─ Block treatment for one treated aggregate -> consider synthdid / gsynth.
└─ YES
   ├─ Binary and absorbing?
   │  ├─ YES -> Run the core 5-step workflow.
   │  └─ NO  -> Route to DIDmultiplegt / DIDmultiplegtDYN and advanced methods.
   └─ Unsure -> Step 1 first. Never pick an estimator before profiling the design.
```

## The 5-Step Workflow

### Step 1: Assess Treatment Structure

Load: `references/did-step-1-treatment-structure.md`

Goal:

- Classify the design before diagnostics or estimation.
- Decide whether the user stays on the core binary absorbing pipeline or must route to advanced methods.
- Catch multilevel treatment structure, timing problems, already-treated units, reversals, and unbalanced-panel constraints early.

Expected output:

- A design label such as canonical 2x2, staggered binary absorbing, multilevel treatment, non-binary/continuous, or reversible treatment.
- A recommended next step: continue to Step 2 or jump to `did-advanced-methods.md`.

### Step 2: Diagnose TWFE Problems

Load: `references/did-step-2-diagnostics.md`

Use this step when the design is staggered, binary, and absorbing and TWFE is still on the table.

Core diagnostics:

- `bacondecomp` for forbidden-comparison weight
- `TwoWayFEWeights` for negative-weight share

Expected output:

- A severity label: `SEVERE`, `MODERATE`, `MILD`, or `MINIMAL`
- A recommendation on whether TWFE should be abandoned, treated only as a comparison, or used cautiously

### Step 3: Choose and Run Robust Estimators

Load: `references/did-step-3-estimation.md`

Use this step for staggered, binary, absorbing treatment after Step 1 confirms the core pipeline.

Core estimator menu:

| Package | Function | Best Default Use |
|---|---|---|
| `did` | `att_gt()` + `aggte()` | General-purpose primary estimator |
| `fixest` | `feols()` + `sunab()` | Fast event studies and plotting |
| `did2s` | `did2s()` | Fast two-stage fallback or comparison |
| `didimputation` | `did_imputation()` | Imputation logic and efficiency |
| `staggered` | `staggered()` | Random-timing and replication-style checks |

Expected output:

- One primary estimator path
- Zero or more comparison estimators for robustness
- A concrete event-study object or ATT object that can feed later inference steps

### Step 4: Power Analysis for Pre-Trends

Load: `references/did-step-4-power-analysis.md`

Use this step after a valid event-study path produces conformable `betahat`, `sigma`, and `tVec` objects.

Purpose:

- Quantify what kinds of pre-trend violations the data could actually detect
- Avoid overinterpreting a non-significant pre-trends test when power is weak

Default toolchain:

- `pretrends`
- `fixest` or `did` event-study output
- `HonestDiD:::sunab_beta_vcv` when using `sunab()` output

Expected output:

- Detectable trend at 50% or 80% power
- Bias relative to `|ATT|` assessment: excellent, good, moderate, or poor power

### Step 5: Sensitivity Analysis and Inference

Load: `references/did-step-5-sensitivity-inference.md`

Use this step after Step 4 or whenever the user needs robust post-estimation inference rather than raw event-study coefficients alone.

Purpose:

- Convert estimator output into `betahat`, `sigma`, and `tVec`
- Run `HonestDiD` sensitivity analysis
- Integrate covariate-aware DiD inference through `DRDID` when appropriate

Expected output:

- HonestDiD intervals or breakdown-`M` interpretation
- A final evidence assessment, not just a plot

## High-Level Routing Rules

- **Binary absorbing staggered treatment**: stay on the core workflow and default to `did`, `fixest`, `did2s`, `didimputation`, and `staggered`.
- **Canonical 2x2 DiD**: standard DiD is acceptable; TWFE pathology diagnostics are usually not the bottleneck.
- **Non-binary, continuous, or reversible treatment**: route to `references/did-advanced-methods.md` and prioritize `DIDmultiplegt` or `DIDmultiplegtDYN`.
- **Block treatment with simultaneous adoption**: consider `synthdid` or `gsynth`.
- **Extended regression framing**: `etwfe` is an option, but treat it as a caveated method rather than the default.
- **Functional form testing**: `YatchewTest` is niche and should not drive the core workflow.
- **Multilevel treatment structure**: if treatment varies at the state level but outcomes are measured at the county level, Step 1 must confirm how treatment timing is propagated and Step 3 must revisit clustering and interpretation.

## Default Recommendations

- If the user is unsure where to start, begin with Step 1 and `panelView`.
- If the design is standard staggered binary absorbing, default to `did` as the main ATT estimator.
- If the user needs a fast event study or clean plotting, pair `fixest::sunab()` with Step 4 and Step 5.
- If cohorts are small or Sun-Abraham is unstable, compare against `did` or `did2s`.
- If the user wants TWFE diagnostics, run both Bacon and negative-weight checks rather than only one.
- If pre-trends look weakly powered, report that explicitly before drawing comfort from non-significant leads.
- If treatment is reversible or non-binary, do not force it through the core staggered binary pipeline.

## Method Selection Heuristics

### By Treatment Pattern

- **Canonical 2x2 DiD**: standard DiD is usually acceptable; focus on design credibility, covariates, and inference.
- **Staggered adoption**: Step 2 diagnostics are mandatory and robust estimators should drive the final answer.
- **Complex non-binary or reversible treatment**: route to the DCDH family; do not present the core staggered binary estimators as defaults.

### By Sample Size

- **Small panels**: power analysis and sensitivity analysis become more important because pre-trends tests can be weak.
- **Medium panels**: follow the standard workflow and compare at least two estimators when feasible.
- **Large panels**: `fixest` / Sun-Abraham is often the fastest event-study path, but speed does not replace diagnostics.

### By Priority

- **Speed**: start with `fixest::sunab()`, then compare against `did2s` or `did`.
- **Transparency and robustness**: start with `did`, then compare against `fixest`, `did2s`, or `staggered`.
- **Inference credibility**: prioritize event-study outputs that can feed cleanly into Step 4 and Step 5.

## Key Warnings at Each Step

1. **Assessment**: Never assume TWFE is valid until Step 1 confirms the treatment structure.
2. **Diagnostics**: Do not skip Step 2 in staggered adoption settings; large forbidden or negative weights are a substantive warning, not a cosmetic footnote.
3. **Estimation**: Different estimators target similar but not identical objects; large disagreements should be reported as model uncertainty.
4. **Power**: Non-significant pre-trends do not prove parallel trends; low power can make the pre-test uninformative.
5. **Sensitivity**: Do not stop at event-study plots when the design is controversial; Step 5 is part of the credibility argument.

## Common Data Coding Gotchas

| Estimator family | Never-treated coding | Main gotcha |
|---|---|---|
| `did` | `0` | `gname` cannot stay `NA` |
| `fixest::sunab()` | `Inf` | `NA` cohorts are silently dropped |
| `didimputation` | large future value such as `max(t) + 10` | Balanced-panel assumptions matter |
| `staggered` | `Inf` | Event-time setup must align with not-yet-treated logic |
| `DIDmultiplegt` / `DIDmultiplegtDYN` | explicit treatment variable | Build the treatment variable from timing only if treatment is actually binary |

When in doubt, open the relevant step guide first and the package quick start second.

## Reference Map

### Workflow files

| File | Use |
|---|---|
| `references/did-master-guide.md` | Condensed practitioner guide across the full 5-step workflow |
| `references/did-step-1-treatment-structure.md` | Design profiling and routing |
| `references/did-step-2-diagnostics.md` | TWFE diagnostics |
| `references/did-step-3-estimation.md` | Core robust estimators |
| `references/did-step-4-power-analysis.md` | `pretrends` power analysis |
| `references/did-step-5-sensitivity-inference.md` | HonestDiD, DRDID, coefficient extraction |
| `references/did-advanced-methods.md` | Non-standard treatment structures and alternative methods |
| `references/did-troubleshooting.md` | Install failures, runtime errors, numerical issues |

### Package quick starts

Open these when you need compact package-specific guidance:

- `references/packages/did_quick_start.md`
- `references/packages/fixest_quick_start.md`
- `references/packages/did2s_quick_start.md`
- `references/packages/didimputation_quick_start.md`
- `references/packages/staggered_quick_start.md`
- `references/packages/HonestDiD_quick_start.md`
- `references/packages/pretrends_quick_start.md`
- `references/packages/DIDmultiplegt_quick_start.md`
- `references/packages/DIDmultiplegtDYN_quick_start.md`

The step guides are the workflow contracts. This file should stay a thin router.
