# HonestDiD: Additional Practical Notes (Repo-Derived)

This addendum focuses on repository-level implementation details beyond `HonestDiD.md`.

## Repository Coverage

- **Repo**: [asheshrambachan/HonestDiD](https://github.com/asheshrambachan/HonestDiD)
- Package/version: `HonestDiD 1.2.0`
- Implementation assets: `R` (19 files), `man` (21), `tests` (1)

## Repo-Only Insights

- The repo implements multiple restriction families (RM/RMB/RMM/SD/SDM/SDRM/SDRMB/SDRMM) as separate computational paths.
- There is explicit support code for `fixest::sunab` objects (`sunab_beta_vcv`) in addition to AGGTE workflows.
- Sensitivity plotting and CI construction are centralized in `sensitivityresults.R` with reusable helpers.

## Useful Files (on GitHub)

- `R/sensitivityresults.R` — Sensitivity CI construction
- `R/honest_sunab.R` — sunab_beta_vcv extraction helper
- `R/honest_did.R` — Main HonestDiD entry point
- `R/flci.R` — Fixed-length CI computation

## Practical Upgrade Pattern

- Standardize one coefficient-extraction routine per estimator family before sensitivity runs.
- Use the relative-magnitudes workflow for reporting because it is easier to communicate than raw M grids alone.

## Consistency Checks

- Validate pre/post indexing and omitted base period before calling sensitivity constructors.
- Keep `numPrePeriods` and `numPostPeriods` synchronized with the sliced covariance matrix.
