# did-analysis

Installable skill for modern Difference-in-Differences causal inference
workflows in R.

This directory is intentionally self-contained. `install.sh` symlinks this
folder into `~/.claude/skills/did-analysis/`, so `SKILL.md`, `references/`,
maintainer docs, and package docs must all remain inside `skill/`.

## Execution Modes

- **Code-generation fallback**: when no `did_*` MCP tools are available, the
  skill routes agents to the step guides under `references/` and emits R code
  for users to run locally.
- **Tool-aware path**: when the companion `did-mcp` server is registered, agents
  should use the 16 `did_*` tools for covered workflow steps and fall back to R
  code only for capabilities outside the tool surface.

The skill does not call MCP directly; the MCP client exposes the tools. See
`SKILL.md` for routing rules and `../mcp/README.md` for MCP setup when this
directory is used from the monorepo checkout.
