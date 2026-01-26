# AGENTS.md - Guidelines for AI Coding Agents

This document provides context and guidelines for AI agents (Claude, Cursor, Copilot, etc.)
working on this repository.

## Repository Overview

This repository contains reusable GitHub Actions for use across multiple projects.

### Structure

```
actions/
├── release-notes/          # Action: Generate beautiful release notes
│   ├── action.yml          # Action definition
│   ├── src/                # TypeScript source
│   ├── dist/               # Compiled output (committed)
│   └── package.json        # Dependencies
├── .github/
│   └── workflows/ci.yml    # CI pipeline
├── lefthook.yml            # Git hooks
├── dprint.json             # Formatting config
└── AGENTS.md               # This file
```

## Critical Rules

### Package Manager: Bun Only

**NEVER use npm or yarn. Always use bun.**

```bash
# Installing dependencies
bun install

# Running scripts
bun run build
bun run lint
bun run typecheck

# Adding dependencies
bun add <package>
bun add -d <dev-package>
```

### Commit the `dist/` folder

GitHub Actions require the compiled `dist/` folder to be committed. After any source change:

```bash
cd release-notes
bun install
bun run build
# Commit the dist/ changes
```

### Conventional Commits

All commits must follow conventional commit format:

```
feat(release-notes): add support for custom templates
fix(release-notes): handle missing sha256 files
docs: update AGENTS.md
chore: update dependencies
```

### Code Style

- **TypeScript**: ESLint + Prettier
- **Markdown/JSON/YAML**: dprint
- **Pre-commit hooks**: lefthook (install with `lefthook install`)

## Adding a New Action

1. Create a new directory: `mkdir my-action`
2. Add required files:
   - `action.yml` - Action definition
   - `src/index.ts` - Entry point
   - `package.json` - Dependencies (use bun)
   - `tsconfig.json` - TypeScript config
   - `eslint.config.mjs` - ESLint config
3. Update `.github/workflows/ci.yml` to include the new action
4. Update `.github/dependabot.yml` to track dependencies
5. Build and commit: `bun run build`

## Testing Actions Locally

```bash
# Build the action
cd release-notes
bun install
bun run build

# Test locally using act (https://github.com/nektos/act)
act -j build
```

## Common Tasks

### Update Dependencies

```bash
cd release-notes
bun update
bun run build
# Commit both bun.lock and dist/ changes
```

### Fix Lint Issues

```bash
cd release-notes
bun run lint          # Check for issues
bun run format        # Auto-fix formatting
```

### Add New Platform Support (release-notes)

Edit `src/types.ts` and add to `PLATFORM_PATTERNS`:

```typescript
"new-platform-id": {
  os: "OS Name",
  osIcon: "",
  arch: "arch",
  archFull: "Full Architecture Name",
  displayName: "Display Name",
},
```

## Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions/creating-actions)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript ESLint](https://typescript-eslint.io/)
