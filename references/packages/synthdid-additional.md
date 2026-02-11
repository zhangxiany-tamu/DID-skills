# synthdid: Additional Practical Notes (Repo-Derived)

This addendum summarizes repository-level details not duplicated in `synthdid.md`.

## Repository Coverage

- **Repo**: [synth-inference/synthdid](https://github.com/synth-inference/synthdid)
- Package/version: `synthdid 0.0.9`
- Implementation assets: `R` (12 files), `man` (31), `vignettes` (3), `tests` (5), `experiments` folder present

## Repo-Only Insights

- The repo includes extensive experimental scripts and benchmark checks in addition to package code.
- Inference methods are explicit in `vcov.R` (placebo, bootstrap, jackknife), useful for sensitivity to SE method choice.
- Plotting support is rich (`synthdid_plot`, `synthdid_units_plot`, placebo plots) and can be standardized for reporting.

## Useful Files (on GitHub)

- `R/synthdid.R` — Core estimator
- `R/vcov.R` — Inference methods (placebo, bootstrap, jackknife)
- `R/plot.R` — Visualization (synthdid_plot, units_plot)

## Practical Upgrade Pattern

- Report results under at least two inference methods (e.g., placebo and jackknife) in applied work.
- Use the same plotting template across datasets to compare weight concentration and fit diagnostics.

## Consistency Checks

- Ensure treated/control block setup (`N0`, `T0`) is validated before estimation.
- Interpret uncertainty method as part of specification, not a post-hoc cosmetic choice.
