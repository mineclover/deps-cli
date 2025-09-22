import { millis, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
/**
 * Effect CLI Queue System - Type Definitions
 *
 * Core type system for the Effect.js-based queue management system.
 * Provides type-safe interfaces for task management, persistence, and monitoring.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { GenericTag } from "effect/Context"

import type * as Effect from "effect/Effect"
import type * as Fiber from "effect/Fiber"
import type * as Option from "effect/Option"

// Import SchemaManager from the existing implementation
export { SchemaManager } from "./SchemaManager.js"

// ============================================================================
// CORE DOMAIN TYPES
// ============================================================================

/**
 * Task execution status lifecycle
 */
export type TaskStatus =
  | "pending" // Queued and waiting for execution
  | "running" // Currently being processed
  | "completed" // Successfully finished
  | "failed" // Finished with error
  | "cancelled" // Manually cancelled
  | "retry" // Scheduled for retry after failure

/**
 * Resource group classification for queue management
 * Each group has dedicated processing queues and circuit breakers
 */
export type ResourceGroup =
  | "filesystem" // File I/O operations
  | "network" // HTTP requests, API calls
  | "computation" // CPU-intensive operations
  | "memory-intensive" // Large data processing

/**
 * Operation type classification for monitoring and optimization
 */
export type OperationType =
  | "file-read" // Reading files from disk
  | "file-write" // Writing files to disk
  | "directory-list" // Listing directory contents
  | "find-files" // Searching for files
  | "network-request" // HTTP/network operations
  | "computation" // CPU-bound calculations
  | "memory-operation" // Memory-intensive tasks

/**
 * Circuit breaker states for stability patterns
 */
export type CircuitBreakerState =
  | "closed" // Normal operation, requests allowed
  | "open" // Failing, requests blocked
  | "half-open" // Testing recovery, limited requests

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Persisted queue task with complete metadata
 * This represents a task as stored in SQLite with all tracking information
 */
export interface PersistedQueueTask<A = unknown, E = unknown> {
  // Core identification
  readonly id: string
  readonly sessionId: string

  // Task classification
  readonly type: OperationType
  readonly resourceGroup: ResourceGroup

  // Execution metadata
  readonly operation: Effect.Effect<A, E>
  readonly priority: number // 1 (highest) to 10 (lowest)
  readonly status: TaskStatus

  // Timing information
  readonly createdAt: Date
  readonly startedAt: Option.Option<Date>
  readonly completedAt: Option.Option<Date>
  readonly estimatedDuration: Duration
  readonly actualDuration: Option.Option<Duration>

  // Error handling
  readonly retryCount: number
  readonly maxRetries: number
  readonly lastError: Option.Option<string>
  readonly errorStack: Option.Option<string>

  // File operation specifics (when applicable)
  readonly filePath: Option.Option<string>
  readonly fileSize: Option.Option<number>
  readonly fileHash: Option.Option<string>

  // Serialized operation data
  readonly operationData: Option.Option<string> // JSON
  readonly resultData: Option.Option<string> // JSON

  // Performance metrics
  readonly memoryUsageKb: Option.Option<number>
  readonly cpuTimeMs: Option.Option<number>
}

/**
 * In-memory queue task representation
 * Lighter version for active queue processing
 */
export interface QueueTask<A = unknown, E = unknown> {
  readonly id: string
  readonly sessionId: string
  readonly type: OperationType
  readonly resourceGroup: ResourceGroup
  readonly operation: Effect.Effect<A, E>
  readonly priority: number
  readonly estimatedDuration: Duration
  readonly maxRetries: number
  readonly operationData: Option.Option<Record<string, unknown>>
}

/**
 * Queue metrics snapshot for monitoring
 */
export interface QueueMetrics {
  readonly sessionId: string
  readonly timestamp: Date

  // Task counts by status
  readonly totalTasks: number
  readonly pendingTasks: number
  readonly runningTasks: number
  readonly completedTasks: number
  readonly failedTasks: number
  readonly cancelledTasks: number

  // Performance metrics
  readonly successRate: number // 0.0 to 1.0
  readonly averageProcessingTime: number // milliseconds
  readonly throughputPerMinute: number // tasks per minute

  // Resource group breakdown
  readonly resourceGroupStats: Record<ResourceGroup, ResourceGroupStats>

  // System resources
  readonly memoryUsageMb: number
  readonly queueDepth: number
}

/**
 * Per-resource-group statistics
 */
export interface ResourceGroupStats {
  readonly totalTasks: number
  readonly completedTasks: number
  readonly failedTasks: number
  readonly runningTasks: number
  readonly averageProcessingTime: number
  readonly circuitBreakerState: CircuitBreakerState
  readonly lastActivity: Date
}

/**
 * Process heartbeat information for crash detection
 */
export interface ProcessHeartbeat {
  readonly processId: number
  readonly sessionId: string
  readonly timestamp: Date
  readonly memoryUsedMb: number
  readonly memoryTotalMb: number
  readonly uptimeSeconds: number
  readonly tasksProcessed: number
  readonly tasksFailed: number
  readonly consecutiveFailures: number
  readonly memoryLeakDetected: boolean
  readonly gcTriggered: boolean
  readonly circuitBreakerOpen: boolean
}

/**
 * Circuit breaker configuration and state
 */
export interface CircuitBreakerInfo {
  readonly resourceGroup: ResourceGroup
  readonly sessionId: string
  readonly state: CircuitBreakerState
  readonly failureCount: number
  readonly successCount: number
  readonly lastFailureTime: Option.Option<Date>
  readonly lastSuccessTime: Option.Option<Date>
  readonly stateChangedAt: Date
  readonly failureThreshold: number
  readonly recoveryTimeoutMs: number
  readonly totalRequests: number
  readonly totalFailures: number
  readonly failureRate: number
}

/**
 * Queue session information
 */
export interface QueueSession {
  readonly sessionId: string
  readonly createdAt: Date
  readonly startedAt: Option.Option<Date>
  readonly lastActivity: Option.Option<Date>
  readonly endedAt: Option.Option<Date>
  readonly commandLine: Option.Option<string>
  readonly workingDirectory: Option.Option<string>
  readonly processId: Option.Option<number>
  readonly totalTasks: number
  readonly completedTasks: number
  readonly failedTasks: number
  readonly status: SessionStatus
}

/**
 * Session lifecycle status
 */
export type SessionStatus =
  | "active" // Currently processing tasks
  | "completed" // All tasks finished successfully
  | "cancelled" // Manually terminated
  | "crashed" // Unexpected termination

// ============================================================================
// ERROR TYPES
// ============================================================================

export class QueueError extends Error {
  readonly _tag = "QueueError"
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
  }
}

