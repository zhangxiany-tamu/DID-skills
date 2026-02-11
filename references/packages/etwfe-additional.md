# etwfe: Additional Practical Notes (Repo-Derived)

This addendum captures repository-specific details beyond `etwfe.md`.

## Repository Coverage

- **Repo**: [grantmcdermott/etwfe](https://github.com/grantmcdermott/etwfe)
- Package/version: `etwfe 0.6.0`
- Implementation assets: `R` (3 files), `man` (3), `vignettes` (1), `tests` (tinytest harness)

## Repo-Only Insights

- The package is intentionally narrow: `etwfe` for estimation, `emfx` for effect extraction, `plot.emfx` for visualization.
- Local mirror includes both `tests/` and `inst/tinytest/`, suggesting lightweight regression checks.
- README/vignette emphasize VCOV choices and post-estimation effect extraction workflow.

## Useful Files (on GitHub)

- `R/etwfe.R` — Estimation wrapper
- `R/emfx.R` — Effect extraction
- `vignettes/etwfe.Rmd` — VCOV choices and workflow

## Practical Upgrade Pattern

- Keep estimation and marginal-effect extraction as separate reproducible steps (`etwfe` then `emfx`).
- Standardize VCOV specification in project helpers for consistent reporting across models.

## Consistency Checks

- Match fixed-effects structure to treatment timing and panel design.
- Confirm event-time interpretation after any binning or reference-period choices.
