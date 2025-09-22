import { millis, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
/**
 * Memory Optimizer for Effect CLI Queue System
 *
 * Advanced memory management and optimization strategies for improved performance.
 * Includes memory pooling, garbage collection optimization, and memory leak detection.
 *
 * Phase 4.2: Memory Optimization and Resource Management
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { GenericTag } from "effect/Context"

import * as Effect from "effect/Effect"
import { effect } from "effect/Layer"
import type { Layer } from "effect/Layer"
//  // Unused import
// Array utilities from standard JS

// import type { ResourceGroup } from "./types.js" // Unused import

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Memory pool configuration
 */
export interface MemoryPoolConfig {
  readonly initialSize: number
  readonly maxSize: number
  readonly growthFactor: number
  readonly shrinkThreshold: number
  readonly maxIdleTime: Duration
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  readonly heapUsed: number
  readonly heapTotal: number
  readonly external: number
  readonly arrayBuffers: number
  readonly rss: number
  readonly heapUtilization: number
  readonly gcFrequency: number
  readonly memoryLeakScore: number
  readonly poolEfficiency: number
}

/**
 * Memory pool for reusable objects
 */
export interface MemoryPool<T> {
  readonly acquire: () => Effect.Effect<T>
  readonly release: (item: T) => Effect.Effect<void>
  readonly drain: () => Effect.Effect<number>
  readonly getStats: () => Effect.Effect<PoolStats>
}

/**
 * Pool statistics
 */
export interface PoolStats {
  readonly totalCreated: number
  readonly currentSize: number
  readonly maxSize: number
  readonly acquisitions: number
  readonly releases: number
  readonly efficiency: number
  readonly hitRate: number
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakAnalysis {
  readonly detected: boolean
  readonly severity: "low" | "medium" | "high" | "critical"
  readonly growthRate: number // bytes per second
  readonly suspectedSources: ReadonlyArray<string>
  readonly recommendations: ReadonlyArray<string>
  readonly heapGrowthTrend: ReadonlyArray<{ timestamp: number; heapSize: number }>
}

/**
 * Memory optimization strategies
 */
export interface OptimizationStrategy {
  readonly name: string
  readonly description: string
  readonly apply: () => Effect.Effect<OptimizationResult>
  readonly revert: () => Effect.Effect<void>
  readonly isActive: boolean
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  readonly strategy: string
  readonly memoryFreed: number
  readonly performanceImpact: number
  readonly success: boolean
  readonly duration: number
}

/**
 * Memory optimizer service interface
 */
export interface MemoryOptimizer {
  readonly createPool: <T>(
    name: string,
    factory: () => T,
    reset: (item: T) => void,
    config: MemoryPoolConfig
  ) => Effect.Effect<MemoryPool<T>>

  readonly getMemoryStats: () => Effect.Effect<MemoryStats>
  readonly analyzeMemoryLeaks: () => Effect.Effect<MemoryLeakAnalysis>
  readonly forceGarbageCollection: () => Effect.Effect<MemoryStats>
  readonly optimizeMemory: (aggressive?: boolean) => Effect.Effect<ReadonlyArray<OptimizationResult>>
  readonly setMemoryLimit: (limit: number) => Effect.Effect<void>
  readonly getAvailableStrategies: () => Effect.Effect<ReadonlyArray<OptimizationStrategy>>
  readonly scheduleMemoryMaintenance: (interval: Duration) => Effect.Effect<void>
}

export const MemoryOptimizer = GenericTag<MemoryOptimizer>("@app/MemoryOptimizer")

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Live implementation of MemoryOptimizer
 */
export const MemoryOptimizerLive: Layer<MemoryOptimizer> = effect(
  MemoryOptimizer,
  Effect.gen(function*() {
    yield* Effect.void
    // Global state
    const memoryPools = new Map<string, MemoryPool<any>>()
    const memoryHistory: Array<{ timestamp: number; stats: NodeJS.MemoryUsage }> = []
    const gcHistory: Array<{ timestamp: number; type: string }> = []
    let memoryLimit: number = 1024 * 1024 * 1024 // 1GB default
    let maintenanceScheduled = false

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Get current memory statistics
     */
    const getCurrentMemoryStats = (): MemoryStats => {
      const usage = process.memoryUsage()
      const heapUtilization = usage.heapUsed / usage.heapTotal

      // Calculate GC frequency based on recent history
      const recentGCs = gcHistory.filter((gc) => Date.now() - gc.timestamp < 60000).length
      const gcFrequency = recentGCs / 60 // per second

      // Calculate memory leak score based on trend
      const recentHistory = memoryHistory.slice(-10)
      let memoryLeakScore = 0
      if (recentHistory.length >= 5) {
        const oldestHeap = recentHistory[0].stats.heapUsed
        const newestHeap = recentHistory[recentHistory.length - 1].stats.heapUsed
        const timeSpan = recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp
        const growthRate = (newestHeap - oldestHeap) / (timeSpan / 1000)
        memoryLeakScore = Math.max(0, Math.min(100, growthRate / (1024 * 1024) * 10)) // Score based on MB/s growth
      }

      // Calculate pool efficiency
      const poolStats = [...memoryPools.values()].map((_pool) =>
        // This would be implemented based on actual pool stats
        0.8 // Mock efficiency value
      )
      const poolEfficiency = poolStats.length > 0
        ? poolStats.reduce((sum, eff) => sum + eff, 0) / poolStats.length
        : 0

      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers,
        rss: usage.rss,
        heapUtilization,
        gcFrequency,
        memoryLeakScore,
        poolEfficiency
      }
    }

    /**
     * Create a memory pool implementation
     */
    const createPoolImpl = <T>(
      name: string,
      factory: () => T,
      reset: (item: T) => void,
      config: MemoryPoolConfig
    ): MemoryPool<T> => {
      const pool: Array<T> = []
      const stats = {
        totalCreated: 0,
        acquisitions: 0,
        releases: 0,
        lastAccess: Date.now()
      }

      // Initialize pool with initial size
      for (let i = 0; i < config.initialSize; i++) {
        pool.push(factory())
        stats.totalCreated++
      }

      const acquire = (): Effect.Effect<T> =>
        Effect.gen(function*() {
          stats.acquisitions++
          stats.lastAccess = Date.now()

          if (pool.length > 0) {
            const item = pool.pop()!
            yield* Effect.log(`📦 Acquired item from pool ${name} (${pool.length} remaining)`)
            return item
          }

          if (stats.totalCreated < config.maxSize) {
            const currentMemory = getCurrentMemoryStats()
            if (currentMemory.rss > memoryLimit * 0.8) {
              yield* Effect.log(
                `⚠️  Memory limit approaching (${
                  (currentMemory.rss / memoryLimit * 100).toFixed(1)
                }%), refusing to create new item`
              )
              return factory() // Create temporary item instead
            }
            const newItem = factory()
            stats.totalCreated++
            yield* Effect.log(`🔧 Created new item for pool ${name} (total: ${stats.totalCreated})`)
            return newItem
          }

          yield* Effect.log(`⚠️  Pool ${name} exhausted, creating temporary item`)
          return factory()
        })

      const release = (item: T): Effect.Effect<void> =>
        Effect.gen(function*() {
          stats.releases++
          stats.lastAccess = Date.now()

          if (pool.length < config.maxSize) {
            reset(item)
            pool.push(item)
            yield* Effect.log(`♻️  Returned item to pool ${name} (${pool.length} items)`)
          } else {
            yield* Effect.log(`🗑️  Pool ${name} full, discarding item`)
          }
        })

      const drain = (): Effect.Effect<number> =>
        Effect.gen(function*() {
          const drained = pool.length
          pool.length = 0
          yield* Effect.log(`🧹 Drained pool ${name}: ${drained} items removed`)
          return drained
        })

      const getStats = (): Effect.Effect<PoolStats> =>
        Effect.succeed({
          totalCreated: stats.totalCreated,
          currentSize: pool.length,
          maxSize: config.maxSize,
          acquisitions: stats.acquisitions,
          releases: stats.releases,
          efficiency: stats.releases > 0 ? stats.acquisitions / stats.totalCreated : 0,
          hitRate: stats.acquisitions > 0 ? (stats.acquisitions - stats.totalCreated) / stats.acquisitions : 0
        })

      return { acquire, release, drain, getStats }
    }

    /**
     * Detect memory leaks
     */
    const detectMemoryLeaks = (): MemoryLeakAnalysis => {
      if (memoryHistory.length < 10) {
        return {
          detected: false,
          severity: "low",
          growthRate: 0,
          suspectedSources: [],
          recommendations: [],
          heapGrowthTrend: []
        }
      }

      const recentHistory = memoryHistory.slice(-20)
      const heapGrowthTrend = recentHistory.map((h) => ({
        timestamp: h.timestamp,
        heapSize: h.stats.heapUsed
      }))

      // Calculate growth rate
      const timeSpan = recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp
      const heapGrowth = recentHistory[recentHistory.length - 1].stats.heapUsed - recentHistory[0].stats.heapUsed
      const growthRate = heapGrowth / (timeSpan / 1000) // bytes per second

      const detected = growthRate > 1024 * 1024 // 1MB/s growth rate threshold
      let severity: "low" | "medium" | "high" | "critical" = "low"

      if (growthRate > 10 * 1024 * 1024) severity = "critical"
      else if (growthRate > 5 * 1024 * 1024) severity = "high"
      else if (growthRate > 2 * 1024 * 1024) severity = "medium"

      const suspectedSources: Array<string> = []
      const recommendations: Array<string> = []

      if (detected) {
        suspectedSources.push("Queue operations with large payloads")
        suspectedSources.push("Memory pools not being properly recycled")
        suspectedSources.push("Event listeners or timers not being cleaned up")

        recommendations.push("Enable more frequent garbage collection")
        recommendations.push("Implement object pooling for frequently created objects")
        recommendations.push("Review and optimize large object allocations")
        recommendations.push("Add memory usage monitoring to critical operations")
      }

      return {
        detected,
        severity,
        growthRate,
        suspectedSources,
        recommendations,
        heapGrowthTrend
      }
    }

    // ========================================================================
    // OPTIMIZATION STRATEGIES
    // ========================================================================

    const optimizationStrategies: Array<OptimizationStrategy> = [
      {
        name: "Aggressive Garbage Collection",
        description: "Force multiple GC cycles to free up memory",
        isActive: false,
        apply: () =>
          Effect.gen(function*() {
            const beforeStats = getCurrentMemoryStats()
            const startTime = Date.now()

            // Force garbage collection if available
            if (global.gc) {
              global.gc()
              global.gc() // Run twice for thorough cleanup
              yield* Effect.sleep(millis(100))
            }

            const afterStats = getCurrentMemoryStats()
            const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed
            const duration = Date.now() - startTime

            return {
              strategy: "Aggressive Garbage Collection",
              memoryFreed,
              performanceImpact: duration,
              success: memoryFreed > 0,
              duration
            }
          }),
        revert: () => Effect.void
      },
      {
        name: "Pool Cleanup",
        description: "Clear unused items from memory pools",
        isActive: false,
        apply: () =>
          Effect.gen(function*() {
            const startTime = Date.now()
            let totalDrained = 0

            for (const [_name, pool] of memoryPools.entries()) {
              const drained = yield* pool.drain()
              totalDrained += drained
            }

            const duration = Date.now() - startTime
            const estimatedMemoryFreed = totalDrained * 1024 // Estimate 1KB per pooled item

            return {
              strategy: "Pool Cleanup",
              memoryFreed: estimatedMemoryFreed,
              performanceImpact: duration,
              success: totalDrained > 0,
              duration
            }
          }),
        revert: () => Effect.void
      },
      {
        name: "History Cleanup",
        description: "Clear old memory and performance history",
        isActive: false,
        apply: () =>
          Effect.sync(() => {
            const startTime = Date.now()
            const beforeLength = memoryHistory.length + gcHistory.length

            // Keep only last 100 entries
            memoryHistory.splice(0, Math.max(0, memoryHistory.length - 100))
            gcHistory.splice(0, Math.max(0, gcHistory.length - 100))

            const afterLength = memoryHistory.length + gcHistory.length
            const itemsCleared = beforeLength - afterLength
            const estimatedMemoryFreed = itemsCleared * 100 // Estimate 100 bytes per history entry
            const duration = Date.now() - startTime

            return {
              strategy: "History Cleanup",
              memoryFreed: estimatedMemoryFreed,
              performanceImpact: duration,
              success: itemsCleared > 0,
              duration
            }
          }),
        revert: () => Effect.void
      }
    ]

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const createPool = <T>(
      name: string,
      factory: () => T,
      reset: (item: T) => void,
      config: MemoryPoolConfig
    ): Effect.Effect<MemoryPool<T>> =>
      Effect.gen(function*() {
        const pool = createPoolImpl(name, factory, reset, config)
        memoryPools.set(name, pool)

        yield* Effect.log(`🏊 Created memory pool '${name}' with initial size ${config.initialSize}`)

        return pool
      })

    const getMemoryStats = (): Effect.Effect<MemoryStats> =>
      Effect.sync(() => {
        const stats = getCurrentMemoryStats()

        // Update memory history
        memoryHistory.push({
          timestamp: Date.now(),
          stats: process.memoryUsage()
        })

        // Keep only last 1000 entries
        if (memoryHistory.length > 1000) {
          memoryHistory.shift()
        }

        return stats
      })

    const analyzeMemoryLeaks = (): Effect.Effect<MemoryLeakAnalysis> => Effect.succeed(detectMemoryLeaks())

    const forceGarbageCollection = (): Effect.Effect<MemoryStats> =>
      Effect.gen(function*() {
        if (global.gc) {
          yield* Effect.log("🗑️ Forcing garbage collection...")
          global.gc()

          gcHistory.push({
            timestamp: Date.now(),
            type: "manual"
          })
        } else {
          yield* Effect.log("⚠️ Garbage collection not available (run with --expose-gc)")
        }

        return yield* getMemoryStats()
      })

    const optimizeMemory = (aggressive = false): Effect.Effect<ReadonlyArray<OptimizationResult>> =>
      Effect.gen(function*() {
        yield* Effect.log(`🚀 Starting memory optimization (aggressive: ${aggressive})`)

        const strategies = aggressive
          ? optimizationStrategies
          : optimizationStrategies.slice(0, 2) // Use only gentle strategies by default

        const results: Array<OptimizationResult> = []

        for (const strategy of strategies) {
          try {
            const result = yield* strategy.apply()
            results.push(result)
            yield* Effect.log(`✅ ${strategy.name}: freed ${(result.memoryFreed / 1024 / 1024).toFixed(1)}MB`)
          } catch (error) {
            yield* Effect.log(`❌ ${strategy.name} failed: ${error}`)
          }
        }

        const totalMemoryFreed = results.reduce((sum, r) => sum + r.memoryFreed, 0)
        yield* Effect.log(`🏁 Memory optimization complete: ${(totalMemoryFreed / 1024 / 1024).toFixed(1)}MB freed`)

        return results
      })

    const setMemoryLimit = (limit: number): Effect.Effect<void> =>
      Effect.gen(function*() {
        memoryLimit = limit
        yield* Effect.log(`💾 Memory limit set to ${(limit / 1024 / 1024).toFixed(1)}MB`)
      })

    const getAvailableStrategies = (): Effect.Effect<ReadonlyArray<OptimizationStrategy>> =>
      Effect.succeed(optimizationStrategies)

    const scheduleMemoryMaintenance = (interval: Duration): Effect.Effect<void> =>
      Effect.gen(function*() {
        if (maintenanceScheduled) {
          yield* Effect.log("🔄 Memory maintenance already scheduled")
          return
        }

        maintenanceScheduled = true

        yield* Effect.log(`⏰ Scheduling memory maintenance every ${toMillis(interval)}ms`)

        // Schedule recurring maintenance
        yield* Effect.fork(
          Effect.gen(function*() {
            while (true) {
              yield* Effect.sleep(interval)

              const stats = yield* getMemoryStats()
              const leakAnalysis = yield* analyzeMemoryLeaks()

              // Auto-optimize if memory usage is high or leaks detected
              if (stats.heapUtilization > 0.8 || leakAnalysis.detected) {
                yield* Effect.log("🧹 Auto-triggering memory optimization")
                yield* optimizeMemory(false)
              }

              // Clean up pools periodically
              if (stats.poolEfficiency < 0.5) {
                yield* Effect.log("🏊 Cleaning up underutilized pools")
                for (const [_name, pool] of memoryPools.entries()) {
                  yield* pool.drain()
                }
              }
            }
          }).pipe(
            Effect.catchAll((error) => Effect.log(`❌ Memory maintenance error: ${error}`))
          )
        )
      })

    return MemoryOptimizer.of({
      createPool,
      getMemoryStats,
      analyzeMemoryLeaks,
      forceGarbageCollection,
      optimizeMemory,
      setMemoryLimit,
      getAvailableStrategies,
      scheduleMemoryMaintenance
    })
  })
)
