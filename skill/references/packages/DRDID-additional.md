# DRDID: Additional Practical Notes (Repo-Derived)

This addendum provides repository-level details that are not repeated in `DRDID.md`.

## Repository Coverage

- **Repo**: [pedrohcgs/DRDID](https://github.com/pedrohcgs/DRDID)
- Package/version: `DRDID 1.2.3`
- Implementation assets: `R` (50 files), `man` (21), `tests` (11), `src` (2)

## Repo-Only Insights

- The repo separates many low-level estimators (`*_panel`, `*_rc`, `*_imp_*`) from high-level wrappers (`drdid`, `ipwdid`, `ordid`).
- Bootstrap is deeply implemented via dedicated worker functions (`wboot_*`) across panel and repeated-cross-section settings.
- C++ hooks (`RcppExports`) are present for treatment uniqueness checks and preprocessing support.

## Useful Files (on GitHub)

- `R/drdid.R` — High-level DR wrapper
- `R/drdid_imp_panel.R` — Improved panel estimator
- `R/wboot_drdid_rc.R` — Bootstrap for repeated cross-section

## Practical Upgrade Pattern

- Use high-level wrappers for baseline estimates, then mirror them with low-level variants when debugging inference differences.
- In weak-overlap designs, run bootstrap-based checks early instead of only relying on analytical SEs.

## Consistency Checks

- Match `panel = TRUE/FALSE` to actual data structure before interpretation.
- Keep trimming and bootstrap choices explicit in reported specifications.
