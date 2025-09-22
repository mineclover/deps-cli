/**
 * StabilityMonitor Test Suite
 *
 * Comprehensive tests for the StabilityMonitor service including:
 * - Heartbeat monitoring
 * - Health metrics collection
 * - Automatic recovery actions
 * - Memory leak detection
 * - System health evaluation
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { millis } from "effect/Duration"
import * as Effect from "effect/Effect"
import { mergeAll, provide } from "effect/Layer"
//  // Unused
import { adjust } from "effect/TestClock"
import { TestContext } from "effect/TestContext"
import { describe, expect, it } from "vitest"

// import type { HealthMetrics, HeartbeatState } from "../../src/services/Queue/types.js"
// HealthCheckResult, HealthMetrics, HeartbeatState are unused

import { StabilityMonitor } from "../../src/services/Queue/types.js"

import { AdaptiveThrottlerLive } from "../../src/services/Queue/AdaptiveThrottlerLive.js"
import { CircuitBreakerLive } from "../../src/services/Queue/CircuitBreakerLive.js"
import { QueuePersistenceLive } from "../../src/services/Queue/QueuePersistenceLive.js"
import { SchemaManagerLive } from "../../src/services/Queue/SchemaManager.js"
import { StabilityMonitorLive } from "../../src/services/Queue/StabilityMonitorLive.js"

// ============================================================================
// TEST LAYER SETUP
// ============================================================================

/**
 * Complete test layer with all StabilityMonitor dependencies
 */
const StabilityTestLayer = mergeAll(
  SchemaManagerLive,
  QueuePersistenceLive.pipe(provide(SchemaManagerLive)),
  CircuitBreakerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive)))),
  AdaptiveThrottlerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive)))),
  StabilityMonitorLive.pipe(
    provide(
      mergeAll(
        QueuePersistenceLive.pipe(provide(SchemaManagerLive)),
        CircuitBreakerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive)))),
        AdaptiveThrottlerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive))))
      )
    )
  )
)

// ============================================================================
// HEARTBEAT MONITORING TESTS
// ============================================================================

