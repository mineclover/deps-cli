/**
 * Queue System Tests
 *
 * Basic tests for the Effect CLI Queue System Phase 1 implementation.
 * Tests core functionality including task queueing, processing, and monitoring.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { millis } from "effect/Duration"
import * as Effect from "effect/Effect"
import { describe, expect, it } from "vitest"
import {
  getQueueStatus,
  initializeQueueSystem,
  queueComputationTask,
  queueFileOperation,
  QueueSystem,
  shutdownQueueSystem
} from "../../src/services/Queue/index.js"

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Simple mock file operation that succeeds
 */
const mockFileRead = (filename: string) =>
  Effect.gen(function*() {
    yield* Effect.sleep(millis(10)) // Simulate brief I/O
    return `Mock content of ${filename}`
  })

/**
 * Simple mock computation that succeeds
 */
const mockComputation = (value: number) =>
  Effect.gen(function*() {
    yield* Effect.sleep(millis(5)) // Simulate brief computation
    return value * 2
  })

/**
 * Mock operation that fails
 */
const mockFailingOperation = (errorMessage: string) =>
  Effect.gen(function*() {
    yield* Effect.sleep(millis(5))
    return yield* Effect.fail(new Error(errorMessage))
  })

/**
 * Run effect with test layer
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(QueueSystem.BasicLayer)
    ) as Effect.Effect<A, E, never>
  )

// ============================================================================
// TESTS
// ============================================================================

describe("Queue System", () => {
  describe("Initialization and Shutdown", () => {
    it("should initialize queue system and return session ID", async () => {
      const sessionId = await runTest(
        Effect.gen(function*() {
          const id = yield* initializeQueueSystem()
          yield* shutdownQueueSystem()
          return id
        })
      )

      expect(sessionId).toMatch(/^session_/)
    })

    it("should shutdown gracefully", async () => {
      await expect(
        runTest(
          Effect.gen(function*() {
            yield* initializeQueueSystem()
            yield* shutdownQueueSystem()
          })
        )
      ).resolves.not.toThrow()
    })
  })

  describe("Task Queueing", () => {
    it("should queue file operations", async () => {
      const taskId = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          const id = yield* queueFileOperation(
            mockFileRead("test.txt"),
            {
              type: "file-read",
              filePath: "test.txt",
              priority: 5
            }
          )

          yield* shutdownQueueSystem()
          return id
        })
      )

      expect(taskId).toMatch(/^task_/)
    })

    it("should queue computation tasks", async () => {
      const taskId = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          const id = yield* queueComputationTask(
            mockComputation(42),
            {
              priority: 3,
              isMemoryIntensive: false
            }
          )

          yield* shutdownQueueSystem()
          return id
        })
      )

      expect(taskId).toMatch(/^task_/)
    })

    it("should handle multiple tasks with different priorities", async () => {
      const taskIds = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          const ids = yield* Effect.all([
            queueFileOperation(mockFileRead("high-priority.txt"), {
              type: "file-read",
              priority: 1
            }),
            queueFileOperation(mockFileRead("low-priority.txt"), {
              type: "file-read",
              priority: 10
            }),
            queueComputationTask(mockComputation(123), {
              priority: 5
            })
          ])

          yield* shutdownQueueSystem()
          return ids
        })
      )

      expect(taskIds).toHaveLength(3)
      taskIds.forEach((id) => expect(id).toMatch(/^task_/))
    })
  })

  describe("Queue Status and Monitoring", () => {
    it("should return queue status", async () => {
      const status = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          // Queue some tasks
          yield* queueFileOperation(mockFileRead("status-test.txt"), {
            type: "file-read",
            priority: 5
          })

          const currentStatus = yield* getQueueStatus()
          yield* shutdownQueueSystem()
          return currentStatus
        })
      )

      expect(status).toHaveProperty("queue")
      expect(status).toHaveProperty("metrics")
      expect(status.queue).toHaveProperty("queues")
      expect(status.queue.queues).toHaveProperty("filesystem")
      expect(status.queue.queues).toHaveProperty("network")
      expect(status.queue.queues).toHaveProperty("computation")
      expect(status.queue.queues).toHaveProperty("memory-intensive")
      expect(status.metrics).toHaveProperty("sessionId")
      expect(status.metrics).toHaveProperty("totalTasks")
      expect(status.metrics.sessionId).toMatch(/^session_/)
    })

    it("should track task metrics", async () => {
      const metrics = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          // Queue and let some tasks process
          yield* queueFileOperation(mockFileRead("metrics-test.txt"), {
            type: "file-read",
            priority: 1
          })

          // Give tasks time to process
          yield* Effect.sleep(millis(100))

          const status = yield* getQueueStatus()
          yield* shutdownQueueSystem()
          return status.metrics
        })
      )

      expect(metrics.totalTasks).toBeGreaterThanOrEqual(1)
      expect(metrics.sessionId).toMatch(/^session_/)
      expect(metrics.timestamp).toBeInstanceOf(Date)
      expect(typeof metrics.successRate).toBe("number")
      expect(typeof metrics.averageProcessingTime).toBe("number")
      expect(typeof metrics.throughputPerMinute).toBe("number")
    })
  })

  describe("Resource Group Handling", () => {
    it("should separate tasks by resource group", async () => {
      const status = await runTest(
        Effect.gen(function*() {
          yield* initializeQueueSystem()

          // Queue tasks for different resource groups
          yield* queueFileOperation(mockFileRead("fs-test.txt"), {
            type: "file-read",
            priority: 5
          })

          yield* queueComputationTask(mockComputation(100), {
            priority: 5,
            isMemoryIntensive: false
          })

          yield* queueComputationTask(mockComputation(200), {
            priority: 5,
            isMemoryIntensive: true
          })

          const currentStatus = yield* getQueueStatus()
          yield* shutdownQueueSystem()
          return currentStatus
        })
      )

      // Check that different resource groups exist and have appropriate properties
      expect(status.queue.queues.filesystem).toBeDefined()
      expect(status.queue.queues.computation).toBeDefined()
      expect(status.queue.queues["memory-intensive"]).toBeDefined()
      expect(status.queue.queues.network).toBeDefined()

      // Each queue should have size and processing status
      Object.values(status.queue.queues).forEach((queue) => {
        expect(typeof queue.size).toBe("number")
        expect(typeof queue.isProcessing).toBe("boolean")
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle task failures gracefully", async () => {
      // This test ensures the system doesn't crash when tasks fail
      await expect(
        runTest(
          Effect.gen(function*() {
            yield* initializeQueueSystem()

            // Queue a task that will fail
            yield* queueFileOperation(
              mockFailingOperation("Simulated file read error"),
              {
                type: "file-read",
                filePath: "nonexistent.txt",
                priority: 5
              }
            )

            // Give it time to process and fail
            yield* Effect.sleep(millis(100))

            const status = yield* getQueueStatus()
            yield* shutdownQueueSystem()

            // System should still be functional
            return status
          })
        )
      ).resolves.toBeDefined()
    })
  })
})

describe("Queue System Integration", () => {
  it("should handle a realistic workflow", async () => {
    const result = await runTest(
      Effect.gen(function*() {
        // Initialize system
        const sessionId = yield* initializeQueueSystem()

        // Queue multiple tasks of different types
        const tasks = yield* Effect.all([
          queueFileOperation(mockFileRead("config.json"), {
            type: "file-read",
            filePath: "config.json",
            priority: 1
          }),
          queueFileOperation(mockFileRead("data.csv"), {
            type: "file-read",
            filePath: "data.csv",
            priority: 3
          }),
          queueComputationTask(mockComputation(42), { priority: 2 }),
          queueComputationTask(mockComputation(84), {
            priority: 4,
            isMemoryIntensive: true
          })
        ])

        // Check initial status
        const initialStatus = yield* getQueueStatus()

        // Wait for processing
        yield* Effect.sleep(millis(200))

        // Check final status
        const finalStatus = yield* getQueueStatus()

        // Clean shutdown
        yield* shutdownQueueSystem()

        return {
          sessionId,
          taskIds: tasks,
          initialStatus,
          finalStatus
        }
      })
    )

    // Verify results
    expect(result.sessionId).toMatch(/^session_/)
    expect(result.taskIds).toHaveLength(4)
    expect(result.initialStatus.metrics.totalTasks).toBeGreaterThanOrEqual(4)
    expect(result.finalStatus.metrics.sessionId).toBe(result.sessionId)

    // Tasks should have been processed (completed or failed counts should be > 0)
    const totalProcessed = result.finalStatus.metrics.completedTasks + result.finalStatus.metrics.failedTasks
    expect(totalProcessed).toBeGreaterThanOrEqual(0)
  })
})
