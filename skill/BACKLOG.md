# did-analysis Backlog

This file is the working queue for improving the skill without turning it into a larger platform.

## Current Goal

Make `did-analysis` easier to trust and maintain by defending a small set of real workflows well.

## Read Order

1. `NEXT_STEPS.md`
2. `METHOD_MATRIX.md`
3. `VALIDATION_RUNBOOK.md`
4. `references/package-versions.md`
5. `references/did-troubleshooting.md`

## P0 Priorities

| Priority item | Why it matters | Status |
|---|---|---|
| Keep `SKILL.md` thin and routing-focused | Prevent the entry point from becoming a second full manual. | `done` |
| Run the first lean validation cycle | Confirms the new maintainer workflow against real prompts. | `done` |
| Refresh package versions only after that validation pass | Avoid version churn that is not tied to actual workflow checks. | `done` |
| Keep the Medicaid-style multilevel workflow documented and validated | This is a real pain point already seen in repo use. | `ongoing` |
| Expand install/runtime troubleshooting only when failures are real | Keeps maintenance evidence-driven. | `ongoing` |

## P1 Priorities

- Revisit `DRDID`, `etwfe`, `gsynth`, and `synthdid` after the `P0` workflows are stable.
- Decide whether any `P1` method deserves promotion based on repeated real use.
- Consider a tiny local structural-check script only if manual checking becomes annoying.

## Current Known Gaps

- `panelView` is not installed locally, so Step 1 visualization was not exercised in the 2026-04-09 pass.
- The multilevel treatment workflow was validated on a synthetic state-treatment / county-outcome panel because the Medicaid dataset is not bundled in this repo.
- `did2s`, `didimputation`, `staggered`, `DRDID`, and `YatchewTest` are installed locally but were not directly exercised in the first lean pass.
- `etwfe`, `gsynth`, `synthdid`, and `polars` are missing locally.
- `DIDmultiplegt` loads locally only with the `rgl.useNULL` workaround and was not directly exercised beyond load validation.

## Validation Results (2026-04-09)

- Workflow 1: success on `did::mpdta` with `did` 2.1.2 and `fixest` 0.12.1; design routed correctly as staggered, binary, and absorbing. `panelView` was unavailable locally.
- Workflow 2: success on `bacondecomp::castle`; forbidden-comparison share was `3.19%` and negative-weight share was `0.00%`, both `MINIMAL`.
- Workflow 3: success on `fixest::base_stagg`; the `sunab -> pretrends -> HonestDiD` chain ran end-to-end. HonestDiD emitted open-endpoint CI warnings, so interval length should be interpreted cautiously.
- Workflow 4: success on a synthetic multilevel panel; state-level treatment propagation and state-clustered `fixest` syntax both worked.
- Workflow 5: success for the DCDH route through `DIDmultiplegtDYN` 2.1.2 on `favara_imbs`, but only after setting `options(rgl.useNULL = TRUE)`. The wrapper package `DIDmultiplegt` was load-validated with the same workaround but not estimation-validated.

## Validation Queue

Run these first and document the outcome in this file if anything breaks:

1. Install `panelView` locally and re-run Step 1 visualization
2. Re-run the multilevel route on the real Medicaid analysis dataset
3. Exercise `did2s`, `didimputation`, and `staggered` directly in local validation
4. Exercise `DRDID` directly in local validation
5. Confirm whether newer `DIDmultiplegtDYN` / `polars` behavior changes the DCDH notes
6. Revisit the HonestDiD open-endpoint warning on `fixest::base_stagg` and check whether grid settings or a newer HonestDiD version remove it

## Maintenance Rules

- Prefer the smallest end-to-end documentation change that fixes a real workflow.
- Every real failure should update `VALIDATION_RUNBOOK.md` and at least one of: a step guide, `references/did-troubleshooting.md`, or `references/package-versions.md`.
- Do not broaden scope into `P1` just because a package is interesting; promote it only when usage or repeated failure justifies it.