export class PersistenceError extends Error {
  readonly _tag = "PersistenceError"
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
  }
}

export class CircuitBreakerError extends Error {
  readonly _tag = "CircuitBreakerError"
  constructor(
    message: string,
    public readonly resourceGroup: ResourceGroup,
    public readonly cause?: unknown
  ) {
    super(message)
  }
}

export class TaskTimeoutError extends Error {
  readonly _tag = "TaskTimeoutError"
  constructor(
    message: string,
    public readonly taskId: string,
    public readonly timeout: Duration,
    public readonly cause?: unknown
  ) {
    super(message)
  }
}

export class ThrottleError extends Error {
  readonly _tag = "ThrottleError"
  constructor(
    message: string,
    public readonly resourceGroup: ResourceGroup,
    public readonly currentLimit: number,
    public readonly cause?: unknown
  ) {
    super(message)
  }
}

// ============================================================================
// SERVICE INTERFACE TAGS
// ============================================================================

/**
 * Queue persistence service for SQLite operations
 */
export interface QueuePersistence {
  readonly persistTask: <A, E>(task: PersistedQueueTask<A, E>) => Effect.Effect<void, PersistenceError>
  readonly updateTaskStatus: (
    taskId: string,
    status: TaskStatus,
    error?: string
  ) => Effect.Effect<void, PersistenceError>
  readonly loadPendingTasks: (sessionId: string) => Effect.Effect<ReadonlyArray<PersistedQueueTask>, PersistenceError>
  readonly clearQueueForNewSession: (sessionId: string) => Effect.Effect<void, PersistenceError>
  readonly recoverFromCrash: (sessionId: string) => Effect.Effect<ReadonlyArray<PersistedQueueTask>, PersistenceError>
  readonly getCurrentSession: () => Effect.Effect<string, never>
  readonly getTaskById: (taskId: string) => Effect.Effect<Option.Option<PersistedQueueTask>, PersistenceError>
  readonly deleteTask: (taskId: string) => Effect.Effect<void, PersistenceError>
  readonly cleanup: () => Effect.Effect<void, never>
}

export const QueuePersistence = GenericTag<QueuePersistence>("@app/QueuePersistence")

/**
 * In-memory queue management service
 */
export interface InternalQueue {
  readonly enqueue: <A, E>(task: QueueTask<A, E>) => Effect.Effect<void, QueueError | PersistenceError>
  readonly getStatus: () => Effect.Effect<QueueStatus, never>
  readonly pauseProcessing: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
  readonly resumeProcessing: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
  readonly cancelTask: (taskId: string) => Effect.Effect<boolean, QueueError | PersistenceError>
  readonly getRunningTasks: () => Effect.Effect<ReadonlyArray<string>, never>
  readonly cleanup: () => Effect.Effect<void, never>
}

