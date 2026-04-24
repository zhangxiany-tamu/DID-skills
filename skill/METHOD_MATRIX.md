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

The **MCP Tool** column names the `did_*` tool that covers this workflow when the companion `did-mcp` server is registered. See `SKILL.md` → "Execution Mode: Tools vs. Code-gen". An em-dash means the workflow is code-gen-only today.

| Workflow family | Package(s) | Bucket | Priority | MCP Tool | Notes |
|---|---|---|---|---|---|
| Treatment profiling and rollout visualization | `panelView` | `first_class` | `P0` | `did_load_panel`, `did_check_panel`, `did_profile_design`, `did_plot_rollout`, `did_recode_never_treated` | Step 1 entry point for almost every real analysis. |
| TWFE pathology diagnostics | `bacondecomp`, `TwoWayFEWeights` | `first_class` | `P0` | `did_diagnose_twfe` | Core guardrail for staggered adoption. |
| Main staggered ATT workflow | `did` | `first_class` | `P0` | `did_estimate` (estimator=`cs`) | Default general-purpose estimator. |
| Fast event-study workflow | `fixest` | `first_class` | `P0` | `did_estimate` (estimator=`sa`) | Main route into `pretrends` and `HonestDiD`. |
| Two-stage comparison workflow | `did2s` | `first_class` | `P0` | `did_estimate` (estimator=`did2s`) | Important fallback and robustness path. |
| Imputation workflow | `didimputation` | `first_class` | `P0` | `did_estimate` (estimator=`bjs`) | High-value comparison when panel assumptions fit. |
| Random-timing / alternative aggregation checks | `staggered` | `first_class` | `P0` | `did_estimate` (estimator=`staggered`) | Useful comparison estimator for timing-sensitive designs. |
| Multi-estimator comparison | (any subset of above) | `first_class` | `P0` | `did_compare_estimators`, `did_extract_event_study` | Round-trips a panel through multiple estimators and returns a comparison table + per-estimator envelopes. |
| Power analysis | `pretrends` | `first_class` | `P0` | `did_power_analysis` | Required to interpret non-significant pre-trends responsibly. |
| Sensitivity analysis | `HonestDiD` | `first_class` | `P0` | `did_honest_sensitivity` | Core inference layer after event-study estimation. |
| Doubly robust covariate-aware ATT | `DRDID` | `caveated` | `P1` | `did_drdid` | Important, but not the default entry path for most users. |
| Extended TWFE | `etwfe` | `caveated` | `P1` | — | Worth documenting, but not the primary recommendation. |
| Non-binary / reversible / continuous treatment | `DIDmultiplegt`, `DIDmultiplegtDYN` | `caveated` | `P1` | — | High-value special-case route with extra installation/runtime risk. |
| Synthetic-control hybrids | `gsynth`, `synthdid` | `caveated` | `P1` | — | Useful when parallel trends is implausible or adoption is block-like. |
| Functional-form testing | `YatchewTest` | `legacy_or_niche` | `P2` | — | Keep documented, but do not center maintenance on it. |
| Generic balance or support tooling | `cobalt` and similar helpers | `out_of_scope` | `P2` | — | Mention inline when needed; do not build a full package-doc set. |
| Event-study / sensitivity plotting | `ggplot2`, `ggdid`, `iplot` | `first_class` | `P0` | `did_plot` | Auto-picks event-study vs. HonestDiD robust-CI plot from the source handle. |
| Narrative / session summary | (n/a) | `first_class` | `P0` | `did_report` | Markdown roll-up across every handle in the current session. |
| Session / handle management | (n/a) | `first_class` | `P0` | `did_session` | list / inspect / drop / status; no code-gen analogue. |

## Operating Rules

- Default recommendations should come from `P0` / `first_class` rows.
- Promote a `P1` method only when a real workflow repeatedly needs it.
- If a `P0` workflow breaks, update `BACKLOG.md` and `VALIDATION_RUNBOOK.md` before broadening scope elsewhere.
- Keep package docs flexible, but keep step-guide routing aligned with this matrix.
