import { millis, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
/**
 * User Experience Utilities
 *
 * Utility functions for enhanced user experience in the Effect CLI.
 * Provides helpers for progress tracking, command enhancement, and user adaptation.
 *
 * Phase 3.4: User Experience Enhancement Utilities
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import * as Effect from "effect/Effect"

import type {
  FeedbackContext,
  PatternType,
  ProgressOptions,
  ProgressStyle,
  ProgressTracker,
  UserLevel,
  UserPattern
} from "./UserExperienceEnhancer.js"
import { UserExperienceEnhancer } from "./UserExperienceEnhancer.js"

// ============================================================================
// PROGRESS TRACKING UTILITIES
// ============================================================================

/**
 * Create a progress tracker with smart defaults
 */
export const createProgressTracker = (
  operation: string,
  estimatedDuration?: Duration,
  options?: ProgressOptions
): Effect.Effect<ProgressTracker, never, UserExperienceEnhancer> =>
  Effect.gen(function*() {
    const ux = yield* UserExperienceEnhancer

    // Apply smart defaults based on operation type
    const smartOptions: ProgressOptions = {
      style: determineProgressStyle(operation),
      showEta: estimatedDuration !== undefined,
      showSteps: operation.includes("build") || operation.includes("analyze"),
      showQueuePosition: true,
      updateInterval: millis(300),
      ...options
    }

    return yield* ux.startProgress(operation, estimatedDuration, smartOptions)
  })

/**
 * Enhance any command with intelligent progress tracking
 */
export const enhanceCommandWithProgress = <A, E>(
  operation: Effect.Effect<A, E>,
  description: string,
  options?: ProgressOptions
): Effect.Effect<A, E, UserExperienceEnhancer> =>
  Effect.gen(function*() {
    const ux = yield* UserExperienceEnhancer
    return yield* ux.trackLongRunningOperation(operation, description, options)
  })

/**
 * Determine optimal progress style based on operation type and context
 */
export const adaptiveProgressStyle = (
  operation: string,
  userLevel: UserLevel = "intermediate",
  terminalWidth: number = process.stdout.columns || 80
): ProgressStyle => {
  // Simple operations use minimal progress
  if (operation.includes("list") || operation.includes("status")) {
    return "minimal"
  }

  // Complex operations use full progress bar for advanced users
  if (userLevel === "advanced" && (operation.includes("build") || operation.includes("analyze"))) {
    return terminalWidth > 100 ? "bar" : "spinner"
  }

  // Beginner users get simple spinner
  if (userLevel === "beginner") {
    return "spinner"
  }

  // Default: dots for intermediate users
  return "dots"
}

/**
 * Helper to determine progress style based on operation characteristics
 */
const determineProgressStyle = (operation: string): ProgressStyle => {
  if (operation.includes("build") || operation.includes("compile")) {
    return "bar"
  }

  if (operation.includes("test") || operation.includes("analyze")) {
    return "spinner"
  }

  if (operation.includes("download") || operation.includes("upload")) {
    return "bar"
  }

  return "dots"
}

// ============================================================================
// USER PATTERN ANALYSIS UTILITIES
// ============================================================================

/**
 * Determine user experience level from behavior patterns
 */
export const getUserLevelFromPatterns = (patterns: Array<UserPattern>): UserLevel => {
  if (patterns.length === 0) return "beginner"

  const advancedPatterns = patterns.filter((p) =>
    p.type === "uses_advanced_features" ||
    p.type === "performance_focused"
  ).length

  const helpPatterns = patterns.filter((p) => p.type === "needs_help_prompts").length

  const totalPatterns = patterns.length

  // Advanced user: uses advanced features and rarely needs help
  if (advancedPatterns / totalPatterns > 0.3 && helpPatterns / totalPatterns < 0.2) {
    return "advanced"
  }

  // Beginner user: frequently needs help and doesn't use advanced features
  if (helpPatterns / totalPatterns > 0.4 && advancedPatterns / totalPatterns < 0.1) {
    return "beginner"
  }

  // Default to intermediate
  return "intermediate"
}

/**
 * Create a user pattern entry
 */
export const createUserPattern = (
  type: PatternType,
  context: string,
  frequency: number = 1
): UserPattern => ({
  type,
  frequency,
  context,
  timestamp: new Date()
})

/**
 * Analyze command usage to detect patterns
 */
export const analyzeCommandUsage = (
  command: string,
  options: Record<string, unknown>,
  duration: Duration
): Array<UserPattern> => {
  const patterns: Array<UserPattern> = []

  // Detect advanced feature usage
  const advancedOptions = ["detailed", "json", "export", "watch"]
  const usesAdvancedOptions = advancedOptions.some((opt) => opt in options)

  if (usesAdvancedOptions) {
    patterns.push(createUserPattern("uses_advanced_features", `${command} with advanced options`))
  }

  // Detect performance focus
  const durationMs = toMillis(duration)
  if (durationMs < 100 && command !== "help") {
    patterns.push(createUserPattern("performance_focused", `Quick ${command} execution`))
  }

  // Detect help needs
  if (command === "help" || command.endsWith("--help")) {
    patterns.push(createUserPattern("needs_help_prompts", `Requested help for ${command}`))
  }

  // Detect frequent queue checks
  if (command.includes("queue") && command.includes("status")) {
    patterns.push(createUserPattern("frequent_queue_checks", "Queue status check"))
  }

  // Detect preference for detailed output
  if ("detailed" in options || "verbose" in options) {
    patterns.push(createUserPattern("prefers_detailed_output", `${command} with detailed output`))
  }

  return patterns
}

// ============================================================================
// SMART FEEDBACK UTILITIES
// ============================================================================

/**
 * Create feedback context from operation results
 */
export const createFeedbackContext = (
  operation: string,
  duration: Duration,
  errorCount: number = 0,
  userLevel: UserLevel = "intermediate"
): FeedbackContext => ({
  operation,
  duration,
  errorCount,
  userExperienceLevel: userLevel
})

/**
 * Generate contextual tips based on operation and user level
 */
export const generateContextualTips = (
  operation: string,
  userLevel: UserLevel,
  hasErrors: boolean = false
): Array<string> => {
  const tips: Array<string> = []

  if (userLevel === "beginner") {
    tips.push("💡 Use --help after any command to see available options")

    if (operation.includes("list")) {
      tips.push("📁 Try 'ls -l' for detailed file information")
    }

    if (operation.includes("queue")) {
      tips.push("📊 Queue commands help monitor system performance")
    }
  }

  if (userLevel === "intermediate") {
    if (hasErrors) {
      tips.push("🔍 Use 'queue status --detailed' to investigate issues")
    }

    if (operation.includes("build")) {
      tips.push("⚡ Large builds can be monitored with progress tracking")
    }
  }

  if (userLevel === "advanced") {
    tips.push("🎯 Export queue metrics with 'queue export --format json' for analysis")

    if (operation.includes("performance")) {
      tips.push("📈 Consider custom resource group configurations for optimization")
    }
  }

  return tips
}

/**
 * Format duration for user-friendly display
 */
export const formatUserFriendlyDuration = (duration: Duration): string => {
  const ms = toMillis(duration)

  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }

  return `${seconds}s`
}

/**
 * Calculate operation complexity score for adaptive UX
 */
export const calculateComplexityScore = (
  operation: string,
  fileCount: number = 0,
  estimatedDuration?: Duration
): number => {
  let score = 0

  // Base complexity by operation type
  if (operation.includes("build")) score += 0.4
  if (operation.includes("analyze")) score += 0.3
  if (operation.includes("test")) score += 0.2
  if (operation.includes("list") || operation.includes("status")) score += 0.1

  // File count impact
  if (fileCount > 100) score += 0.3
  else if (fileCount > 10) score += 0.2
  else if (fileCount > 1) score += 0.1

  // Duration impact
  if (estimatedDuration) {
    const durationMs = toMillis(estimatedDuration)
    if (durationMs > 30000) score += 0.3
    else if (durationMs > 5000) score += 0.2
    else if (durationMs > 1000) score += 0.1
  }

  return Math.min(1.0, score)
}