export const InternalQueue = GenericTag<InternalQueue>("@app/InternalQueue")

/**
 * Queue status information
 */
export interface QueueStatus {
  readonly queues: Record<ResourceGroup, {
    readonly size: number
    readonly isProcessing: boolean
    readonly lastProcessed: Option.Option<Date>
  }>
  readonly totalPending: number
  readonly totalRunning: number
  readonly processingFibers: ReadonlyArray<Fiber.RuntimeFiber<void, never>>
}

/**
 * Queue monitoring and metrics service
 */
export interface QueueMonitor {
  readonly getQueueStatus: (sessionId?: string) => Effect.Effect<QueueMetrics, PersistenceError>
  readonly recordMetricsSnapshot: (sessionId: string) => Effect.Effect<void, PersistenceError>
  readonly getResourceGroupPerformance: (
    resourceGroup: ResourceGroup,
    sessionId?: string
  ) => Effect.Effect<ResourceGroupStats, PersistenceError>
  readonly exportMetrics: (
    format: "json" | "csv",
    sessionId?: string
  ) => Effect.Effect<string, PersistenceError>
  readonly getProcessHeartbeat: (sessionId: string) => Effect.Effect<Option.Option<ProcessHeartbeat>, PersistenceError>
  readonly updateHeartbeat: (sessionId: string) => Effect.Effect<void, PersistenceError>
}

export const QueueMonitor = GenericTag<QueueMonitor>("@app/QueueMonitor")

/**
 * Circuit breaker service for stability patterns
 */
export interface CircuitBreaker {
  readonly checkState: (resourceGroup: ResourceGroup) => Effect.Effect<CircuitBreakerState, never>
  readonly recordSuccess: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
  readonly recordFailure: (resourceGroup: ResourceGroup, error: unknown) => Effect.Effect<void, never>
  readonly forceOpen: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
  readonly forceClose: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
  readonly getInfo: (resourceGroup: ResourceGroup) => Effect.Effect<CircuitBreakerInfo, PersistenceError>
  readonly resetStats: (resourceGroup: ResourceGroup) => Effect.Effect<void, never>
}

export const CircuitBreaker = GenericTag<CircuitBreaker>("@app/CircuitBreaker")

/**
 * Adaptive throttler for dynamic concurrency control
 */
export interface AdaptiveThrottler {
  readonly throttle: <A, E>(
    resourceGroup: ResourceGroup,
    operation: Effect.Effect<A, E>
  ) => Effect.Effect<A, E | ThrottleError>
  readonly getCurrentLimits: () => Effect.Effect<Record<ResourceGroup, ThrottleLimits>, never>
  readonly getSystemLoad: () => Effect.Effect<SystemLoadMetrics, never>
  readonly cleanup: () => Effect.Effect<void, never>
}

export const AdaptiveThrottler = GenericTag<AdaptiveThrottler>("@app/AdaptiveThrottler")

/**
 * Throttle configuration for each resource group
 */
export interface ThrottleLimits {
  readonly current: number
  readonly min: number
  readonly max: number
}

/**
 * System load metrics for adaptive throttling
 */
export interface SystemLoadMetrics {
  readonly cpu: number // 0.0 to 1.0
  readonly memory: number // 0.0 to 1.0
  readonly queueBacklog: number // number of pending tasks
}

/**
 * Stability monitoring service for comprehensive system health tracking
 */
export interface StabilityMonitor {
  readonly getHeartbeat: () => Effect.Effect<HeartbeatState, never>
  readonly getHealthMetrics: () => Effect.Effect<HealthMetrics, never>
  readonly performHealthCheck: () => Effect.Effect<HealthCheckResult, never>
  readonly cleanup: () => Effect.Effect<void, never>
}

export const StabilityMonitor = GenericTag<StabilityMonitor>("@app/StabilityMonitor")

/**
 * Heartbeat state for system health monitoring
 */
export interface HeartbeatState {
  readonly lastHeartbeat: Date
  readonly consecutiveFailures: number
  readonly isHealthy: boolean
  readonly uptimeStart: Date
}

/**
 * Comprehensive health metrics collection
 */
export interface HealthMetrics {
  readonly database: DatabaseHealth
  readonly queue: QueueHealth
  readonly circuitBreaker: CircuitBreakerState
  readonly systemLoad: SystemLoadMetrics
  readonly memory: MemoryStatus
  readonly timestamp: Date
}

/**
 * Database health status
 */
export interface DatabaseHealth {
  readonly connected: boolean
  readonly schemaValid: boolean
  readonly responseTime: number | null
  readonly error?: string
}

/**
 * Queue processing health status
 */
