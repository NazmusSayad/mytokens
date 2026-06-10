# mytokens

`mytokens` is a small CLI that reads your local OpenCode SQLite history, matches models against the OpenRouter model catalog, and prints a readable usage + cost report.

<img width="3838" height="733" alt="image" src="https://github.com/user-attachments/assets/de6b99ec-748c-4631-91f2-17ca780eed57" />

## What it does

- Reads usage rows from your OpenCode database (`part` + `message` tables).
- Fetches live model pricing from `https://openrouter.ai/api/v1/models`.
- Matches local model names to OpenRouter model IDs with fuzzy matching.
- Calculates estimated USD cost per model per day.

## Install

Use it directly from npm (no cloning/building needed):

```bash
npx mytokens
```

Or install globally:

```bash
npm i -g mytokens
mytokens
```

## Usage

Run with default database path:

```bash
npx mytokens
```

You can also pass your database file as the first CLI argument, or set `OPENCODE_DB_PATH`.

Default DB path if no argument/env is provided:

```text
~/.local/share/opencode/opencode.db
```

## Output

The CLI prints three tables:

- `Daily Usage/Model`: token usage and estimated cost by date + model.
- `Daily Usage/Provider`: token usage and estimated cost by date + provider.
- `Daily Total Usage`: models used, token totals, and total cost by date.

## Requirements

- Node.js 18+
- Access to your OpenCode SQLite database
- Network access to OpenRouter models endpoint
