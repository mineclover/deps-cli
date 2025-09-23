/**
 * Simple CLI Commands (No Queue System)
 *
 * Commands that don't require the queue system.
 */

// Code analysis commands (no queue dependency)
import { analyzeCommand } from "./AnalyzeCommand.js"
import { classifyCommand } from "./ClassifyCommand.js"

/**
 * Simple commands array - no queue system required
 */
export const simpleCommands = [
  analyzeCommand,
  classifyCommand
]

/**
 * Individual command exports
 */
export { analyzeCommand, classifyCommand }