export interface QueueHealth {
  readonly pendingCount: number
  readonly runningCount: number
  readonly stuckTasksCount: number
  readonly isProcessing: boolean
  readonly avgProcessingTime: number
}

/**
 * Memory usage status and warnings
 */
export interface MemoryStatus {
  readonly rss: number
  readonly heapUsed: number
  readonly heapTotal: number
  readonly external: number
  readonly warnings: MemoryWarnings
}

/**
 * Memory usage warning flags
 */
export interface MemoryWarnings {
  readonly highRSS: boolean
  readonly highHeap: boolean
  readonly highExternal: boolean
}

/**
 * Complete health check result with metrics and health status
 */
export interface HealthCheckResult {
  readonly metrics: HealthMetrics
  readonly isHealthy: boolean
}

/**
 * Session management service
 */
export interface SessionManager {
  readonly createSession: () => Effect.Effect<string, never>
  readonly getCurrentSession: () => Effect.Effect<QueueSession, PersistenceError>
  readonly endSession: (sessionId: string, status: SessionStatus) => Effect.Effect<void, PersistenceError>
  readonly getSessionHistory: (limit?: number) => Effect.Effect<ReadonlyArray<QueueSession>, PersistenceError>
  readonly cleanupOldSessions: (olderThanDays: number) => Effect.Effect<number, PersistenceError>
}

export const SessionManager = GenericTag<SessionManager>("@app/SessionManager")

// ============================================================================
// UTILITY TYPES AND FUNCTIONS
// ============================================================================

/**
 * Task factory function type
 */
export type TaskFactory<A, E> = (
  type: OperationType,
  resourceGroup: ResourceGroup,
  operation: Effect.Effect<A, E>,
  options?: Partial<TaskOptions>
) => QueueTask<A, E>

/**
 * Task creation options
 */
export interface TaskOptions {
  readonly priority: number
  readonly maxRetries: number
  readonly estimatedDuration: Duration
  readonly filePath: string
  readonly operationData: Record<string, unknown>
}

/**
 * Queue system configuration
 */
export interface QueueConfig {
  readonly databasePath: string
  readonly maxQueueSize: number
  readonly heartbeatIntervalMs: number
  readonly circuitBreakerConfig: {
    readonly failureThreshold: number
    readonly recoveryTimeoutMs: number
    readonly successThreshold: number
  }
  readonly retentionPolicy: {
    readonly completedTasksRetentionDays: number
    readonly heartbeatRetentionDays: number
    readonly metricsRetentionDays: number
  }
}

/**
 * Default configuration values
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  databasePath: ".effect-cli/queue.db",
  maxQueueSize: 1000,
  heartbeatIntervalMs: 5000,
  circuitBreakerConfig: {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000,
    successThreshold: 3
  },
  retentionPolicy: {
    completedTasksRetentionDays: 7,
    heartbeatRetentionDays: 1,
    metricsRetentionDays: 30
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique task ID
 */
export const generateTaskId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `task_${timestamp}_${random}`
}

/**
 * Generate unique session ID
 */
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `session_${timestamp}_${random}`
}

/**
 * Check if task is in terminal state
 */
export const isTerminalStatus = (status: TaskStatus): boolean => {
  return status === "completed" || status === "failed" || status === "cancelled"
}

/**
 * Calculate task priority score (lower number = higher priority)
 */
export const calculatePriorityScore = (
  priority: number,
  createdAt: Date,
  retryCount: number
): number => {
  const age = Date.now() - createdAt.getTime()
  const ageMinutes = age / (1000 * 60)
  const retryPenalty = retryCount * 0.5

  return priority + (ageMinutes * 0.01) + retryPenalty
}

/**
 * Convert Duration to milliseconds for database storage
 */
export const durationToMs = (duration: Duration): number => {
  return toMillis(duration)
}

/**
 * Convert milliseconds to Duration
 */
export const msToDuration = (ms: number): Duration => {
  return millis(ms)
}

/**
 * Type guard for checking if error is QueueError
 */
export const isQueueError = (error: unknown): error is QueueError => {
  return error instanceof Error && "_tag" in error && error._tag === "QueueError"
}

/**
 * Type guard for checking if error is PersistenceError
 */
export const isPersistenceError = (error: unknown): error is PersistenceError => {
  return error instanceof Error && "_tag" in error && error._tag === "PersistenceError"
}

/**
 * Type guard for checking if error is CircuitBreakerError
 */
export const isCircuitBreakerError = (error: unknown): error is CircuitBreakerError => {
  return error instanceof Error && "_tag" in error && error._tag === "CircuitBreakerError"
}

/**
 * Type guard for checking if error is ThrottleError
 */
export const isThrottleError = (error: unknown): error is ThrottleError => {
  return error instanceof Error && "_tag" in error && error._tag === "ThrottleError"
}
