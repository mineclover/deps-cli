/**
 * User Experience Module
 *
 * Advanced user experience enhancements for the Effect CLI.
 * Provides intelligent feedback, progress tracking, and adaptive interface
 * based on user behavior and system performance.
 *
 * Phase 3.4: User Experience Enhancement
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

// Core service
export {
  type FeedbackContext,
  type PatternType,
  type ProgressOptions,
  type ProgressStyle,
  type ProgressTracker,
  UserExperienceEnhancer,
  UserExperienceEnhancerLive,
  type UserLevel,
  type UserPattern
} from "./UserExperienceEnhancer.js"

// Utility functions
export {
  adaptiveProgressStyle,
  createProgressTracker,
  enhanceCommandWithProgress,
  getUserLevelFromPatterns
} from "./utils.js"
