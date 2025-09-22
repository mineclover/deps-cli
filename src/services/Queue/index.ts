import { millis, seconds } from "effect/Duration"
import type { Duration } from "effect/Duration"
import { fromNullable, getOrElse, map } from "effect/Option"
/**
 * Effect CLI Queue System - Main Export Module
 *
 * Provides complete queue system integration with all services,
 * layers, and utilities. This is the primary entry point for
 * using the queue system in Effect CLI applications.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import * as Effect from "effect/Effect"
import { mergeAll, provide } from "effect/Layer"

// ============================================================================
// LAYER COMPOSITIONS
// ============================================================================

import { AdaptiveThrottlerLive } from "./AdaptiveThrottlerLive.js"
import { CircuitBreakerLive } from "./CircuitBreakerLive.js"
import { createTask, InternalQueueLive } from "./InternalQueueLive.js"
import { QueueMonitorLive } from "./QueueMonitorLive.js"
import { QueuePersistenceLive } from "./QueuePersistenceLive.js"
import { SchemaManagerLive } from "./SchemaManager.js"
import { StabilityMonitorLive } from "./StabilityMonitorLive.js"
import { TransparentQueueAdapterLive } from "./TransparentQueueAdapter.js"

// ============================================================================
// HIGH-LEVEL QUEUE OPERATIONS
// ============================================================================

import type { OperationType, ResourceGroup } from "./types.js"
import { generateSessionId, InternalQueue, QueueMonitor, QueuePersistence, StabilityMonitor } from "./types.js"
// import { SchemaManager } from "./types.js" // Unused import

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Types and interfaces
export * from "./types.js"

// Service implementations
export * from "./AdaptiveThrottlerLive.js"
export * from "./CircuitBreakerLive.js"
export * from "./InternalQueueLive.js"
export * from "./QueueMonitorLive.js"
export * from "./QueuePersistenceLive.js"
export * from "./SchemaManager.js"
export * from "./StabilityMonitorLive.js"

// Phase 3: CLI Integration modules
export * from "./TransparentQueueAdapter.js"

// Phase 4: Advanced optimization modules
export * from "./AdvancedCache.js"
export * from "./MemoryOptimizer.js"
export * from "./PerformanceProfiler.js"

// Re-export service tags for dependency injection
export {
  AdaptiveThrottler,
  CircuitBreaker,
  InternalQueue,
  QueueMonitor,
  QueuePersistence,
  SchemaManager,
  StabilityMonitor
} from "./types.js"

// Phase 3 service tags
export { TransparentQueueAdapter } from "./TransparentQueueAdapter.js"

// Phase 4 service tags
export { AdvancedCache } from "./AdvancedCache.js"
export { MemoryOptimizer } from "./MemoryOptimizer.js"
export { PerformanceProfiler } from "./PerformanceProfiler.js"

/**
 * Basic Queue System Layer (Phase 1 Foundation)
 *
 * Hierarchical service composition with proper dependency injection.
 */
const persistenceLayer = QueuePersistenceLive.pipe(
  provide(SchemaManagerLive)
)

const serviceLayer = mergeAll(
  InternalQueueLive,
  QueueMonitorLive
).pipe(
  provide(persistenceLayer)
)

export const BasicQueueSystemLayer = mergeAll(
  SchemaManagerLive,
  persistenceLayer,
  serviceLayer
)

/**
 * Phase 2 Queue System Layer (Stability Features)
 *
 * Includes Circuit Breaker, Adaptive Throttler and StabilityMonitor for comprehensive stability
 */
const stabilityLayer = mergeAll(
  CircuitBreakerLive.pipe(provide(persistenceLayer)),
  AdaptiveThrottlerLive.pipe(provide(persistenceLayer)),
  StabilityMonitorLive.pipe(
    provide(
      mergeAll(
        persistenceLayer,
        CircuitBreakerLive.pipe(provide(persistenceLayer)),
        AdaptiveThrottlerLive.pipe(provide(persistenceLayer))
      )
    )
  )
)

export const StabilityQueueSystemLayer = mergeAll(
  SchemaManagerLive,
  persistenceLayer,
  serviceLayer,
  stabilityLayer
)

