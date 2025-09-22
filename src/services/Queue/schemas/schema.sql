-- Effect CLI Queue System Database Schema
-- Version: 1.0.0
-- Created: 2025-01-12

-- ============================================================================
-- QUEUE SYSTEM TABLES
-- ============================================================================

-- 큐 작업 추적 테이블 (핵심)
CREATE TABLE IF NOT EXISTS queue_tasks (
    -- Primary identifiers
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    
    -- Task metadata
    type TEXT NOT NULL,                    -- 'file-read', 'file-write', 'directory-list', etc.
    resource_group TEXT NOT NULL,         -- 'filesystem', 'network', 'computation', 'memory-intensive'
    priority INTEGER NOT NULL DEFAULT 1,  -- 1(high) to 10(low)
    
    -- Status tracking
    status TEXT NOT NULL,                  -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    
    -- Timing information
    created_at TEXT NOT NULL,              -- ISO 8601 timestamp
    started_at TEXT,                       -- When task started running
    completed_at TEXT,                     -- When task finished (success or failure)
    
    -- Error handling
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,                       -- Error message if failed
    
    -- Performance tracking
    estimated_duration INTEGER,            -- Milliseconds
    actual_duration INTEGER,               -- Calculated: completed_at - started_at
    
    -- Additional metadata
    file_path TEXT,                        -- For file operations
    file_size INTEGER,                     -- For file operations (bytes)
    operation_data TEXT                    -- JSON data for complex operations
);

-- 큐 메트릭 스냅샷 테이블
CREATE TABLE IF NOT EXISTS queue_metrics (
    -- Session and timestamp
    session_id TEXT NOT NULL,
    snapshot_time TEXT NOT NULL,
    
    -- Overall statistics
    total_tasks INTEGER NOT NULL DEFAULT 0,
    pending_tasks INTEGER NOT NULL DEFAULT 0,
    running_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    cancelled_tasks INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    success_rate REAL NOT NULL DEFAULT 0.0,           -- 0.0 to 1.0
    average_processing_time REAL NOT NULL DEFAULT 0.0, -- milliseconds
    throughput_per_minute REAL NOT NULL DEFAULT 0.0,   -- tasks per minute
    
    -- Resource group breakdown (JSON)
    resource_group_stats TEXT,             -- JSON: {"filesystem": {...}, "network": {...}}
    
    PRIMARY KEY (session_id, snapshot_time)
);

-- 프로세스 상태 모니터링 테이블
CREATE TABLE IF NOT EXISTS process_heartbeat (
    -- Process identification
    process_id INTEGER NOT NULL,           -- process.pid
    session_id TEXT NOT NULL,
    
    -- Timestamp
    timestamp TEXT NOT NULL,               -- ISO 8601
    
    -- System resources
    memory_used_mb REAL NOT NULL,          -- Heap memory in MB
    memory_total_mb REAL NOT NULL,         -- Total heap in MB
    uptime_seconds INTEGER NOT NULL,       -- Process uptime
    
    -- Performance counters
    tasks_processed INTEGER NOT NULL DEFAULT 0,
    tasks_failed INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    
    -- Health indicators
    memory_leak_detected BOOLEAN NOT NULL DEFAULT FALSE,
    gc_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    circuit_breaker_open BOOLEAN NOT NULL DEFAULT FALSE,
    
    PRIMARY KEY (process_id, timestamp)
);

-- Circuit Breaker 상태 추적 테이블
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    resource_group TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    
    -- State information
    state TEXT NOT NULL,                   -- 'Closed', 'Open', 'HalfOpen'
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    last_failure_time TEXT,                -- ISO 8601
    last_success_time TEXT,                -- ISO 8601
    state_changed_at TEXT NOT NULL,        -- ISO 8601
    
    -- Configuration
    failure_threshold INTEGER NOT NULL DEFAULT 5,
    recovery_timeout_ms INTEGER NOT NULL DEFAULT 60000,  -- 1 minute
    
    -- Statistics
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_failures INTEGER NOT NULL DEFAULT 0,
    failure_rate REAL NOT NULL DEFAULT 0.0
);

