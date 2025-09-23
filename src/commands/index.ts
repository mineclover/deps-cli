/**
 * Main CLI Commands
 *
 * Core functionality commands for the Effect CLI application.
 * These include production-ready code analysis and queue management.
 */

// Code analysis commands (core functionality)
import { analyzeCommand } from "./AnalyzeCommand.js"

// Queue management commands (core functionality)
import { queueCommand } from "./QueueCommand.js"
import { queueStatusCommand } from "./QueueStatusCommand.js"
import { simpleQueueCommand } from "./SimpleQueueCommand.js"

/**
 * Main commands array
 * Core CLI functionality including queue management
 */
export const mainCommands = [
  // Code analysis (core functionality)
  analyzeCommand,

  // Queue management (core functionality)
  queueCommand,
  queueStatusCommand,
  simpleQueueCommand
]

/**
 * Individual command exports
 */
export { analyzeCommand, queueCommand, queueStatusCommand, simpleQueueCommand }
