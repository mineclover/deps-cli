/**
 * Example Commands Module
 *
 * Configurable example commands demonstrating Effect CLI patterns.
 * Use config.ts to enable/disable examples globally or individually.
 */

import { catCommand } from "./CatCommand.js"
import { ENABLE_EXAMPLES, ExampleConfig } from "./config.js"
import { findCommand } from "./FindCommand.js"
import { listCommand } from "./ListCommand.js"
import { advancedCommand, sampleCommand } from "./SampleCommand.js"

// Conditional imports based on configuration
const getEnabledCommands = () => {
  if (!ENABLE_EXAMPLES) {
    return []
  }

  const commands = []

  if (ExampleConfig.LIST_COMMAND) commands.push(listCommand)
  if (ExampleConfig.CAT_COMMAND) commands.push(catCommand)
  if (ExampleConfig.FIND_COMMAND) commands.push(findCommand)
  if (ExampleConfig.SAMPLE_COMMAND) commands.push(sampleCommand)
  if (ExampleConfig.ADVANCED_COMMAND) commands.push(advancedCommand)

  return commands
}

/**
 * Configured example commands array
 * Only includes commands that are enabled in config.ts
 */
export const exampleCommands = getEnabledCommands()

/**
 * Individual command exports (always available for selective import)
 * These exports ignore the configuration and can be imported directly
 */
export { advancedCommand, catCommand, findCommand, listCommand, sampleCommand }

/**
 * Configuration exports for external use
 */
export { ENABLE_EXAMPLES, ExampleConfig } from "./config.js"

/**
 * Usage Examples:
 *
 * 1. Use all configured examples:
 *    import { exampleCommands } from "./examples/index.js"
 *    Command.withSubcommands([...exampleCommands, ...myCommands])
 *
 * 2. Use specific examples only:
 *    import { listCommand, sampleCommand } from "./examples/index.js"
 *    Command.withSubcommands([listCommand, sampleCommand])
 *
 * 3. Disable all examples:
 *    Set ENABLE_EXAMPLES = false in config.ts
 *
 * 4. Disable specific examples:
 *    Set individual flags to false in ExampleConfig
 */
