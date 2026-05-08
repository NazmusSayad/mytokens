# Maps, Frames, and Focal Points

Maps are visual canvases composed of Frames (pages), Focal Points (interactive nodes), and Components (linked entities).

## Map Structure in .uigraph.yaml

```yaml
maps:
  - name: Auth Map
    description: User authentication flows
    frames:
      - name: Login Page
        description: The login screen
        imagePath: .uigraph/maps/login-page.png
        focalPoints:
          - name: Register Button
            x: 120
            y: 300
            visibility: public
            components:
              - componentId: component_api-contract
                serviceName: Auth Service
                apiGroupName: auth-api
                operationId: registerUser
          - name: Login Form
            x: 200
            y: 400
            visibility: public
            components:
              - componentId: component_test-case-suite
                serviceName: Auth Service
                testPackName: Auth Smoke
              - componentId: component_backend-flow-diagram
                serviceName: Auth Service
                architectureDiagramName: Login Flow
```

## Map Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `description` | string | no | Description |
| `frames` | list | no | List of frames |

## Frame Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `description` | string | no | Description |
| `imagePath` | string | no | Path to background image |
| `focalPoints` | list | no | List of focal points |

## Focal Point Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `x` | float | yes | X coordinate |
| `y` | float | yes | Y coordinate |
| `visibility` | string | no | `public` or `private`. Default: `public` |
| `components` | list | no | Linked components |

## Component Linking

Each component entry links a focal point to a UiGraph entity.

### Component IDs

| Component ID | Purpose | Required Resolution Fields (if no componentLinkId) |
|--------------|---------|-----------------------------------------------------|
| `component_api-contract` | Link to an API operation | `serviceName`, `apiGroupName`, `operationId` |
| `component_test-case-suite` | Link to a test pack | `serviceName`, `testPackName` |
| `component_support-kb-troubleshooting` | Link to a doc | `serviceName`, `docName` |
| `component_backend-flow-diagram` | Link to an architecture diagram | `serviceName`, `architectureDiagramName` |

### Resolution Priority

1. If `componentLinkId` is provided, use it directly.
2. Otherwise, the gateway resolves using `serviceName` + entity-specific names.

### Example: API Contract Link

```yaml
components:
  - componentId: component_api-contract
    serviceName: Auth Service
    apiGroupName: auth-api
    operationId: registerUser
```

This links the focal point to the `registerUser` operation inside the `auth-api` API group belonging to `Auth Service`.

### Example: Test Suite Link

```yaml
components:
  - componentId: component_test-case-suite
    serviceName: Auth Service
    testPackName: Auth Smoke
```

### Example: Architecture Diagram Link

```yaml
components:
  - componentId: component_backend-flow-diagram
    serviceName: Auth Service
    architectureDiagramName: Login Flow
```

### Example: Doc Link

```yaml
components:
  - componentId: component_support-kb-troubleshooting
    serviceName: Auth Service
    docName: Auth Troubleshooting Guide
```

## Image Upload Behavior

When a frame has `imagePath`:
1. The CLI computes SHA256 of the image.
2. Calls gateway `v1/sync/frame/prepare`.
3. Gateway responds with action: `skip`, `upload`, or `done`.
4. If `upload`, CLI uploads to S3 presigned URL, then calls `complete`.
5. If `skip`, the image is unchanged and no upload occurs.
