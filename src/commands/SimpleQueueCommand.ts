/**
 * Simple Queue Command - Basic queue system demonstration
 *
 * Test command to verify queue system integration without complex dependencies
 */

import * as Command from "@effect/cli/Command"
import { log } from "effect/Console"
import { millis } from "effect/Duration"
import * as Effect from "effect/Effect"
import {
  BasicQueueSystemLayer,
  getQueueStatus,
  initializeQueueSystem,
  queueComputationTask
} from "../services/Queue/index.js"

export const simpleQueueCommand = Command.make(
  "queue-demo",
  {},
  () =>
    Effect.gen(function*() {
      yield* log("🚀 Queue System Demo")

      // Initialize queue system
      const sessionId = yield* initializeQueueSystem()
      yield* log(`📋 Session ID: ${sessionId}`)

      // Add some demo tasks
      yield* log("📝 Adding computation tasks to queue...")

      const task1 = queueComputationTask(
        Effect.gen(function*() {
          yield* Effect.sleep(millis(100))
          yield* log("Task 1 completed")
          return "Result 1"
        }),
        { priority: 1 }
      )

      const task2 = queueComputationTask(
        Effect.gen(function*() {
          yield* Effect.sleep(millis(200))
          yield* log("Task 2 completed")
          return "Result 2"
        }),
        { priority: 2 }
      )

      const taskId1 = yield* task1
      const taskId2 = yield* task2

      yield* log(`✅ Added tasks: ${taskId1}, ${taskId2}`)

      // Show queue status
      yield* log("📊 Queue Status:")
      const status = yield* getQueueStatus()
      yield* log(`  - Queue sizes: ${JSON.stringify(status.queue.queues)}`)
      yield* log(`  - Processing fibers: ${status.queue.processingFibers.length}`)

      // Wait a moment for tasks to process
      yield* Effect.sleep(millis(500))

      // Show final status
      const finalStatus = yield* getQueueStatus()
      yield* log("📈 Final Queue Status:")
      yield* log(`  - Queue sizes: ${JSON.stringify(finalStatus.queue.queues)}`)
      yield* log(`  - Processing fibers: ${finalStatus.queue.processingFibers.length}`)

      yield* log("✨ Queue demo completed!")
    })
      .pipe(
        Effect.provide(BasicQueueSystemLayer)
      )
)
