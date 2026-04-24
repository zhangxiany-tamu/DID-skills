# Real-Data MCP Validation

Run the maintained local validation pass after building the MCP server:

```bash
npm run build
npm run validate:real
```

By default the script reads examples from:

```text
/Users/xianyangzhang/My Drive/DID Examples
```

Override with `DID_EXAMPLES_DIR=/path/to/examples`. The script writes derived
temporary CSVs under `/tmp` and writes validation summaries under the ignored
`mcp/validation-output/` directory.

## Report Shape

Each validation report should include:

- dataset name and source CSV
- preparation note describing any validation-panel transformation
- required-tool coverage across the six-scenario run
- MCP tool chain executed
- expected qualitative result
- actual key metrics and handles
- warnings surfaced by MCP/R tools
- pass/fail status with any failed expectation or tool error

The required scenarios are Medicaid insurance coverage, Medicaid mortality,
teacher collective bargaining, unilateral divorce laws, sentencing
enhancements, and bank deregulation. Across the full suite, every registered
`did_*` MCP tool must be exercised at least once, and the core five-step path
must pass for every scenario.

## Validation Panel Notes

The harness uses local real datasets, but it prepares MCP-sized validation
panels before loading them:

- Medicaid insurance: state-year panel, state identifiers mapped to numeric
  IDs, survey weights preserved, absorbing post-expansion treatment derived
  from first expansion year.
- Medicaid mortality: county mortality aggregated to a state-year panel with
  population-weighted mortality rates.
- Teacher collective bargaining: 1959-1990 state-year panel with finite log
  spending outcomes and absorbing collective-bargaining timing.
- Divorce laws: balanced 1968-1985 state-year subset, AK and OK excluded, and
  sentinel never-treated timing recoded to missing.
- Sentencing enhancements: complete-state panel with finite log gun-robbery
  outcomes and absorbing first-treated year derived from adoption timing.
- Bank deregulation: Baker-style 1977-1998 state-year sample, positive Gini
  outcomes, log inequality outcome, and post-1998 adopters treated as never
  treated.