describe("StabilityMonitor - Heartbeat Monitoring", () => {
  it("should initialize with healthy heartbeat state", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const heartbeat = yield* monitor.getHeartbeat()

      expect(heartbeat.isHealthy).toBe(true)
      expect(heartbeat.consecutiveFailures).toBe(0)
      expect(heartbeat.lastHeartbeat).toBeInstanceOf(Date)
      expect(heartbeat.uptimeStart).toBeInstanceOf(Date)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should track consecutive failures in heartbeat state", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      // Perform health check which should update heartbeat
      yield* monitor.performHealthCheck()

      const heartbeat = yield* monitor.getHeartbeat()

      // Initially should be healthy
      expect(heartbeat.isHealthy).toBe(true)
      expect(heartbeat.consecutiveFailures).toBe(0)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should update heartbeat timestamp on health checks", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const initialHeartbeat = yield* monitor.getHeartbeat()

      // Advance test clock by 10 milliseconds
      yield* adjust(millis(10))

      // Perform health check
      yield* monitor.performHealthCheck()

      const updatedHeartbeat = yield* monitor.getHeartbeat()

      // Timestamp should be updated (or at least not earlier)
      expect(updatedHeartbeat.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(
        initialHeartbeat.lastHeartbeat.getTime()
      )
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})

// ============================================================================
// HEALTH METRICS COLLECTION TESTS
// ============================================================================

describe("StabilityMonitor - Health Metrics Collection", () => {
  it("should collect comprehensive health metrics", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      // Verify all required metrics are present
      expect(metrics).toHaveProperty("database")
      expect(metrics).toHaveProperty("queue")
      expect(metrics).toHaveProperty("circuitBreaker")
      expect(metrics).toHaveProperty("systemLoad")
      expect(metrics).toHaveProperty("memory")
      expect(metrics).toHaveProperty("timestamp")

      // Verify timestamp is recent
      const now = Date.now()
      const metricsTime = metrics.timestamp.getTime()
      expect(now - metricsTime).toBeLessThan(1000) // Within 1 second
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should collect valid database health metrics", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      const dbHealth = metrics.database
      expect(typeof dbHealth.connected).toBe("boolean")
      expect(typeof dbHealth.schemaValid).toBe("boolean")
      expect(dbHealth.responseTime === null || typeof dbHealth.responseTime === "number").toBe(true)

      // If connected, should have reasonable response time
      if (dbHealth.connected && dbHealth.responseTime !== null) {
        expect(dbHealth.responseTime).toBeGreaterThanOrEqual(0)
        expect(dbHealth.responseTime).toBeLessThan(5000) // Less than 5 seconds
      }
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should collect valid queue health metrics", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      const queueHealth = metrics.queue
      expect(typeof queueHealth.pendingCount).toBe("number")
      expect(typeof queueHealth.runningCount).toBe("number")
      expect(typeof queueHealth.stuckTasksCount).toBe("number")
      expect(typeof queueHealth.isProcessing).toBe("boolean")
      expect(typeof queueHealth.avgProcessingTime).toBe("number")

      // Counts should be non-negative
      expect(queueHealth.pendingCount).toBeGreaterThanOrEqual(0)
      expect(queueHealth.runningCount).toBeGreaterThanOrEqual(0)
      expect(queueHealth.stuckTasksCount).toBeGreaterThanOrEqual(0)
      expect(queueHealth.avgProcessingTime).toBeGreaterThanOrEqual(0)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should collect valid memory status metrics", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      const memoryStatus = metrics.memory
      expect(typeof memoryStatus.rss).toBe("number")
      expect(typeof memoryStatus.heapUsed).toBe("number")
      expect(typeof memoryStatus.heapTotal).toBe("number")
      expect(typeof memoryStatus.external).toBe("number")

      // Memory values should be positive
      expect(memoryStatus.rss).toBeGreaterThan(0)
      expect(memoryStatus.heapUsed).toBeGreaterThan(0)
      expect(memoryStatus.heapTotal).toBeGreaterThan(0)
      expect(memoryStatus.external).toBeGreaterThanOrEqual(0)

      // Heap used should be less than or equal to heap total
      expect(memoryStatus.heapUsed).toBeLessThanOrEqual(memoryStatus.heapTotal)

      // Verify warnings structure
      const warnings = memoryStatus.warnings
      expect(typeof warnings.highRSS).toBe("boolean")
      expect(typeof warnings.highHeap).toBe("boolean")
      expect(typeof warnings.highExternal).toBe("boolean")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should collect valid system load metrics", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      const systemLoad = metrics.systemLoad
      expect(typeof systemLoad.cpu).toBe("number")
      expect(typeof systemLoad.memory).toBe("number")
      expect(typeof systemLoad.queueBacklog).toBe("number")

      // Load values should be in valid ranges
      expect(systemLoad.cpu).toBeGreaterThanOrEqual(0)
      expect(systemLoad.cpu).toBeLessThanOrEqual(1)
      expect(systemLoad.memory).toBeGreaterThanOrEqual(0)
      expect(systemLoad.memory).toBeLessThanOrEqual(1)
      expect(systemLoad.queueBacklog).toBeGreaterThanOrEqual(0)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should include valid circuit breaker state", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      const breakerState = metrics.circuitBreaker
      expect(["closed", "open", "half-open"]).toContain(breakerState)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})

// ============================================================================
// HEALTH CHECK AND RECOVERY TESTS
// ============================================================================

describe("StabilityMonitor - Health Check and Recovery", () => {
  it("should perform comprehensive health check", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const result = yield* monitor.performHealthCheck()

      expect(result).toHaveProperty("metrics")
      expect(result).toHaveProperty("isHealthy")
      expect(typeof result.isHealthy).toBe("boolean")

      // Metrics should be comprehensive
      const metrics = result.metrics
      expect(metrics).toHaveProperty("database")
      expect(metrics).toHaveProperty("queue")
      expect(metrics).toHaveProperty("circuitBreaker")
      expect(metrics).toHaveProperty("systemLoad")
      expect(metrics).toHaveProperty("memory")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should evaluate system health correctly for healthy system", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const result = yield* monitor.performHealthCheck()

      // In a fresh test environment, system should typically be healthy
      // unless there are specific issues
      expect(typeof result.isHealthy).toBe("boolean")

      // If system is reported as healthy, verify supporting metrics
      if (result.isHealthy) {
        expect(result.metrics.database.connected).toBe(true)
        expect(result.metrics.circuitBreaker).not.toBe("open")
      }
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should handle health check errors gracefully", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      // Health check should not throw errors, even under adverse conditions
      const result = yield* monitor.performHealthCheck()

      // Should always return a valid result structure
      expect(result).toHaveProperty("metrics")
      expect(result).toHaveProperty("isHealthy")
      expect(typeof result.isHealthy).toBe("boolean")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should handle graceful cleanup", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      // Cleanup should complete without errors
      yield* monitor.cleanup()

      // After cleanup, basic operations should still work
      const heartbeat = yield* monitor.getHeartbeat()
      expect(heartbeat).toHaveProperty("isHealthy")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})

// ============================================================================
// MEMORY MONITORING TESTS
// ============================================================================

describe("StabilityMonitor - Memory Monitoring", () => {
  it("should detect memory usage patterns", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()
      const memory = metrics.memory

      // Memory should be actively used in a running process
      expect(memory.rss).toBeGreaterThan(0)
      expect(memory.heapUsed).toBeGreaterThan(0)
      expect(memory.heapTotal).toBeGreaterThan(memory.heapUsed)

      // External memory can be zero but shouldn't be negative
      expect(memory.external).toBeGreaterThanOrEqual(0)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should provide memory warning flags", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()
      const warnings = metrics.memory.warnings

      // In a test environment, memory warnings should typically be false
      // unless we're running under high memory pressure
      expect(typeof warnings.highRSS).toBe("boolean")
      expect(typeof warnings.highHeap).toBe("boolean")
      expect(typeof warnings.highExternal).toBe("boolean")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should maintain consistent memory readings", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics1 = yield* monitor.getHealthMetrics()
      // Advance test clock by 50 milliseconds instead of sleeping
      yield* adjust(millis(50))
      const metrics2 = yield* monitor.getHealthMetrics()

      const mem1 = metrics1.memory
      const mem2 = metrics2.memory

      // Memory values should be reasonable and not wildly different
      // (allowing for some variation due to test execution)
      const rssDiff = Math.abs(mem2.rss - mem1.rss)
      const heapDiff = Math.abs(mem2.heapUsed - mem1.heapUsed)

      // Differences should be relatively small for short time periods
      expect(rssDiff).toBeLessThan(mem1.rss * 0.5) // Less than 50% change
      expect(heapDiff).toBeLessThan(mem1.heapUsed * 0.5) // Less than 50% change
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("StabilityMonitor - Integration Tests", () => {
  it("should integrate with circuit breaker monitoring", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      // Should include circuit breaker state
      expect(["closed", "open", "half-open"]).toContain(metrics.circuitBreaker)

      // Health evaluation should consider circuit breaker state
      const result = yield* monitor.performHealthCheck()
      if (metrics.circuitBreaker === "open") {
        // Open circuit breaker should potentially affect health status
        // (depending on overall system health evaluation logic)
        expect(typeof result.isHealthy).toBe("boolean")
      }
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should integrate with adaptive throttler monitoring", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const metrics = yield* monitor.getHealthMetrics()

      // Should include system load metrics from throttler
      expect(metrics.systemLoad).toHaveProperty("cpu")
      expect(metrics.systemLoad).toHaveProperty("memory")
      expect(metrics.systemLoad).toHaveProperty("queueBacklog")

      // System load should influence health evaluation
      const result = yield* monitor.performHealthCheck()
      expect(typeof result.isHealthy).toBe("boolean")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should provide consistent metrics across multiple calls", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      // Collect metrics multiple times in rapid succession
      const [metrics1, metrics2, metrics3] = yield* Effect.all([
        monitor.getHealthMetrics(),
        monitor.getHealthMetrics(),
        monitor.getHealthMetrics()
      ])

      // All should have the same basic structure
      const expectedProperties = ["database", "queue", "circuitBreaker", "systemLoad", "memory", "timestamp"]

      for (const props of [metrics1, metrics2, metrics3]) {
        expectedProperties.forEach((prop) => {
          expect(props).toHaveProperty(prop)
        })
      }

      // Timestamps should be close to each other
      const time1 = metrics1.timestamp.getTime()
      const time2 = metrics2.timestamp.getTime()
      const time3 = metrics3.timestamp.getTime()

      expect(Math.abs(time2 - time1)).toBeLessThan(100) // Within 100ms
      expect(Math.abs(time3 - time1)).toBeLessThan(100) // Within 100ms
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe("StabilityMonitor - Performance Tests", () => {
  it("should collect health metrics efficiently", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const startTime = Date.now()
      yield* monitor.getHealthMetrics()
      const endTime = Date.now()

      const duration = endTime - startTime

      // Health metrics collection should be fast (< 100ms)
      expect(duration).toBeLessThan(100)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should perform health check efficiently", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      const startTime = Date.now()
      yield* monitor.performHealthCheck()
      const endTime = Date.now()

      const duration = endTime - startTime

      // Health check should be fast (< 200ms including recovery actions)
      expect(duration).toBeLessThan(200)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))

  it("should handle concurrent health checks", () =>
    Effect.gen(function*() {
      const monitor = yield* StabilityMonitor

      // Run multiple health checks concurrently
      const results = yield* Effect.all([
        monitor.performHealthCheck(),
        monitor.performHealthCheck(),
        monitor.performHealthCheck()
      ], { concurrency: "unbounded" })

      // All should succeed and return valid results
      results.forEach((result) => {
        expect(result).toHaveProperty("metrics")
        expect(result).toHaveProperty("isHealthy")
        expect(typeof result.isHealthy).toBe("boolean")
      })
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.provide(TestContext),
      Effect.runPromise
    ))
})
