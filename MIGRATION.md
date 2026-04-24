# Migration Guide

The repo formerly known as `DID-skills` (flat-layout, v1) is now `DID` (monorepo). The repo originally contained only the skill at the root; it has been restructured into a monorepo so an optional companion `did-mcp` server could be shipped alongside.

Layout evolution:

| Release | Layout | Contents |
|---|---|---|
| `skill-v1.1.0-flat` | Flat (skill at root) | Skill only. |
| `v2.0.0` | Monorepo (`skill/` + empty `mcp/` scaffold) | Skill relocated, MCP planned. |
| Post-v2.0.0 (tip of `main`) | Monorepo | Skill + full `did-mcp` server (16 tools, 5-step workflow, real-data audit). |

Skill content between `skill-v1.1.0-flat` and `v2.0.0` was relocated, not modified. After `v2.0.0` the skill's `references/` guides received targeted fixes (notably `print(panelview(...))` and the Sun-Abraham label parser) alongside the MCP build-out.

## If you cloned directly into `.claude/skills/did-analysis/`

Old install:

```bash
git clone https://github.com/zhangxiany-tamu/DID-skills ~/.claude/skills/did-analysis
```

That layout is frozen at tag `skill-v1.1.0-flat`. To upgrade to v2:

```bash
# 1. Remove the old skills directory (files are all on the remote; safe to delete)
rm -rf ~/.claude/skills/did-analysis

# 2. Clone the new repo anywhere (not inside .claude/skills)
git clone https://github.com/zhangxiany-tamu/DID.git ~/src/DID
cd ~/src/DID

# 3. Run the installer
./install.sh
```

The installer symlinks `skill/` into `~/.claude/skills/did-analysis/` so the skill still loads from the expected path.

## If you used `git subtree`

Old usage:

```bash
git subtree add --prefix=.claude/skills/did-analysis \
  https://github.com/zhangxiany-tamu/DID-skills.git main --squash
```

For v2, point the subtree at the new repo's `skill/` subfolder. Easiest option is to switch to a plain subrepo or manual copy since `git subtree` does not natively support subdirectory pulls. Alternatively, pull the `skill-v*` tags from the `DID` repo and continue using the subtree pattern.

## If you never manually installed the skill

The GitHub URL `DID-skills` auto-redirects to `DID` (GitHub handles renames transparently). Your Claude Code setup likely unaffected. Just update bookmarks.

## Why the restructure

To add the `did-mcp` server alongside the skill without polluting the skill's install path or complicating downstream workflows. The skill remains pure markdown and still installs via a single symlink. The MCP is opt-in.

## Tag reference

- `skill-v1.1.0-flat` — last flat-layout tip. Use this if you need the pre-restructure code.
- `v2.0.0` — first monorepo release. Skill content unchanged from `skill-v1.1.0-flat`; only relocated to `skill/`. Includes an empty `mcp/` scaffold; no tools registered yet.
- tip of `main` (post-v2.0.0) — full `did-mcp` server shipped: session/ping, Step 1 (load/check/profile/plot-rollout/recode), Step 2 (twfe diagnose), Step 3 (five estimators + compare + extract), Step 4 (power), Step 5 (HonestDiD), plus `did_plot` / `did_drdid` / `did_report`. Tag `v3.0.0` (or similar) will mark this milestone when cut.
