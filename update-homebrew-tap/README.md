# Update Homebrew Tap

Automatically update a Homebrew formula in a tap repository when you publish a new release.

## Features

- **Auto-fetch SHA256**: Automatically fetches checksums from `.sha256` files
- **Multi-platform**: Supports macOS (arm64/x64) and Linux (arm64/x64)
- **Template support**: Use custom Handlebars templates or the built-in default
- **GitHub API**: Commits directly to tap repo (no checkout needed)
- **Dry-run mode**: Preview generated formula without committing

## Usage

### Basic Example

```yaml
- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: albertocavalcante/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ secrets.TAP_GITHUB_TOKEN }}
    description: "My awesome CLI tool"
    homepage: https://github.com/albertocavalcante/myapp
    license: MIT
    assets: |
      {
        "darwin-arm64": {"url": "https://github.com/.../myapp-darwin-arm64.tar.gz"},
        "darwin-x64": {"url": "https://github.com/.../myapp-darwin-x64.tar.gz"},
        "linux-arm64": {"url": "https://github.com/.../myapp-linux-arm64.tar.gz"},
        "linux-x64": {"url": "https://github.com/.../myapp-linux-x64.tar.gz"}
      }
```

### With GitHub App Token (Eukia)

```yaml
- name: Generate GitHub App token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.EUKIA_APP_ID }}
    private-key: ${{ secrets.EUKIA_APP_PRIVATE_KEY }}
    repositories: homebrew-tap

- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: albertocavalcante/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ steps.app-token.outputs.token }}
    git-user-name: "Eukia[bot]"
    git-user-email: "eukia[bot]@users.noreply.github.com"
    assets: ${{ needs.build.outputs.assets-json }}
```

### With Custom Template

```yaml
- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: albertocavalcante/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ secrets.TAP_GITHUB_TOKEN }}
    template: packaging/homebrew/myapp.rb.in
    assets: |
      {
        "darwin-arm64": {
          "url": "https://example.com/myapp-darwin-arm64.gz",
          "sha256": "abc123..."
        }
      }
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `tap-repo` | Yes | - | Target Homebrew tap repository (owner/repo) |
| `formula-name` | Yes | - | Formula name (e.g., `myapp`) |
| `version` | Yes | - | Release version (e.g., `v1.0.0`) |
| `assets` | Yes | - | JSON object mapping platforms to asset URLs |
| `github-token` | Yes | - | Token with write access to tap repo |
| `template` | No | - | Path to custom formula template |
| `template-inline` | No | - | Inline template content |
| `branch` | No | `main` | Target branch in tap repo |
| `formula-path` | No | `Formula/{name}.rb` | Path to formula file |
| `commit-message` | No | `Update {name} to {version}` | Custom commit message |
| `dry-run` | No | `false` | Preview without committing |
| `description` | No | `{name} binary` | Formula description |
| `homepage` | No | - | Project homepage URL |
| `license` | No | `MIT` | License identifier |
| `binary-name` | No | `{formula-name}` | Binary name if different |
| `git-user-name` | No | `github-actions[bot]` | Git committer name |
| `git-user-email` | No | `41898282+github-actions[bot]@users.noreply.github.com` | Git committer email |
| `private-repo` | No | `false` | Set to `true` for private GitHub repos (uses GitHubPrivateRepositoryReleaseDownloadStrategy) |

## Outputs

| Output | Description |
|--------|-------------|
| `formula-content` | Generated formula content |
| `formula-path` | Path to formula in tap repo |
| `commit-sha` | SHA of the commit |
| `commit-url` | URL to the commit |

## Assets JSON Format

The `assets` input accepts a JSON object mapping platform identifiers to asset info:

```json
{
  "darwin-arm64": {
    "url": "https://github.com/owner/repo/releases/download/v1.0.0/app-darwin-arm64.tar.gz",
    "sha256": "abc123..."
  },
  "darwin-x64": {
    "url": "https://github.com/owner/repo/releases/download/v1.0.0/app-darwin-x64.tar.gz"
  }
}
```

**Platform identifiers:**
- `darwin-arm64` / `macos-arm64` - macOS Apple Silicon
- `darwin-x64` / `darwin-amd64` / `macos-x64` - macOS Intel
- `linux-arm64` / `linux-aarch64` - Linux ARM64
- `linux-x64` / `linux-amd64` - Linux x86_64

If `sha256` is omitted, the action will attempt to fetch it from `{url}.sha256`.

## Private Repositories

For private GitHub repositories, set `private-repo: "true"`. This generates a formula using Homebrew's `GitHubPrivateRepositoryReleaseDownloadStrategy`.

```yaml
- name: Update Homebrew tap (private repo)
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: owner/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ secrets.TAP_TOKEN }}
    private-repo: "true"
    assets: |
      {"darwin-arm64": {"url": "https://github.com/owner/private-repo/releases/download/v1.0.0/app.tar.gz"}}
```

Users installing from a private repo must set the `HOMEBREW_GITHUB_API_TOKEN` environment variable:

```bash
export HOMEBREW_GITHUB_API_TOKEN="ghp_your_token_here"
brew install owner/tap/myapp
```

## Custom Templates

Templates use [Handlebars](https://handlebarsjs.com/) syntax. Available variables:

```handlebars
{{name}}           - Formula name
{{version}}        - Version (without 'v' prefix)
{{description}}    - Formula description
{{homepage}}       - Homepage URL
{{license}}        - License identifier
{{binaryName}}     - Binary name

{{darwinArm64.url}}     - macOS ARM64 URL
{{darwinArm64.sha256}}  - macOS ARM64 SHA256
{{darwinX64.url}}       - macOS x64 URL
{{darwinX64.sha256}}    - macOS x64 SHA256
{{linuxArm64.url}}      - Linux ARM64 URL
{{linuxArm64.sha256}}   - Linux ARM64 SHA256
{{linuxX64.url}}        - Linux x64 URL
{{linuxX64.sha256}}     - Linux x64 SHA256
```

## License

MIT
