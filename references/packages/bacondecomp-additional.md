# bacondecomp: Additional Practical Notes (Repo-Derived)

This addendum provides repository-level context not repeated in `bacondecomp.md`.

## Repository Coverage

- **Repo**: [evanjflack/bacondecomp](https://github.com/evanjflack/bacondecomp)
- Package/version: `bacondecomp 0.1.1`
- Implementation assets: `R` (2 files), `man` (5), `vignettes` (1), `tests` (9)

## Repo-Only Insights

- Core decomposition is compact and auditable in `R/bacon.R`, including weight scaling and controlled-decomposition internals.
- Test suite covers FE decomposition, weight behavior, controlled variants, summary outputs, and error handling.
- Vignette includes interpretation patterns for dominance by a few 2x2 comparisons.

## Useful Files (on GitHub)

- `R/bacon.R` — Core decomposition
- `tests/testthat/test_bacon_weights.R` — Weight behavior tests
- `vignettes/bacon.Rmd` — Interpretation patterns

## Practical Upgrade Pattern

- Pair decomposition output with explicit forbidden-comparison share reporting in your DiD diagnostics section.
- If using covariates, inspect controlled-decomposition behavior before comparing to no-control outputs.

## Consistency Checks

- Verify treatment coding is binary and panel identifiers are stable.
- Use decomposition as a TWFE diagnostic, not as a replacement estimator.
