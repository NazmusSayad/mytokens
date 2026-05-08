# .uigraph.yaml Schema

Use this file as the source of truth before generating `.uigraph.yaml`. Do not infer the schema from examples.

## Hard Rules

- `version: 1` is required.
- `project.name` is required.
- `service.name`, `service.category`, and `service.description` are required.
- `service.repository.provider` and `service.repository.url` are required.
- `service.repository.provider` must be `github`, `gitlab`, or `bitbucket`.
- Generated API specs must be under `.uigraph/openapi/`.
- Generated architecture diagrams and context files must be under `.uigraph/diagrams/`.
- Generated database schemas must be under `.uigraph/db/`.
- Generated docs must be under `.uigraph/docs/`.
- Generated map images must be under `.uigraph/maps/`.
- SQL database schemas use `.sql`; NoSQL database schemas use `.json`.
- All referenced files must exist relative to `.uigraph.yaml`.

## Canonical Structure

```yaml
version: 1

project:
  name: my-product              # required
  environment: production       # optional

service:
  name: My Service              # required
  category: Backend             # required
  description: Short summary    # required
  repository:
    provider: github            # required: github, gitlab, bitbucket
    url: https://github.com/org/repo  # required: current git remote or user-provided URL
  ownership:                    # optional
    team: platform
    email: platform@example.com
  labels:                       # optional
    - backend
  integrations:                 # optional
    slack:
      url: https://example.slack.com/archives/C123456
    jira:
      url: https://example.atlassian.net/projects/ABC

apis:                           # optional
  - name: public-api            # required
    type: openapi               # required: openapi, graphql, grpc
    path: .uigraph/openapi/public-api.yaml  # required

architectureDiagrams:           # optional
  - name: Request Flow          # required
    path: .uigraph/diagrams/request-flow/request-flow.mmd  # required
    contextPath: .uigraph/diagrams/request-flow/context.json  # optional

databases:                      # optional
  - name: app                   # required
    dialect: postgres           # required: postgres, mysql, sqlite, dynamodb, mongodb, other
    dbType: PostgreSQL          # optional
    schemaPath: .uigraph/db/app.sql  # required

testPacks:                      # optional
  - name: Smoke Tests           # required
    type: smoke                 # required: smoke, regression, manual
    environment: staging        # optional
    releaseLabel: v1.0.0        # optional
    testCases:                  # optional; see references/test-packs-and-cases.md
      - title: Health check returns 200  # required
        type: api               # required: api, manual
        order: 1                # required
        priority: p1            # optional: p0, p1, p2, p3
        apiGroupName: public-api
        operationId: healthCheck
        expectedStatusCode: 200

docs:                           # optional
  - name: Runbook               # required
    path: .uigraph/docs/runbook.md  # required
    fileType: markdown          # optional: pdf, html, markdown, doc, other
    description: On-call runbook

maps:                           # optional; see references/maps-frames-focalpoints.md
  - name: Product Map           # required
    description: Main user flows
    frames:
      - name: Home Page         # required
        imagePath: .uigraph/maps/home-page.png
        focalPoints:
          - name: Submit Button # required
            x: 120              # required
            y: 240              # required
            visibility: public  # optional: public, private
            components:
              - componentId: component_api-contract
                serviceName: My Service
                apiGroupName: public-api
                operationId: healthCheck
```

## Component Link Rules

When `componentLinkId` is absent, component links must include these fields:

- `component_api-contract`: `serviceName`, `apiGroupName`, `operationId`
- `component_test-case-suite`: `serviceName`, `testPackName`
- `component_support-kb-troubleshooting`: `serviceName`, `docName`
- `component_backend-flow-diagram`: `serviceName`, `architectureDiagramName`

Names must match existing entries exactly: service name, API name, OpenAPI `operationId`, test pack name, doc name, architecture diagram name, map name, frame name, and focal point name.

## Common Invalid Output

```yaml
service:
  name: mytokens
  category: cli
  description: CLI tool
  repository:
    provider: github
    url: https://github.com/NazmusSayad/mytokens

databases:
  - name: tokens
    dialect: sqlite
    schemaPath: db/main.sql

apis:
  - name: models-dot-dev
    type: openapi
    path: openapi/models-dot-dev.yaml
```

This is invalid because:

- It is missing required `version: 1`.
- It is missing required `project.name`.
- Generated artifact paths are outside `.uigraph/`.

## Detailed References

- Test packs and test cases: `references/test-packs-and-cases.md`
- Maps, frames, and focal points: `references/maps-frames-focalpoints.md`
- Database schemas: `references/database-schemas.md`
- Architecture diagrams: `references/architecture-diagrams.md`
