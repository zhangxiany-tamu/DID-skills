# panelView: Additional Practical Notes (Repo-Derived)

This addendum provides repository-level context not repeated in `panelView.md`.

## Repository Coverage

- **Repo**: [xuyiqing/panelView](https://github.com/xuyiqing/panelView)
- **Documentation site**: [yiqingxu.org/packages/panelView/](https://yiqingxu.org/packages/panelView/)
- Package/version: `panelView 1.1.17`
- Implementation assets: `R` (1 core file), `man`, `vignettes`

## Repo-Only Insights

- The package is a single-function package: `panelview()` handles all three plot types via the `type` argument.
- Internally uses base R graphics (not ggplot2), so plots cannot be modified with `+` syntax after creation.
- The function name is lowercase (`panelview`) even though the package is uppercase (`panelView`).

## Practical Tips

- **Large panels (>500 units)**: Treatment heatmaps become unreadable. Sample units or use `by.timing = TRUE` to compress the display.
- **`by.timing = TRUE`**: Always use this for staggered designs — it groups units by treatment cohort, making the adoption pattern immediately visible.
- **Save plots**: Use `pdf()` or `png()` before calling `panelview()` since the function uses base graphics and does not return a ggplot object.
- **Multi-valued treatment**: The function supports non-binary treatment variables. Use custom `color` vectors to distinguish levels.

## Consistency Checks

- Ensure the treatment indicator matches the timing variable (a common error is having `treat = 1` for periods before `first.treat`).
- Verify `index` order: first element is the unit identifier, second is the time variable.
- For `type = "outcome"`, the LHS of the formula must be a numeric outcome variable.
