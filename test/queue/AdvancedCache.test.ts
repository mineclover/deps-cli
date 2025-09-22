/**
 * AdvancedCache Test Suite
 *
 * Basic tests for Phase 4.3 - Advanced multi-tier caching system
 */

import * as Effect from "effect/Effect"
import { describe, expect, it } from "vitest"

import { AdvancedCache, AdvancedCacheLive } from "../../src/services/Queue/AdvancedCache.js"
import { BasicQueueSystemLayer } from "../../src/services/Queue/index.js"

describe("AdvancedCache", () => {
  describe("Basic Functionality", () => {
    it("should provide advanced caching service", async () => {
      const test = Effect.gen(function*() {
        const cache = yield* AdvancedCache

        // Service should be available
        expect(cache).toBeDefined()
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(AdvancedCacheLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })

  describe("Service Integration", () => {
    it("should integrate with queue system", async () => {
      const test = Effect.gen(function*() {
        // Service should start without errors
        const cache = yield* AdvancedCache

        expect(cache).toBeDefined()
      })

      await Effect.runPromise(test.pipe(
        Effect.provide(AdvancedCacheLive),
        Effect.provide(BasicQueueSystemLayer)
      ))
    })
  })
})
