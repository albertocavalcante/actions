# GitHub Actions

Reusable GitHub Actions for release automation and cross-repository operations.

## Available Actions

### [release-notes](./release-notes)

Generates beautiful, structured release notes for multi-platform releases.

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

# Outputs: release-notes, assets-json, checksums-json, homebrew-assets
```

### [update-homebrew-tap](./update-homebrew-tap)

Automatically update a Homebrew formula in a tap repository.

```yaml
- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: albertocavalcante/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ secrets.TAP_TOKEN }}
    description: "My awesome CLI tool"
    homepage: https://github.com/owner/myapp
    license: MIT
    assets: |
      {
        "darwin-arm64": {"url": "https://github.com/.../myapp-darwin-arm64.tar.gz"},
        "darwin-x64": {"url": "https://github.com/.../myapp-darwin-x64.tar.gz"},
        "linux-x64": {"url": "https://github.com/.../myapp-linux-x64.tar.gz"}
      }
```

### [package-deb](./package-deb)

Create Debian packages (.deb) from binary artifacts.

```yaml
- name: Package DEB
  id: deb
  uses: albertocavalcante/actions/package-deb@main
  with:
    binary-path: extracted/myapp
    binary-name: myapp
    version: 1.0.0
    arch: amd64
    maintainer: "Your Name <email@example.com>"
    description: "My awesome CLI tool"
    homepage: https://github.com/owner/myapp

# Outputs: deb-file, deb-name, sha256
```

### [package-rpm](./package-rpm)

Create RPM packages from binary artifacts.

```yaml
- name: Package RPM
  id: rpm
  uses: albertocavalcante/actions/package-rpm@main
  with:
    binary-path: extracted/myapp
    binary-name: myapp
    version: 1.0.0
    release: 1
    arch: x86_64
    summary: "My awesome CLI tool"
    description: "A tool for doing things"
    license: MIT
    url: https://github.com/owner/myapp

# Outputs: rpm-file, rpm-name, sha256
```

### [check-nightly-changes](./check-nightly-changes)

Check if there are new commits since the last nightly build.

```yaml
- name: Check for changes
  id: check
  uses: albertocavalcante/actions/check-nightly-changes@main
  with:
    tag-name: nightly  # optional, defaults to 'nightly'
    force: ${{ github.event.inputs.force }}

