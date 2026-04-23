# DIDmultiplegtDYN: Additional Practical Notes (Repo-Derived)

This addendum captures repository-level details not repeated in `DIDmultiplegtDYN.md`.

## Repository Coverage

- **Repo**: [Credible-Answers/did_multiplegt_dyn](https://github.com/Credible-Answers/did_multiplegt_dyn)
- Current version: `DIDmultiplegtDYN 2.3.0`
- Exported function: `did_multiplegt_dyn`

## Repo-Only Insights

- Two local code branches coexist; behavior can differ by branch/version.
- The modern branch includes dedicated helpers for normalization, bootstrap, design diagnostics, and print/summary methods.
- A companion package path (`did_multiplegt_dyn_all_pl`) indicates an alternative workflow for all-placebo reporting.

## Useful Files (on GitHub)

- `R/R/did_multiplegt_dyn.R` — Core estimation
- `R/R/did_multiplegt_bootstrap.R` — Bootstrap inference
- `R/R/did_multiplegt_dyn_design.R` — Design diagnostics

## Practical Upgrade Pattern

- Pin one branch/version before analysis and keep it fixed across all replication runs.
- For complex treatment paths, rely on helper diagnostics (`*_design`, `*_by_check`) before interpreting effects.

## Consistency Checks

- If `same_switchers_pl` is used, enforce compatibility with other option toggles.
- Verify placebo/effect horizon feasibility before long event-study grids.
