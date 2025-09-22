/**
 * Adaptive Throttler Service Implementation
 *
 * Provides dynamic concurrency control with adaptive throttling based on
 * system load metrics. Uses Semaphore-based resource management and automatic
 * threshold adjustment to maintain optimal system performance.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { seconds } from "effect/Duration"
import * as Effect from "effect/Effect"
import { fail, log } from "effect/Effect"
import { interrupt } from "effect/Fiber"
import { effect, succeed } from "effect/Layer"
import { get, make, set } from "effect/Ref"
import type { ResourceGroup, SystemLoadMetrics, ThrottleLimits } from "./types.js"
import { AdaptiveThrottler, QueuePersistence, ThrottleError } from "./types.js"

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ThrottleConfig {
  readonly filesystem: ThrottleLimits
  readonly network: ThrottleLimits
  readonly computation: ThrottleLimits
  readonly "memory-intensive": ThrottleLimits
}

interface LoadMonitorState {
  readonly cpuUsage: number
  readonly memoryUsage: number
  readonly queueBacklog: number
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export const AdaptiveThrottlerLive = effect(
  AdaptiveThrottler,
  Effect.gen(function*() {
    // Dependencies
    const persistence = yield* QueuePersistence

    // Initial configuration
    const initialConfig: ThrottleConfig = {
      filesystem: { current: 5, min: 2, max: 10 },
      network: { current: 10, min: 5, max: 20 },
      computation: { current: 3, min: 1, max: 6 },
      "memory-intensive": { current: 2, min: 1, max: 4 }
    }

    // State management
    const throttleLimits = yield* make(initialConfig)
    const systemLoad = yield* make<LoadMonitorState>({
      cpuUsage: 0.0,
      memoryUsage: 0.0,
      queueBacklog: 0
    })

    // Semaphore management for each resource group
    const resourceSemaphores = yield* Effect.gen(function*() {
      const filesystem = yield* Effect.makeSemaphore(initialConfig.filesystem.current)
      const network = yield* Effect.makeSemaphore(initialConfig.network.current)
      const computation = yield* Effect.makeSemaphore(initialConfig.computation.current)
      const memoryIntensive = yield* Effect.makeSemaphore(initialConfig["memory-intensive"].current)

      return new Map(
        [
          ["filesystem" as const, filesystem],
          ["network" as const, network],
          ["computation" as const, computation],
          ["memory-intensive" as const, memoryIntensive]
        ] as const
      )
    })

    yield* log("Adaptive throttler service initialized")

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Get current system resource usage
     */
    const collectSystemMetrics = () =>
      Effect.gen(function*() {
        // Get CPU usage (simplified - in real implementation would use OS metrics)
        const cpuUsage = Math.random() * 0.3 // Simulate low CPU usage for demo

        // Get memory usage from Node.js process
        const memUsage = process.memoryUsage()
        const memoryUsage = Math.min(memUsage.heapUsed / (500 * 1024 * 1024), 1.0) // Cap at 500MB

        // Get queue backlog
        const sessionId = yield* persistence.getCurrentSession()
        const pendingTasks = yield* persistence.loadPendingTasks(sessionId)
        const queueBacklog = pendingTasks.length

        return {
          cpuUsage,
          memoryUsage,
          queueBacklog
        }
      })

    /**
     * Adjust throttle limits based on system load
     */
    const adjustThresholds = () =>
      Effect.gen(function*() {
        const currentLimits = yield* get(throttleLimits)
        const load = yield* get(systemLoad)

        // Calculate adjustment factor based on system load
        const loadFactor = Math.max(load.cpuUsage, load.memoryUsage)
        const backlogFactor = Math.min(load.queueBacklog / 100, 1.0)
        const adjustmentFactor = 1.0 - (loadFactor * 0.3 + backlogFactor * 0.2)

        // Apply adjustment to all resource groups
        const newLimits: ThrottleConfig = {
          filesystem: adjustLimit(currentLimits.filesystem, adjustmentFactor),
          network: adjustLimit(currentLimits.network, adjustmentFactor),
          computation: adjustLimit(currentLimits.computation, adjustmentFactor),
          "memory-intensive": adjustLimit(currentLimits["memory-intensive"], adjustmentFactor)
        }

        yield* set(throttleLimits, newLimits)

        // Log significant adjustments
        if (Math.abs(adjustmentFactor - 1.0) > 0.1) {
          yield* log(
            `Throttle limits adjusted: factor=${adjustmentFactor.toFixed(2)}, ` +
              `cpu=${load.cpuUsage.toFixed(2)}, memory=${load.memoryUsage.toFixed(2)}, ` +
              `backlog=${load.queueBacklog}`
          )
        }
      })

    /**
     * Adjust individual limit based on factor
     */
    const adjustLimit = (limit: ThrottleLimits, factor: number): ThrottleLimits => {
      const adjusted = Math.round(limit.current * factor)
      const newCurrent = Math.max(limit.min, Math.min(limit.max, adjusted))
      return { ...limit, current: newCurrent }
    }

    /**
     * Periodic system load monitoring (every 10 seconds)
     */
    const loadMonitoringFiber = yield* Effect.gen(function*() {
      while (true) {
        const metrics = yield* collectSystemMetrics().pipe(
          Effect.catchAll((error) =>
            Effect.gen(function*() {
              yield* log(`Load monitoring error: ${error}`)
              return {
                cpuUsage: 0.0,
                memoryUsage: 0.0,
                queueBacklog: 0
              }
            })
          )
        )

        yield* set(systemLoad, metrics)
        yield* Effect.sleep(seconds(10))
      }
    }).pipe(Effect.fork)

    /**
     * Periodic threshold adjustment (every 30 seconds)
     */
    const adjustmentFiber = yield* Effect.gen(function*() {
      while (true) {
        yield* adjustThresholds().pipe(
          Effect.catchAll((error) =>
            Effect.gen(function*() {
              yield* log(`Threshold adjustment error: ${error}`)
            })
          )
        )
        yield* Effect.sleep(seconds(30))
      }
    }).pipe(Effect.fork)

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const throttle = <A, E>(
      resourceGroup: ResourceGroup,
      operation: Effect.Effect<A, E>
    ): Effect.Effect<A, E | ThrottleError> =>
      Effect.gen(function*() {
        const semaphore = resourceSemaphores.get(resourceGroup)
        if (!semaphore) {
          return yield* fail(
            new ThrottleError(`Unknown resource group: ${resourceGroup}`, resourceGroup, 0)
          )
        }

        // Get current limit for error reporting
        const limits = yield* get(throttleLimits)
        const currentLimit = limits[resourceGroup].current

        // Apply semaphore-based throttling
        const result = yield* semaphore.withPermits(1)(operation).pipe(
          Effect.catchAll(() =>
            fail(
              new ThrottleError(
                `Resource throttled: ${resourceGroup} (limit: ${currentLimit})`,
                resourceGroup,
                currentLimit
              )
            )
          )
        )

        return result
      })

    const getCurrentLimits = () =>
      Effect.gen(function*() {
        const limits = yield* get(throttleLimits)
        return limits as Record<ResourceGroup, ThrottleLimits>
      })

    const getSystemLoad = () =>
      Effect.gen(function*() {
        const load = yield* get(systemLoad)
        return {
          cpu: load.cpuUsage,
          memory: load.memoryUsage,
          queueBacklog: load.queueBacklog
        } as SystemLoadMetrics
      })

    const cleanup = () =>
      Effect.gen(function*() {
        yield* log("Starting adaptive throttler cleanup...")
        yield* interrupt(loadMonitoringFiber)
        yield* interrupt(adjustmentFiber)
        yield* log("Adaptive throttler cleanup completed")
      })

    // ========================================================================
    // SERVICE INTERFACE
    // ========================================================================

    return AdaptiveThrottler.of({
      throttle,
      getCurrentLimits,
      getSystemLoad,
      cleanup
    })
  })
)

// ============================================================================
// TEST IMPLEMENTATION
// ============================================================================

export const AdaptiveThrottlerTest = succeed(
  AdaptiveThrottler,
  AdaptiveThrottler.of({
    throttle: (_, operation) => operation,
    getCurrentLimits: () =>
      Effect.succeed({
        filesystem: { current: 5, min: 2, max: 10 },
        network: { current: 10, min: 5, max: 20 },
        computation: { current: 3, min: 1, max: 6 },
        "memory-intensive": { current: 2, min: 1, max: 4 }
      } as Record<ResourceGroup, ThrottleLimits>),
    getSystemLoad: () =>
      Effect.succeed({
        cpu: 0.3,
        memory: 0.4,
        queueBacklog: 5
      }),
    cleanup: () => Effect.void
  })
)
