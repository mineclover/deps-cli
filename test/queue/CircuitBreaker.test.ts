/**
 * Circuit Breaker Tests
 *
 * Tests for the Circuit Breaker Pattern implementation
 * in the Effect CLI Queue System Phase 2.
 */

import * as Effect from "effect/Effect"
import { mergeAll, provide } from "effect/Layer"
import { TestContext } from "effect/TestContext"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  CircuitBreaker,
  CircuitBreakerLive,
  QueuePersistenceLive,
  SchemaManagerLive
} from "../../src/services/Queue/index.js"

const testLayer = mergeAll(
  SchemaManagerLive,
  QueuePersistenceLive.pipe(provide(SchemaManagerLive)),
  CircuitBreakerLive.pipe(provide(QueuePersistenceLive.pipe(provide(SchemaManagerLive))))
)

describe("Circuit Breaker", () => {
  beforeEach(() => {
    // Reset state before each test
  })

  afterEach(() => {
    // Clean up after each test
  })

  describe("State Management", () => {
    it("should start in closed state", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker
        const state = yield* breaker.checkState("filesystem")
        return state
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("closed")
    })

    it("should transition to open after failure threshold", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        // Record 5 failures (threshold)
        for (let i = 0; i < 5; i++) {
          yield* breaker.recordFailure("filesystem", new Error("test error"))
        }

        const state = yield* breaker.checkState("filesystem")
        return state
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("open")
    })

    it("should force open when requested", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        yield* breaker.forceOpen("network")
        const state = yield* breaker.checkState("network")
        return state
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("open")
    })

    it("should force close when requested", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        // First open it
        yield* breaker.forceOpen("computation")
        let state = yield* breaker.checkState("computation")
        expect(state).toBe("open")

        // Then close it
        yield* breaker.forceClose("computation")
        state = yield* breaker.checkState("computation")
        return state
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result).toBe("closed")
    })
  })

  describe("Circuit Breaker Info", () => {
    it("should provide detailed circuit breaker information", async () => {
      const info = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        // Record some failures
        yield* breaker.recordFailure("filesystem", new Error("test"))
        yield* breaker.recordFailure("filesystem", new Error("test"))

        const info = yield* breaker.getInfo("filesystem")
        return info
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(info.resourceGroup).toBe("filesystem")
      expect(info.failureCount).toBe(2)
      expect(info.state).toBe("closed") // Still closed, below threshold
      expect(info.failureThreshold).toBe(5)
      expect(info.recoveryTimeoutMs).toBe(30000)
    })
  })

  describe("Reset Functionality", () => {
    it("should reset stats for specific resource group", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        // Record some failures
        yield* breaker.recordFailure("network", new Error("test"))
        yield* breaker.recordFailure("network", new Error("test"))

        let info = yield* breaker.getInfo("network")
        expect(info.failureCount).toBe(2)

        // Reset stats
        yield* breaker.resetStats("network")

        info = yield* breaker.getInfo("network")
        return info
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result.failureCount).toBe(0)
      expect(result.state).toBe("closed")
    })
  })

  describe("Success Recording", () => {
    it("should record successes and reset failure count", async () => {
      const result = await Effect.gen(function*() {
        const breaker = yield* CircuitBreaker

        // Record some failures
        yield* breaker.recordFailure("computation", new Error("test"))
        yield* breaker.recordFailure("computation", new Error("test"))

        let info = yield* breaker.getInfo("computation")
        expect(info.failureCount).toBe(2)

        // Record success - should reset failure count
        yield* breaker.recordSuccess("computation")

        info = yield* breaker.getInfo("computation")
        return info
      }).pipe(
        Effect.provide(testLayer),
        Effect.provide(TestContext),
        Effect.runPromise
      )

      expect(result.failureCount).toBe(0)
    })
  })
})
