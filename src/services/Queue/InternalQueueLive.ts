import { millis, seconds } from "effect/Duration"
import type { Duration } from "effect/Duration"
import { filter, getOrNull, isSome, map, none, some } from "effect/Option"
import type { Option } from "effect/Option"
import { bounded, offer, size, take } from "effect/Queue"
import type { Queue } from "effect/Queue"
import { forever } from "effect/Schedule"
/**
 * Internal Queue Service Implementation
 *
 * Manages in-memory queue processing with resource group isolation,
 * priority handling, and coordinated persistence. Implements concurrent
 * processing with Effect.js patterns.
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import * as Effect from "effect/Effect"
import { fail, log } from "effect/Effect"
import { interrupt } from "effect/Fiber"
import type { RuntimeFiber } from "effect/Fiber"
import { effect, succeed } from "effect/Layer"

import { get, make, set, update } from "effect/Ref"

import type { QueueStatus, QueueTask, ResourceGroup, TaskStatus } from "./types.js"
import { generateTaskId, InternalQueue, QueueError, QueuePersistence } from "./types.js"

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ProcessingState {
  readonly queue: Queue<QueueTask>
  readonly processingFiber: Option<RuntimeFiber<void, never>>
  readonly isPaused: boolean
  readonly lastProcessed: Option<Date>
}

interface RunningTask {
  readonly task: QueueTask
  readonly startedAt: Date
  readonly fiber: RuntimeFiber<unknown, unknown>
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export const InternalQueueLive = effect(
  InternalQueue,
  Effect.gen(function*() {
    // Dependencies
    const persistence = yield* QueuePersistence

    // State management
    const processingStates = yield* make(
      new Map<ResourceGroup, ProcessingState>()
    )

    const runningTasks = yield* make(
      new Map<string, RunningTask>()
    )

    const isShuttingDown = yield* make(false)

    yield* log("Internal queue service initializing...")

    // ========================================================================
    // RESOURCE GROUP SETUP
    // ========================================================================

    const resourceGroups: Array<ResourceGroup> = ["filesystem", "network", "computation", "memory-intensive"]

    // Initialize processing states for each resource group
    const initialStates = yield* Effect.forEach(
      resourceGroups,
      (group) =>
        Effect.gen(function*() {
          const queue = yield* bounded<QueueTask>(100) // Configurable queue size
          const state: ProcessingState = {
            queue,
            processingFiber: none(),
            isPaused: false,
            lastProcessed: none()
          }
          return [group, state] as const
        })
    )

    yield* update(processingStates, () => new Map(initialStates))

    // ========================================================================
    // QUEUE PROCESSING LOGIC
    // ========================================================================

    /**
     * Process tasks from a specific resource group queue
     */
    const processQueue = (group: ResourceGroup): Effect.Effect<void, never, never> =>
      Effect.gen(function*() {
        yield* log(`Starting queue processor for ${group}`)

        while (true) {
          // Check if we should continue processing
          const shuttingDown = yield* get(isShuttingDown)
          if (shuttingDown) {
            yield* log(`Shutting down processor for ${group}`)
            break
          }

          const states = yield* get(processingStates)
          const state = states.get(group)

          if (!state || state.isPaused) {
            yield* Effect.sleep(millis(1000))
            continue
          }

          // Take next task from queue
          const task = yield* take(state.queue)

          yield* log(`Processing task ${task.id} [${group}]`)

          // Execute task processing
          yield* Effect.gen(function*() {
            // Update task status to running
            yield* persistence.updateTaskStatus(task.id, "running")

            // Start the actual operation
            const operationFiber = yield* task.operation.pipe(
              Effect.timeout(seconds(300)), // 5 minute timeout
              Effect.fork
            )

            // Record running task
            const runningTask: RunningTask = {
              task,
              startedAt: new Date(),
              fiber: operationFiber
            }

            yield* update(runningTasks, (map) => {
              const newMap = new Map(map)
              newMap.set(task.id, runningTask)
              return newMap
            })

            // Wait for the operation to complete
            const result = yield* operationFiber.pipe(
              Effect.catchAll((error) =>
                Effect.gen(function*() {
                  // Handle task failure
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  yield* persistence.updateTaskStatus(task.id, "failed", errorMessage)
                  yield* log(`Task failed: ${task.id} - ${errorMessage}`)
                  return fail(error)
                })
              ),
              Effect.tap(() =>
                Effect.gen(function*() {
                  // Handle task success
                  yield* persistence.updateTaskStatus(task.id, "completed")
                  yield* log(`Task completed: ${task.id}`)
                })
              ),
              Effect.ensuring(Effect.gen(function*() {
                // Always clean up running task record
                yield* update(runningTasks, (map) => {
                  const newMap = new Map(map)
                  newMap.delete(task.id)
                  return newMap
                })

                // Update last processed time
                yield* update(processingStates, (states) => {
                  const newStates = new Map(states)
                  const currentState = newStates.get(group)
                  if (currentState) {
                    newStates.set(group, {
                      ...currentState,
                      lastProcessed: some(new Date())
                    })
                  }
                  return newStates
                })
              }))
            )

            return result
          })

          // Continue processing next task
          yield* Effect.void
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function*() {
            yield* log(`Queue processor error for ${group}: ${error}`)
            // Continue processing after error
            yield* Effect.sleep(seconds(1))
            return yield* processQueue(group)
          })
        ),
        Effect.repeat(forever)
      )

    /**
     * Start processing fibers for all resource groups
     */
    const startProcessing = () =>
      Effect.gen(function*() {
        const states = yield* get(processingStates)

        const updatedStates = yield* Effect.reduce(
          resourceGroups,
          states,
          (currentStates, group) =>
            Effect.gen(function*() {
              const state = currentStates.get(group)
              if (!state) return currentStates

              const fiber = yield* processQueue(group).pipe(Effect.fork)

              const newStates = new Map(currentStates)
              newStates.set(group, {
                ...state,
                processingFiber: some(fiber)
              })

              return newStates
            })
        )

        yield* set(processingStates, updatedStates)
        yield* log("All queue processors started")
      })

    // Start processing
    yield* startProcessing()

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const enqueue = <A, E>(task: QueueTask<A, E>) =>
      Effect.gen(function*() {
        // Convert to persisted task and save to database
        const persistedTask = {
          ...task,
          createdAt: new Date(),
          startedAt: none(),
          completedAt: none(),
          actualDuration: none(),
          retryCount: 0,
          lastError: none(),
          errorStack: none(),
          filePath: task.operationData.pipe(
            map((data: unknown) =>
              typeof data === "object" && data !== null && "filePath" in data
                ? (data as { filePath?: string }).filePath
                : undefined
            ),
            filter((path): path is string => typeof path === "string")
          ),
          fileSize: none(),
          fileHash: none(),
          operationData: task.operationData.pipe(
            map(JSON.stringify)
          ),
          resultData: none(),
          memoryUsageKb: none(),
          cpuTimeMs: none(),
          status: "pending" as TaskStatus
        }

        // Persist to database first
        yield* persistence.persistTask(persistedTask)

        // Add to in-memory queue
        const states = yield* get(processingStates)
        const state = states.get(task.resourceGroup)

        if (!state) {
          return yield* fail(
            new QueueError(`Unknown resource group: ${task.resourceGroup}`)
          )
        }

        yield* offer(state.queue, task)

        yield* log(`Task enqueued: ${task.id} [${task.resourceGroup}] priority=${task.priority}`)
      })

    const getStatus = () =>
      Effect.gen(function*() {
        const states = yield* get(processingStates)
        const running = yield* get(runningTasks)

        const queueSizes = yield* Effect.all(
          Object.fromEntries(
            [...states.entries()].map(([group, state]) => [
              group,
              size(state.queue)
            ])
          )
        )

        const queues = Object.fromEntries(
          [...states.entries()].map(([group, state]) => [
            group,
            {
              size: queueSizes[group] || 0,
              isProcessing: !state.isPaused && isSome(state.processingFiber),
              lastProcessed: state.lastProcessed
            }
          ])
        ) as Record<ResourceGroup, any>

        const totalPending = Object.values(queues).reduce((sum, q) => sum + q.size, 0)
        const totalRunning = running.size
        const processingFibers = [...states.values()]
          .map((state) => getOrNull(state.processingFiber))
          .filter(Boolean) as Array<RuntimeFiber<never, never>>

        const status: QueueStatus = {
          queues,
          totalPending,
          totalRunning,
          processingFibers
        }

        return status
      })

    const pauseProcessing = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        yield* update(processingStates, (states) => {
          const newStates = new Map(states)
          const state = newStates.get(resourceGroup)
          if (state) {
            newStates.set(resourceGroup, {
              ...state,
              isPaused: true
            })
          }
          return newStates
        })

        yield* log(`Processing paused for ${resourceGroup}`)
      })

    const resumeProcessing = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        yield* update(processingStates, (states) => {
          const newStates = new Map(states)
          const state = newStates.get(resourceGroup)
          if (state) {
            newStates.set(resourceGroup, {
              ...state,
              isPaused: false
            })
          }
          return newStates
        })

        yield* log(`Processing resumed for ${resourceGroup}`)
      })

    const cancelTask = (taskId: string) =>
      Effect.gen(function*() {
        const running = yield* get(runningTasks)
        const runningTask = running.get(taskId)

        if (runningTask) {
          // Interrupt the running fiber
          yield* interrupt(runningTask.fiber)

          // Update task status
          yield* persistence.updateTaskStatus(taskId, "cancelled")

          yield* log(`Task cancelled: ${taskId}`)
          return true
        }

        // Task might be in pending queue - try to update status
        yield* persistence.updateTaskStatus(taskId, "cancelled")
          .pipe(Effect.ignore) // Ignore if task doesn't exist

        yield* log(`Task cancellation attempted: ${taskId}`)
        return false
      })

    const getRunningTasks = () =>
      Effect.gen(function*() {
        const running = yield* get(runningTasks)
        return [...running.keys()]
      })

    const cleanup = () =>
      Effect.gen(function*() {
        yield* log("Starting internal queue cleanup...")

        // Signal shutdown
        yield* set(isShuttingDown, true)

        // Get all processing fibers
        const states = yield* get(processingStates)
        const processingFibers = [...states.values()]
          .map((state) => getOrNull(state.processingFiber))
          .filter(Boolean) as Array<RuntimeFiber<never, never>>

        // Get all running task fibers
        const running = yield* get(runningTasks)
        const taskFibers = [...running.values()].map((rt) => rt.fiber)

        // Interrupt all fibers
        yield* Effect.forEach(
          [...processingFibers, ...taskFibers],
          (fiber) => interrupt(fiber),
          { concurrency: "unbounded" }
        )

        // Wait a moment for graceful shutdown
        yield* Effect.sleep(millis(500))

        yield* log("Internal queue cleanup completed")
      })

    // ========================================================================
    // SERVICE INTERFACE
    // ========================================================================

    return InternalQueue.of({
      enqueue,
      getStatus,
      pauseProcessing,
      resumeProcessing,
      cancelTask,
      getRunningTasks,
      cleanup
    })
  })
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create task factory for easy task creation
 */
