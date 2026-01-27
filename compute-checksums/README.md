# Compute Checksums

A lightweight GitHub Action to compute SHA256 (or other) checksums for local files or remote URLs.

## Features

- **Local files**: Glob pattern support for local file checksumming
- **Remote URLs**: Download and checksum remote files
- **URL mapping**: Map identifiers to URLs for structured output
- **SHA256 file reading**: Optionally read existing `.sha256` files instead of recomputing
- **Multiple algorithms**: SHA256 (default), SHA512, MD5

## Usage

### Checksum Local Files

```yaml
- name: Compute checksums
  id: checksums
  uses: albertocavalcante/actions/compute-checksums@main
  with:
    files: |
      dist/*.tar.gz
      dist/*.zip

- name: Use checksums
  run: echo '${{ steps.checksums.outputs.checksums }}'
```

### Checksum Remote URLs

```yaml
- name: Compute checksums for release assets
  id: checksums
  uses: albertocavalcante/actions/compute-checksums@main
  with:
    urls: |
      [
        "https://github.com/owner/repo/releases/download/v1.0.0/app-linux.tar.gz",
        "https://github.com/owner/repo/releases/download/v1.0.0/app-macos.tar.gz"
      ]
```

### URL Map (for Homebrew integration)

```yaml
- name: Compute checksums by platform
  id: checksums
  uses: albertocavalcante/actions/compute-checksums@main
  with:
    url-map: |
      {
        "darwin-arm64": "https://github.com/owner/repo/releases/download/v1.0.0/app-darwin-arm64.tar.gz",
        "darwin-x64": "https://github.com/owner/repo/releases/download/v1.0.0/app-darwin-x64.tar.gz",
        "linux-arm64": "https://github.com/owner/repo/releases/download/v1.0.0/app-linux-arm64.tar.gz",
        "linux-x64": "https://github.com/owner/repo/releases/download/v1.0.0/app-linux-x64.tar.gz"
      }

# Output: {"darwin-arm64": "abc123...", "darwin-x64": "def456...", ...}
```

### Combined with update-homebrew-tap

```yaml
- name: Compute checksums
  id: checksums
  uses: albertocavalcante/actions/compute-checksums@main
  with:
    url-map: |
      {
        "darwin-arm64": "https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/app-darwin-arm64.tar.gz",
        "linux-x64": "https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/app-linux-x64.tar.gz"
      }

- name: Update Homebrew tap
  uses: albertocavalcante/actions/update-homebrew-tap@main
  with:
    tap-repo: owner/homebrew-tap
    formula-name: myapp
    version: ${{ github.ref_name }}
    github-token: ${{ secrets.TAP_TOKEN }}
    assets: |
      {
        "darwin-arm64": {
          "url": "https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/app-darwin-arm64.tar.gz",
          "sha256": "${{ fromJSON(steps.checksums.outputs.checksums)['darwin-arm64'] }}"
        }
      }
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `files` | No | - | Glob pattern(s) for local files |
| `urls` | No | - | JSON array of URLs to download |
| `url-map` | No | - | JSON object mapping identifiers to URLs |
| `read-sha256-files` | No | `true` | Read existing `.sha256` files if available |
| `algorithm` | No | `sha256` | Hash algorithm (sha256, sha512, md5) |

At least one of `files`, `urls`, or `url-map` must be provided.

## Outputs

| Output | Description |
|--------|-------------|
| `checksums` | JSON object mapping filename/identifier to checksum |
| `checksums-file` | Path to checksums.json file |
| `checksums-list` | Newline-separated list in `checksum  filename` format |

## Output Formats

### checksums (JSON)

```json
{
  "app-linux-x64.tar.gz": "abc123...",
  "app-darwin-arm64.tar.gz": "def456..."
}
```

### checksums-list (shasum compatible)

```
abc123...  app-linux-x64.tar.gz
def456...  app-darwin-arm64.tar.gz
```

## SHA256 File Reading

When `read-sha256-files` is enabled (default), the action will:

1. For local files: Check for `{filename}.sha256` alongside the file
2. For URLs: Fetch `{url}.sha256` from the server

If a `.sha256` file exists and contains a valid hash, it will be used instead of computing the hash. This is useful when:
- Release workflows already generate `.sha256` files
- You want to avoid re-downloading large files

## License

MIT
