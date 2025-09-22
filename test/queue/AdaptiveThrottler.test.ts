/**
 * Adaptive Throttler Tests
 *
 * Tests for the Adaptive Throttler implementation
 * in the Effect CLI Queue System Phase 2.2.
 */

//  // Unused
import * as Effect from "effect/Effect"
//  // Unused
import { mergeAll, provide } from "effect/Layer"
//  // Unused
import { TestContext } from "effect/TestContext"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  AdaptiveThrottler,
  AdaptiveThrottlerLive,
  QueuePersistenceLive,
  SchemaManagerLive
} from "../../src/services/Queue/index.js"

const testLayer = mergeAll(
  SchemaManagerLive,
  QueuePersistenceLive.pipe(provide(SchemaManagerLive)),
  AdaptiveThrottlerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive))))
)

describe("Adaptive Throttler", () => {
  beforeEach(() => {
    // Reset state before each test
  })

  afterEach(() => {
    // Clean up after each test
  })

  describe("Throttle Limits Management", () => {
    it("should have default throttle limits for all resource groups", async () => {
      const limits = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler
        const limits = yield* throttler.getCurrentLimits()
        return limits
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(limits.filesystem.current).toBeGreaterThanOrEqual(2)
      expect(limits.filesystem.current).toBeLessThanOrEqual(10)
      expect(limits.network.current).toBeGreaterThanOrEqual(5)
      expect(limits.network.current).toBeLessThanOrEqual(20)
      expect(limits.computation.current).toBeGreaterThanOrEqual(1)
      expect(limits.computation.current).toBeLessThanOrEqual(6)
      expect(limits["memory-intensive"].current).toBeGreaterThanOrEqual(1)
      expect(limits["memory-intensive"].current).toBeLessThanOrEqual(4)

      // Check min/max bounds
      expect(limits.filesystem.min).toBe(2)
      expect(limits.filesystem.max).toBe(10)
    })

    it("should provide system load metrics", async () => {
      const metrics = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler
        const metrics = yield* throttler.getSystemLoad()
        return metrics
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(metrics.cpu).toBeGreaterThanOrEqual(0)
      expect(metrics.cpu).toBeLessThanOrEqual(1)
      expect(metrics.memory).toBeGreaterThanOrEqual(0)
      expect(metrics.memory).toBeLessThanOrEqual(1)
      expect(metrics.queueBacklog).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Throttling Operations", () => {
    it("should throttle filesystem operations", async () => {
      const result = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        const operation = Effect.succeed("filesystem operation completed")

        const result = yield* throttler.throttle("filesystem", operation)
        return result
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("filesystem operation completed")
    })

    it("should throttle network operations", async () => {
      const result = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        const operation = Effect.succeed("network operation completed")

        const result = yield* throttler.throttle("network", operation)
        return result
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("network operation completed")
    })

    it("should throttle computation operations", async () => {
      const result = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        const operation = Effect.succeed("computation completed")

        const result = yield* throttler.throttle("computation", operation)
        return result
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("computation completed")
    })

    it("should throttle memory-intensive operations", async () => {
      const result = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        const operation = Effect.succeed("memory operation completed")

        const result = yield* throttler.throttle("memory-intensive", operation)
        return result
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("memory operation completed")
    })

    it("should handle unknown resource groups", async () => {
      await expect(
        Effect.gen(function*() {
          const throttler = yield* AdaptiveThrottler

          const operation = Effect.succeed("test")

          // This should fail with ThrottleError
          yield* throttler.throttle("unknown" as any, operation)
        }).pipe(
          Effect.provide(testLayer),
          Effect.provide(TestContext),
          Effect.runPromise
        )
      ).rejects.toThrow()
    })
  })

  describe("Concurrency Control", () => {
    it("should limit concurrent filesystem operations", async () => {
      const results = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        // Create 10 concurrent filesystem operations
        const operations = Array.from(
          { length: 10 },
          (_, i) => throttler.throttle("filesystem", Effect.succeed(`fs-op-${i}`))
        )

        // Execute all operations concurrently
        const results = yield* Effect.all(operations, { concurrency: "unbounded" })
        return results
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(results).toHaveLength(10)
      expect(results[0]).toBe("fs-op-0")
    })

    it("should limit concurrent network operations", async () => {
      const results = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        // Create 15 concurrent network operations (more than limit of 10)
        const operations = Array.from(
          { length: 15 },
          (_, i) => throttler.throttle("network", Effect.succeed(`net-op-${i}`))
        )

        // Execute all operations concurrently
        const results = yield* Effect.all(operations, { concurrency: "unbounded" })
        return results
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(results).toHaveLength(15)
      expect(results[0]).toBe("net-op-0")
    })
  })

  describe("Error Handling", () => {
    it("should handle throttling limits correctly", async () => {
      const error = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        // Use a failing operation that will be throttled
        const failingOperation = Effect.fail(new Error("operation failed"))

        // Clear any existing throttle state first
        yield* throttler.cleanup()

        const result = yield* Effect.either(
          throttler.throttle("filesystem", failingOperation)
        )

        return result
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(error._tag).toBe("Left")
      if (error._tag === "Left") {
        // The throttler should either propagate the original error or throttle error
        expect(error.left.message).toMatch(/Resource throttled|operation failed/)
      }
    })

    it("should handle throttle cleanup", async () => {
      await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        // Test cleanup doesn't throw
        yield* throttler.cleanup()
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )
    })
  })

  describe("System Load Monitoring", () => {
    it("should track system load changes over time", async () => {
      const initialMetrics = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        const initial = yield* throttler.getSystemLoad()
        const updated = yield* throttler.getSystemLoad()

        return { initial, updated }
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(initialMetrics.initial).toBeDefined()
      expect(initialMetrics.updated).toBeDefined()
      expect(typeof initialMetrics.initial.cpu).toBe("number")
      expect(typeof initialMetrics.initial.memory).toBe("number")
      expect(typeof initialMetrics.initial.queueBacklog).toBe("number")
    })
  })

  describe("Integration Tests", () => {
    it("should integrate with other queue system components", async () => {
      const result = await Effect.gen(function*() {
        const throttler = yield* AdaptiveThrottler

        // Test that throttler can work with mixed operation types
        const fsOp = throttler.throttle("filesystem", Effect.succeed("fs"))
        const netOp = throttler.throttle("network", Effect.succeed("net"))
        const cpuOp = throttler.throttle("computation", Effect.succeed("cpu"))
        const memOp = throttler.throttle("memory-intensive", Effect.succeed("mem"))

        const results = yield* Effect.all([fsOp, netOp, cpuOp, memOp])
        return results
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toEqual(["fs", "net", "cpu", "mem"])
    })
  })
})
