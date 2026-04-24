# did-analysis Next Steps

This is the shortest maintainer handoff for the repo.

## Read These Files In Order

1. `BACKLOG.md`
2. `METHOD_MATRIX.md`
3. `VALIDATION_RUNBOOK.md`
4. `references/package-versions.md`
5. `references/did-troubleshooting.md`

## Current Goal

Close the remaining local blockers from the first lean validation pass while keeping the repo skill-first.

## Immediate Priorities

1. Install `panelView` locally and re-run the Step 1 visualization path.
2. Re-run the multilevel workflow on the actual Medicaid dataset when available.
3. Exercise `did2s`, `didimputation`, `staggered`, and `DRDID` directly in a follow-up validation pass.
4. Revisit the HonestDiD open-endpoint warning on `base_stagg` and determine whether it is grid-related, data-related, or resolved in a newer package version.
5. Keep the `rgl.useNULL` workaround documented for DCDH-family packages unless a cleaner fix is confirmed.
6. Keep `SKILL.md` thin; move new detail into step guides, not back into the entry point.

## Required Working Style

- prefer the smallest documentation change that unlocks or restores a real workflow
- update `BACKLOG.md` when a workflow fails or priorities change
- use `FAILURE_BUCKETS.md` before deciding what to edit
- treat `METHOD_MATRIX.md` as the priority boundary
- do not expand into broader package coverage unless repeated use justifies it

## Done Means

- the `P0` workflows in `VALIDATION_RUNBOOK.md` route correctly through the skill
- any failures are bucketed and documented
- version-tracking notes match the last validated cycle
- `SKILL.md` remains a routing layer, not a second full manual
