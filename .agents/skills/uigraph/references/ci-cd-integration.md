# CI/CD Integration

The CLI requires the `UIGRAPH_TOKEN` environment variable.

## CLI Command

```bash
uigraph sync
uigraph sync --config .uigraph.yaml
uigraph sync --dry-run
uigraph sync --api-url https://api.prod.uigraph.app/uigraph-gateway
```

## GitHub Actions

```yaml
name: UiGraph Sync

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  uigraph-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: stable

      - name: Install UiGraph CLI
        run: |
          go install github.com/uigraph-app/uigraph-cli@latest
          echo "$(go env GOPATH)/bin" >> "$GITHUB_PATH"

      - name: Dry run on PR
        if: github.event_name == 'pull_request'
        env:
          UIGRAPH_TOKEN: ${{ secrets.UIGRAPH_TOKEN }}
        run: uigraph sync --dry-run

      - name: Sync to UiGraph on push
        if: github.event_name == 'push'
        env:
          UIGRAPH_TOKEN: ${{ secrets.UIGRAPH_TOKEN }}
        run: uigraph sync
```

## GitLab CI

```yaml
uigraph-sync:
  stage: deploy
  image: golang:1.23
  script:
    - go install github.com/uigraph-app/uigraph-cli@latest
    - export PATH="$PATH:$(go env GOPATH)/bin"
    - uigraph sync
  only:
    - main
    - master
  variables:
    UIGRAPH_TOKEN: $UIGRAPH_TOKEN
  tags:
    - docker

uigraph-sync-dry-run:
  stage: test
  image: golang:1.23
  script:
    - go install github.com/uigraph-app/uigraph-cli@latest
    - export PATH="$PATH:$(go env GOPATH)/bin"
    - uigraph sync --dry-run
  only:
    - merge_requests
  variables:
    UIGRAPH_TOKEN: $UIGRAPH_TOKEN
  tags:
    - docker
```

## Bitbucket Pipelines

```yaml
image: golang:1.23

pipelines:
  default:
    - step:
        name: UiGraph Sync
        script:
          - go install github.com/uigraph-app/uigraph-cli@latest
          - export PATH="$PATH:$(go env GOPATH)/bin"
          - uigraph sync
        variables:
          UIGRAPH_TOKEN: $UIGRAPH_TOKEN
```

## Install Script Alternative

Instead of `go install`, use the install script:

```bash
curl -sSL https://cli.uigraph.app/install.sh | sh
uigraph sync
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UIGRAPH_TOKEN` | yes | API token for gateway authentication |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Config error, validation error, or missing token |
| `2` | Gateway sync error |
