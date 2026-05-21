# Package Version Tracking

Documents the package versions observed during the **last local validation pass** of this skill. Check these against installed versions when troubleshooting API mismatches.

Last updated: 2026-05-21

Validation context: maintenance validation completed on 2026-05-21 under R 4.5.2 on `aarch64-apple-darwin24.4.0`. The pass ran the MCP smoke suite, the six-scenario real-data validation, the 16-tool x 6-dataset MCP audit matrix, the skill R fallback recipe audit, forced worker recycling, and quick DCDH package examples. Refresh this file only after a new validation pass and its follow-up notes are recorded in [`../BACKLOG.md`](../BACKLOG.md).

## Documented Package Versions

| Package | Version | Validation status | Source | Primary CRAN/GitHub |
|---------|---------|-------------------|--------|---------------------|
| bacondecomp | 0.1.1 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=bacondecomp) |
| did | 2.3.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=did) |
| did2s | 1.2.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=did2s) |
| didimputation | 0.5.0 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=didimputation) |
| DIDmultiplegt | 2.0.0 | `quick_example_validated_with_polars` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegt) |
| DIDmultiplegtDYN | 2.3.0 | `quick_example_validated_with_polars` | CRAN | [CRAN](https://cran.r-project.org/package=DIDmultiplegtDYN) |
| DRDID | 1.2.3 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=DRDID) |
| etwfe | 0.6.0 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=etwfe) |
| fixest | 0.13.2 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=fixest) |
| gsynth | 1.3.1 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=gsynth) |
| HonestDiD | 0.2.6 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=HonestDiD) |
| panelView | 1.1.18 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=panelView) |
| polars | 1.8.0.9000 | `validated_local_for_dcdh` | r-universe | [r-universe](https://rpolars.r-universe.dev) |
| pretrends | 0.1.0 | `validated_local` | GitHub | [GitHub](https://github.com/jonathandroth/pretrends) |
| staggered | 1.2.2 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=staggered) |
| synthdid | 0.0.9 | `installed_not_exercised` | GitHub | [GitHub](https://github.com/synth-inference/synthdid) |
| TwoWayFEWeights | 2.0.4 | `validated_local` | CRAN | [CRAN](https://cran.r-project.org/package=TwoWayFEWeights) |
| YatchewTest | 1.1.1 | `installed_not_exercised` | CRAN | [CRAN](https://cran.r-project.org/package=YatchewTest) |

## Notes

- The 2026-05-21 pass validated the P0 MCP and skill fallback workflows directly on six DID Examples datasets: Medicaid insurance, Medicaid mortality, teacher collective bargaining, unilateral divorce laws, sentencing enhancements, and bank deregulation.
- `did2s`, `didimputation`, `staggered`, `DRDID`, and `panelView` are now directly exercised by the maintained audits.
- `DIDmultiplegtDYN` 2.3.0 and `DIDmultiplegt` 2.0.0 both completed package quick examples with `polars` loaded. Keep `options(rgl.useNULL = TRUE)` documented for headless environments because it remains a low-cost workaround.
- `etwfe`, `gsynth`, `synthdid`, and `YatchewTest` are installed locally but still outside the defended P0 audit path.
- HonestDiD still emits open-endpoint CI warnings on some real examples; the MCP audit now treats those as expected numerical warnings unless they coincide with failed estimates or missing robust rows.

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
