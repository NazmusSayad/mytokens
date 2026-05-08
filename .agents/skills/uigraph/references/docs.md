# Documentation Artifacts

Docs are files attached to a service.

## Configuration in .uigraph.yaml

```yaml
docs:
  - name: API Guide
    path: .uigraph/docs/api-guide.md
    fileType: markdown
    description: Public API documentation
  - name: Runbook
    path: .uigraph/docs/runbook.pdf
    fileType: pdf
    description: Operational runbook
```

## Doc Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name. Used for upsert matching |
| `path` | string | yes | Relative path to file |
| `fileType` | string | no | `pdf`, `html`, `markdown`, `doc`, `other`. Auto-detected from extension if omitted |
| `description` | string | no | Description |

## Supported File Types

| Extension | Auto-detected Type |
|-----------|-------------------|
| `.pdf` | `pdf` |
| `.html`, `.htm` | `html` |
| `.md`, `.markdown` | `markdown` |
| `.doc`, `.docx` | `doc` |
| `.txt` | `other` (falls through) |

## Upload Behavior

1. CLI computes SHA256 of the file.
2. Calls `v1/sync/service/doc/prepare` with hash and size.
3. Gateway responds:
   - `action: skip` — file unchanged, nothing to do.
   - `action: upload` — returns presigned S3 URL and fileId.
4. CLI uploads to S3.
5. CLI calls `v1/sync/service/doc/complete` with fileId.

## Content Type Mapping for S3 Upload

The CLI resolves content type based on `fileType` or file extension:

| Type/Extension | Content-Type |
|---------------|--------------|
| `pdf` | `application/pdf` |
| `html` | `text/html` |
| `markdown` | `text/markdown` |
| `doc` | `application/msword` |
| `txt` | `text/plain` |
| `png` | `image/png` |
| `jpg`, `jpeg` | `image/jpeg` |
| `gif` | `image/gif` |
| `webp` | `image/webp` |
| `svg` | `image/svg+xml` |
| default | `application/octet-stream` |

The content type sent to S3 must match what the gateway used when generating the presigned URL, or S3 returns `403 SignatureDoesNotMatch`.
