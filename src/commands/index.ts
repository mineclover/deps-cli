/**
 * Main CLI Commands
 *
 * Core functionality commands for the Effect CLI application.
 * These include both template examples and production-ready queue management.
 */

// Template commands
import { greetCommand } from "./GreetCommand.js"

// Queue management commands (core functionality)
import { queueCommand } from "./QueueCommand.js"
import { queueStatusCommand } from "./QueueStatusCommand.js"
import { simpleQueueCommand } from "./SimpleQueueCommand.js"

/**
 * Main commands array
 * Core CLI functionality including queue management
 */
export const mainCommands = [
  // Template command (replace with your commands)
  greetCommand,

  // Queue management (core functionality)
  queueCommand,
  queueStatusCommand,
  simpleQueueCommand
]

/**
 * Individual command exports
 */
export { greetCommand, queueCommand, queueStatusCommand, simpleQueueCommand }
