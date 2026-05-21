# did-analysis Backlog

This file is the working queue for improving the skill without turning it into a larger platform.

## Current Goal

Keep `did-analysis` trustworthy by defending the P0 workflows with repeatable MCP and skill-fallback validation.

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
| Keep recycle/recovery validation on the regular smoke surface | Handles must survive worker swaps in long sessions. | `done` |

## P1 Priorities

- Revisit `etwfe`, `gsynth`, and `synthdid` after the `P0` workflows are stable.
- Decide whether any `P1` method deserves promotion based on repeated real use.
- Consider promoting deeper worker-pool unit tests if recycle/crash behavior changes again.

## Current Known Gaps

- The real-data validation uses an aggregated Medicaid mortality panel; a full county-outcome/state-treatment multilevel workflow remains a separate documentation-level check.
- `etwfe`, `gsynth`, `synthdid`, and `YatchewTest` are installed locally but remain outside the defended P0 audit path.
- DCDH-family package quick examples pass with `polars`, but the advanced-method workflows remain code-generation only rather than MCP tools.
- HonestDiD open-endpoint CI warnings still appear on some real examples and should remain visible in reports.

## Validation Results (2026-05-21)

- MCP build, unit tests, `smoke:all`, and forced recycle smoke all pass under the declared Node 22 runtime.
- `npm run validate:real` passes all six DID Examples scenarios and exercises all 16 registered tools at least once.
- `node scripts/audit-mcp-matrix.mjs` passes all 96 tool-dataset cells.
- `node skill/scripts/audit-skill-recipes.mjs` passes all 30 skill fallback recipe cells.
- P0 estimator paths `did`, `fixest`, `did2s`, `didimputation`, `staggered`, `DRDID`, `pretrends`, `HonestDiD`, `panelView`, `bacondecomp`, and `TwoWayFEWeights` are directly exercised.
- `DIDmultiplegtDYN` 2.3.0 and `DIDmultiplegt` 2.0.0 quick examples both pass with `polars`.

## Validation Queue

Run these first and document the outcome in this file if anything breaks:

1. Re-run `npm run build`, `npm test`, `npm run smoke:all`, and `npm run smoke:recycle` after MCP changes.
2. Re-run `npm run validate:real`, `node scripts/audit-mcp-matrix.mjs`, and `node ../skill/scripts/audit-skill-recipes.mjs` after workflow or package-version changes.
3. Revisit the full county-outcome/state-treatment multilevel route if the raw Medicaid mortality workflow becomes a priority.
4. Revisit the HonestDiD open-endpoint warnings only when they affect interpretation or a package update changes behavior.
5. Consider direct `etwfe`, `gsynth`, or `synthdid` validation only after repeated real use justifies moving them toward P0.

## Maintenance Rules

- Prefer the smallest end-to-end documentation change that fixes a real workflow.
- Every real failure should update `VALIDATION_RUNBOOK.md` and at least one of: a step guide, `references/did-troubleshooting.md`, or `references/package-versions.md`.
- Do not broaden scope into `P1` just because a package is interesting; promote it only when usage or repeated failure justifies it.
