#!/usr/bin/env node

import { Command } from 'commander'
import { registerAnalysisCommands } from './commands/AnalysisCommands.js'
import { createCommandRegistry } from './commands/CommandRegistry.js'
import { registerNamespaceCollectionCommands } from './commands/NamespaceCollectionCommands.js'
import { registerNamespaceCommands } from './commands/NamespaceCommands.js'

const program = new Command()

program
  .name('deps-cli')
  .description(
    '🎯 Namespace-driven TypeScript/JavaScript dependency analysis tool with configurable file patterns and comprehensive code quality insights'
  )
  .version('2.0.0')
  .option('--namespace <name>', 'Use specific configuration namespace for environment-specific analysis')
  .option('--list-namespaces', 'List all available configuration namespaces with their file patterns and settings')

// =========================================================
// COMMAND REGISTRATION
// =========================================================

// 커맨드 레지스트리 초기화
const registry = createCommandRegistry()

// 핵심 커맨드 모듈들 등록 (namespace config 기반)
registry.registerModule(registerAnalysisCommands)          // 코드 분석 명령어들
registry.registerModule(registerNamespaceCommands)         // 네임스페이스 관리
registry.registerModule(registerNamespaceCollectionCommands) // 데이터 수집 및 문서 생성

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
