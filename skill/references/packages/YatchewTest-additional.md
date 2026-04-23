# YatchewTest: Additional Practical Notes (Repo-Derived)

This addendum documents additional practical notes derived from the GitHub source repository.

## Repository Coverage

- **Repo**: [Credible-Answers/yatchew_test](https://github.com/Credible-Answers/yatchew_test)
- Full R source + C++ backend + man pages + DESCRIPTION + NAMESPACE

## Key Source Files

| File | Key Functions | When to Read |
|------|--------------|--------------|
| `R/yatchew_test.R` | `yatchew_test()`, `yatchew_test.data.frame()` | Understanding the linearity test algorithm, heteroskedasticity-robust variant, and path plot generation |
| `R/nearest_neighbor_sort.R` | `nearest_neighbor_sort()` | How observations are sorted for difference-based variance estimation |
| `R/path_plot.R` | `path_plot()` | Visualization of sorted treatment-outcome path |
| `R/print.R` | `print.yatchew_test()` | Output formatting for test results |
| `src/msort.cpp` | Internal C++ sort | Performance-critical sorting backend via Rcpp |

## Repo-Only Insights

- `yatchew_test.R` implements Yatchew's (1997) differencing-based test: it sorts data by the treatment variable, takes first differences to eliminate the nonparametric component, then compares the variance of differenced residuals to OLS residual variance.
- The heteroskedasticity-robust variant (`het_robust = TRUE`) uses a modified variance estimator that accounts for non-constant error variance.
- `nearest_neighbor_sort.R` provides multivariate sorting when multiple treatment variables are supplied in `D`.

## Practical Upgrade Pattern

- Treat Yatchew-style tests as model-specification diagnostics, not DiD identification tests.
- Use `het_robust = TRUE` when treatment intensity varies substantially across units.
- The `path_plot` option provides visual confirmation of the sorting order and treatment-outcome relationship shape.

## Consistency Checks

- Keep linearity-test conclusions separate from causal identification claims.
- When testing multi-valued treatments, verify that the sorting in `nearest_neighbor_sort.R` matches your expected ordering.
