# Database Schemas

## Database Selection Rules

Do not generate both SQL and NoSQL database artifacts by default. Generate only the database artifact type supported by discovered project evidence or explicit user input.

- Generate SQL schemas only when evidence shows relational database usage, such as migrations, checked-in SQL files, relational ORM models, or dependencies/configuration for PostgreSQL, MySQL, or SQLite.
- Generate NoSQL schemas only when evidence shows NoSQL usage, such as DynamoDB tables, MongoDB collections, NoSQL schema/config files, SDK usage, or an explicit user request.
- If the project evidence is ambiguous, ask which database artifact to create instead of generating both SQL and NoSQL.

## Configuration in .uigraph.yaml

This example shows both SQL and NoSQL formats. It is not a recommendation to always create both. Generated `databases` entries must reflect discovered project evidence or explicit user input.

```yaml
databases:
  - name: ecommerce
    dialect: mysql
    dbType: MySQL
    schemaPath: .uigraph/db/ecommerce-schema.sql
  - name: payments
    dialect: dynamodb
    dbType: DynamoDB
    schemaPath: .uigraph/db/dynamo-schema.json
```

Database schema files must be generated under `.uigraph/db/`.

- For SQL dialects (`postgres`, `mysql`, `sqlite`, `other` when SQL-like), generate a raw `.sql` file.
- For NoSQL dialects (`dynamodb`, `mongodb`), generate a structured `.json` file.
- In `.uigraph.yaml`, `databases[*].schemaPath` must reference the generated `.sql` or `.json` file that matches the declared dialect.

## SQL Schemas

For dialects: `postgres`, `mysql`, `sqlite`

The schema file is a raw `.sql` file under `.uigraph/db/` containing `CREATE TABLE` statements. The gateway parses the SQL via an adapter.

Requirements:
- Must be valid SQL for the declared dialect.
- Should include `CREATE TABLE`, `FOREIGN KEY`, and `INDEX` statements.
- The CLI sends the raw file content; the gateway parses it.

## NoSQL Schemas

For dialects: `dynamodb`, `mongodb`

The schema file is a structured `.json` file under `.uigraph/db/`.

### DynamoDB JSON Schema

```json
{
  "name": "string",
  "description": "string",
  "dialect": "dynamodb",
  "primaryKey": {
    "partitionKey": "string",
    "partitionKeyType": "string",
    "sortKey": "string",
    "sortKeyType": "string"
  },
  "globalSecondaryIndexes": [
    {
      "id": "uuid",
      "name": "string",
      "partitionKey": "string",
      "partitionKeyType": "string",
      "sortKey": "string",
      "sortKeyType": "string"
    }
  ],
  "attributes": [
    {
      "id": "uuid",
      "name": "string",
      "type": "string",
      "required": "boolean",
      "notes": "string",
      "fields": [
        {
          "id": "uuid",
          "name": "string",
          "type": "string",
          "required": "boolean",
          "fields": []
        }
      ]
    }
  ]
}
```

### Field Types for NoSQL

Known attribute types:
- `string`
- `number`
- `boolean`
- `object` (can have nested `fields` array)
- `array`

### Nested Fields

When `type` is `object`, the `fields` array defines nested properties recursively:

```json
{
  "name": "Payload",
  "type": "object",
  "required": true,
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true
    },
    {
      "name": "amount",
      "type": "number",
      "required": true
    }
  ]
}
```

## MongoDB Schemas

MongoDB uses the same JSON format as DynamoDB. The gateway adapts based on `dialect`.
