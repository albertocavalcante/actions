# run-copybara

Run [Google Copybara](https://github.com/google/copybara) to transform and sync code between repositories.

## Alternatives

[olivr/copybara-action](https://github.com/olivr/copybara-action) is a great Docker-based alternative with more stability guarantees and additional features like auto-generated configs. Consider using it if you don't need GitHub App token authentication.

## Usage

### Basic (with GitHub App token)

```yaml
- name: Generate App Token
  id: app
  uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    owner: your-org
    repositories: source-repo,dest-repo

- name: Checkout
  uses: actions/checkout@v4
  with:
    fetch-depth: 0
    token: ${{ steps.app.outputs.token }}

- name: Run Copybara
  uses: albertocavalcante/actions/run-copybara@main
  with:
    config-file: infra/copybara/copy.bara.sky
    workflow: push
    destination-url: https://github.com/your-org/dest-repo.git
    git-token: ${{ steps.app.outputs.token }}
```

### With SSH key

```yaml
- name: Run Copybara
  uses: albertocavalcante/actions/run-copybara@main
  with:
    config-file: infra/copybara/copy.bara.sky
    workflow: push
    ssh-key: ${{ secrets.DEPLOY_KEY }}
```

### First-time sync (init history)

```yaml
- name: Run Copybara
  uses: albertocavalcante/actions/run-copybara@main
  with:
    config-file: infra/copybara/copy.bara.sky
    workflow: push
    init-history: true
    git-token: ${{ steps.app.outputs.token }}
```

### Dry run (validate only)

```yaml
- name: Run Copybara
  uses: albertocavalcante/actions/run-copybara@main
  with:
    config-file: infra/copybara/copy.bara.sky
    workflow: push
    dry-run: true
    git-token: ${{ steps.app.outputs.token }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|--------|
| `version` | Copybara release version | No | `20251215` |
| `config-file` | Path to copy.bara.sky | **Yes** | - |
| `workflow` | Workflow name in config | **Yes** | - |
| `destination-url` | Git destination URL override | No | - |
| `init-history` | First-time sync flag | No | `false` |
| `last-rev` | Starting revision SHA | No | - |
| `force` | Force push (dangerous) | No | `false` |
| `dry-run` | Validate only | No | `false` |
| `git-token` | GitHub token for HTTPS auth | No* | - |
| `ssh-key` | SSH private key for auth | No* | - |
| `git-user-name` | Committer name | No | `github-actions[bot]` |
| `git-user-email` | Committer email | No | `github-actions[bot]@users.noreply.github.com` |
| `java-version` | Java version | No | `21` |
| `extra-args` | Additional Copybara args | No | - |

\* Either `git-token` or `ssh-key` must be provided.

## Outputs

| Output | Description |
|--------|-------------|
| `copybara-jar` | Path to the Copybara JAR file |

## Authentication

### GitHub App Token

Use [actions/create-github-app-token](https://github.com/actions/create-github-app-token) to generate a token:

```yaml
- uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

### SSH Deploy Key

Add a deploy key to the destination repository with write access:

```yaml
- uses: albertocavalcante/actions/run-copybara@main
  with:
    ssh-key: ${{ secrets.DEPLOY_KEY }}
```

## License

MIT
