// schema.js
export const SCHEMA_VERSION = 1;

export const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_type TEXT NOT NULL,
    duration INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  );
`;

export const CREATE_INSIGHTS_CACHE_TABLE = `
  CREATE TABLE IF NOT EXISTS insights_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_type TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    data_hash TEXT NOT NULL,
    insight_text TEXT NOT NULL,
    time_period_start INTEGER NOT NULL,
    time_period_end INTEGER NOT NULL,
    UNIQUE(insight_type, time_period_start, time_period_end)
  );
`;

// Create indexes for faster queries
export const CREATE_SESSIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
  ON sessions(created_at);
  
  CREATE INDEX IF NOT EXISTS idx_sessions_activity_type 
  ON sessions(activity_type);
`;

export const CREATE_INSIGHTS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_insights_insight_type 
  ON insights_cache(insight_type);
  
  CREATE INDEX IF NOT EXISTS idx_insights_time_period 
  ON insights_cache(time_period_start, time_period_end);
`;