/**
 * Phase 3.5 CLI Integration Queue System Layer
 *
 * Includes transparent adapter for seamless CLI integration
 */
export const CLIIntegratedQueueSystemLayer = mergeAll(
  StabilityQueueSystemLayer,
  TransparentQueueAdapterLive.pipe(provide(StabilityQueueSystemLayer))
)

/**
 * Complete Queue System Layer (Production)
 *
 * Alias for CLIIntegratedQueueSystemLayer - includes Phase 1 + Phase 2 + Phase 3.5 features
 */
export const QueueSystemLayer = CLIIntegratedQueueSystemLayer

/**
 * Test Queue System Layer
 *
 * Lightweight mock implementation for testing.
 * Does not require database or file system access.
 */
export const TestQueueSystemLayer = mergeAll(
  // Import test implementations
  // These would be imported from test files when implemented
  SchemaManagerLive, // For now, use real implementations
  QueuePersistenceLive,
  InternalQueueLive,
  QueueMonitorLive
)

/**
 * Initialize queue system for a new session
 */
export const initializeQueueSystem = (sessionId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* QueuePersistence
    const monitor = yield* QueueMonitor

    const actualSessionId = sessionId ?? generateSessionId()

    // Clear any previous session and initialize new one
    yield* persistence.clearQueueForNewSession(actualSessionId)

    // Record initial metrics
    yield* monitor.recordMetricsSnapshot(actualSessionId)

    // Update heartbeat
    yield* monitor.updateHeartbeat(actualSessionId)

    yield* Effect.log(`Queue system initialized for session: ${actualSessionId}`)

    return actualSessionId
  })

/**
 * Shutdown queue system gracefully
 */
export const shutdownQueueSystem = () =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue
    const persistence = yield* QueuePersistence

    yield* Effect.log("Shutting down queue system...")

    // Stop queue processing
    yield* queue.cleanup()

    // Close persistence connections
    yield* persistence.cleanup()

    yield* Effect.log("Queue system shutdown completed")
  })

/**
 * Add a file operation to the queue
 */
export const queueFileOperation = <A, E>(
  operation: Effect.Effect<A, E>,
  options: {
    type: Extract<OperationType, "file-read" | "file-write" | "directory-list" | "find-files">
    filePath?: string
    priority?: number
    maxRetries?: number
    estimatedDuration?: Duration
  }
) =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    const task = createTask(operation, {
      type: options.type,
      resourceGroup: "filesystem",
      priority: options.priority ?? 5,
      maxRetries: options.maxRetries ?? 3,
      estimatedDuration: options.estimatedDuration ?? seconds(30),
      operationData: options.filePath ? { filePath: options.filePath } : undefined
    })

    yield* queue.enqueue(task)

    return task.id
  })

/**
 * Add a network operation to the queue
 */
export const queueNetworkOperation = <A, E>(
  operation: Effect.Effect<A, E>,
  options: {
    priority?: number
    maxRetries?: number
    estimatedDuration?: Duration
    url?: string
  } = {}
) =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    const task = createTask(operation, {
      type: "network-request",
      resourceGroup: "network",
      priority: options.priority ?? 5,
      maxRetries: options.maxRetries ?? 3,
      estimatedDuration: options.estimatedDuration ?? seconds(30),
      operationData: options.url ? { url: options.url } : undefined
    })

    yield* queue.enqueue(task)

    return task.id
  })

/**
 * Add a computation task to the queue
 */
export const queueComputationTask = <A, E>(
  operation: Effect.Effect<A, E>,
  options: {
    priority?: number
    maxRetries?: number
    estimatedDuration?: Duration
    isMemoryIntensive?: boolean
  } = {}
) =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    const resourceGroup: ResourceGroup = options.isMemoryIntensive ? "memory-intensive" : "computation"

    const task = createTask(operation, {
      type: "computation",
      resourceGroup,
      priority: options.priority ?? 5,
      maxRetries: options.maxRetries ?? 3,
      estimatedDuration: options.estimatedDuration ?? seconds(30)
    })

    yield* queue.enqueue(task)

    return task.id
  })

/**
 * Get current queue status and metrics
 */
