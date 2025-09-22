-- Effect CLI Queue System Schema Migrations
-- This file tracks schema version history and provides migration paths

-- ============================================================================
-- SCHEMA VERSION TRACKING
-- ============================================================================

-- Schema version table (always created first)
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL,
    description TEXT NOT NULL,
    checksum TEXT NOT NULL
);

-- ============================================================================
-- MIGRATION: Version 1.0.0 → 1.1.0
-- ============================================================================

-- Migration 1.1.0: Add task dependencies and batching support
-- Applied when: Task dependencies are needed for complex workflows

/*
-- Add dependency tracking columns to queue_tasks
ALTER TABLE queue_tasks ADD COLUMN depends_on_task_id TEXT;
ALTER TABLE queue_tasks ADD COLUMN batch_id TEXT;
ALTER TABLE queue_tasks ADD COLUMN batch_position INTEGER;

-- Add foreign key constraint for dependencies
-- Note: SQLite doesn't support adding foreign key constraints to existing tables
-- This would require table recreation in a real migration

-- Add index for dependency queries
CREATE INDEX IF NOT EXISTS idx_queue_tasks_dependencies 
    ON queue_tasks(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_queue_tasks_batch 
    ON queue_tasks(batch_id, batch_position);

-- Insert migration record
INSERT OR REPLACE INTO schema_version (version, applied_at, description, checksum)
VALUES (
    '1.1.0', 
    datetime('now'), 
    'Add task dependencies and batching support',
    'hash-of-migration-content-here'
);
*/

-- ============================================================================
-- MIGRATION: Version 1.1.0 → 1.2.0  
-- ============================================================================

-- Migration 1.2.0: Add performance profiling and detailed metrics
-- Applied when: Detailed performance analysis is needed

/*
-- Add performance profiling table
CREATE TABLE IF NOT EXISTS task_performance_profile (
    task_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    
    -- Detailed timing breakdown
    queue_wait_time INTEGER,        -- Time spent in queue (ms)
    throttle_wait_time INTEGER,     -- Time spent in throttling (ms)
    execution_time INTEGER,         -- Pure execution time (ms)
    
    -- Resource usage during execution
    peak_memory_mb REAL,
    cpu_usage_percent REAL,
    
    -- I/O statistics
    files_read INTEGER DEFAULT 0,
    files_written INTEGER DEFAULT 0,
    bytes_read INTEGER DEFAULT 0,
    bytes_written INTEGER DEFAULT 0,
    
    -- Network statistics (for future network operations)
    network_requests INTEGER DEFAULT 0,
    network_bytes_sent INTEGER DEFAULT 0,
    network_bytes_received INTEGER DEFAULT 0,
    
    created_at TEXT NOT NULL,
    
    FOREIGN KEY (task_id) REFERENCES queue_tasks(id) ON DELETE CASCADE
);

-- Add indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_performance_session_created 
    ON task_performance_profile(session_id, created_at DESC);

-- Insert migration record
INSERT OR REPLACE INTO schema_version (version, applied_at, description, checksum)
VALUES (
    '1.2.0', 
    datetime('now'), 
    'Add performance profiling and detailed metrics',
    'hash-of-migration-content-here'
);
*/

-- ============================================================================
-- MIGRATION: Version 1.2.0 → 2.0.0
-- ============================================================================

-- Migration 2.0.0: Add distributed queue support and worker nodes
-- Applied when: Multi-process or distributed processing is needed

/*
-- Add worker nodes table
CREATE TABLE IF NOT EXISTS worker_nodes (
    node_id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    process_id INTEGER NOT NULL,
    
    -- Worker capabilities
    supported_resource_groups TEXT, -- JSON array
    max_concurrent_tasks INTEGER NOT NULL DEFAULT 1,
    
    -- Status tracking  
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'busy', 'offline'
    last_heartbeat TEXT NOT NULL,
    
    -- Performance metrics
    total_tasks_processed INTEGER NOT NULL DEFAULT 0,
    average_task_duration REAL NOT NULL DEFAULT 0.0,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Add worker assignment to tasks
ALTER TABLE queue_tasks ADD COLUMN assigned_worker_id TEXT;
ALTER TABLE queue_tasks ADD COLUMN assignment_time TEXT;

-- Add index for worker queries
CREATE INDEX IF NOT EXISTS idx_queue_tasks_worker_assignment 
    ON queue_tasks(assigned_worker_id, status);

CREATE INDEX IF NOT EXISTS idx_worker_nodes_status 
    ON worker_nodes(status, last_heartbeat);

-- Insert migration record
INSERT OR REPLACE INTO schema_version (version, applied_at, description, checksum)
VALUES (
    '2.0.0', 
    datetime('now'), 
    'Add distributed queue support and worker nodes',
    'hash-of-migration-content-here'
);
*/

-- ============================================================================
-- UTILITY QUERIES FOR MIGRATIONS
-- ============================================================================

-- Check current schema version
-- SELECT version, applied_at FROM schema_version ORDER BY applied_at DESC LIMIT 1;

-- Check if migration is needed
-- SELECT CASE 
--     WHEN (SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1) < '1.1.0' 
--     THEN 'Migration needed to 1.1.0' 
--     ELSE 'Schema up to date' 
-- END as migration_status;

-- List all applied migrations
-- SELECT version, applied_at, description 
-- FROM schema_version 
-- ORDER BY applied_at ASC;

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

-- Rollback from 1.1.0 to 1.0.0
/*
-- Remove added columns (requires table recreation in SQLite)
CREATE TABLE queue_tasks_backup AS SELECT 
    id, session_id, type, resource_group, priority, status,
    created_at, started_at, completed_at, retry_count, max_retries,
    last_error, estimated_duration, actual_duration, 
    file_path, file_size, operation_data
FROM queue_tasks;

DROP TABLE queue_tasks;
ALTER TABLE queue_tasks_backup RENAME TO queue_tasks;

-- Recreate indexes
-- (Copy from original schema.sql)

-- Remove migration record
DELETE FROM schema_version WHERE version = '1.1.0';
*/