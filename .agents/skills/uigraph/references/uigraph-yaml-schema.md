# .uigraph.yaml Schema

This document describes every field in `.uigraph.yaml`.

## Top-Level Structure

```yaml
version: 1

project:
  name: string            # required
  environment: string     # optional. e.g. production, staging, development

service:
  name: string            # required
  category: string        # required
  description: string     # required
  repository:
    provider: string      # required. enum: github, gitlab, bitbucket
    url: string           # required
  ownership:
    team: string          # optional
    email: string         # optional
  labels:                 # optional. list of strings
    - string
  integrations:           # optional
    jira:
      url: string
    slack:
      url: string

apis:                     # optional. list of APIRef
architectureDiagrams:     # optional. list of ArchDiagramRef
databases:                # optional. list of DatabaseRef
testPacks:                # optional. list of TestPackRef
docs:                     # optional. list of DocRef
maps:                     # optional. list of MapRef
```

## APIRef

```yaml
- name: string            # required. display name for the API group
  type: string            # required. enum: openapi, graphql, grpc
  path: string            # required. relative path to the spec file
```

## ArchDiagramRef

```yaml
- name: string            # required. display name
  path: string            # required. relative path to .mmd file
  contextPath: string     # optional. relative path to context.json
```

## DatabaseRef

```yaml
- name: string            # required. logical DB name (dbName)
  dialect: string         # required. enum: postgres, mysql, sqlite, dynamodb, mongodb, other
  dbType: string          # optional. e.g. Postgres, MySQL, DynamoDB
  schemaPath: string      # required. relative path to schema file
```

## TestPackRef

```yaml
- name: string            # required
  type: string            # required. enum: smoke, regression, manual
  environment: string     # optional
  releaseLabel: string    # optional
  testCases:              # optional. list of TestCaseRef
```

## TestCaseRef

```yaml
- type: string            # required. enum: api, manual
  title: string           # required
  order: float64          # required

  # Common optional
  description: string
  priority: string        # enum: p0, p1, p2, p3
  tags:                   # list of strings
    - string
  linkedTicket: string
  estimatedDurationMins: int
  testOwner: string

  # Map/Frame/Focal Point reference (resolved to linkedMapNodeId)
  mapName: string
  frameName: string
  focalPointName: string

  # API-specific (only when type: api)
  apiGroupName: string
  operationId: string
  expectedStatusCode: int
  requestTemplate: string
  responseTimeMs: int
  responseBody: string
  assertions:             # list of AssertionRef
    - field: string
      type: string
      value: string

  # Manual-specific (only when type: manual)
  stepsList:              # list of StepRef
    - action: string
      expectedResult: string
  expectedOutcome: string
  preconditions: string
  testData: string
  postconditions: string
  requiresEvidence: bool
  isCritical: bool
```

## DocRef

```yaml
- name: string            # required. display name for upsert matching
  path: string            # required. relative path to file
  fileType: string        # optional. enum: pdf, html, markdown, doc, other
  description: string     # optional
```

## MapRef

```yaml
- name: string            # required
  description: string     # optional
  frames:                 # optional. list of FrameRef
```

## FrameRef

```yaml
- name: string            # required
  description: string     # optional
  imagePath: string       # optional. path to background image
  focalPoints:            # optional. list of FocalPointRef
```

## FocalPointRef

```yaml
- name: string            # required
  x: float64              # required. x-coordinate on frame canvas
  y: float64              # required. y-coordinate on frame canvas
  visibility: string      # optional. enum: public, private. defaults to public
  components:             # optional. list of FocalPointMetaRef
```

## FocalPointMetaRef

```yaml
- componentId: string     # required.
                          # enum:
                          #   component_api-contract
                          #   component_test-case-suite
                          #   component_support-kb-troubleshooting
                          #   component_backend-flow-diagram

  # Linking strategy A: direct link ID
  componentLinkId: string # optional

  # Linking strategy B: name-based resolution
  serviceName: string     # optional. service that owns the linked entity
  apiGroupName: string    # optional. for component_api-contract
  operationId: string     # optional. OpenAPI operationId
  testPackName: string    # optional. for component_test-case-suite
  docName: string         # optional. for component_support-kb-troubleshooting
  architectureDiagramName: string  # optional. for component_backend-flow-diagram
```

## Important Linking Rules

- For `component_api-contract` without `componentLinkId`: requires `serviceName`, `apiGroupName`, and `operationId`.
- For `component_backend-flow-diagram` without `componentLinkId`: requires `serviceName` and `architectureDiagramName`.
- For any component: either `componentLinkId` or `serviceName` is required.
- `operationId` values must match an `operationId` inside the synced OpenAPI spec.
