# staggered: Additional Practical Notes (Repo-Derived)

This addendum captures repository details beyond what is repeated in `staggered.md`.

## Repository Coverage

- **Repo**: [jonathandroth/staggered](https://github.com/jonathandroth/staggered)
- Package/version: `staggered 1.2.2`
- Implementation assets: `R` (7 files), `man` (10), `src` (3)

## Repo-Only Insights

- The package includes multiple estimators (`staggered`, `staggered_cs`, `staggered_sa`) with shared matrix-building internals.
- Significant infrastructure is devoted to constructing A0/A-theta objects for efficient estimation and variance formulas.
- C++ helpers are used for core linear algebra solves (`RcppExports` + `src`).

## Useful Files (on GitHub)

- `R/compute_efficient_estimator_and_se.R` — Core estimator
- `R/create_A0_lists.R` — Matrix-building internals
- `R/balance_checks.R` — Pre-treatment balance

## Practical Upgrade Pattern

- Run `balance_checks` early, then estimate with at least one alternative (e.g., `staggered_cs`) for robustness.
- Store estimator variant and variance options in output tables to avoid ambiguous comparisons.

## Consistency Checks

- Keep unit/time/treatment columns strictly clean before calling estimators.
- Interpret differences across `staggered` variants as assumption-driven, not purely numerical noise.
