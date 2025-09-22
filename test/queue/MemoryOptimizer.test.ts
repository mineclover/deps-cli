/**
 * MemoryOptimizer Test Suite
 *
 * Basic tests for Phase 4.2 - Memory optimization and resource management
 */

import * as Effect from "effect/Effect"
import { describe, expect, it } from "vitest"

import { BasicQueueSystemLayer } from "../../src/services/Queue/index.js"
import { MemoryOptimizer, MemoryOptimizerLive } from "../../src/services/Queue/MemoryOptimizer.js"

describe("MemoryOptimizer", () => {
  describe("Basic Functionality", () => {
    it("should provide memory optimization service", async () => {
      const test = Effect.gen(function*() {
        const optimizer = yield* MemoryOptimizer

        // Service should be available
        expect(optimizer).toBeDefined()
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(MemoryOptimizerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Service Integration", () => {
    it("should integrate with queue system", async () => {
      const test = Effect.gen(function*() {
        // Service should start without errors
        const optimizer = yield* MemoryOptimizer

        expect(optimizer).toBeDefined()
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(MemoryOptimizerLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })
})
