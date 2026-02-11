# Package Version Tracking

Documents the version of each R package that was used to generate the skill documentation. Check these against installed versions when troubleshooting API mismatches.

Last updated: 2026-02-08

## Documented Package Versions

| Package | Version | Source | Primary CRAN/GitHub |
|---------|---------|--------|---------------------|
| bacondecomp | 0.1.1 | CRAN | [CRAN](https://cran.r-project.org/package=bacondecomp) |
| did | 2.3.0 | CRAN | [CRAN](https://cran.r-project.org/package=did) |
| did2s | 1.2.0 | CRAN | [CRAN](https://cran.r-project.org/package=did2s) |
| didimputation | 0.5.0 | CRAN | [CRAN](https://cran.r-project.org/package=didimputation) |
| DIDmultiplegt | 2.0.0 | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegt) |
| DIDmultiplegtDYN | 2.3.0 | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegtDYN) |
| DRDID | 1.2.3 | CRAN | [CRAN](https://cran.r-project.org/package=DRDID) |
| etwfe | 0.6.0 | CRAN | [CRAN](https://cran.r-project.org/package=etwfe) |
| fixest | 0.13.2 | CRAN | [CRAN](https://cran.r-project.org/package=fixest) |
| gsynth | 1.3.1 | CRAN | [CRAN](https://cran.r-project.org/package=gsynth) |
| HonestDiD | 1.2.0 | CRAN | [CRAN](https://cran.r-project.org/package=HonestDiD) |
| panelView | 1.1.17 | CRAN | [CRAN](https://cran.r-project.org/package=panelView) |
| polars | 1.8.0 | r-universe | [r-universe](https://rpolars.r-universe.dev) |
| pretrends | 0.1.0 | GitHub | [GitHub](https://github.com/jonathandroth/pretrends) |
| staggered | 1.2.2 | CRAN | [CRAN](https://cran.r-project.org/package=staggered) |
| synthdid | 0.0.9 | GitHub | [GitHub](https://github.com/synth-inference/synthdid) |
| TwoWayFEWeights | 2.0.4 | CRAN | [CRAN](https://cran.r-project.org/package=TwoWayFEWeights) |
| YatchewTest | 1.1.1 | CRAN | [CRAN](https://cran.r-project.org/package=YatchewTest) |

## Notes

- **did 2.3.0**: Now stable on CRAN. Previous docs referenced GitHub dev version 2.2.1.913.
- **DIDmultiplegt 2.0.0**: Unified wrapper package that calls DIDmultiplegtDYN, DIDHAD, or did_multiplegt_old via a `mode` argument.
- **DIDmultiplegtDYN 2.3.0**: Now requires `polars` (Rust-based data frame library). You must call `library(polars)` before `library(DIDmultiplegtDYN)` due to a namespace bug where the `pl` object is not properly imported (see `did-troubleshooting.md` Section 10.4).
- **polars 1.8.0**: System dependency for DIDmultiplegtDYN. Requires Rust/cargo to compile. Install from r-universe, not CRAN.
- **HonestDiD 1.2.0**: Now on CRAN (installed automatically as a dependency of did2s). No longer requires `remotes::install_github()`.
- **staggered, DRDID**: Both on CRAN. Install with `install.packages()`.
- **pretrends, synthdid**: Still GitHub-only. Install with `remotes::install_github()`.
- **panelView 1.1.17**: Treatment rollout visualization. Note: function name is lowercase (`panelview()`), package name is uppercase (`panelView`).
- **cobalt**: Used inline for covariate balance checking (`bal.tab()`); no 3-file package doc set (general-purpose package, not DiD-specific).
- **TwoWayFEWeights 2.0.4**: Major version bump from 0.1.0. API is unchanged for the primary `twowayfeweights()` function.

## Update Checklist

When refreshing documentation for a package:

1. Pull the latest source from CRAN/GitHub
2. Update the version number in this table
3. Regenerate the `pkg.md` and `pkg_quick_start.md` files
4. Check for new/removed/renamed functions in the function map
5. Update `pkg-additional.md` if source structure changed
6. Update the "Last updated" date above
