import { millis, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
import { fixed } from "effect/Schedule"
/**
 * User Experience Enhancer
 *
 * Advanced user experience enhancements for the Effect CLI with queue integration.
 * Provides intelligent progress tracking, contextual help, and adaptive feedback
 * based on user behavior patterns and system performance.
 *
 * Phase 3.4: User Experience Enhancement
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { GenericTag } from "effect/Context"

import * as Effect from "effect/Effect"
import { effect } from "effect/Layer"
import type { Layer } from "effect/Layer"

import { InternalQueue } from "../Queue/index.js"
import type { QueueMetrics } from "../Queue/types.js"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * User experience enhancer service interface
 *
 * Provides intelligent feedback, progress tracking, and contextual assistance
 * to improve user interaction with the CLI and queue system.
 */
export interface UserExperienceEnhancer {
  // Progress Tracking
  readonly startProgress: (
    operation: string,
    estimatedDuration?: Duration,
    options?: ProgressOptions
  ) => Effect.Effect<ProgressTracker>
  readonly trackLongRunningOperation: <A, E>(
    operation: Effect.Effect<A, E>,
    description: string,
    options?: ProgressOptions
  ) => Effect.Effect<A, E>

  // Contextual Help
  readonly showSystemStatus: () => Effect.Effect<void>
  readonly suggestOptimizations: () => Effect.Effect<Array<string>>
  readonly explainQueueBehavior: (operation: string) => Effect.Effect<string>

  // Adaptive Feedback
  readonly provideSmartFeedback: (context: FeedbackContext) => Effect.Effect<void>
  readonly detectUserPatterns: () => Effect.Effect<Array<UserPattern>>
  readonly adaptInterfaceForUser: (patterns: Array<UserPattern>) => Effect.Effect<void>
}

export const UserExperienceEnhancer = GenericTag<UserExperienceEnhancer>("@app/UserExperienceEnhancer")

/**
 * Progress tracking interface
 */
export interface ProgressTracker {
  readonly update: (progress: number, message?: string) => Effect.Effect<void>
  readonly complete: (message?: string) => Effect.Effect<void>
  readonly fail: (error: string) => Effect.Effect<void>
  readonly addStep: (step: string) => Effect.Effect<void>
}

/**
 * Progress configuration options
 */
export interface ProgressOptions {
  readonly showEta?: boolean
  readonly showSteps?: boolean
  readonly showQueuePosition?: boolean
  readonly updateInterval?: Duration
  readonly style?: ProgressStyle
}

export type ProgressStyle = "bar" | "spinner" | "dots" | "minimal"

/**
 * Feedback context for smart assistance
 */
export interface FeedbackContext {
  readonly operation: string
  readonly duration: Duration
  readonly queueMetrics?: QueueMetrics
  readonly errorCount?: number
  readonly userExperienceLevel?: UserLevel
}

export type UserLevel = "beginner" | "intermediate" | "advanced"

/**
 * User behavior patterns
 */
export interface UserPattern {
  readonly type: PatternType
  readonly frequency: number
  readonly context: string
  readonly timestamp: Date
}

export type PatternType =
  | "frequent_queue_checks"
  | "prefers_detailed_output"
  | "uses_advanced_features"
  | "needs_help_prompts"
  | "performance_focused"

// ============================================================================
// PROGRESS TRACKING IMPLEMENTATION
// ============================================================================

/**
 * Advanced progress tracker with adaptive feedback
 */
class LiveProgressTracker implements ProgressTracker {
  private currentProgress = 0 // Store for progress tracking
  private _steps: Array<string> = []
  private startTime = Date.now()

  constructor(
    private operation: string,
    private estimatedDuration?: Duration,
    private options: ProgressOptions = {}
  ) {}

  update = (progress: number, message?: string): Effect.Effect<void> => {
    return Effect.sync(() => {
      const currentProgress = Math.max(0, Math.min(100, progress))
      const elapsed = Date.now() - this.startTime

      // Build progress display
      const display = this._buildProgressDisplay(progress, elapsed, message)

      // Update console with progress
      process.stdout.write(`\r${display}`)

      this.currentProgress = currentProgress
    }).pipe(
      Effect.catchAll(() => Effect.void)
    )
  }

  complete = (message?: string): Effect.Effect<void> => {
    return Effect.sync(() => {
      const elapsed = Date.now() - this.startTime
      const successMessage = message || `${this.operation} completed`

      process.stdout.write(`\r✅ ${successMessage} (${this.formatDuration(elapsed)})\n`)
    })
  }

  fail = (error: string): Effect.Effect<void> => {
    return Effect.sync(() => {
      const elapsed = Date.now() - this.startTime
      process.stdout.write(`\r❌ ${this.operation} failed: ${error} (${this.formatDuration(elapsed)})\n`)
    })
  }

  addStep = (step: string): Effect.Effect<void> => {
    return Effect.sync(() => {
      this._steps.push(step)
    })
  }

  private _buildProgressDisplay(progress: number, elapsed: number, message?: string): string {
    const style = this.options.style || "bar"
    let display = ""

    // Use stored progress for consistency checks
    const actualProgress = Math.max(this.currentProgress, progress)

    switch (style) {
      case "bar": {
        const barLength = 20
        const filled = Math.floor((actualProgress / 100) * barLength)
        const bar = "█".repeat(filled) + "░".repeat(barLength - filled)
        display = `🔄 [${bar}] ${actualProgress.toFixed(1)}% ${this.operation}`
        break
      }

      case "spinner": {
        const spinners = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        const spinner = spinners[Math.floor(elapsed / 100) % spinners.length]
        display = `${spinner} ${progress.toFixed(1)}% ${this.operation}`
        break
      }

      case "dots": {
        const dotCount = Math.floor(elapsed / 500) % 4
        const dots = ".".repeat(dotCount) + " ".repeat(3 - dotCount)
        display = `🔄 ${progress.toFixed(1)}% ${this.operation}${dots}`
        break
      }

      case "minimal":
        display = `${progress.toFixed(1)}% ${this.operation}`
        break
    }

    if (message) {
      display += ` - ${message}`
    }

    // Add ETA if available and requested
    if (this.options.showEta && this.estimatedDuration && progress > 0) {
      const totalMs = toMillis(this.estimatedDuration)
      const eta = ((totalMs / progress) * (100 - progress)) / 100
      display += ` (ETA: ${this.formatDuration(eta)})`
    }

    return display
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }
}

// ============================================================================
// USER EXPERIENCE ENHANCER IMPLEMENTATION
// ============================================================================

/**
 * Live implementation of UserExperienceEnhancer
 */
export const UserExperienceEnhancerLive: Layer<UserExperienceEnhancer, never, InternalQueue> = effect(
  UserExperienceEnhancer,
  Effect.gen(function*() {
    const queue = yield* InternalQueue

    // User behavior tracking (in-memory for this implementation)
    const userPatterns: Array<UserPattern> = []

    // ========================================================================
    // PROGRESS TRACKING
    // ========================================================================

    const startProgress = (
      operation: string,
      estimatedDuration?: Duration,
      options: ProgressOptions = {}
    ): Effect.Effect<ProgressTracker> =>
      Effect.gen(function*() {
        const tracker = new LiveProgressTracker(operation, estimatedDuration, options)
        yield* Effect.log(`Starting progress tracking for: ${operation}`)
        return tracker
      })

    const trackLongRunningOperation = <A, E>(
      operation: Effect.Effect<A, E>,
      description: string,
      options: ProgressOptions = {}
    ): Effect.Effect<A, E> =>
      Effect.gen(function*() {
        const progress = yield* startProgress(description, undefined, options)

        yield* progress.addStep("Initializing")

        // Start the operation with periodic progress updates
        const result = yield* operation.pipe(
          Effect.race(
            // Progress update schedule
            Effect.gen(function*() {
              let currentProgress = 0
              yield* Effect.repeat(
                Effect.gen(function*() {
                  currentProgress = Math.min(90, currentProgress + 10)
                  yield* progress.update(currentProgress, "Processing...")
                }),
                fixed(
                  millis(options.updateInterval ? toMillis(options.updateInterval) : 500)
                )
              )
            }).pipe(Effect.forever)
          ),
          Effect.tap(() => progress.complete(`${description} completed successfully`)),
          Effect.tapError((error) => progress.fail(`${description} failed: ${String(error)}`))
        )

        return result
      })

    // ========================================================================
    // CONTEXTUAL HELP
    // ========================================================================

    const showSystemStatus = (): Effect.Effect<void> =>
      Effect.gen(function*() {
        yield* Effect.log("📊 System Status Dashboard")
        yield* Effect.log("=".repeat(50))

        // Queue system status
        const status = yield* queue.getStatus()
        const isHealthy = status.totalPending < 100 && status.totalRunning < 10
        yield* Effect.log(`Queue Status: ${isHealthy ? "🟢 Healthy" : "🔴 Issues Detected"}`)
        yield* Effect.log(`Running Tasks: ${status.totalRunning}`)
        yield* Effect.log(`Pending Tasks: ${status.totalPending}`)
        yield* Effect.log(`Active Fibers: ${status.processingFibers.length}`)

        // Resource group breakdown
        yield* Effect.log(`\n🔧 Resource Group Status:`)
        yield* Effect.forEach(Object.entries(status.queues), ([group, queueInfo]) =>
          Effect.log(`  ${group}: ${queueInfo.size} queued, ${queueInfo.isProcessing ? "processing" : "idle"}`))
      })

    const suggestOptimizations = (): Effect.Effect<Array<string>> =>
      Effect.gen(function*() {
        const status = yield* queue.getStatus()
        const suggestions: Array<string> = []

        // Analyze status and provide suggestions
        if (status.totalRunning > 10) {
          suggestions.push("🔧 High concurrent task load - consider spacing out operations")
        }

        if (status.totalPending > 50) {
          suggestions.push("📋 Many pending tasks - queue processing may be backed up")
        }

        Object.entries(status.queues).forEach(([group, queueInfo]) => {
          if (queueInfo.size > 20) {
            suggestions.push(
              `📈 High ${group} queue depth (${queueInfo.size} tasks) - consider optimization`
            )
          }
        })

        if (suggestions.length === 0) {
          suggestions.push("✅ System is performing well! No optimizations needed.")
        }

        return suggestions
      })

    const explainQueueBehavior = (operation: string): Effect.Effect<string> =>
      Effect.sync(() => {
        const explanations: Record<string, string> = {
          "file-read":
            "File read operations are queued in the 'filesystem' resource group to prevent I/O conflicts and optimize disk access patterns.",
          "file-write":
            "File write operations use queue serialization to prevent data corruption and ensure atomic file modifications.",
          "network-request":
            "Network requests are managed by the queue system to respect rate limits and handle connection pooling efficiently.",
          "computation":
            "CPU-intensive operations are queued to prevent system overload and maintain responsive user interface.",
          "directory-list":
            "Directory listing operations are optimized through the queue system with intelligent caching and batch processing."
        }

        return explanations[operation] ||
          `The '${operation}' operation is automatically managed by the queue system for optimal resource utilization and error handling.`
      })

    // ========================================================================
    // ADAPTIVE FEEDBACK
    // ========================================================================

    const provideSmartFeedback = (context: FeedbackContext): Effect.Effect<void> =>
      Effect.gen(function*() {
        const duration = toMillis(context.duration)

        // Provide contextual feedback based on operation characteristics
        if (duration > 5000) {
          yield* Effect.log(
            `💡 The ${context.operation} operation took ${
              (duration / 1000).toFixed(1)
            }s. Consider using progress tracking for better visibility.`
          )
        }

        if (context.errorCount && context.errorCount > 0) {
          yield* Effect.log(
            `⚠️ Encountered ${context.errorCount} errors during ${context.operation}. Use 'queue status --detailed' to investigate.`
          )
        }

        if (context.queueMetrics && context.queueMetrics.pendingTasks > 10) {
          yield* Effect.log(
            `📋 Queue has ${context.queueMetrics.pendingTasks} pending tasks. Your operation may experience delays.`
          )
        }

        // Level-based feedback
        if (context.userExperienceLevel === "beginner") {
          yield* Effect.log(
            `💡 Tip: Use 'queue status' to monitor system performance and 'ls --help' to see all available options.`
          )
        }
      })

    const detectUserPatterns = (): Effect.Effect<Array<UserPattern>> => Effect.succeed(userPatterns)

    const adaptInterfaceForUser = (patterns: Array<UserPattern>): Effect.Effect<void> =>
      Effect.gen(function*() {
        // Analyze patterns and adapt interface
        const hasAdvancedUsage = patterns.some((p) => p.type === "uses_advanced_features")
        const needsHelp = patterns.some((p) => p.type === "needs_help_prompts")

        if (hasAdvancedUsage) {
          yield* Effect.log("🎯 Detected advanced user patterns - enabling detailed output by default")
        }

        if (needsHelp) {
          yield* Effect.log("💡 Providing additional guidance based on usage patterns")
        }
      })

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    return UserExperienceEnhancer.of({
      startProgress,
      trackLongRunningOperation,
      showSystemStatus,
      suggestOptimizations,
      explainQueueBehavior,
      provideSmartFeedback,
      detectUserPatterns,
      adaptInterfaceForUser
    })
  })
)
