# DIDmultiplegt: Additional Practical Notes (Repo-Derived)

This addendum reflects full repository scanning and focuses on non-redundant details.

## Repository Coverage

- **Repo**: [Credible-Answers/did_multiplegt](https://github.com/Credible-Answers/did_multiplegt)
- Repo includes R package code, plus Stata/Python folders and extended example assets.
- Code assets: `R` (49 files), `man` (11), `vignettes` (multiple markdown + source scripts)

## Repo-Only Insights

- The repository is a multi-language bundle, not only an R package mirror.
- There are multiple implementation tracks: `R/`, `no_xlsx/DIDmultiplegtDYN/`, and `did_multiplegt_dyn_all_pl/`.
- Vignettes explicitly cover irregular outcome frequency, placebo mapping caveats, and tabulation workflows.

## Useful Files (on GitHub)

- `vignettes/vignette_1.md`, `vignettes/vignette_2.md` — Usage patterns
- `R/R/did_multiplegt_dyn.R` — Core estimation
- `did_multiplegt_dyn_all_pl/R/R/did_multiplegt_dyn_all_pl.R` — All-placebo variant

## Practical Upgrade Pattern

- Use the vignette design examples to stress-test treatment timing complexity before production estimation.
- Document which implementation branch you used (`R` vs `no_xlsx` vs `all_pl`) for reproducibility.

## Consistency Checks

- Do not mix outputs from different branch variants without verifying version/argument parity.
- Keep placebo interpretation explicit when outcomes are observed intermittently.