export const createTask = <A, E>(
  operation: Effect.Effect<A, E>,
  options: {
    type: QueueTask["type"]
    resourceGroup: ResourceGroup
    priority?: number
    maxRetries?: number
    estimatedDuration?: Duration
    operationData?: Record<string, unknown> | undefined
  }
): QueueTask<A, E> => ({
  id: generateTaskId(),
  sessionId: "", // Will be set by the persistence layer
  type: options.type,
  resourceGroup: options.resourceGroup,
  operation,
  priority: options.priority ?? 5,
  estimatedDuration: options.estimatedDuration ?? seconds(30),
  maxRetries: options.maxRetries ?? 3,
  operationData: options.operationData
    ? some(options.operationData)
    : none() as Option<Record<string, unknown>>
})

/**
 * Test implementation
 */
export const InternalQueueTest = succeed(
  InternalQueue,
  InternalQueue.of({
    enqueue: () => Effect.succeed(void 0),
    getStatus: () =>
      Effect.succeed({
        queues: {
          filesystem: { size: 0, isProcessing: false, lastProcessed: none() },
          network: { size: 0, isProcessing: false, lastProcessed: none() },
          computation: { size: 0, isProcessing: false, lastProcessed: none() },
          "memory-intensive": { size: 0, isProcessing: false, lastProcessed: none() }
        },
        totalPending: 0,
        totalRunning: 0,
        processingFibers: []
      }),
    pauseProcessing: () => Effect.succeed(void 0),
    resumeProcessing: () => Effect.succeed(void 0),
    cancelTask: () => Effect.succeed(false),
    getRunningTasks: () => Effect.succeed([]),
    cleanup: () => Effect.succeed(void 0)
  })
)
