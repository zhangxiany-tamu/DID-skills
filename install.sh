#!/usr/bin/env bash
# DID monorepo installer
# - Links skill/ into ~/.claude/skills/did-analysis/
# - Links workflow/did-analysis.ts into ~/.claude/workflows/
# - Optionally builds the mcp/ server and prints the config to register

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_TARGET="${HOME}/.claude/skills/did-analysis"
SKILL_SOURCE="${REPO_DIR}/skill"
WORKFLOW_TARGET="${HOME}/.claude/workflows/did-analysis.ts"
WORKFLOW_SOURCE="${REPO_DIR}/workflow/did-analysis.ts"

if [[ ! -d "${SKILL_SOURCE}" ]]; then
  echo "Error: ${SKILL_SOURCE} does not exist. Run this script from the repo root." >&2
  exit 1
fi

# 1. Link the skill (idempotent)
mkdir -p "$(dirname "${SKILL_TARGET}")"

if [[ -e "${SKILL_TARGET}" && ! -L "${SKILL_TARGET}" ]]; then
  echo "Warning: ${SKILL_TARGET} exists and is not a symlink."
  echo "  Contents will not be overwritten. Remove it manually if you want to replace with a symlink:"
  echo "    rm -rf '${SKILL_TARGET}'"
  echo "  Then rerun this script."
else
  ln -sfn "${SKILL_SOURCE}" "${SKILL_TARGET}"
  echo "Linked skill: ${SKILL_TARGET} -> ${SKILL_SOURCE}"
fi

# 2. Link the did-analysis workflow (idempotent)
echo ""
if [[ -f "${WORKFLOW_SOURCE}" ]]; then
  mkdir -p "$(dirname "${WORKFLOW_TARGET}")"
  if [[ -e "${WORKFLOW_TARGET}" && ! -L "${WORKFLOW_TARGET}" ]]; then
    echo "Warning: ${WORKFLOW_TARGET} exists and is not a symlink — leaving it in place."
    echo "  Remove it manually and rerun this script to replace with a symlink."
  else
    ln -sfn "${WORKFLOW_SOURCE}" "${WORKFLOW_TARGET}"
    echo "Linked workflow: ${WORKFLOW_TARGET} -> ${WORKFLOW_SOURCE}"
    echo "  Invoke it in Claude Code as: /did-analysis"
  fi
else
  echo "No workflow/did-analysis.ts found — skipping workflow link."
fi

# 3. Optional MCP build
echo ""
if [[ ! -d "${REPO_DIR}/mcp" ]]; then
  echo "No mcp/ directory yet — skill-only install complete."
  exit 0
fi

read -rp "Build the did-mcp server too? [y/N] " yn
if [[ "${yn:-N}" =~ ^[Yy]$ ]]; then
  if [[ -f "${REPO_DIR}/mcp/.nvmrc" ]] && command -v nvm >/dev/null 2>&1; then
    (cd "${REPO_DIR}/mcp" && nvm use) || true
  fi
  (cd "${REPO_DIR}/mcp" && npm install && npm run build)
  echo ""
  echo "MCP built. To register with Claude Code:"
  echo "  1. Open ${REPO_DIR}/mcp/mcp-config.example.json"
  echo "  2. Copy the 'mcpServers' entry into ~/.claude/settings.json"
  echo "  3. Restart Claude Code to pick up the new server"
else
  echo "Skipped MCP build. To build later:"
  echo "  cd '${REPO_DIR}/mcp' && npm install && npm run build"
fi