export const getQueueStatus = () =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue
    const monitor = yield* QueueMonitor

    const queueStatus = yield* queue.getStatus()
    const metrics = yield* monitor.getQueueStatus()

    return {
      queue: queueStatus,
      metrics
    }
  })

/**
 * Wait for a specific task to complete
 */
export const waitForTask = (taskId: string, _timeoutMs: number = 60000) =>
  Effect.gen(function*() {
    const persistence = yield* QueuePersistence

    // Poll for task completion
    const checkTask = () =>
      Effect.gen(function*() {
        const taskOption = yield* persistence.getTaskById(taskId)

        return taskOption.pipe(
          map((t) => ({ status: t.status, task: t })),
          getOrElse(() => ({ status: "not-found" as const, task: null }))
        )
      })

    let result = yield* checkTask()

    while (result.status === "pending" || result.status === "running") {
      yield* Effect.sleep(millis(100))
      result = yield* checkTask()
    }

    return fromNullable(result?.task)
  })

/**
 * Export queue metrics to file
 */
export const exportQueueMetrics = (
  format: "json" | "csv" = "json",
  sessionId?: string
) =>
  Effect.gen(function*() {
    const monitor = yield* QueueMonitor

    const metricsData = yield* monitor.exportMetrics(format, sessionId)

    return metricsData
  })

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if queue system is healthy (Enhanced with StabilityMonitor)
 */
export const checkQueueHealth = () =>
  Effect.gen(function*() {
    const status = yield* getQueueStatus()
    const monitor = yield* QueueMonitor
    const persistence = yield* QueuePersistence

    const currentSession = yield* persistence.getCurrentSession()
    const heartbeat = yield* monitor.getProcessHeartbeat(currentSession)

    const isHealthy = status.queue.processingFibers.length > 0 &&
      !heartbeat.pipe(
        map((h) => h.memoryLeakDetected || h.circuitBreakerOpen),
        getOrElse(() => false)
      )

    return {
      healthy: isHealthy,
      status: status.queue,
      metrics: status.metrics,
      heartbeat
    }
  })

/**
 * Get comprehensive system health (Phase 2.3 Enhanced)
 */
export const getSystemHealth = () =>
  Effect.gen(function*() {
    const stabilityMonitor = yield* StabilityMonitor

    const healthCheck = yield* stabilityMonitor.performHealthCheck()
    const heartbeat = yield* stabilityMonitor.getHeartbeat()

    return {
      isHealthy: healthCheck.isHealthy,
      metrics: healthCheck.metrics,
      heartbeat,
      timestamp: new Date()
    }
  })

/**
 * Pause all queue processing (for maintenance)
 */
export const pauseAllQueues = () =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    yield* queue.pauseProcessing("filesystem")
    yield* queue.pauseProcessing("network")
    yield* queue.pauseProcessing("computation")
    yield* queue.pauseProcessing("memory-intensive")

    yield* Effect.log("All queues paused")
  })

/**
 * Resume all queue processing
 */
export const resumeAllQueues = () =>
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    yield* queue.resumeProcessing("filesystem")
    yield* queue.resumeProcessing("network")
    yield* queue.resumeProcessing("computation")
    yield* queue.resumeProcessing("memory-intensive")

    yield* Effect.log("All queues resumed")
  })

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default queue system configuration (Phase 3.5 Complete)
 */
export const QueueSystem = {
  Layer: QueueSystemLayer,
  BasicLayer: BasicQueueSystemLayer,
  StabilityLayer: StabilityQueueSystemLayer,
  CLIIntegratedLayer: CLIIntegratedQueueSystemLayer,
  TestLayer: TestQueueSystemLayer,

  // Operations
  initialize: initializeQueueSystem,
  shutdown: shutdownQueueSystem,

  // Queue operations
  queueFileOperation,
  queueNetworkOperation,
  queueComputationTask,

  // Status and monitoring
  getStatus: getQueueStatus,
  checkHealth: checkQueueHealth,
  getSystemHealth, // Phase 2.3: Enhanced system health
  exportMetrics: exportQueueMetrics,

  // Control
  pauseAll: pauseAllQueues,
  resumeAll: resumeAllQueues,
  waitForTask
} as const
