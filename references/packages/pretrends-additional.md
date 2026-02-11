# pretrends: Additional Practical Notes (Repo-Derived)

This addendum contains repository-level details not duplicated in `pretrends.md`.

## Repository Coverage

- **Repo**: [jonathandroth/pretrends](https://github.com/jonathandroth/pretrends)
- Package/version: `pretrends 0.1.0`
- Implementation assets: `R` (3 files), `man` (3), data included, no tests folder

## Repo-Only Insights

- The core package surface is intentionally small (`pretrends`, `slope_for_power`) with internal power-calculation helpers.
- Numerical routines are concentrated in `power-calculation-fns.R`, making assumptions easier to audit.
- With no local tests folder, validate edge cases in your own project-level checks.

## Useful Files (on GitHub)

- `R/pretrends-plot.R` — Plot construction
- `R/power-calculation-fns.R` — Core numerical routines

## Practical Upgrade Pattern

- Build one reusable coefficient/VCOV extraction function per estimator family, then pipe into `pretrends` consistently.
- Report detectable-trend magnitudes alongside pre-trend p-values to avoid over-interpreting non-significance.

## Consistency Checks

- Ensure event-time vector and covariance matrix are aligned and ordered.
- Keep reference period handling identical across estimation and power-analysis stages.
