#!/usr/bin/env node

import { Command } from 'commander'
import { registerAnalysisCommands } from './commands/AnalysisCommands.js'
import { createCommandRegistry } from './commands/CommandRegistry.js'
import { registerExperimentalCommands } from './commands/ExperimentalCommands.js'
import { registerMirrorCommands } from './commands/MirrorCommands.js'
import { registerNamespaceCollectionCommands } from './commands/NamespaceCollectionCommands.js'
import { registerNamespaceCommands } from './commands/NamespaceCommands.js'

const program = new Command()

program
  .name('deps-cli')
  .description(
    '🚀 Enhanced TypeScript/JavaScript dependency analysis with AST-based parsing, Biome integration, and namespace configuration management'
  )
  .version('2.0.0')
  .option('--namespace <name>', 'Use specific configuration namespace for environment-specific analysis')
  .option('--list-namespaces', 'List all available configuration namespaces (development, production, staging, etc.)')

// =========================================================
// COMMAND REGISTRATION
// =========================================================

// 커맨드 레지스트리 초기화
const registry = createCommandRegistry()

// 커맨드 모듈들 등록
registry.registerModule(registerAnalysisCommands)
registry.registerModule(registerNamespaceCommands)
registry.registerModule(registerMirrorCommands)
registry.registerModule(registerExperimentalCommands)
registry.registerModule(registerNamespaceCollectionCommands)

// 모든 커맨드 등록
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
