# panelView: Additional Practical Notes (Repo-Derived)

This addendum provides repository-level context not repeated in `panelView.md`.

## Repository Coverage

- **Repo**: [xuyiqing/panelView](https://github.com/xuyiqing/panelView)
- **Documentation site**: [yiqingxu.org/packages/panelView/](https://yiqingxu.org/packages/panelView/)
- Package/version: `panelView 1.1.17`
- Implementation assets: `R` (1 core file), `man`, `vignettes`

## Repo-Only Insights

- The package is a single-function package: `panelview()` handles all three plot types via the `type` argument.
- As of `panelView >= 1.1.17`, `panelview()` returns a ggplot object (class `"gg"` / `"ggplot"`). Earlier versions used base R graphics. Always print or assign the return value rather than relying on implicit printing.
- The function name is lowercase (`panelview`) even though the package is uppercase (`panelView`).

## Practical Tips

- **Large panels (>500 units)**: Treatment heatmaps become unreadable. Sample units or use `by.timing = TRUE` to compress the display.
- **`by.timing = TRUE`**: Always use this for staggered designs — it groups units by treatment cohort, making the adoption pattern immediately visible.
- **Save plots**: Wrap the call in `print()` and open a PNG/PDF device:
  ```r
  png("rollout.png", width = 9, height = 7, units = "in", res = 150)
  print(panelview(y ~ treat, data = df, index = c("id", "year"),
                  type = "treat", by.timing = TRUE))
  dev.off()
  ```
  The bare `panelview(...)` call renders only when the returned ggplot is auto-printed at the REPL top level. Inside a function body, `lapply()`, `render()`, or a PNG device capture the return value is silently dropped unless you `print()` it.
- **Multi-valued treatment**: The function supports non-binary treatment variables. Use custom `color` vectors to distinguish levels.

## Consistency Checks

- Ensure the treatment indicator matches the timing variable (a common error is having `treat = 1` for periods before `first.treat`).
- Verify `index` order: first element is the unit identifier, second is the time variable.
- For `type = "outcome"`, the LHS of the formula must be a numeric outcome variable.
