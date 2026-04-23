# Package Version Tracking

Documents the package versions observed during the **last local validation pass** of this skill. Check these against installed versions when troubleshooting API mismatches.

Last updated: 2026-04-09

Validation context: first lean local validation cycle completed on 2026-04-09 under R 4.3.2 using the workflows in [`../VALIDATION_RUNBOOK.md`](../VALIDATION_RUNBOOK.md). Several packages still remain `installed_not_exercised` or `missing_local`; keep those follow-ups in [`../BACKLOG.md`](../BACKLOG.md). Refresh this file only after a new validation pass and its follow-up notes are recorded there.

## Documented Package Versions

| Package | Version | Validation status | Source | Primary CRAN/GitHub |
|---------|---------|-------------------|--------|---------------------|
| bacondecomp | 0.1.1 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=bacondecomp) |
| did | 2.1.2 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=did) |
| did2s | 1.0.2 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=did2s) |
| didimputation | 0.3.0 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=didimputation) |
| DIDmultiplegt | 2.0.0 | `load_validated_with_rgl_useNULL` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegt) |
| DIDmultiplegtDYN | 2.1.2 | `validated_local_with_rgl_useNULL` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegtDYN) |
| DRDID | 1.2.2 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=DRDID) |
| etwfe | — | `missing_local` | CRAN | [CRAN](https://cran.r-project.org/package=etwfe) |
| fixest | 0.12.1 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=fixest) |
| gsynth | — | `missing_local` | CRAN | [CRAN](https://cran.r-project.org/package=gsynth) |
| HonestDiD | 0.2.6 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=HonestDiD) |
| panelView | — | `missing_local` | CRAN | [CRAN](https://cran.r-project.org/package=panelView) |
| polars | — | `missing_local` | r-universe | [r-universe](https://rpolars.r-universe.dev) |
| pretrends | 0.1.0 | `validated_local` | GitHub | [GitHub](https://github.com/jonathandroth/pretrends) |
| staggered | 1.2.2 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=staggered) |
| synthdid | — | `missing_local` | GitHub | [GitHub](https://github.com/synth-inference/synthdid) |
| TwoWayFEWeights | 2.0.4 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=TwoWayFEWeights) |
| YatchewTest | 1.1.1 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=YatchewTest) |

## Notes

- This local pass validated workflows directly on `did`, `fixest`, `bacondecomp`, `TwoWayFEWeights`, `pretrends`, `HonestDiD`, and `DIDmultiplegtDYN`.
- `panelView`, `etwfe`, `gsynth`, `synthdid`, and `polars` were not installed locally.
- Several installed package versions were older than the previously documented target versions, especially `did`, `fixest`, `did2s`, `didimputation`, `HonestDiD`, `DRDID`, and `DIDmultiplegtDYN`.
- `DIDmultiplegt` and `DIDmultiplegtDYN` required `options(rgl.useNULL = TRUE)` to load in this headless macOS environment; see `did-troubleshooting.md`.
- The local DCDH validation used `DIDmultiplegtDYN` 2.1.2, so this pass does **not** validate the newer `2.3.0+` `polars` behavior documented previously.
- `HonestDiD` completed successfully but emitted open-endpoint CI warnings in the `base_stagg` workflow, so interval length should be interpreted cautiously.

## Validation Loop

When a workflow is revalidated:

1. Run the relevant prompt from [`../VALIDATION_RUNBOOK.md`](../VALIDATION_RUNBOOK.md).
2. If the workflow fails, classify it with [`../FAILURE_BUCKETS.md`](../FAILURE_BUCKETS.md) and log follow-up work in [`../BACKLOG.md`](../BACKLOG.md).
3. Only after the workflow is judged correct should you update the version ledger below.
4. If the workflow exposed environment-specific issues, update `did-troubleshooting.md` in the same pass.

## Update Checklist

When refreshing documentation for a package:

1. Re-run the relevant workflow from `../VALIDATION_RUNBOOK.md`
2. Pull the latest source from CRAN/GitHub only if that workflow needs a refresh
3. Update the version number in this table after validation, not before
4. Regenerate the `pkg.md` and `pkg_quick_start.md` files if behavior or docs changed
5. Check for new/removed/renamed functions in the function map
6. Update `pkg-additional.md` if source structure changed
7. Update the "Last updated" date above
