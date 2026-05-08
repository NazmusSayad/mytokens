# Validation Rules

These are the rules the LLM/agent must manually verify by inspecting generated files. They also reflect constraints enforced by `config.Validate()` in the CLI.

After generating artifacts, validate the generated structure before finishing. Do this through LLM/agent file inspection and reasoning. If validation fails, fix only files generated during the current execution.

## Required Top-Level Fields

- `version` must be `1`
- `project.name` must not be empty
- `service.name` must not be empty
- `service.category` must not be empty
- `service.description` must not be empty
- `service.repository.provider` must not be empty
- `service.repository.url` must not be empty

## Enums

| Field | Valid Values |
|-------|-------------|
| `service.repository.provider` | `github`, `gitlab`, `bitbucket` |
| `apis[*].type` | `openapi`, `graphql`, `grpc` |
| `architectureDiagrams[*]` | `name` and `path` required |
| `testPacks[*].type` | `smoke`, `regression`, `manual` |
| `testCases[*].type` | `api`, `manual` |
| `testCases[*].priority` | `p0`, `p1`, `p2`, `p3` |
| `databases[*].dialect` | `postgres`, `mysql`, `sqlite`, `dynamodb`, `mongodb`, `other` |
| `docs[*].fileType` | `pdf`, `html`, `markdown`, `doc`, `other` |
| `maps[*].frames[*].focalPoints[*].visibility` | `public`, `private` |
| `maps[*].frames[*].focalPoints[*].components[*].componentId` | `component_api-contract`, `component_test-case-suite`, `component_support-kb-troubleshooting`, `component_backend-flow-diagram` |

## File Existence Checks

All `path` fields must point to files that exist relative to `.uigraph.yaml`:

- `apis[*].path`
- `architectureDiagrams[*].path`
- `architectureDiagrams[*].contextPath`
- `databases[*].schemaPath`
- `docs[*].path`
- `maps[*].frames[*].imagePath`

## Repository URL Checks

- `service.repository.url` must come from the current git remote or an explicit user-provided URL.
- Do not copy placeholder repository URLs from templates.
- Normalize SSH GitHub/GitLab/Bitbucket remotes to HTTPS when possible.
- `service.repository.provider` must match the repository host.

## Database Schema File Checks

- SQL dialects (`postgres`, `mysql`, `sqlite`, `other` when SQL-like) must use `.sql` files under `.uigraph/db/`.
- NoSQL dialects (`dynamodb`, `mongodb`) must use `.json` files under `.uigraph/db/`.
- `databases[*].schemaPath` must point to a file extension that matches the declared dialect.

## Generated Structure Checks

- `.uigraph.yaml` must be valid YAML when generated.
- Generated `.json` files must parse as valid JSON.
- Generated OpenAPI, GraphQL, gRPC, SQL, Mermaid, and docs files should be structurally plausible for their declared type.
- Generated helper scripts must exist only under `.uigraph/scripts/`.
- Generated helper scripts must not overwrite unrelated files unless the user explicitly approved that behavior.

## Component Linking Validation

For every `components` entry under a focal point:

1. `componentId` is required and must be one of the four valid enums.
2. Either `componentLinkId` or `serviceName` is required.
3. If `componentId` is `component_backend-flow-diagram` and `componentLinkId` is empty: `serviceName` and `architectureDiagramName` are both required.
4. If `componentId` is `component_api-contract` and `componentLinkId` is empty: `serviceName`, `apiGroupName`, and `operationId` are all required.

## Test Case Rules

- `testCases[*].title` is required.
- `testCases[*].order` is required.
- When `type` is `api`, `apiGroupName` and `operationId` should reference an existing API group and operation.
- `operationId` must match an `operationId` defined in the synced OpenAPI spec.

## Frame Image Rules

- If `imagePath` is provided, the file must exist.
- The CLI computes SHA256 of the image and checks with the gateway whether upload is needed.

## Doc Upload Rules

- The CLI computes SHA256 of the doc file.
- If the hash matches the gateway's stored hash, the upload is skipped.
- Supported content types for upload: `application/pdf`, `text/html`, `text/markdown`, `application/msword`, `text/plain`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`.
