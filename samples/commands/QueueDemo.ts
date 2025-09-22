/**
 * Queue System Demonstration
 *
 * Shows basic usage of the Effect CLI Queue System with Phase 1 implementation.
 * Demonstrates file operations, monitoring, and queue management.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { log } from "effect/Console"
import { millis, seconds } from "effect/Duration"
import * as Effect from "effect/Effect"
import {
  getQueueStatus,
  initializeQueueSystem,
  queueComputationTask,
  queueFileOperation,
  QueueSystem,
  shutdownQueueSystem
} from "../services/Queue/index.js"

// ============================================================================
// DEMO OPERATIONS
// ============================================================================

/**
 * Simulate a file read operation
 */
const simulateFileRead = (filePath: string) =>
  Effect.gen(function*() {
    yield* Effect.log(`Reading file: ${filePath}`)

    // Simulate file reading delay
    yield* Effect.sleep(millis(Math.random() * 1000 + 500))

    const content = `Content of ${filePath} - ${new Date().toISOString()}`

    yield* Effect.log(`File read completed: ${filePath}`)

    return content
  })

/**
 * Simulate a computation task
 */
const simulateComputation = (taskName: string, complexity: number) =>
  Effect.gen(function*() {
    yield* Effect.log(`Starting computation: ${taskName}`)

    // Simulate computation delay based on complexity
    yield* Effect.sleep(millis(complexity * 100))

    const result = Math.random() * complexity

    yield* Effect.log(`Computation completed: ${taskName} = ${result}`)

    return result
  })

// ============================================================================
// DEMO PROGRAM
// ============================================================================

const runQueueDemo = Effect.gen(function*() {
  yield* log("🚀 Effect CLI Queue System Demo")
  yield* log("=====================================")

  // Initialize the queue system
  yield* log("1. Initializing Queue System...")
  const sessionId = yield* initializeQueueSystem()
  yield* log(`   Session ID: ${sessionId}`)

  // Add some file operations to the queue
  yield* log("\n2. Adding File Operations to Queue...")

  const fileTask1 = yield* queueFileOperation(
    simulateFileRead("config.json"),
    {
      type: "file-read",
      filePath: "config.json",
      priority: 1 // High priority
    }
  )
  yield* log(`   Queued file task 1: ${fileTask1}`)

  const fileTask2 = yield* queueFileOperation(
    simulateFileRead("README.md"),
    {
      type: "file-read",
      filePath: "README.md",
      priority: 5 // Normal priority
    }
  )
  yield* log(`   Queued file task 2: ${fileTask2}`)

  const fileTask3 = yield* queueFileOperation(
    simulateFileRead("package.json"),
    {
      type: "file-read",
      filePath: "package.json",
      priority: 3 // Higher priority
    }
  )
  yield* log(`   Queued file task 3: ${fileTask3}`)

  // Add some computation tasks
  yield* log("\n3. Adding Computation Tasks to Queue...")

  const compTask1 = yield* queueComputationTask(
    simulateComputation("Calculate PI", 10),
    {
      priority: 2,
      isMemoryIntensive: false
    }
  )
  yield* log(`   Queued computation task 1: ${compTask1}`)

  const compTask2 = yield* queueComputationTask(
    simulateComputation("Matrix multiplication", 20),
    {
      priority: 4,
      isMemoryIntensive: true
    }
  )
  yield* log(`   Queued computation task 2: ${compTask2}`)

  // Check initial queue status
  yield* log("\n4. Initial Queue Status:")
  const initialStatus = yield* getQueueStatus()
  yield* log(`   Total Pending: ${initialStatus.queue.totalPending}`)
  yield* log(`   Total Running: ${initialStatus.queue.totalRunning}`)
  yield* log(`   Filesystem Queue: ${initialStatus.queue.queues.filesystem.size}`)
  yield* log(`   Computation Queue: ${initialStatus.queue.queues.computation.size}`)
  yield* log(`   Memory-Intensive Queue: ${initialStatus.queue.queues["memory-intensive"].size}`)

  // Wait a bit for tasks to process
  yield* log("\n5. Waiting for tasks to process...")
  yield* Effect.sleep(seconds(3))

  // Check status after processing
  yield* log("\n6. Queue Status After Processing:")
  const afterStatus = yield* getQueueStatus()
  yield* log(`   Total Tasks: ${afterStatus.metrics.totalTasks}`)
  yield* log(`   Completed Tasks: ${afterStatus.metrics.completedTasks}`)
  yield* log(`   Failed Tasks: ${afterStatus.metrics.failedTasks}`)
  yield* log(`   Success Rate: ${(afterStatus.metrics.successRate * 100).toFixed(1)}%`)
  yield* log(`   Avg Processing Time: ${afterStatus.metrics.averageProcessingTime.toFixed(2)}ms`)

  // Wait a bit more for remaining tasks
  if (afterStatus.queue.totalPending > 0 || afterStatus.queue.totalRunning > 0) {
    yield* log(
      `\n7. Waiting for remaining tasks (${afterStatus.queue.totalPending} pending, ${afterStatus.queue.totalRunning} running)...`
    )
    yield* Effect.sleep(seconds(4))

    const finalStatus = yield* getQueueStatus()
    yield* log(
      `   Final - Completed: ${finalStatus.metrics.completedTasks}, Failed: ${finalStatus.metrics.failedTasks}`
    )
  }

  // Export metrics
  yield* log("\n8. Exporting Queue Metrics...")
  const metricsJson = yield* QueueSystem.exportMetrics("json")
  yield* log("   Metrics (JSON):")
  yield* log(`   ${metricsJson.substring(0, 200)}...`)

  // Shutdown queue system
  yield* log("\n9. Shutting down Queue System...")
  yield* shutdownQueueSystem()

  yield* log("\n✅ Queue System Demo Completed!")
})

// ============================================================================
// MAIN PROGRAM
// ============================================================================

const program = runQueueDemo.pipe(
  Effect.provide(QueueSystem.BasicLayer),
  Effect.catchAll((error) =>
    Effect.gen(function*() {
      yield* log(`❌ Demo failed with error: ${error}`)
      if (error instanceof Error) {
        yield* log(`   Error details: ${error.message}`)
        if (error.stack) {
          yield* log(`   Stack trace: ${error.stack}`)
        }
      }
    })
  )
)

// Export for CLI usage
export { program as QueueDemo }

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  Effect.runPromise(program)
    .then(() => {
      console.log("Demo execution completed")
      process.exit(0)
    })
    .catch((error) => {
      console.error("Demo execution failed:", error)
      process.exit(1)
    })
}
