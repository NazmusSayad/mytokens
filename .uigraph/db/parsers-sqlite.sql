-- SQLite schema for parser data stores
-- Used by: Cursor (CSV files), and potential future SQLite-based parsers

-- Parser usage data (aggregated from various JSONL/CSV sources)
CREATE TABLE IF NOT EXISTS usage_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app TEXT NOT NULL,
    mode TEXT,
    type TEXT NOT NULL,
    date INTEGER NOT NULL,
    model_id TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    tokens_cache_input INTEGER DEFAULT 0,
    tokens_cache_output INTEGER DEFAULT 0,
    tokens_reasoning INTEGER DEFAULT 0,
    project_path TEXT,
    project_name TEXT,
    session_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_app ON usage_data(app);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_data(date);
CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_data(model_id);
CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_data(project_path);

-- Parser metadata for tracking available data sources
CREATE TABLE IF NOT EXISTS parser_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parser_name TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    file_format TEXT NOT NULL,
    last_parsed INTEGER,
    record_count INTEGER DEFAULT 0
);

-- Cursor-specific cache table (from ~/.config/tokscale/cursor-cache/*.csv)
CREATE TABLE IF NOT EXISTS cursor_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date INTEGER NOT NULL,
    model TEXT NOT NULL,
    input_with_cache_write INTEGER DEFAULT 0,
    input_without_cache_write INTEGER DEFAULT 0,
    cache_read INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    session_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cursor_date ON cursor_usage(date);
CREATE INDEX IF NOT EXISTS idx_cursor_model ON cursor_usage(model);