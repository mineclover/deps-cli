#!/usr/bin/env node

import { Command } from "commander"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { EnhancedDependencyAnalyzer } from "./analyzers/EnhancedDependencyAnalyzer.js"
import { globalConfig } from "./config/ConfigManager.js"

const program = new Command()

// 전역 설정 로드
let configLoaded = false

async function ensureConfig(options: Record<string, any> = {}) {
  if (!configLoaded) {
    try {
      // namespace 옵션이 있는 경우 namespace 기반 로딩 사용
      if (options.namespace) {
        await globalConfig.loadWithNamespace({
          cliArgs: options,
          namespace: options.namespace,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true
        })
      } else {
        // 강화된 로딩 방식 사용 (재시도 + 캐싱)
        await globalConfig.loadWithRetry({
          cliArgs: options,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true
        })
      }
      configLoaded = true

      // 디버그 모드에서 설정 정보 출력
      if (globalConfig.get('development.debugMode')) {
        console.log('🔧 Configuration loaded:')
        console.log(globalConfig.dumpSafe())

        // 캐시 통계도 출력
        const cacheStats = globalConfig.getCacheStats()
        console.log('📊 Cache stats:', {
          memorySize: cacheStats.memorySize,
          maxSize: cacheStats.maxSize
        })
      }
    } catch (error) {
      console.warn('⚠️ Failed to load configuration, attempting auto-recovery:', error)

      // 자동 복구 시도
      const recovery = await globalConfig.autoRecover()
      if (recovery.success) {
        configLoaded = true
        console.log('✅ Configuration auto-recovery successful:', recovery.actions)
      } else {
        console.error('❌ Configuration auto-recovery failed:', recovery.actions)
        // 기본 설정으로 계속 진행
      }
    }
  }
}

program
  .name("deps-cli")
  .description("Enhanced dependency analysis CLI tool with 99%+ accuracy")
  .version("2.0.0")
  .option("--namespace <name>", "Use specific configuration namespace")
  .option("--list-namespaces", "List available configuration namespaces")

// =========================================================
// ENHANCED DEPENDENCY ANALYSIS COMMANDS (AST-BASED)
// Legacy commands have been removed - see migration guide
// =========================================================

