# GitHub Actions

Reusable GitHub Actions for my projects.

## Available Actions

### [release-notes](./release-notes)

Generates beautiful, structured release notes for multi-platform releases.

**Usage:**

```yaml
- name: Generate release notes
  id: notes
  uses: albertocavalcante/actions/release-notes@main
  with:
    version: ${{ github.ref_name }}
    assets-dir: release-assets
    project-name: my-project
    project-description: "A tool for doing things"
    is-prerelease: ${{ contains(github.ref_name, '-') }}
```

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `version` | Yes | - | Release version (e.g., v0.1.0 or nightly) |
| `assets-dir` | Yes | `release-assets` | Directory containing release assets |
| `project-name` | Yes | - | Project name for display |
| `project-description` | No | `""` | Short project description |
| `repository` | No | `${{ github.repository }}` | Repository in owner/repo format |
| `is-prerelease` | No | `false` | Whether this is a prerelease |
| `build-status` | No | `{}` | JSON object with build job results |
| `workflow-run-id` | No | `${{ github.run_id }}` | Workflow run ID for failed build links |
| `template` | No | - | Path to custom Handlebars template |

**Outputs:**

| Output | Description |
|--------|-------------|
| `release-notes` | Generated release notes markdown |
| `release-notes-file` | Path to generated release notes file |

## License

MIT
