import { toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
/**
 * Performance Profiler for Effect CLI Queue System
 *
 * Advanced performance profiling and bottleneck identification system.
 * Provides detailed metrics collection, analysis, and optimization recommendations.
 *
 * Phase 4.1: Performance Profiling and Bottleneck Identification
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { GenericTag } from "effect/Context"

import * as Effect from "effect/Effect"
import { effect } from "effect/Layer"
import type { Layer } from "effect/Layer"
//  // Unused import

import type { OperationType, ResourceGroup } from "./types.js"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Performance metrics for individual operations
 */
export interface OperationMetrics {
  readonly operationId: string
  readonly operationType: OperationType
  readonly resourceGroup: ResourceGroup
  readonly startTime: number
  readonly endTime: number
  readonly duration: number
  readonly memoryBefore: number
  readonly memoryAfter: number
  readonly memoryDelta: number
  readonly cpuBefore: number
  readonly cpuAfter: number
  readonly cpuDelta: number
  readonly queueWaitTime: number
  readonly success: boolean
  readonly errorType: string | undefined
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  readonly totalOperations: number
  readonly avgDuration: number
  readonly p50Duration: number
  readonly p95Duration: number
  readonly p99Duration: number
  readonly throughput: number // operations per second
  readonly errorRate: number
  readonly memoryEfficiency: number
  readonly cpuUtilization: number
  readonly bottleneckPoints: ReadonlyArray<BottleneckAnalysis>
}

/**
 * Bottleneck analysis results
 */
export interface BottleneckAnalysis {
  readonly type: "memory" | "cpu" | "io" | "concurrency" | "queue"
  readonly severity: "low" | "medium" | "high" | "critical"
  readonly description: string
  readonly impact: number // 0-100 scale
  readonly recommendations: ReadonlyArray<string>
  readonly affectedOperations: ReadonlyArray<string>
}

/**
 * Resource utilization tracking
 */
export interface ResourceUtilization {
  readonly resourceGroup: ResourceGroup
  readonly concurrentOperations: number
  readonly maxConcurrency: number
  readonly utilizationPercentage: number
  readonly avgWaitTime: number
  readonly throughput: number
  readonly bottleneckScore: number
}

/**
 * Performance profiler service interface
 */
export interface PerformanceProfiler {
  readonly startProfiling: (
    operationId: string,
    operationType: OperationType,
    resourceGroup: ResourceGroup
  ) => Effect.Effect<ProfilingSession>
  readonly endProfiling: (
    session: ProfilingSession,
    success: boolean,
    errorType?: string
  ) => Effect.Effect<OperationMetrics>
  readonly getPerformanceStats: (timeWindow?: Duration) => Effect.Effect<PerformanceStats>
  readonly analyzeBottlenecks: () => Effect.Effect<ReadonlyArray<BottleneckAnalysis>>
  readonly getResourceUtilization: () => Effect.Effect<ReadonlyArray<ResourceUtilization>>
  readonly exportProfilingData: (format: "json" | "csv") => Effect.Effect<string>
  readonly clearProfilingData: (olderThan?: Duration) => Effect.Effect<number>
}

export const PerformanceProfiler = GenericTag<PerformanceProfiler>("@app/PerformanceProfiler")

/**
 * Active profiling session
 */
export interface ProfilingSession {
  readonly operationId: string
  readonly operationType: OperationType
  readonly resourceGroup: ResourceGroup
  readonly startTime: number
  readonly startMemory: number
  readonly startCpu: number
  readonly queueEntryTime: number
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Live implementation of PerformanceProfiler
 */
export const PerformanceProfilerLive: Layer<PerformanceProfiler> = effect(
  PerformanceProfiler,
  Effect.gen(function*() {
    yield* Effect.void
    // Storage for performance metrics
    const operationMetrics: Array<OperationMetrics> = []
    const activeSessions = new Map<string, ProfilingSession>()
    const resourceUtilizationHistory = new Map<ResourceGroup, Array<{ timestamp: number; utilization: number }>>()

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Get current memory usage
     */
    const getCurrentMemory = (): number => {
      const memUsage = process.memoryUsage()
      return memUsage.heapUsed
    }

    /**
     * Get current CPU usage (simplified)
     */
    const getCurrentCpu = (): number => {
      const usage = process.cpuUsage()
      return (usage.user + usage.system) / 1000 // Convert to milliseconds
    }

    /**
     * Calculate percentiles from sorted array
     */
    const calculatePercentile = (sortedArray: ReadonlyArray<number>, percentile: number): number => {
      if (sortedArray.length === 0) return 0
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
      return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
    }

    /**
     * Analyze bottlenecks based on metrics
     */
    const identifyBottlenecks = (metrics: ReadonlyArray<OperationMetrics>): ReadonlyArray<BottleneckAnalysis> => {
      const bottlenecks: Array<BottleneckAnalysis> = []

      // Memory bottleneck analysis
      const highMemoryOps = metrics.filter((m) => m.memoryDelta > 50 * 1024 * 1024) // 50MB threshold
      if (highMemoryOps.length > metrics.length * 0.1) {
        bottlenecks.push({
          type: "memory",
          severity: highMemoryOps.length > metrics.length * 0.3 ? "critical" : "high",
          description: `${highMemoryOps.length} operations consumed excessive memory`,
          impact: Math.min(100, (highMemoryOps.length / metrics.length) * 100),
          recommendations: [
            "Implement memory pooling for large operations",
            "Consider streaming for large data processing",
            "Review object lifecycle management"
          ],
          affectedOperations: highMemoryOps.map((op) => op.operationType)
        })
      }

      // CPU bottleneck analysis
      const highCpuOps = metrics.filter((m) => m.cpuDelta > 1000) // 1 second CPU time
      if (highCpuOps.length > metrics.length * 0.1) {
        bottlenecks.push({
          type: "cpu",
          severity: highCpuOps.length > metrics.length * 0.2 ? "critical" : "high",
          description: `${highCpuOps.length} operations consumed excessive CPU`,
          impact: Math.min(100, (highCpuOps.length / metrics.length) * 100),
          recommendations: [
            "Consider breaking CPU-intensive tasks into smaller chunks",
            "Implement worker threads for computation-heavy operations",
            "Optimize algorithms and data structures"
          ],
          affectedOperations: highCpuOps.map((op) => op.operationType)
        })
      }

      // Queue wait time analysis
      const highWaitOps = metrics.filter((m) => m.queueWaitTime > 5000) // 5 second wait
      if (highWaitOps.length > metrics.length * 0.1) {
        bottlenecks.push({
          type: "queue",
          severity: "medium",
          description: `${highWaitOps.length} operations experienced long queue wait times`,
          impact: Math.min(100, (highWaitOps.length / metrics.length) * 80),
          recommendations: [
            "Increase concurrency limits for affected resource groups",
            "Implement priority queuing for critical operations",
            "Consider load balancing across multiple queues"
          ],
          affectedOperations: highWaitOps.map((op) => op.operationType)
        })
      }

      // Error rate analysis
      const errorRate = metrics.filter((m) => !m.success).length / metrics.length
      if (errorRate > 0.05) { // 5% error rate threshold
        bottlenecks.push({
          type: "io",
          severity: errorRate > 0.2 ? "critical" : errorRate > 0.1 ? "high" : "medium",
          description: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
          impact: Math.min(100, errorRate * 100),
          recommendations: [
            "Implement exponential backoff for failed operations",
            "Add circuit breaker patterns",
            "Review error handling and recovery strategies"
          ],
          affectedOperations: metrics.filter((m) => !m.success).map((op) => op.operationType)
        })
      }

      return bottlenecks
    }

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const startProfiling = (
      operationId: string,
      operationType: OperationType,
      resourceGroup: ResourceGroup
    ): Effect.Effect<ProfilingSession> =>
      Effect.gen(function*() {
        const session: ProfilingSession = {
          operationId,
          operationType,
          resourceGroup,
          startTime: Date.now(),
          startMemory: getCurrentMemory(),
          startCpu: getCurrentCpu(),
          queueEntryTime: Date.now()
        }

        activeSessions.set(operationId, session)

        yield* Effect.log(`🔍 Started profiling ${operationType} operation: ${operationId}`)

        return session
      })

    const endProfiling = (
      session: ProfilingSession,
      success: boolean,
      errorType?: string
    ): Effect.Effect<OperationMetrics> =>
      Effect.gen(function*() {
        const endTime = Date.now()
        const endMemory = getCurrentMemory()
        const endCpu = getCurrentCpu()

        const metrics: OperationMetrics = {
          operationId: session.operationId,
          operationType: session.operationType,
          resourceGroup: session.resourceGroup,
          startTime: session.startTime,
          endTime,
          duration: endTime - session.startTime,
          memoryBefore: session.startMemory,
          memoryAfter: endMemory,
          memoryDelta: endMemory - session.startMemory,
          cpuBefore: session.startCpu,
          cpuAfter: endCpu,
          cpuDelta: endCpu - session.startCpu,
          queueWaitTime: session.startTime - session.queueEntryTime,
          success,
          errorType
        }

        operationMetrics.push(metrics)
        activeSessions.delete(session.operationId)

        // Update resource utilization history
        const resourceHistory = resourceUtilizationHistory.get(session.resourceGroup) || []
        resourceHistory.push({
          timestamp: endTime,
          utilization: activeSessions.size // Simplified utilization metric
        })
        resourceUtilizationHistory.set(session.resourceGroup, resourceHistory.slice(-100)) // Keep last 100 entries

        yield* Effect.log(
          `📊 Profiling completed for ${session.operationType}: ` +
            `${metrics.duration}ms, Memory: ${(metrics.memoryDelta / 1024 / 1024).toFixed(1)}MB, ` +
            `Success: ${success}`
        )

        return metrics
      })

    const getPerformanceStats = (timeWindow?: Duration): Effect.Effect<PerformanceStats> =>
      Effect.sync(() => {
        const windowStart = timeWindow
          ? Date.now() - toMillis(timeWindow)
          : 0

        const filteredMetrics = operationMetrics.filter((m) => m.startTime >= windowStart)

        if (filteredMetrics.length === 0) {
          return {
            totalOperations: 0,
            avgDuration: 0,
            p50Duration: 0,
            p95Duration: 0,
            p99Duration: 0,
            throughput: 0,
            errorRate: 0,
            memoryEfficiency: 0,
            cpuUtilization: 0,
            bottleneckPoints: []
          }
        }

        const durations: ReadonlyArray<number> = filteredMetrics.map((m) => m.duration).sort((a, b) => a - b)
        const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0)
        const errorCount = filteredMetrics.filter((m) => !m.success).length
        const timeSpan = Math.max(
          1,
          (filteredMetrics[filteredMetrics.length - 1].endTime - filteredMetrics[0].startTime) / 1000
        )

        const stats: PerformanceStats = {
          totalOperations: filteredMetrics.length,
          avgDuration: totalDuration / filteredMetrics.length,
          p50Duration: calculatePercentile(durations, 50),
          p95Duration: calculatePercentile(durations, 95),
          p99Duration: calculatePercentile(durations, 99),
          throughput: filteredMetrics.length / timeSpan,
          errorRate: errorCount / filteredMetrics.length,
          memoryEfficiency: filteredMetrics.reduce((sum, m) => sum + (m.memoryDelta > 0 ? 1 : 0), 0) /
            filteredMetrics.length,
          cpuUtilization: filteredMetrics.reduce((sum, m) => sum + m.cpuDelta, 0) / filteredMetrics.length / 1000,
          bottleneckPoints: identifyBottlenecks(filteredMetrics)
        }

        return stats
      })

    const analyzeBottlenecks = (): Effect.Effect<ReadonlyArray<BottleneckAnalysis>> =>
      Effect.sync(() => identifyBottlenecks(operationMetrics))

    const getResourceUtilization = (): Effect.Effect<ReadonlyArray<ResourceUtilization>> =>
      Effect.sync(() => {
        const resourceGroups: Array<ResourceGroup> = ["filesystem", "network", "computation", "memory-intensive"]

        return resourceGroups.map((group) => {
          const groupMetrics = operationMetrics.filter((m) => m.resourceGroup === group)
          const recentMetrics = groupMetrics.slice(-50) // Last 50 operations

          const avgWaitTime = recentMetrics.length > 0
            ? recentMetrics.reduce((sum, m) => sum + m.queueWaitTime, 0) / recentMetrics.length
            : 0

          const throughput = recentMetrics.length > 0
            ? recentMetrics.length / Math.max(1, (Date.now() - recentMetrics[0].startTime) / 1000)
            : 0

          // Simplified bottleneck score based on wait time and error rate
          const errorRate = recentMetrics.length > 0
            ? recentMetrics.filter((m) => !m.success).length / recentMetrics.length
            : 0

          const bottleneckScore = Math.min(100, (avgWaitTime / 1000) * 10 + errorRate * 50)

          return {
            resourceGroup: group,
            concurrentOperations: [...activeSessions.values()]
              .filter((s) => s.resourceGroup === group).length,
            maxConcurrency: 10, // This would come from configuration
            utilizationPercentage: Math.min(100, throughput * 10),
            avgWaitTime,
            throughput,
            bottleneckScore
          }
        })
      })

    const exportProfilingData = (format: "json" | "csv"): Effect.Effect<string> =>
      Effect.gen(function*() {
        if (format === "json") {
          return JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              totalMetrics: operationMetrics.length,
              activeSessions: activeSessions.size,
              metrics: operationMetrics,
              resourceUtilization: yield* getResourceUtilization(),
              performanceStats: yield* getPerformanceStats()
            },
            null,
            2
          )
        } else {
          // CSV format
          const headers = [
            "operationId",
            "operationType",
            "resourceGroup",
            "duration",
            "memoryDelta",
            "cpuDelta",
            "queueWaitTime",
            "success",
            "errorType"
          ].join(",")

          const rows = operationMetrics.map((m) =>
            [
              m.operationId,
              m.operationType,
              m.resourceGroup,
              m.duration,
              m.memoryDelta,
              m.cpuDelta,
              m.queueWaitTime,
              m.success,
              m.errorType || ""
            ].join(",")
          )

          return [headers, ...rows].join("\n")
        }
      })

    const clearProfilingData = (olderThan?: Duration): Effect.Effect<number> =>
      Effect.gen(function*() {
        const cutoffTime = olderThan
          ? Date.now() - toMillis(olderThan)
          : 0

        const beforeCount = operationMetrics.length

        // Remove old metrics
        while (operationMetrics.length > 0 && operationMetrics[0].startTime < cutoffTime) {
          operationMetrics.shift()
        }

        const removedCount = beforeCount - operationMetrics.length

        yield* Effect.log(
          `🧹 Cleared ${removedCount} profiling records older than ${olderThan ? toMillis(olderThan) : "all"}ms`
        )

        return removedCount
      })

    return PerformanceProfiler.of({
      startProfiling,
      endProfiling,
      getPerformanceStats,
      analyzeBottlenecks,
      getResourceUtilization,
      exportProfilingData,
      clearProfilingData
    })
  })
)
