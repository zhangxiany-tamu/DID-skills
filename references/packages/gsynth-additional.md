# gsynth: Additional Practical Notes (Repo-Derived)

This addendum emphasizes repository details that are not repeated in `gsynth.md`.

## Repository Coverage

- **Repo**: [xuyiqing/gsynth](https://github.com/xuyiqing/gsynth)
- Package/version: `gsynth 1.3.1`
- Implementation assets: `R` (9 files), `man` (9), `vignettes` (1), `src` (7)

## Repo-Only Insights

- The estimator is backed by substantial compiled code (`src`) and many Rcpp-exported computational routines.
- `core.R` is large and contains multiple fitting engines (interactive FE, EM, matrix-completion paths).
- `NEWS.md` documents behavior changes relevant for inference defaults and parallel/cluster bootstrap support.

## Useful Files (on GitHub)

- `R/default.R` — Main entry point
- `R/core.R` — Multiple fitting engines (IFE, EM, matrix completion)
- `vignettes/tutorial.Rmd` — Full tutorial

## Practical Upgrade Pattern

- Treat `gsynth` runs as compute-intensive jobs; standardize seed/control settings and runtime logging.
- For reproducibility, archive solver/bootstrapping options with each model object.

## Consistency Checks

- Confirm your environment can compile/use C++ dependencies consistently.
- Check interpretation of implied weights and factor rank choices before policy conclusions.
