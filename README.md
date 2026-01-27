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

## Complete Release Workflow Example

Combine the actions for a complete release automation pipeline:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            platform: linux-x64
          - os: macos-latest
            platform: darwin-arm64
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          # Build your binary
          mkdir -p dist
          # ... build commands ...
          tar -czf dist/myapp-${{ matrix.platform }}.tar.gz myapp
          shasum -a 256 dist/myapp-${{ matrix.platform }}.tar.gz > dist/myapp-${{ matrix.platform }}.tar.gz.sha256
      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.platform }}
          path: dist/*

  release:
    needs: build
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