-- 세션 관리 테이블
CREATE TABLE IF NOT EXISTS queue_sessions (
    session_id TEXT PRIMARY KEY,
    
    -- Session lifecycle
    created_at TEXT NOT NULL,              -- ISO 8601
    started_at TEXT,                       -- When first task started
    last_activity TEXT,                    -- Last task activity
    ended_at TEXT,                         -- When session ended
    
    -- Session metadata
    command_line TEXT,                     -- Command that started the session
    working_directory TEXT,                -- CWD when session started
    process_id INTEGER,                    -- process.pid
    
    -- Session statistics
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active'  -- 'active', 'completed', 'cancelled', 'crashed'
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_queue_tasks_session_status 
    ON queue_tasks(session_id, status);

CREATE INDEX IF NOT EXISTS idx_queue_tasks_resource_group_status 
    ON queue_tasks(resource_group, status);

CREATE INDEX IF NOT EXISTS idx_queue_tasks_created_at 
    ON queue_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_queue_tasks_priority_created 
    ON queue_tasks(priority DESC, created_at ASC);

-- Metrics queries
CREATE INDEX IF NOT EXISTS idx_queue_metrics_session_time 
    ON queue_metrics(session_id, snapshot_time DESC);

-- Heartbeat queries
CREATE INDEX IF NOT EXISTS idx_process_heartbeat_session_time 
    ON process_heartbeat(session_id, timestamp DESC);

-- Session management
CREATE INDEX IF NOT EXISTS idx_queue_sessions_status 
    ON queue_sessions(status);

CREATE INDEX IF NOT EXISTS idx_queue_sessions_created_at 
    ON queue_sessions(created_at DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Current session summary
CREATE VIEW IF NOT EXISTS current_session_summary AS
SELECT 
    s.session_id,
    s.status as session_status,
    s.created_at as session_started,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    SUM(CASE WHEN t.status = 'running' THEN 1 ELSE 0 END) as running_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
    ROUND(AVG(t.actual_duration), 2) as avg_duration_ms,
    ROUND(
        CAST(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS REAL) / 
        NULLIF(COUNT(t.id), 0) * 100, 2
    ) as success_rate_percent
FROM queue_sessions s
LEFT JOIN queue_tasks t ON s.session_id = t.session_id
WHERE s.status = 'active'
GROUP BY s.session_id, s.status, s.created_at;

-- Resource group performance
CREATE VIEW IF NOT EXISTS resource_group_performance AS
SELECT 
    resource_group,
    session_id,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(AVG(actual_duration), 2) as avg_duration_ms,
    ROUND(AVG(retry_count), 2) as avg_retries,
    ROUND(
        CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) / 
        COUNT(*) * 100, 2
    ) as success_rate_percent
FROM queue_tasks 
WHERE status IN ('completed', 'failed')
GROUP BY resource_group, session_id;

-- ============================================================================
-- TRIGGERS FOR DATA INTEGRITY
-- ============================================================================

-- Update actual_duration when task completes
CREATE TRIGGER IF NOT EXISTS update_task_duration
    AFTER UPDATE OF completed_at ON queue_tasks
    WHEN NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL
BEGIN
    UPDATE queue_tasks 
    SET actual_duration = (
        (julianday(NEW.completed_at) - julianday(NEW.started_at)) * 86400000
    )
    WHERE id = NEW.id;
END;

-- Update session last_activity on task changes
CREATE TRIGGER IF NOT EXISTS update_session_activity
    AFTER UPDATE ON queue_tasks
BEGIN
    UPDATE queue_sessions 
    SET last_activity = datetime('now')
    WHERE session_id = NEW.session_id;
END;

-- ============================================================================
-- CLEANUP POLICIES
-- ============================================================================

-- NOTE: These would be implemented as scheduled jobs in the application
-- 
-- 1. Delete heartbeat data older than 7 days
-- 2. Archive completed sessions older than 30 days  
-- 3. Clean up orphaned circuit breaker states
-- 4. Compress old metrics snapshots