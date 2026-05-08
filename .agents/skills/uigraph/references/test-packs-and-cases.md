# Test Packs and Test Cases

Test packs are defined inline in `.uigraph.yaml` under `testPacks`.

## Test Pack Structure

```yaml
testPacks:
  - name: Adapter Smoke
    type: smoke
    environment: staging
    releaseLabel: v1.2.0
    testCases:
      - ...
```

### Test Pack Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `type` | string | yes | `smoke`, `regression`, `manual` |
| `environment` | string | no | Environment label |
| `releaseLabel` | string | no | Release tag |
| `testCases` | list | no | List of test cases |

## API Test Case

```yaml
- title: Register user returns 201
  type: api
  order: 1
  description: Verify user registration endpoint
  priority: p0
  tags:
    - auth
    - registration
  linkedTicket: JIRA-123
  estimatedDurationMins: 2
  testOwner: alice@example.com

  # Link to API operation
  apiGroupName: storefront-api
  operationId: registerUser
  expectedStatusCode: 201
  requestTemplate: '{"email":"test@example.com","password":"secret"}'
  responseTimeMs: 500
  responseBody: '{"id":"..."}'

  assertions:
    - field: id
      type: exists
      value: ""
    - field: email
      type: equals
      value: "test@example.com"

  # Link to map focal point
  mapName: Auth Map
  frameName: Login Page
  focalPointName: Register Button
```

### API Test Case Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Must be `api` |
| `title` | string | yes | Test case title |
| `order` | float | yes | Execution order |
| `description` | string | no | Long description |
| `priority` | string | no | `p0`, `p1`, `p2`, `p3` |
| `tags` | list | no | String labels |
| `linkedTicket` | string | no | External ticket ID |
| `estimatedDurationMins` | int | no | Estimated minutes |
| `testOwner` | string | no | Owner email or name |
| `apiGroupName` | string | no | Must match an `apis[].name` |
| `operationId` | string | no | Must match an `operationId` in the OpenAPI spec |
| `expectedStatusCode` | int | no | Expected HTTP status |
| `requestTemplate` | string | no | Request body template |
| `responseTimeMs` | int | no | Max response time in ms |
| `responseBody` | string | no | Expected response body |
| `assertions` | list | no | List of `{field, type, value}` |
| `mapName` | string | no | Map to link to |
| `frameName` | string | no | Frame to link to |
| `focalPointName` | string | no | Focal point to link to |

## Manual Test Case

```yaml
- title: Verify login flow in UI
  type: manual
  order: 3
  description: Step-by-step login verification
  priority: p1
  tags:
    - ui
    - manual

  # Link to map focal point
  mapName: Auth Map
  frameName: Login Page
  focalPointName: Login Form

  stepsList:
    - action: Navigate to login page
      expectedResult: Login form is displayed
    - action: Enter valid credentials
      expectedResult: User is redirected to dashboard
    - action: Check session cookie
      expectedResult: Session token is set

  expectedOutcome: User successfully logs in and session is established
  preconditions: User account exists and is active
  testData: Use test account testuser@example.com / TestPass123
  postconditions: User session is active
  requiresEvidence: true
  isCritical: true
```

### Manual Test Case Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Must be `manual` |
| `title` | string | yes | Test case title |
| `order` | float | yes | Execution order |
| `stepsList` | list | no | List of `{action, expectedResult}` |
| `expectedOutcome` | string | no | Overall expected result |
| `preconditions` | string | no | Setup required before test |
| `testData` | string | no | Data to use during test |
| `postconditions` | string | no | Expected state after test |
| `requiresEvidence` | bool | no | Whether screenshot/log is required |
| `isCritical` | bool | no | Whether test is critical |

## Linking Rules

- `apiGroupName` must match the `name` of an entry in `apis`.
- `operationId` must match an `operationId` inside the referenced OpenAPI spec.
- `mapName`, `frameName`, `focalPointName` must match entries in `maps`.
