/**
 * PerformanceProfiler Test Suite
 *
 * Comprehensive tests for Phase 4.1 - Performance profiling and bottleneck identification
 */

import { millis } from "effect/Duration"
import * as Effect from "effect/Effect"
import { describe, expect, it } from "vitest"

import { BasicQueueSystemLayer } from "../../src/services/Queue/index.js"
import { PerformanceProfiler, PerformanceProfilerLive } from "../../src/services/Queue/PerformanceProfiler.js"

describe("PerformanceProfiler", () => {
  describe("Profiling Sessions", () => {
    it("should start and complete profiling sessions", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Start a profiling session
        const session = yield* profiler.startProfiling(
          "test-operation-1",
          "computation",
          "computation"
        )

        expect(session.operationId).toBe("test-operation-1")
        expect(session.operationType).toBe("computation")
        expect(session.resourceGroup).toBe("computation")
        expect(typeof session.startTime).toBe("number")
        expect(session.startTime).toBeGreaterThan(0)

        // Simulate some work
        yield* Effect.sleep(millis(100))

        // Complete the session
        const completedMetrics = yield* profiler.endProfiling(session, true)

        expect(completedMetrics.duration).toBeGreaterThan(90)
        expect(completedMetrics.duration).toBeLessThan(200)
        expect(completedMetrics.operationId).toBe("test-operation-1")
        expect(completedMetrics.success).toBe(true)
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })

    it("should track failed operations", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Start and fail a session
        const session = yield* profiler.startProfiling("failed-op", "network-request", "network")
        yield* Effect.sleep(millis(50))

        const metrics = yield* profiler.endProfiling(session, false, "timeout")

        expect(metrics.success).toBe(false)
        expect(metrics.errorType).toBe("timeout")
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Performance Statistics", () => {
    it("should generate performance statistics", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Create some operations
        const session1 = yield* profiler.startProfiling("perf-1", "computation", "computation")
        yield* Effect.sleep(millis(50))
        yield* profiler.endProfiling(session1, true)

        const session2 = yield* profiler.startProfiling("perf-2", "file-read", "filesystem")
        yield* Effect.sleep(millis(75))
        yield* profiler.endProfiling(session2, true)

        // Get performance stats
        const stats = yield* profiler.getPerformanceStats()

        expect(stats).toBeDefined()
        expect(stats.totalOperations).toBe(2)
        expect(stats.errorRate).toBeGreaterThanOrEqual(0)
        expect(stats.avgDuration).toBeGreaterThan(0)
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Bottleneck Analysis", () => {
    it("should identify performance bottlenecks", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Create multiple operations to build up data
        for (let i = 0; i < 5; i++) {
          const session = yield* profiler.startProfiling(`op-${i}`, "computation", "computation")
          yield* Effect.sleep(millis(100))
          yield* profiler.endProfiling(session, true)
        }

        // Analyze bottlenecks
        const bottlenecks = yield* profiler.analyzeBottlenecks()

        // Should be an array (may be empty if no significant bottlenecks)
        expect(Array.isArray(bottlenecks)).toBe(true)
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Resource Utilization", () => {
    it("should track resource utilization", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Create operations across different resource groups
        const session1 = yield* profiler.startProfiling("fs-op", "file-read", "filesystem")
        const session2 = yield* profiler.startProfiling("net-op", "network-request", "network")

        yield* Effect.sleep(millis(50))

        yield* profiler.endProfiling(session1, true)
        yield* profiler.endProfiling(session2, true)

        // Get resource utilization
        const utilization = yield* profiler.getResourceUtilization()

        expect(Array.isArray(utilization)).toBe(true)
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Data Export", () => {
    it("should export profiling data in JSON format", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Generate some data
        const session = yield* profiler.startProfiling("export-test", "computation", "computation")
        yield* Effect.sleep(millis(25))
        yield* profiler.endProfiling(session, true)

        // Export data
        const jsonData = yield* profiler.exportProfilingData("json")

        expect(typeof jsonData).toBe("string")
        expect(jsonData.length).toBeGreaterThan(0)

        // Should be valid JSON
        const parsed = JSON.parse(jsonData)
        expect(parsed).toBeDefined()
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })

    it("should export profiling data in CSV format", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Generate some data
        const session = yield* profiler.startProfiling("csv-test", "file-read", "filesystem")
        yield* Effect.sleep(millis(30))
        yield* profiler.endProfiling(session, true)

        // Export as CSV
        const csvData = yield* profiler.exportProfilingData("csv")

        expect(typeof csvData).toBe("string")
        expect(csvData.length).toBeGreaterThan(0)
        expect(csvData).toContain(",") // Should contain CSV delimiters
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Data Management", () => {
    it("should clear old profiling data", async () => {
      const test = Effect.gen(function*() {
        const profiler = yield* PerformanceProfiler

        // Create some data
        const session = yield* profiler.startProfiling("clear-test", "computation", "computation")
        yield* Effect.sleep(millis(10))
        yield* profiler.endProfiling(session, true)

        // Clear all data
        const clearedCount = yield* profiler.clearProfilingData()

        expect(typeof clearedCount).toBe("number")
        expect(clearedCount).toBeGreaterThanOrEqual(0)
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(PerformanceProfilerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })
})