# Outputs: should-build, short-sha, full-sha, commits-since, tag-exists
```

### [compute-checksums](./compute-checksums)

Compute SHA256 checksums for local files or remote URLs.

```yaml
- name: Compute checksums
  id: checksums
  uses: albertocavalcante/actions/compute-checksums@main
  with:
    files: dist/*.tar.gz
    # Or use url-map for remote files:
    # url-map: |
    #   {"darwin-arm64": "https://example.com/app-darwin-arm64.tar.gz"}

# Output: {"filename.tar.gz": "sha256hash...", ...}
```

### [run-copybara](./run-copybara)

Run Google Copybara to transform and sync code between repositories.

```yaml
- name: Sync to public repo
  uses: albertocavalcante/actions/run-copybara@main
  with:
    config-file: infra/copybara/copy.bara.sky
    workflow: push
    git-token: ${{ secrets.GITHUB_TOKEN }}
```

## Reusable Workflows

### rust-build

Reusable workflow for building Rust binaries across multiple platforms.

```yaml
jobs:
  build:
    uses: albertocavalcante/actions/.github/workflows/rust-build.yml@main
    with:
      binary-name: myapp
      rust-version: "1.87.0"
      platforms: "linux-amd64,linux-aarch64,darwin-arm64,darwin-amd64,windows-amd64"
      # Optional:
      # working-directory: "."
      # cargo-args: "--features foo"
      # artifact-retention-days: 7
      # timeout-minutes: 30

# Produces artifacts: binary-linux-amd64, binary-linux-aarch64, etc.
# Each contains: myapp-{platform}.tar.gz and myapp-{platform}.tar.gz.sha256
```

**Supported platforms:**
- `linux-amd64` - x86_64-unknown-linux-gnu
- `linux-aarch64` - aarch64-unknown-linux-gnu (cross-compiled)
- `linux-amd64-musl` - x86_64-unknown-linux-musl (static binary)
- `darwin-arm64` - aarch64-apple-darwin
- `darwin-amd64` - x86_64-apple-darwin (cross-compiled)
- `windows-amd64` - x86_64-pc-windows-msvc

### go-build

Reusable workflow for building Go binaries across multiple platforms. All platforms build on `ubuntu-24.04` using Go's native cross-compilation (no CGO), so macOS/Windows runners are unnecessary. Version metadata is auto-injected via `-ldflags` targeting `main.version`, `main.commit`, and `main.date`.

```yaml
jobs:
  build:
    uses: albertocavalcante/actions/.github/workflows/go-build.yml@main
    with:
      binary-name: myapp
      go-version: "1.25"
      platforms: "linux-amd64,linux-arm64,darwin-arm64,darwin-amd64,windows-amd64"
      # Optional:
      # module-path: "./cmd/myapp"      # defaults to ./cmd/{binary-name}
      # build-tags: "full"              # Go build tags
      # ldflags: "-X main.extra=value"  # appended after auto-injected version/commit/date
      # artifact-prefix: "binary"       # prefix for artifact names
      # artifact-retention-days: 7
      # timeout-minutes: 15

# Produces artifacts: binary-linux-amd64, binary-linux-arm64, etc.
# Each contains: myapp-{platform}.tar.gz/.zip and .sha256
```

**Supported platforms:**
- `linux-amd64` - Linux x86_64
- `linux-arm64` - Linux ARM64
- `darwin-arm64` - macOS Apple Silicon
- `darwin-amd64` - macOS Intel
- `windows-amd64` - Windows x86_64

## Complete Release Workflow Example

Combine the actions for a complete release automation pipeline:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  build:
    uses: albertocavalcante/actions/.github/workflows/rust-build.yml@main
    with:
      binary-name: myapp
      rust-version: "1.87.0"
      platforms: "linux-amd64,linux-aarch64,darwin-arm64,darwin-amd64,windows-amd64"

  package-deb:
    needs: build
    strategy:
      matrix:
        include:
          - artifact: linux-amd64
            arch: amd64
          - artifact: linux-aarch64
            arch: arm64
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: binary-${{ matrix.artifact }}
          path: artifacts
      - run: tar -xzf artifacts/*.tar.gz -C artifacts
      - uses: albertocavalcante/actions/package-deb@main
        with:
          binary-path: artifacts/myapp
          binary-name: myapp
          version: ${{ github.ref_name }}
          arch: ${{ matrix.arch }}
      - uses: actions/upload-artifact@v4
        with:
          name: deb-${{ matrix.arch }}
          path: "*.deb*"

  release:
    needs: [build, package-deb]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          path: release-assets
          merge-multiple: true

      - name: Generate release notes
        id: notes
        uses: albertocavalcante/actions/release-notes@main
        with:
          version: ${{ github.ref_name }}
          assets-dir: release-assets
          project-name: myapp

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body: ${{ steps.notes.outputs.release-notes }}
          files: release-assets/*

      - name: Update Homebrew tap
        uses: albertocavalcante/actions/update-homebrew-tap@main
        with:
          tap-repo: owner/homebrew-tap
          formula-name: myapp
          version: ${{ github.ref_name }}
          github-token: ${{ secrets.TAP_TOKEN }}
          assets: ${{ steps.notes.outputs.homebrew-assets }}
```

## Nightly Workflow Example

```yaml
name: Nightly

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
    inputs:
      force:
        description: "Force build"
        type: boolean
        default: false

jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      should-build: ${{ steps.check.outputs.should-build }}
      short-sha: ${{ steps.check.outputs.short-sha }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: albertocavalcante/actions/check-nightly-changes@main
        id: check
        with:
          force: ${{ inputs.force }}

  build:
    needs: check
    if: needs.check.outputs.should-build == 'true'
    uses: albertocavalcante/actions/.github/workflows/rust-build.yml@main
    with:
      binary-name: myapp
      platforms: "linux-amd64,darwin-arm64"
      artifact-retention-days: 3

  release:
    needs: [check, build]
    runs-on: ubuntu-latest
    steps:
      # ... create nightly release
```

## Using with GitHub App (Eukia)

For cross-repository operations, use a GitHub App token:

```yaml
- name: Generate GitHub App token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.EUKIA_APP_ID }}
    private-key: ${{ secrets.EUKIA_APP_PRIVATE_KEY }}
    repositories: homebrew-tap,other-repo

- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    # ...
```

## License

MIT
