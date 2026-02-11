# did2s: Additional Practical Notes (Repo-Derived)

This addendum captures repository details not repeated in `did2s.md`.

## Repository Coverage

- **Repo**: [kylebutts/did2s](https://github.com/kylebutts/did2s)
- Package/version: `did2s 1.2.0`
- Implementation assets: `R` (9 files), `man` (9), `vignettes` (2), `tests` (4)

## Repo-Only Insights

- The repo provides `did3s` alongside `did2s`, which is easy to miss in high-level docs.
- There is built-in HonestDiD integration (`get_honestdid_obj_did2s`, `honest_did_did2s`).
- `robust_solve_XtX` indicates numerical-stability handling is part of the estimator pipeline.

## Useful Files (on GitHub)

- `R/did2s.R` — Core two-stage estimator
- `R/did3s.R` — Three-stage variant
- `R/honest_did.R` — HonestDiD integration
- `vignettes/event_study.Rmd` — Event study workflow

## Practical Upgrade Pattern

- Use `did2s` for core estimation, then convert to HonestDiD object via repo helper functions for sensitivity intervals.
- Keep an eye on solver behavior in near-singular first-stage designs.

## Consistency Checks

- Ensure `cluster_var` matches assignment structure.
- For event studies, treat `Inf` coding for never-treated consistently across model setup and plotting.
