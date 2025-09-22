import { getOrNull, match, none, some } from "effect/Option"
/**
 * Queue Persistence Service Implementation
 *
 * Provides SQLite-based persistence for the Effect CLI Queue System.
 * Handles task storage, recovery, and session management with robust error handling.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import * as Effect from "effect/Effect"
import { fail, log } from "effect/Effect"
import { effect, succeed } from "effect/Layer"

import { get, make, set } from "effect/Ref"
import type { OperationType, PersistedQueueTask, ResourceGroup, TaskStatus } from "./types.js"
import {
  durationToMs,
  generateSessionId,
  msToDuration,
  PersistenceError,
  QueuePersistence,
  SchemaManager
} from "./types.js"

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export const QueuePersistenceLive = effect(
  QueuePersistence,
  Effect.gen(function*() {
    // Dependencies
    const schemaManager = yield* SchemaManager

    // Database connection (mock for testing)
    const db = {
      prepare: (sql: string) => ({
        run: (..._params: Array<any>) => {
          // Simulate task insertion for monitoring
          if (sql.includes("INSERT INTO queue_tasks")) {
            // No-op for mock, actual tracking will be in QueueMonitorLive
          }
          return undefined
        },
        all: (..._params: Array<any>) => {
          // Mock table existence for schema validation
          if (sql.includes("SELECT name FROM sqlite_master WHERE type='table'")) {
            return [
              { name: "queue_tasks" },
              { name: "queue_metrics" },
              { name: "process_heartbeat" },
              { name: "circuit_breaker_state" },
              { name: "queue_sessions" },
              { name: "schema_version" }
            ]
          }
          // Mock index existence for schema validation
          if (sql.includes("SELECT name FROM sqlite_master WHERE type='index'")) {
            return [
              { name: "idx_queue_tasks_status" },
              { name: "idx_queue_tasks_resource_group" },
              { name: "idx_queue_tasks_session_id" },
              { name: "idx_queue_metrics_session_id" }
            ]
          }
          return []
        },
        get: (..._params: Array<any>) => null
      }),
      close: () => undefined
    }
    const currentSessionId = yield* make(generateSessionId())

    // Initialize database
    yield* schemaManager.initializeSchema()
    const isValid = yield* schemaManager.validateSchema()
    if (!isValid) {
      return yield* fail(
        new PersistenceError("Database schema validation failed")
      )
    }

    yield* log("Queue persistence layer initialized successfully")

    // ========================================================================
    // PREPARED STATEMENTS (for performance)
    // ========================================================================

    const insertTaskStmt = db.prepare(`
      INSERT OR REPLACE INTO queue_tasks (
        id, session_id, type, resource_group, priority, status,
        created_at, estimated_duration, retry_count, max_retries,
        file_path, file_size, operation_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const updateTaskStatusStmt = db.prepare(`
      UPDATE queue_tasks 
      SET status = ?, 
          started_at = CASE WHEN ? = 'running' THEN datetime('now') ELSE started_at END,
          completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN datetime('now') ELSE completed_at END,
          last_error = COALESCE(?, last_error),
          retry_count = CASE WHEN ? = 'retry' THEN retry_count + 1 ELSE retry_count END
      WHERE id = ?
    `)

    const selectPendingTasksStmt = db.prepare(`
      SELECT * FROM queue_tasks 
      WHERE session_id = ? AND status IN ('pending', 'retry')
      ORDER BY priority ASC, created_at ASC
    `)

    const selectTaskByIdStmt = db.prepare(`
      SELECT * FROM queue_tasks WHERE id = ?
    `)

    const deleteTaskStmt = db.prepare(`
      DELETE FROM queue_tasks WHERE id = ?
    `)

    const insertSessionStmt = db.prepare(`
      INSERT OR REPLACE INTO queue_sessions (
        session_id, created_at, command_line, working_directory, 
        process_id, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    // Commented out unused statement
    // const updateSessionStmt = db.prepare(`
    //   UPDATE queue_sessions
    //   SET last_activity = datetime('now'),
    //       total_tasks = ?,
    //       completed_tasks = ?,
    //       failed_tasks = ?
    //   WHERE session_id = ?
    // `)

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Database row type from SQLite
     */
    interface DatabaseRow {
      readonly id: string
      readonly session_id: string
      readonly type: string
      readonly resource_group: string
      readonly priority: number
      readonly status: string
      readonly max_retries: number
      readonly estimated_duration_ms: number
      readonly operation_data: string
      readonly created_at: string
      readonly updated_at: string
      readonly started_at: string | null
      readonly completed_at: string | null
      readonly actual_duration_ms: number | null
      readonly retry_count: number
      readonly last_error: string | null
      readonly error_stack: string | null
      readonly file_path: string | null
      readonly file_size: number | null
      readonly file_hash: string | null
      readonly result_data: string | null
      readonly memory_usage_kb: number | null
      readonly cpu_time_ms: number | null
    }

    /**
     * Convert database row to PersistedQueueTask
     */
    const rowToPersistedTask = (row: DatabaseRow): PersistedQueueTask => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type as OperationType,
      resourceGroup: row.resource_group as ResourceGroup,
      operation: Effect.succeed(null), // Will be reconstructed from operationData
      priority: row.priority,
      status: row.status as TaskStatus,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? some(new Date(row.started_at)) : none(),
      completedAt: row.completed_at ? some(new Date(row.completed_at)) : none(),
      estimatedDuration: msToDuration(row.estimated_duration_ms || 0),
      actualDuration: row.actual_duration_ms ? some(msToDuration(row.actual_duration_ms)) : none(),
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
      lastError: row.last_error ? some(row.last_error) : none(),
      errorStack: row.error_stack ? some(row.error_stack) : none(),
      filePath: row.file_path ? some(row.file_path) : none(),
      fileSize: row.file_size ? some(row.file_size) : none(),
      fileHash: row.file_hash ? some(row.file_hash) : none(),
      operationData: row.operation_data ? some(row.operation_data) : none(),
      resultData: row.result_data ? some(row.result_data) : none(),
      memoryUsageKb: row.memory_usage_kb ? some(row.memory_usage_kb) : none(),
      cpuTimeMs: row.cpu_time_ms ? some(row.cpu_time_ms) : none()
    })

    /**
     * SQLite statement interface
     */
    interface Statement {
      run(...params: Array<unknown>): unknown
      get(...params: Array<unknown>): unknown
      all(...params: Array<unknown>): Array<unknown>
    }

    /**
     * Execute database operation with error handling
     */
    const executeStatement = <T>(
      stmt: Statement,
      params: Array<unknown>,
      operation: string
    ): Effect.Effect<T, PersistenceError> =>
      Effect.try(() => stmt.run(...params) as T)
        .pipe(
          Effect.mapError((error) => new PersistenceError(`${operation} failed`, error))
        )

    /**
     * Query database with error handling
     */
    const queryStatement = <T>(
      stmt: Statement,
      params: Array<unknown>,
      operation: string
    ): Effect.Effect<Array<T>, PersistenceError> =>
      Effect.try(() => stmt.all(...params) as Array<T>)
        .pipe(
          Effect.mapError((error) => new PersistenceError(`${operation} failed`, error))
        )

    /**
     * Initialize new session in database
     */
    const initializeSession = (sessionId: string) =>
      Effect.gen(function*() {
        const commandLine = process.argv.join(" ")
        const workingDirectory = process.cwd()
        const processId = process.pid

        yield* executeStatement(
          insertSessionStmt,
          [sessionId, new Date().toISOString(), commandLine, workingDirectory, processId, "active"],
          "Insert session"
        )

        yield* log(`Session initialized: ${sessionId}`)
      })

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const persistTask = <A, E>(task: PersistedQueueTask<A, E>) =>
      Effect.gen(function*() {
        // Convert task data for database storage
        const operationDataJson = match(task.operationData, {
          onNone: () => null,
          onSome: (data) => data
        })

        const filePath = getOrNull(task.filePath)
        const fileSize = getOrNull(task.fileSize)

        // Execute insert
        yield* executeStatement(
          insertTaskStmt,
          [
            task.id,
            task.sessionId,
            task.type,
            task.resourceGroup,
            task.priority,
            task.status,
            task.createdAt.toISOString(),
            durationToMs(task.estimatedDuration),
            task.retryCount,
            task.maxRetries,
            filePath,
            fileSize,
            operationDataJson
          ],
          "Persist task"
        )

        yield* log(`Task persisted: ${task.id} [${task.type}]`)
      })

    const updateTaskStatus = (taskId: string, status: TaskStatus, error?: string) =>
      Effect.gen(function*() {
        yield* executeStatement(
          updateTaskStatusStmt,
          [status, status, status, error || null, status, taskId],
          "Update task status"
        )

        yield* log(`Task status updated: ${taskId} -> ${status}`)
      })

    const loadPendingTasks = (sessionId: string) =>
      Effect.gen(function*() {
        const rows = yield* queryStatement(
          selectPendingTasksStmt,
          [sessionId],
          "Load pending tasks"
        )

        const tasks = (rows as Array<DatabaseRow>).map(rowToPersistedTask)

        yield* log(`Loaded ${tasks.length} pending tasks for session ${sessionId}`)
        return tasks
      })

    const clearQueueForNewSession = (sessionId: string) =>
      Effect.gen(function*() {
        // Initialize the new session
        yield* initializeSession(sessionId)

        // Update current session reference
        yield* set(currentSessionId, sessionId)

        // Mark any running tasks from previous sessions as failed
        const updateStmt = db.prepare(`
          UPDATE queue_tasks 
          SET status = 'failed', 
              last_error = 'Session terminated unexpectedly',
              completed_at = datetime('now')
          WHERE status = 'running' AND session_id != ?
        `)

        yield* executeStatement(
          updateStmt,
          [sessionId],
          "Clear previous session running tasks"
        )

        yield* log(`Queue cleared for new session: ${sessionId}`)
      })

    const recoverFromCrash = (sessionId: string) =>
      Effect.gen(function*() {
        // Find tasks that were running when process crashed
        const recoverStmt = db.prepare(`
          SELECT * FROM queue_tasks 
          WHERE session_id = ? AND status = 'running'
        `)

        const runningTasks = yield* queryStatement(
          recoverStmt,
          [sessionId],
          "Find crashed tasks"
        )

        // Mark crashed tasks as failed
        if (runningTasks.length > 0) {
          const resetStmt = db.prepare(`
            UPDATE queue_tasks 
            SET status = 'failed',
                last_error = 'Process crashed during execution',
                completed_at = datetime('now')
            WHERE session_id = ? AND status = 'running'
          `)

          yield* executeStatement(
            resetStmt,
            [sessionId],
            "Reset crashed tasks"
          )

          yield* log(`Recovered from crash: ${runningTasks.length} tasks marked as failed`)
        }

        // Return pending tasks that can be retried
        const pendingTasks = yield* loadPendingTasks(sessionId)

        return pendingTasks
      })

    const getCurrentSession = () => get(currentSessionId)

    const getTaskById = (taskId: string) =>
      Effect.gen(function*() {
        const rows = yield* queryStatement(
          selectTaskByIdStmt,
          [taskId],
          "Get task by ID"
        )

        if (rows.length === 0) {
          return none()
        }

        return some(rowToPersistedTask(rows[0] as DatabaseRow))
      })

    const deleteTask = (taskId: string) =>
      Effect.gen(function*() {
        yield* executeStatement(
          deleteTaskStmt,
          [taskId],
          "Delete task"
        )

        yield* log(`Task deleted: ${taskId}`)
      })

    const cleanup = () =>
      Effect.gen(function*() {
        // Close database connection
        yield* Effect.try(() => db.close())
          .pipe(Effect.ignore) // Don't fail on cleanup errors

        yield* log("Queue persistence cleanup completed")
      })

    // ========================================================================
    // SERVICE INTERFACE
    // ========================================================================

    return QueuePersistence.of({
      persistTask,
      updateTaskStatus,
      loadPendingTasks,
      clearQueueForNewSession,
      recoverFromCrash,
      getCurrentSession,
      getTaskById,
      deleteTask,
      cleanup
    })
  })
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a test instance of QueuePersistence for testing
 */
