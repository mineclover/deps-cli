#!/usr/bin/env node

import { Command } from 'commander'
import { createCommandRegistry } from './commands/CommandRegistry.js'
import { registerNamespaceCommands } from './commands/NamespaceCommands.js'

const program = new Command()

program
  .name('deps-cli')
  .description('🎯 Namespace-based file pattern configuration tool')
  .version('2.0.0')
  .option('--namespace <name>', 'Use specific configuration namespace')
  .option('--list-namespaces', 'List all available configuration namespaces')

// =========================================================
// COMMAND REGISTRATION
// =========================================================

const registry = createCommandRegistry()

// Register namespace management commands
registry.registerModule(registerNamespaceCommands)

// Register all commands
registry.registerAll(program)

// Help command
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name(),
})

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason)
  process.exit(1)
})

program.parse()