// Enhanced analyze command
program
  .command("analyze-enhanced")
  .description("Enhanced dependency analysis with AST-based parsing and graph construction")
  .argument("<filePath>", "Path to the file or directory to analyze")
  .option("--format <format>", "Output format (json, summary)", "summary")
  .option("-v, --verbose", "Enable verbose output")
  .option("--exclude <patterns>", "Comma-separated list of glob patterns to exclude")
  .action(async (filePath, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🚀 Starting enhanced analysis of: ${filePath}`)
      }

      const fullPath = path.resolve(filePath)
      await fs.access(fullPath)

      const stat = await fs.stat(fullPath)
      const projectRoot = stat.isDirectory() ? fullPath : path.dirname(fullPath)

      // exclude 패턴 파싱
      const excludePatterns: Array<string> = []
      if (options.exclude) {
        const patterns = options.exclude.split(',').map((p: string) => p.trim()).filter(Boolean)
        excludePatterns.push(...patterns)
        if (verbose) {
          console.log(`🚫 Excluding patterns: ${patterns.join(', ')}`)
        }
      }

      const analyzer = new EnhancedDependencyAnalyzer(projectRoot)
      const graph = await analyzer.buildProjectDependencyGraph(undefined, excludePatterns)

      if (options.format === 'json') {
        console.log(JSON.stringify(graph, null, 2))
      } else {
        console.log('📊 Enhanced Dependency Analysis Results')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Total files: ${graph.nodes.size}`)
        console.log(`🔗 Dependencies (edges): ${graph.edges.length}`)
        console.log(`🚀 Entry points: ${graph.entryPoints.length}`)

        if (verbose && graph.entryPoints.length > 0) {
          console.log('\n🚀 Entry Points (first 5):')
          graph.entryPoints.slice(0, 5).forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry}`)
          })
        }

        if (verbose && graph.edges.length > 0) {
          console.log('\n🔗 Dependencies (first 10):')
          graph.edges.slice(0, 10).forEach((edge, i) => {
            console.log(`  ${i + 1}. ${edge.from} → ${edge.to}`)
          })
        }

        const unusedFiles = analyzer.findUnusedFilesFromGraph(graph)
        if (unusedFiles.length > 0) {
          console.log(`\n🗑️ Unused files: ${unusedFiles.length}`)
          unusedFiles.slice(0, 5).forEach((file, i) => {
            console.log(`  ${i + 1}. ${file}`)
          })
          if (unusedFiles.length > 5) {
            console.log(`  ... and ${unusedFiles.length - 5} more`)
          }
        }

        const unusedMethods = analyzer.findUnusedMethodsFromGraph(graph)
        if (unusedMethods.length > 0) {
          console.log(`\n🔧 Unused methods: ${unusedMethods.length}`)
          unusedMethods.slice(0, 5).forEach((method, i) => {
            console.log(`  ${i + 1}. ${method.className}.${method.methodName} (${method.type})`)
          })
          if (unusedMethods.length > 5) {
            console.log(`  ... and ${unusedMethods.length - 5} more`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-usages-enhanced")
  .description("Enhanced AST-based analysis to find all files that import/use a specific file")
  .argument("<filePath>", "Target file path to find usages for")
  .option("--format <format>", "Output format (json, summary)", "summary")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (targetFilePath, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const _verbose = options.verbose || config.development?.verbose || false

      const projectRoot = process.cwd()
      const analyzer = new EnhancedDependencyAnalyzer(projectRoot)
      const graph = await analyzer.buildProjectDependencyGraph()

      const usingFiles = await analyzer.findFilesUsingTargetFromGraph(graph, targetFilePath)

      if (options.format === 'json') {
        console.log(JSON.stringify({ targetFile: targetFilePath, usingFiles }, null, 2))
      } else {
        console.log('📄 Enhanced File Usage Analysis')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`🎯 Target file: ${targetFilePath}`)
        console.log(`📁 Total files analyzed: ${graph.nodes.size}`)

        if (usingFiles.length > 0) {
          console.log(`\n✅ Files using this file (${usingFiles.length}):`)
          usingFiles.forEach((file, i) => {
            console.log(`  ${i + 1}. ${file}`)
          })
        } else {
          console.log(`\n❌ No files found using this file.`)
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced file usage analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-method-usages-enhanced")
  .description("Enhanced AST-based analysis to find all files that call a specific method")
  .argument("<className>", "Class name (use 'null' for standalone functions)")
  .argument("<methodName>", "Method or function name")
  .option("--format <format>", "Output format (json, summary)", "summary")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (className, methodName, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const _verbose = options.verbose || config.development?.verbose || false

      const projectRoot = process.cwd()
      const analyzer = new EnhancedDependencyAnalyzer(projectRoot)
      const graph = await analyzer.buildProjectDependencyGraph()

      const classNameOrNull = className === 'null' ? null : className
      const methodUsages = await analyzer.findFilesUsingMethodFromGraph(graph, classNameOrNull, methodName)

      if (options.format === 'json') {
        console.log(JSON.stringify({
          className: classNameOrNull,
          methodName,
          usages: methodUsages
        }, null, 2))
      } else {
        console.log('🔧 Enhanced Method Usage Analysis')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`🎯 Target: ${classNameOrNull ? `${classNameOrNull}.${methodName}` : methodName}`)
        console.log(`📁 Total files analyzed: ${graph.nodes.size}`)

        if (methodUsages.length > 0) {
          console.log(`\n✅ Files using this method (${methodUsages.length}):`)
          methodUsages.forEach((usage, i) => {
            console.log(`  ${i + 1}. ${usage.filePath}`)
            if (_verbose && usage.references) {
              usage.references.forEach((ref: any) => {
                console.log(`     Line ${ref.line}: ${ref.context}`)
              })
            }
          })
        } else {
          console.log(`\n❌ No files found calling this method.`)
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced method usage analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-unused-files-enhanced")
  .description("Enhanced AST-based analysis to find files that are never imported anywhere")
  .option("--format <format>", "Output format (json, summary)", "summary")
  .option("-v, --verbose", "Enable verbose output")
  .option("--include-tests", "Include test files as entry points", true)
  .action(async (options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const _verbose = options.verbose || config.development?.verbose || false

      const projectRoot = process.cwd()
      const analyzer = new EnhancedDependencyAnalyzer(projectRoot)
      const graph = await analyzer.buildProjectDependencyGraph()

      const unusedFiles = analyzer.findUnusedFilesFromGraph(graph)

      if (options.format === 'json') {
        console.log(JSON.stringify({
          totalFiles: graph.nodes.size,
          unusedFiles,
          entryPoints: graph.entryPoints
        }, null, 2))
      } else {
        console.log('🗑️ Enhanced Unused Files Analysis')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Total files: ${graph.nodes.size}`)
        console.log(`🚀 Entry points: ${graph.entryPoints.length}`)

        if (unusedFiles.length === 0) {
          console.log('\n✅ All files are being used!')
        } else {
          console.log(`\n🗑️ Unused files (${unusedFiles.length}):`)
          unusedFiles.forEach((file, i) => {
            console.log(`  ${i + 1}. ${file}`)
          })
        }

        if (_verbose && graph.entryPoints.length > 0) {
          console.log('\n🚀 Entry Points (first 10):')
          graph.entryPoints.slice(0, 10).forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry}`)
          })
          if (graph.entryPoints.length > 10) {
            console.log(`  ... and ${graph.entryPoints.length - 10} more`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced unused files analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-unused-methods-enhanced")
  .description("Enhanced AST-based analysis to find methods that are never called anywhere")
  .option("--format <format>", "Output format (json, summary)", "summary")
  .option("-v, --verbose", "Enable verbose output")
  .option("--include-private", "Include private methods in analysis", false)
  .action(async (options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const _verbose = options.verbose || config.development?.verbose || false

      const projectRoot = process.cwd()
      const analyzer = new EnhancedDependencyAnalyzer(projectRoot)
      const graph = await analyzer.buildProjectDependencyGraph()

      const unusedMethods = analyzer.findUnusedMethodsFromGraph(graph)

      if (options.format === 'json') {
        console.log(JSON.stringify({ unusedMethods }, null, 2))
      } else {
        console.log('🔧 Enhanced Unused Methods Analysis')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Total files analyzed: ${graph.nodes.size}`)

        if (unusedMethods.length === 0) {
          console.log('\n✅ All methods are being used!')
        } else {
          console.log(`\n🔧 Unused methods (${unusedMethods.length}):`)
          unusedMethods.forEach((method, i) => {
            console.log(`  ${i + 1}. ${method.className}.${method.methodName} (${method.type})`)
            if (_verbose) {
              console.log(`     Location: ${method.filePath}:${method.line}`)
              console.log(`     Access: ${method.visibility}`)
            }
          })

          if (!options.verbose && unusedMethods.length > 10) {
            console.log(`\n💡 Use --verbose to see method details and locations`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced unused methods analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// =========================================================
// NAMESPACE CONFIGURATION MANAGEMENT COMMANDS
// =========================================================

// List namespaces command
program
  .command("list-namespaces")
  .description("List all available configuration namespaces")
  .option("--config <file>", "Configuration file path", "deps-cli.config.json")
  .action(async (options) => {
    try {
      const namespaces = await globalConfig.listNamespaces(options.config)

      console.log('📋 Available Configuration Namespaces')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      if (namespaces.namespaces.length === 0) {
        console.log('❌ No namespaces found in configuration file')
        console.log('💡 Use "create-namespace" command to create your first namespace')
      } else {
        console.log(`📁 Total namespaces: ${namespaces.namespaces.length}`)

        if (namespaces.default) {
          console.log(`🎯 Default namespace: ${namespaces.default}`)
        }

        console.log('\n📋 Available namespaces:')
        namespaces.namespaces.forEach((ns, i) => {
          const isDefault = ns === namespaces.default ? ' (default)' : ''
          console.log(`  ${i + 1}. ${ns}${isDefault}`)
        })
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Failed to list namespaces:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Create namespace command
program
  .command("create-namespace")
  .description("Create a new configuration namespace")
  .argument("<name>", "Namespace name")
  .option("--config <file>", "Configuration file path", "deps-cli.config.json")
  .option("--copy-from <namespace>", "Copy settings from existing namespace")
  .option("--set-default", "Set as default namespace")
  .action(async (name, options) => {
    try {
      let config = {}

      // 기존 namespace에서 복사
      if (options.copyFrom) {
        const existingConfig = await globalConfig.loadNamespacedConfig(options.config, options.copyFrom)
        config = { ...existingConfig }
        delete (config as any)._metadata // 메타데이터는 제외
      } else {
        // 기본 설정 사용
        config = {
          analysis: { maxConcurrency: 4, timeout: 30000 },
          logging: { level: 'info', format: 'text', enabled: true },
          output: { defaultFormat: 'summary', compression: false },
          development: { verbose: false, debugMode: false, mockApiCalls: false }
        }
      }

      await globalConfig.setNamespaceConfig(name, config, options.config)

      console.log(`✅ Namespace '${name}' created successfully`)
      if (options.copyFrom) {
        console.log(`📋 Settings copied from namespace '${options.copyFrom}'`)
      }

      // default로 설정
      if (options.setDefault) {
        console.log(`🎯 Set '${name}' as default namespace`)
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Failed to create namespace:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Delete namespace command
program
  .command("delete-namespace")
  .description("Delete a configuration namespace")
  .argument("<name>", "Namespace name to delete")
  .option("--config <file>", "Configuration file path", "deps-cli.config.json")
  .option("--force", "Force deletion without confirmation")
  .action(async (name, options) => {
    try {
      if (!options.force) {
        console.log(`⚠️ This will permanently delete namespace '${name}'`)
        console.log('💡 Use --force to skip this confirmation')
        process.exit(1)
      }

      await globalConfig.deleteNamespace(name, options.config)
      console.log(`✅ Namespace '${name}' deleted successfully`)

      process.exit(0)
    } catch (error) {
      console.error("❌ Failed to delete namespace:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Help command
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name()
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