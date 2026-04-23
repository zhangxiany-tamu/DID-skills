# Migration Guide

The repo formerly known as `DID-skills` (flat-layout, v1) is now `DID` (monorepo, v2). The skill content has moved from the repo root into a `skill/` subfolder to make room for the companion `did-mcp` server at `mcp/`.

No skill content has been modified — only relocated. All step guides, package docs, and routing logic work exactly as before.

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
- `v2.0.0` — first monorepo release. Skill content unchanged from `skill-v1.1.0-flat`; only relocated to `skill/`. MCP scaffold not yet shipped at this tag.
