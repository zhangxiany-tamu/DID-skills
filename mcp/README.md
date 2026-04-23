# did-mcp

MCP server that exposes the `did-analysis` skill's 5-step workflow as agent-callable tools. Claude Code (or any MCP client) can run the workflow end-to-end instead of writing R code for the user to paste.

## Architecture

- **TypeScript** server via `@modelcontextprotocol/sdk`, stdio transport
- **Persistent R subprocess** per session, NDJSON over stdin/stdout (`r/bridge.R`)
- **Object-handle session state** — tools return typed handles (`panel_1`, `estimate_1`, …) that later tools consume
- **Worker pool** with 1 active + 1 standby R process; recycle every 100 calls or 60 minutes; promote standby on crash; persist serializable handles via `saveRDS` across recycle

See `../skill/CLAUDE.md` for the monorepo conventions; the skill's `SKILL.md` defines the workflow the tools execute.

## Status

**Phase 1 (current)**: scaffolding + smoke test.
- `did_ping` — round-trip through the R bridge
- `did_session` — list/inspect/drop handles, show pool status

**Phase 2 (Step 1 tools)**: `did_load_panel`, `did_check_panel`, `did_profile_design`, `did_plot_rollout`, `did_recode_never_treated`.

**Phase 3 (Step 3 tools)**: `did_estimate` (did / fixest / did2s / didimputation / staggered), `did_compare_estimators`, `did_extract_event_study`.

**Phase 4+ (v2)**: `did_diagnose_twfe`, `did_power_analysis`, `did_honest_sensitivity`, `did_drdid`, `did_plot`, `did_report`.

## Build

Requires Node 22.x and R 4.x.

```bash
cd mcp
nvm use          # picks 22 from .nvmrc if you use nvm
npm install
npm run build
```

## R packages

Install the R packages the workflow depends on (P0 + P1 tiers from `skill/METHOD_MATRIX.md`):

```bash
Rscript r/install_packages.R
```

P0 packages are required; P1 packages are best-effort and tools depending on them error gracefully when absent. `pretrends` and `synthdid` install from GitHub; the rest come from CRAN.

## Register with Claude Code

Copy the `did-mcp` entry from `mcp-config.example.json` into your `~/.claude/settings.json` under `mcpServers`. Adjust the absolute paths to point at YOUR Node, Rscript, and this repo. Restart Claude Code to load the server.

Verify the wiring:

```
In Claude Code: "Call did_ping and show me the result."
```

You should get back a JSON blob with `pong: true`, the R version, the jsonlite version, and the bridge PID.

## Development

- One tool per file under `src/tools/`. Each exports a `*_SCHEMA` (JSON Schema for Claude) and an `execute*` function.
- R-side handlers live in `r/bridge.R` as `dispatch_<method>` functions. R handlers should mirror the R function bodies documented in `../skill/references/did-step-*-*.md` so the MCP path and the skill's code-gen fallback produce identical results.
- Build: `npm run dev` (watch mode), `npm run build` (once).
- Tests: `npm test` (vitest). Fixtures: `did::mpdta` and `create_did_example_data()` from `../skill/references/did-step-1-treatment-structure.md` — no external CSVs.

## Troubleshooting

**`Rscript: command not found`** — set `R_PATH` in the MCP config to the absolute path of your Rscript binary (`which Rscript`).

**`jsonlite is not installed`** — run `Rscript r/install_packages.R`; the bridge requires jsonlite to communicate.

**Server starts but `did_ping` hangs** — R process may be stalled on an interactive prompt. Check stderr in Claude Code's logs. The worker watches for `y/n` prompts and reports stalls.

**Worker pool keeps crashing** — something is killing the R process before it reaches the NDJSON loop. Test the bridge directly:
```bash
echo '{"id":1,"method":"ping","params":{"echo":"hi"}}' | Rscript r/bridge.R
```
Expected output: one line of JSON with `"pong":true`.
