# YatchewTest: Quick Start

Read this file first. It gives a short workflow and a complete function map, then points to full docs and source files.

## How To Use This File

- Start here for package orientation and function selection.
- For full arguments/examples, open `YatchewTest.md` at the referenced line.
- For repository-derived implementation insights, read `YatchewTest-additional.md`.

## Quick Workflow

1. Use `yatchew_test(...)` to test linearity in treatment-response relationships.
2. Use the `data.frame` method when working with tabular inputs.
3. Treat results as functional-form diagnostics, not identification tests.

## Layer 5 Source (GitHub)

- **Repo**: [Credible-Answers/yatchew_test](https://github.com/Credible-Answers/yatchew_test)
- **Key files**: `R/yatchew_test.R`, `R/nearest_neighbor_sort.R`, `R/path_plot.R`, `R/print.R`

## Complete Function Map

| Function | What It Does | Details In Full Manual |
|---|---|---|
| `yatchew_test` | Tests linearity of treatment-response relationship using Yatchew's method | `YatchewTest.md:46` |
| `yatchew_test.data.frame` | Data.frame method for Yatchew linearity test | `YatchewTest.md:28` |

## Common Use Case Example

This example demonstrates the core functionality of the YatchewTest package by testing whether a relationship between variables is linear, which is useful for validating functional form assumptions in regression models.

```r
library(YatchewTest)

# Generate sample data with nonlinear relationship
set.seed(123)
n <- 1000
x <- rnorm(n, 0, 1)
y <- 2 + 0.5 * x + 0.3 * x^2 + rnorm(n, 0, 1)  # Quadratic relationship
data <- data.frame(x = x, y = y)

# Test for linearity
linear_test <- yatchew_test(
  data = data,
  Y = "y",              # Dependent variable
  D = "x",              # Independent variable
  het_robust = TRUE     # Robust to heteroskedasticity
)

# View results
print(linear_test)
```

## Reading Strategy

- Use this file to pick the right test entry point.
- Use `YatchewTest.md` for argument-level details.
- For deep function internals, consult the GitHub source linked in Layer 5 above.
