# fixest: Additional Practical Notes (Repo-Derived)

This addendum records additional practical notes derived from the GitHub source repository.

## Repository Coverage

- **Repo**: [lrberge/fixest](https://github.com/lrberge/fixest)
- 14 DiD-relevant R source files + DESCRIPTION + NAMESPACE

## Key Source Files for DiD

| File | Key Functions | When to Read |
|------|--------------|--------------|
| `R/did.R` | `sunab()`, `sunab_att()` | Understanding Sun-Abraham interaction-weighted estimation internals |
| `R/estimation.R` | `feols()` | Core OLS engine, formula parsing, fixed-effects handling |
| `R/iplot.R` | `iplot()` | Event study plot construction from interaction terms |
| `R/miscfuns.R` | `i()`, `did_means()` | Interaction operator logic, treated/control descriptive stats |
| `R/panel.R` | `panel()` | Panel data construction, lag/lead operators |
| `R/VCOV.R` | `vcov_cluster()`, `vcov_conley()` | Clustered and spatial standard error computation |
| `R/methods.R` | `coef()`, `vcov()`, `summary()` | Coefficient/variance extraction for downstream pipelines |

## Repo-Only Insights

- `sunab()` in `did.R` constructs cohort-relative-time interactions internally; coefficient naming follows the `var::period` pattern used by `extract_time_periods()` in the sensitivity step.
- `feols()` in `estimation.R` handles multi-part formulas (`y ~ x | fe1 + fe2`) with demeaning; the fixed-effects slot is parsed separately from the linear part.
- `i()` in `miscfuns.R` is the general interaction constructor; `sunab()` is a specialized wrapper around it for DiD.

## Useful Files

- `fixest.md` in this skill — Authoritative function-level documentation
- GitHub `R/did.R`, `R/estimation.R`, `R/VCOV.R` — Key source for deep-dives

## Practical Upgrade Pattern

- Pin the installed `fixest` version in your project lockfile/session info before running large event-study pipelines.
- Add explicit regression tests around coefficient naming conventions used in downstream sensitivity steps.

## Consistency Checks

- Validate `sunab` coefficient names before feeding outputs into pretrends/HonestDiD pipelines.
- Keep clustering/reference-period settings explicit in all tables and plots.
