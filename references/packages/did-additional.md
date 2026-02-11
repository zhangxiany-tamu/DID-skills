# did: Additional Practical Notes (Repo-Derived)

This addendum focuses on repository-level details not duplicated in `did.md`.

## Repository Coverage

- **Repo**: [bcallaway11/did](https://github.com/bcallaway11/did)
- Package/version: `did 2.3.0`
- Implementation assets: `R` (24 files), `man` (42), `vignettes` (5), `tests` (16)

## Repo-Only Insights

- The repo includes an internal `R/honest_did/` bridge (`honest_did.AGGTEobj`) for direct sensitivity workflows after `aggte`.
- There is an explicit pretest pipeline (`conditional_did_pretest`, multiplier bootstrap helpers) beyond core ATT estimation.
- Test suite is broad: point estimates, inference, pretest behavior, simulation consistency, and user bug regressions.

## Useful Files (on GitHub)

- `R/att_gt.R` — Core group-time ATT estimation
- `R/aggte.R` — Aggregation engine
- `R/honest_did/honest_did.R` — HonestDiD bridge
- `vignettes/TWFE.Rmd` — TWFE comparison vignette

## Practical Upgrade Pattern

- For production runs, pair `att_gt`/`aggte` with the repo-tested pretest and sensitivity hooks instead of stopping at event-study plots.
- When results are policy-facing, inspect `test-user_bug_fixes.R` patterns to avoid known edge-case mistakes.

## Consistency Checks

- Keep `control_group` and `base_period` explicit and reported.
- Align clustering with treatment-assignment level before inference.
- If using the honest-DiD bridge, verify period indexing before passing coefficients.
