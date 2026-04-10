# DID Failure Buckets

Use these buckets when a real workflow fails. Every failure should land in exactly one bucket first, even if several fixes are eventually needed.

| Bucket | What It Means | Common Signature | Update First |
|---|---|---|---|
| `routing_error` | The skill picked the wrong workflow or package family. | Binary absorbing design routed to advanced methods, or reversible treatment forced through core staggered DiD. | Relevant step guide, `BACKLOG.md` |
| `version_drift` | Package behavior changed relative to documented syntax or defaults. | Example code no longer runs, arguments changed, output schema differs. | `references/package-versions.md`, affected package doc, `BACKLOG.md` |
| `data_prep_mismatch` | Data coding rules were incomplete or wrong. | Never-treated coding wrong, multilevel treatment not propagated, panel balance assumption missed. | Step guide, troubleshooting doc |
| `numerical_instability` | The method is conceptually right, but estimation/inference is unstable. | Singular matrix, zero standard errors, non-PSD VCOV, tiny cohorts. | Troubleshooting doc, step guide |
| `inference_extraction_mismatch` | Estimation succeeded, but downstream extraction for `pretrends` or `HonestDiD` failed. | `betahat`, `sigma`, or `tVec` malformed or non-conformable. | Step 4 or Step 5 guide, troubleshooting doc |
| `install_runtime_environment_failure` | The package cannot be installed or loaded in the user's environment. | Homebrew R compile errors, missing Rust/cargo, solver installation failures. | `references/did-troubleshooting.md`, `BACKLOG.md` |
| `user_design_mismatch` | The user’s actual research design is not well served by the repo’s main workflow. | Spillovers, treatment timing beyond sample, unsupported comparison group logic. | Step 1 guide, `METHOD_MATRIX.md`, `BACKLOG.md` |

## Triage Rule

When documenting a failure:

1. Name the workflow that failed.
2. Assign the primary bucket.
3. Update the first doc listed above.
4. Add a short follow-up item to `BACKLOG.md` if the issue is not fully resolved.
