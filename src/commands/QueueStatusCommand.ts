import { log } from "effect/Console"
import { isSome, none } from "effect/Option"
import type { Option } from "effect/Option"
/**
 * Queue Status Command
 *
 * CLI command to display current queue system status and metrics.
 * Part of the Effect CLI Queue System implementation.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"

import * as Effect from "effect/Effect"

import { BasicQueueSystemLayer, getQueueStatus, QueueMonitor, QueueSystem } from "../services/Queue/index.js"
import type { QueueMetrics, QueueStatus } from "../services/Queue/types.js"

// ============================================================================
// COMMAND OPTIONS
// ============================================================================

const formatOption = Options.choice("format", ["table", "json", "csv"] as const)
  .pipe(Options.withDefault("table" as const))

const sessionOption = Options.text("session")
  .pipe(Options.optional)

// ============================================================================
// STATUS DISPLAY FUNCTIONS
// ============================================================================

const displayTableFormat = (status: { queue: QueueStatus; metrics: QueueMetrics }) =>
  Effect.gen(function*() {
    yield* log("Queue System Status")
    yield* log("==================")

    // Overall metrics
    yield* log(`Session ID:        ${status.metrics.sessionId}`)
    yield* log(`Timestamp:         ${status.metrics.timestamp}`)
    yield* log(`Total Tasks:       ${status.metrics.totalTasks}`)
    yield* log(`Pending:           ${status.metrics.pendingTasks}`)
    yield* log(`Running:           ${status.metrics.runningTasks}`)
    yield* log(`Completed:         ${status.metrics.completedTasks}`)
    yield* log(`Failed:            ${status.metrics.failedTasks}`)
    yield* log(`Success Rate:      ${(status.metrics.successRate * 100).toFixed(1)}%`)
    yield* log(`Avg Process Time:  ${status.metrics.averageProcessingTime.toFixed(2)}ms`)
    yield* log(`Throughput/min:    ${status.metrics.throughputPerMinute.toFixed(2)}`)
    yield* log(`Memory Usage:      ${status.metrics.memoryUsageMb}MB`)

    yield* log("\nResource Group Status")
    yield* log("====================")

    // Resource groups
    const resourceGroups = ["filesystem", "network", "computation", "memory-intensive"] as const

    for (const group of resourceGroups) {
      const queue = status.queue.queues[group]
      const stats = status.metrics.resourceGroupStats[group] || {}

      yield* log(`\n${group.toUpperCase()}:`)
      yield* log(`  Queue Size:      ${queue.size}`)
      yield* log(`  Processing:      ${queue.isProcessing ? "Yes" : "No"}`)
      yield* log(`  Total Tasks:     ${stats.totalTasks || 0}`)
      yield* log(`  Completed:       ${stats.completedTasks || 0}`)
      yield* log(`  Failed:          ${stats.failedTasks || 0}`)
      yield* log(`  Avg Time:        ${(stats.averageProcessingTime || 0).toFixed(2)}ms`)
    }

    yield* log("\nProcessing Fibers")
    yield* log("=================")
    yield* log(`Active Fibers:     ${status.queue.processingFibers.length}`)
  })

const displayJsonFormat = (status: { queue: QueueStatus; metrics: QueueMetrics }) =>
  Effect.gen(function*() {
    const output = JSON.stringify(
      {
        queue: status.queue,
        metrics: status.metrics
      },
      null,
      2
    )
    yield* log(output)
  })

const displayCsvFormat = (status: { queue: QueueStatus; metrics: QueueMetrics }) =>
  Effect.gen(function*() {
    const headers = [
      "sessionId",
      "timestamp",
      "totalTasks",
      "pendingTasks",
      "runningTasks",
      "completedTasks",
      "failedTasks",
      "successRate",
      "avgProcessingTime",
      "throughputPerMinute",
      "memoryUsageMb",
      "queueDepth"
    ]

    const values = [
      status.metrics.sessionId,
      status.metrics.timestamp,
      status.metrics.totalTasks,
      status.metrics.pendingTasks,
      status.metrics.runningTasks,
      status.metrics.completedTasks,
      status.metrics.failedTasks,
      status.metrics.successRate,
      status.metrics.averageProcessingTime,
      status.metrics.throughputPerMinute,
      status.metrics.memoryUsageMb,
      status.metrics.queueDepth
    ]

    yield* log(headers.join(","))
    yield* log(values.join(","))
  })

// ============================================================================
// COMMAND IMPLEMENTATION
// ============================================================================

const queueStatusAction = (options: {
  format: "table" | "json" | "csv"
  session: Option<string>
}) =>
  Effect.gen(function*() {
    yield* log("🔍 Fetching Queue Status...")

    // Get queue status
    let status = yield* getQueueStatus()

    // If specific session requested, get metrics for that session
    if (isSome(options.session)) {
      const monitor = yield* QueueMonitor
      const sessionMetrics = yield* monitor.getQueueStatus(options.session.value)
      status = { ...status, metrics: sessionMetrics }
    }

    yield* log("")

    // Display in requested format
    switch (options.format) {
      case "json":
        yield* displayJsonFormat(status)
        break
      case "csv":
        yield* displayCsvFormat(status)
        break
      case "table":
      default:
        yield* displayTableFormat(status)
        break
    }
  })

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const queueStatusCommand = Command.make(
  "queue-status",
  {
    format: formatOption,
    session: sessionOption
  },
  queueStatusAction
).pipe(
  Command.withDescription("Display current queue system status and metrics")
)

// ============================================================================
// STANDALONE EXECUTION
// ============================================================================

const program = queueStatusAction({ format: "table", session: none() }).pipe(
  Effect.provide(QueueSystem.BasicLayer),
  Effect.catchAll((error) =>
    Effect.gen(function*() {
      yield* log(`❌ Queue status check failed: ${error}`)
      if (error instanceof Error) {
        yield* log(`   Error: ${error.message}`)
      }
    })
  )
)

// Export for CLI integration
export { program as QueueStatusProgram }

// Run if called directly
if (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  Effect.runPromise(program.pipe(Effect.provide(BasicQueueSystemLayer)))
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error("Queue status execution failed:", error)
      process.exit(1)
    })
}
