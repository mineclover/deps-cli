/**
 * Example Commands Configuration
 *
 * Set ENABLE_EXAMPLES to false to exclude all example commands from the CLI.
 * This is useful for production builds where you want to remove sample code.
 */

export const ENABLE_EXAMPLES = true

/**
 * Individual example command toggles
 * You can selectively disable specific examples while keeping others enabled.
 */
export const ExampleConfig = {
  LIST_COMMAND: true,
  CAT_COMMAND: true,
  FIND_COMMAND: true,
  SAMPLE_COMMAND: true,
  ADVANCED_COMMAND: true
} as const

/**
 * Development helper - automatically disable examples in production
 * Uncomment the line below to auto-disable examples based on NODE_ENV
 */
// export const ENABLE_EXAMPLES = process.env.NODE_ENV !== 'production';