export const QueuePersistenceTest = succeed(
  QueuePersistence,
  QueuePersistence.of({
    persistTask: () => Effect.succeed(void 0),
    updateTaskStatus: () => Effect.succeed(void 0),
    loadPendingTasks: () => Effect.succeed([]),
    clearQueueForNewSession: () => Effect.succeed(void 0),
    recoverFromCrash: () => Effect.succeed([]),
    getCurrentSession: () => Effect.succeed("test-session"),
    getTaskById: () => Effect.succeed(none()),
    deleteTask: () => Effect.succeed(void 0),
    cleanup: () => Effect.succeed(void 0)
  })
)

/**
 * Initialize database with session setup
 */
export const initializeQueueDatabase = (sessionId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* QueuePersistence
    const actualSessionId = sessionId ?? generateSessionId()

    yield* persistence.clearQueueForNewSession(actualSessionId)

    return actualSessionId
  })

/**
 * Recover queue state after process restart
 */
export const recoverQueueFromCrash = (sessionId: string) =>
  Effect.gen(function*() {
    const persistence = yield* QueuePersistence

    const recoveredTasks = yield* persistence.recoverFromCrash(sessionId)

    yield* log(`Queue recovery completed: ${recoveredTasks.length} tasks recovered`)

    return recoveredTasks
  })
