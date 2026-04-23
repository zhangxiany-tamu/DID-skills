# DID Method Matrix

This file defines which workflows this repo defends most aggressively and which ones are secondary.

## Bucket Definitions

| Bucket | Meaning |
|---|---|
| `first_class` | Core workflow. Keep routing, examples, and troubleshooting current. |
| `caveated` | Supported, but version-sensitive, niche, or dependent on special assumptions. |
| `legacy_or_niche` | Useful in narrow cases, but not part of the default path. |
| `out_of_scope` | Not a near-term priority for this skill repo. |

## Priority Definitions

| Priority | Meaning |
|---|---|
| `P0` | Validate regularly and keep ready for real user workflows. |
| `P1` | Maintain as secondary coverage; revisit when failures or demand justify it. |
| `P2` | Keep documented, but do not spend major maintenance effort unless priorities change. |

## Matrix

| Workflow family | Package(s) | Bucket | Priority | Notes |
|---|---|---|---|---|
| Treatment profiling and rollout visualization | `panelView` | `first_class` | `P0` | Step 1 entry point for almost every real analysis. |
| TWFE pathology diagnostics | `bacondecomp`, `TwoWayFEWeights` | `first_class` | `P0` | Core guardrail for staggered adoption. |
| Main staggered ATT workflow | `did` | `first_class` | `P0` | Default general-purpose estimator. |
| Fast event-study workflow | `fixest` | `first_class` | `P0` | Main route into `pretrends` and `HonestDiD`. |
| Two-stage comparison workflow | `did2s` | `first_class` | `P0` | Important fallback and robustness path. |
| Imputation workflow | `didimputation` | `first_class` | `P0` | High-value comparison when panel assumptions fit. |
| Random-timing / alternative aggregation checks | `staggered` | `first_class` | `P0` | Useful comparison estimator for timing-sensitive designs. |
| Power analysis | `pretrends` | `first_class` | `P0` | Required to interpret non-significant pre-trends responsibly. |
| Sensitivity analysis | `HonestDiD` | `first_class` | `P0` | Core inference layer after event-study estimation. |
| Doubly robust covariate-aware ATT | `DRDID` | `caveated` | `P1` | Important, but not the default entry path for most users. |
| Extended TWFE | `etwfe` | `caveated` | `P1` | Worth documenting, but not the primary recommendation. |
| Non-binary / reversible / continuous treatment | `DIDmultiplegt`, `DIDmultiplegtDYN` | `caveated` | `P1` | High-value special-case route with extra installation/runtime risk. |
| Synthetic-control hybrids | `gsynth`, `synthdid` | `caveated` | `P1` | Useful when parallel trends is implausible or adoption is block-like. |
| Functional-form testing | `YatchewTest` | `legacy_or_niche` | `P2` | Keep documented, but do not center maintenance on it. |
| Generic balance or support tooling | `cobalt` and similar helpers | `out_of_scope` | `P2` | Mention inline when needed; do not build a full package-doc set. |

## Operating Rules

- Default recommendations should come from `P0` / `first_class` rows.
- Promote a `P1` method only when a real workflow repeatedly needs it.
- If a `P0` workflow breaks, update `BACKLOG.md` and `VALIDATION_RUNBOOK.md` before broadening scope elsewhere.
- Keep package docs flexible, but keep step-guide routing aligned with this matrix.
