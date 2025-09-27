#!/usr/bin/env node

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Command } from 'commander'
import { EnhancedDependencyAnalyzer } from './analyzers/EnhancedDependencyAnalyzer.js'
import { globalConfig } from './config/ConfigManager.js'

const program = new Command()

// 전역 설정 로드
let configLoaded = false

async function ensureConfig(options: Record<string, any> = {}) {
  if (!configLoaded) {
    try {
      // namespace 옵션이 있는 경우 namespace 기반 로딩 사용
      if (options.useNamespace) {
        await globalConfig.loadWithNamespace({
          cliArgs: options,
          namespace: options.useNamespace,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true,
        })
      } else {
        // 강화된 로딩 방식 사용 (재시도 + 캐싱)
        await globalConfig.loadWithRetry({
          cliArgs: options,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true,
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
          maxSize: cacheStats.maxSize,
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
  .name('deps-cli')
  .description(
    '🚀 Enhanced TypeScript/JavaScript dependency analysis with AST-based parsing, Biome integration, and namespace configuration management'
  )
  .version('2.0.0')
  .option('--namespace <name>', 'Use specific configuration namespace for environment-specific analysis')
  .option('--list-namespaces', 'List all available configuration namespaces (development, production, staging, etc.)')

// =========================================================
// ENHANCED DEPENDENCY ANALYSIS COMMANDS (AST-BASED)
// Legacy commands have been removed - see migration guide
// =========================================================

// Enhanced analyze command
program
  .command('analyze-enhanced')
  .description(
    '🔍 Comprehensive dependency analysis using AST parsing with 99%+ accuracy. Builds complete dependency graphs, detects entry points, and analyzes import/export relationships.'
  )
  .argument(
    '<filePath>',
    'Path to the file or directory to analyze (supports TypeScript, JavaScript, and mixed projects)'
  )
  .option('--format <format>', 'Output format: json (detailed graph data) or summary (human-readable stats)', 'summary')
  .option('-v, --verbose', 'Enable detailed analysis output with timing information and file counts')
  .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude (e.g., "*.test.ts,node_modules/**")')
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
        const patterns = options.exclude
          .split(',')
          .map((p: string) => p.trim())
          .filter(Boolean)
        for (const pattern of patterns) {
          excludePatterns.push(pattern)
        }
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
      console.error('❌ Enhanced analysis failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('find-usages-enhanced')
  .description(
    '🔎 Find all files that import or reference a specific file using precise AST analysis. Perfect for refactoring and impact analysis.'
  )
  .argument('<filePath>', 'Target file path to find usages for (relative or absolute path, supports .ts/.js files)')
  .option(
    '--format <format>',
    'Output format: json (machine-readable) or summary (formatted list with counts)',
    'summary'
  )
  .option('-v, --verbose', 'Enable verbose output showing import details and line numbers')
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
      console.error('❌ Enhanced file usage analysis failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('find-method-usages-enhanced')
  .description(
    '🎯 Find all locations where a specific method or function is called using advanced AST parsing. Supports both class methods and standalone functions.'
  )
  .argument('<className>', "Class name for methods (use 'null' for standalone functions like utils or helpers)")
  .argument('<methodName>', 'Method or function name to search for (case-sensitive)')
  .option(
    '--format <format>',
    'Output format: json (detailed usage data) or summary (readable list with locations)',
    'summary'
  )
  .option('-v, --verbose', 'Enable verbose output showing call context and line numbers')
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
        console.log(
          JSON.stringify(
            {
              className: classNameOrNull,
              methodName,
              usages: methodUsages,
            },
            null,
            2
          )
        )
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
      console.error('❌ Enhanced method usage analysis failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('find-unused-files-enhanced')
  .description(
    '🧹 Discover dead code by finding files that are never imported anywhere using graph analysis. Eliminates false positives with smart entry point detection.'
  )
  .option(
    '--format <format>',
    'Output format: json (structured data) or summary (formatted report with statistics)',
    'summary'
  )
  .option('-v, --verbose', 'Enable detailed output showing entry points and analysis steps')
  .option('--include-tests', 'Include test files as entry points (recommended for accurate analysis)', true)
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
        console.log(
          JSON.stringify(
            {
              totalFiles: graph.nodes.size,
              unusedFiles,
              entryPoints: graph.entryPoints,
            },
            null,
            2
          )
        )
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
      console.error('❌ Enhanced unused files analysis failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('find-unused-methods-enhanced')
  .description(
    '⚡ Identify unused methods and functions across your codebase using sophisticated AST analysis. Helps reduce bundle size and improve maintainability.'
  )
  .option(
    '--format <format>',
    'Output format: json (machine-readable method data) or summary (organized report by class/file)',
    'summary'
  )
  .option('-v, --verbose', 'Enable verbose output with method signatures and file locations')
  .option('--include-private', 'Include private methods in analysis (useful for internal API cleanup)', false)
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
      console.error(
        '❌ Enhanced unused methods analysis failed:',
        error instanceof Error ? error.message : String(error)
      )
      process.exit(1)
    }
  })

// =========================================================
// NAMESPACE CONFIGURATION MANAGEMENT COMMANDS
// =========================================================

// List namespaces command
program
  .command('list-namespaces')
  .description(
    '📋 Display all available configuration namespaces with their settings. Useful for environment management and configuration overview.'
  )
  .option(
    '--config <file>',
    'Path to configuration file (defaults to deps-cli.config.json in current directory)',
    'deps-cli.config.json'
  )
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
      console.error('❌ Failed to list namespaces:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Create namespace command
program
  .command('create-namespace')
  .description(
    '🆕 Create a new configuration namespace for environment-specific analysis settings (development, production, staging, etc.)'
  )
  .argument('<name>', 'Namespace name (e.g., development, production, staging, testing)')
  .option('--config <file>', 'Configuration file path (creates if not exists)', 'deps-cli.config.json')
  .option('--copy-from <namespace>', 'Copy settings from existing namespace as template')
  .option('--set-default', 'Set this namespace as the default for future operations')
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
          development: { verbose: false, debugMode: false, mockApiCalls: false },
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
      console.error('❌ Failed to create namespace:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Delete namespace command
program
  .command('delete-namespace')
  .description('🗑️ Permanently remove a configuration namespace and all its settings. Use with caution!')
  .argument('<name>', 'Namespace name to delete (cannot be undone)')
  .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
  .option('--force', 'Force deletion without confirmation prompt (dangerous!)')
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
      console.error('❌ Failed to delete namespace:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

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

// === Experimental Structural Markdown Mapping Commands ===

program
  .command('experimental')
  .description('🧪 Experimental features for testing new functionality')
  .addCommand(
    program
      .createCommand('markdown')
      .description('🔬 Generate experimental structural markdown mapping from dependency analysis')
      .argument('[path]', 'Path to analyze', '.')
      .option('--output <dir>', 'Output directory for markdown files', './docs/dependencies')
      .option('--template <type>', 'Template type: detailed, summary, compact', 'detailed')
      .option('--include-source', 'Include source code in markdown files', false)
      .option('--format <format>', 'Front matter format: yaml, json', 'yaml')
      .option('--config-output <dir>', 'Config setting: Default output directory for markdown generation')
      .option('--single-file', 'Process only the specified file instead of entire project', false)
      .option('--use-namespace <name>', 'Use specific namespace configuration for markdown generation')
      .action(async (path, options) => {
        try {
          console.log('🧪 Experimental Structural Markdown Mapping')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log(`📁 Analyzing: ${path}`)
          console.log(`📄 Output: ${options.output}`)
          console.log(`🎨 Template: ${options.template}`)
          if (options.useNamespace) {
            console.log(`🏷️ Namespace: ${options.useNamespace}`)
          }

          // Config 출력 디렉토리 설정
          if (options.configOutput) {
            console.log(`⚙️ Setting config output directory: ${options.configOutput}`)
            const { globalConfig } = await import('./config/ConfigManager.js')

            if (options.useNamespace) {
              // namespace별 설정 저장
              try {
                const config = await globalConfig.loadNamespacedConfig(undefined, options.useNamespace)
                config.markdown = config.markdown || {}
                config.markdown.outputDir = options.configOutput
                await globalConfig.setNamespaceConfig(options.useNamespace, config)
                console.log(`✅ Config updated for namespace '${options.useNamespace}'`)
              } catch (error) {
                console.error(
                  `❌ Failed to update namespace config: ${error instanceof Error ? error.message : String(error)}`
                )
                return
              }
            } else {
              // 전역 설정 저장
              globalConfig.set('markdown.defaultOutputDir', options.configOutput)
              console.log('✅ Global config updated successfully')
            }
            return
          }

          // namespace 설정 로드 및 적용
          let finalOutputDir = options.output
          let finalTemplate = options.template
          let finalIncludeSource = options.includeSource
          let finalFormat = options.format

          if (options.useNamespace) {
            try {
              const { globalConfig } = await import('./config/ConfigManager.js')
              const namespaceConfig = await globalConfig.loadNamespacedConfig(undefined, options.useNamespace)

              if (namespaceConfig.markdown) {
                finalOutputDir = namespaceConfig.markdown.outputDir || finalOutputDir
                finalTemplate = namespaceConfig.markdown.template || finalTemplate
                finalIncludeSource = namespaceConfig.markdown.includeSource ?? finalIncludeSource
                finalFormat = namespaceConfig.markdown.frontMatterFormat || finalFormat

                console.log(`🔧 Applied namespace '${options.useNamespace}' settings:`)
                console.log(`   📁 Output: ${finalOutputDir}`)
                console.log(`   🎨 Template: ${finalTemplate}`)
                console.log(`   📝 Include Source: ${finalIncludeSource}`)
                console.log(`   📋 Format: ${finalFormat}`)
              }
            } catch (error) {
              console.warn(
                `⚠️ Failed to load namespace '${options.useNamespace}' config, using defaults:`,
                error instanceof Error ? error.message : String(error)
              )
            }
          }

          // 동적 import로 매핑 엔진 로드
          const { StructuralMappingEngine } = await import('./mapping/StructuralMappingEngine.js')
          const { EnhancedDependencyAnalyzer } = await import('./analyzers/EnhancedDependencyAnalyzer.js')

          // 의존성 분석 실행
          console.log('\n🔍 Running dependency analysis...')

          let analyzer: any
          let graph: any

          if (options.singleFile) {
            // 단일 파일 처리
            console.log('📄 Single file mode enabled')
            analyzer = new EnhancedDependencyAnalyzer('.')

            // 프로젝트 전체를 분석하되 결과를 필터링
            const fullGraph = await analyzer.buildProjectDependencyGraph()

            // 지정된 파일만 포함하도록 필터링
            const { resolve } = await import('node:path')
            const targetFile = resolve(path)

            graph = {
              nodes: new Set([targetFile]),
              edges: fullGraph.edges.filter((edge: any) => edge.from === targetFile || edge.to === targetFile),
              exportMap: new Map([[targetFile, fullGraph.exportMap.get(targetFile) || []]]),
              importMap: new Map([[targetFile, fullGraph.importMap.get(targetFile) || []]]),
              entryPoints: [targetFile],
            }

            console.log(`🎯 Focused on single file: ${path}`)
          } else {
            // 프로젝트 전체 처리
            analyzer = new EnhancedDependencyAnalyzer(path)
            graph = await analyzer.buildProjectDependencyGraph()
          }

          // 구조적 매핑 엔진 초기화 (MirrorPathMapper 포함)
          const mappingEngine = new StructuralMappingEngine(path, finalOutputDir)

          // 설정 업데이트 (namespace 설정 적용)
          mappingEngine.updateConfig({
            outputDirectory: finalOutputDir,
            templateType: finalTemplate,
            includeSourceCode: finalIncludeSource,
            frontMatterFormat: finalFormat,
          })

          // 의존성 그래프를 마크다운 노드로 변환
          console.log('🔄 Converting dependency graph to markdown nodes...')
          const nodes = await mappingEngine.processDependencyGraph(graph, path, options.useNamespace)

          // 통계 생성
          const stats = mappingEngine.generateDependencyStatistics(nodes)
          console.log(`📊 Generated ${stats.totalNodes} nodes`)
          console.log(`🔗 Total dependencies: ${stats.totalDependencies}`)

          // 역할별 통계 출력
          console.log('\n📋 Role-based statistics:')
          for (const [role, count] of stats.roleStatistics) {
            console.log(`  • ${role}: ${count} files`)
          }

          // 무결성 검증
          console.log('\n🔍 Verifying mapping integrity...')
          const verification = mappingEngine.verifyMappingIntegrity(nodes)

          if (verification.valid) {
            console.log('✅ Mapping integrity verified')
          } else {
            console.log('⚠️ Mapping integrity issues found:')
            verification.errors.forEach((error) => console.log(`  ❌ ${error}`))
            verification.warnings.forEach((warning) => console.log(`  ⚠️ ${warning}`))
          }

          // 마크다운 생성
          console.log('\n📝 Generating markdown files...')
          await mappingEngine.generateMarkdown(nodes)

          console.log(`\n✅ Structural markdown mapping completed!`)
          console.log(`📁 Output directory: ${finalOutputDir}`)
          console.log(`📊 Total files generated: ${stats.totalNodes}`)
          if (options.useNamespace) {
            console.log(`🏷️ Namespace: ${options.useNamespace}`)
          }

          process.exit(0)
        } catch (error) {
          console.error(
            '❌ Experimental markdown generation failed:',
            error instanceof Error ? error.message : String(error)
          )
          process.exit(1)
        }
      })
  )

program
  .command('research')
  .description('🔬 Research tools for mapping strategy development')
  .addCommand(
    program
      .createCommand('mapping-strategies')
      .description('📊 Analyze and compare different mapping strategies')
      .argument('[path]', 'Path to analyze', '.')
      .action(async (path) => {
        try {
          console.log('🔬 Mapping Strategy Research Tool')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { EnhancedDependencyAnalyzer } = await import('./analyzers/EnhancedDependencyAnalyzer.js')
          const { RoleClassifier } = await import('./utils/RoleClassifier.js')

          const analyzer = new EnhancedDependencyAnalyzer(path)
          const graph = await analyzer.buildProjectDependencyGraph()

          console.log(`📁 Total files: ${graph.nodes.size}`)
          console.log(`🔗 Total dependencies: ${graph.edges.length}`)
          console.log(`🚀 Entry points: ${graph.entryPoints.length}`)

          // 역할 분류 연구
          console.log('\n🎭 Role Classification Analysis:')
          const classifier = new RoleClassifier()
          const roleStats = new Map()

          for (const filePath of graph.entryPoints) {
            try {
              const { readFile, stat } = await import('node:fs/promises')
              const content = await readFile(filePath, 'utf-8')
              const stats = await stat(filePath)

              const metadata = {
                id: 'temp' as any,
                path: filePath,
                relativePath: filePath.replace(path, '').replace(/^\//, ''),
                role: 'service' as any,
                language: 'TypeScript',
                size: stats.size,
                lines: content.split('\n').length,
                lastModified: stats.mtime,
                hash: 'temp',
              }

              const role = classifier.classifyFile(metadata, content)
              roleStats.set(role, (roleStats.get(role) || 0) + 1)
            } catch (e) {
              // Skip files that can't be read
            }
          }

          for (const [role, count] of roleStats) {
            console.log(`  • ${role}: ${count} files`)
          }

          console.log('\n🔍 Potential mapping strategies:')
          console.log('  1. File-level mapping (1 file = 1 markdown)')
          console.log('  2. Role-based grouping (group by service/test/utility)')
          console.log('  3. Directory-based hierarchy (preserve folder structure)')
          console.log('  4. Dependency-based clustering (group highly connected files)')

          process.exit(0)
        } catch (error) {
          console.error('❌ Mapping strategy research failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )

program
  .command('prototype')
  .description('🛠️ Prototype generation with specific strategies')
  .addCommand(
    program
      .createCommand('generate')
      .description('🏗️ Generate prototype with specified strategy')
      .argument('<strategy>', 'Strategy: file-level, role-based, directory-based')
      .argument('[path]', 'Path to analyze', '.')
      .option('--output <dir>', 'Output directory', './prototypes')
      .action(async (strategy, path, options) => {
        try {
          console.log(`🏗️ Prototype Generation: ${strategy}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const validStrategies = ['file-level', 'role-based', 'directory-based']
          if (!validStrategies.includes(strategy)) {
            throw new Error(`Invalid strategy: ${strategy}. Valid options: ${validStrategies.join(', ')}`)
          }

          console.log(`📁 Analyzing: ${path}`)
          console.log(`🎯 Strategy: ${strategy}`)
          console.log(`📄 Output: ${options.output}`)

          // 기본 프로토타입 생성 (실제 구현은 추후)
          console.log('\n⚠️ Prototype generation is not yet implemented')
          console.log('🔄 This command will be implemented in future iterations')
          console.log('📋 Current focus: Establishing core mapping architecture')

          process.exit(0)
        } catch (error) {
          console.error('❌ Prototype generation failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )

program
  .command('id')
  .description('🆔 ID system management and operations')
  .addCommand(
    program
      .createCommand('generate')
      .description('🏭 Generate IDs for all files and methods in the project')
      .argument('[path]', 'Path to analyze', '.')
      .option('--format <format>', 'Output format: json, table', 'table')
      .action(async (path, options) => {
        try {
          console.log('🏭 ID Generation System')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { EnhancedDependencyAnalyzer } = await import('./analyzers/EnhancedDependencyAnalyzer.js')
          const { IdGenerator } = await import('./utils/IdGenerator.js')

          const analyzer = new EnhancedDependencyAnalyzer(path)
          const graph = await analyzer.buildProjectDependencyGraph()

          console.log(`📁 Processing ${graph.entryPoints.length} files...`)

          const idMappings = []

          for (const filePath of graph.entryPoints) {
            try {
              const { readFile } = await import('node:fs/promises')
              const content = await readFile(filePath, 'utf-8')
              const relativePath = filePath.replace(path, '').replace(/^\//, '')

              const fileId = IdGenerator.generateFileId(relativePath, content)
              const contentHash = IdGenerator.generateContentHash(content)

              idMappings.push({
                type: 'file',
                id: fileId,
                path: relativePath,
                hash: contentHash.substring(0, 16),
                size: content.length,
              })
            } catch (e) {
              console.warn(`⚠️ Skipped: ${filePath}`)
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(idMappings, null, 2))
          } else {
            console.log(`\n📊 Generated ${idMappings.length} file IDs:\n`)
            console.log('Type     | ID                           | Path                        | Hash')
            console.log('---------|------------------------------|-----------------------------|---------')

            idMappings.slice(0, 10).forEach((mapping) => {
              const truncatedId = mapping.id.substring(0, 28) + '...'
              const truncatedPath = mapping.path.length > 27 ? mapping.path.substring(0, 24) + '...' : mapping.path
              console.log(
                `${mapping.type.padEnd(8)} | ${truncatedId.padEnd(28)} | ${truncatedPath.padEnd(27)} | ${mapping.hash}`
              )
            })

            if (idMappings.length > 10) {
              console.log(`... and ${idMappings.length - 10} more`)
            }
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ ID generation failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )
  .addCommand(
    program
      .createCommand('mapping')
      .description('🗺️ Show current ID mapping table')
      .addCommand(
        program
          .createCommand('show')
          .description('📋 Display current ID mappings')
          .argument('[path]', 'Path to analyze', '.')
          .action(async (path) => {
            try {
              console.log('🗺️ ID Mapping Table')
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              console.log('⚠️ ID mapping persistence is not yet implemented')
              console.log('🔄 Use "deps-cli id generate" to see current IDs')

              process.exit(0)
            } catch (error) {
              console.error('❌ ID mapping display failed:', error instanceof Error ? error.message : String(error))
              process.exit(1)
            }
          })
      )
  )

program
  .command('classify')
  .description('🎭 Role classification operations')
  .addCommand(
    program
      .createCommand('roles')
      .description('📊 Show role classification results for files and methods')
      .argument('[path]', 'Path to analyze', '.')
      .option('--detailed', 'Show detailed classification rules and logic', false)
      .action(async (path, options) => {
        try {
          console.log('🎭 Role Classification Analysis')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { EnhancedDependencyAnalyzer } = await import('./analyzers/EnhancedDependencyAnalyzer.js')
          const { RoleClassifier } = await import('./utils/RoleClassifier.js')

          const analyzer = new EnhancedDependencyAnalyzer(path)
          const graph = await analyzer.buildProjectDependencyGraph()
          const classifier = new RoleClassifier()

          console.log(`📁 Analyzing ${graph.entryPoints.length} files...\n`)

          const classifications = []
          const roleStats = new Map()

          for (const filePath of graph.entryPoints) {
            try {
              const { readFile, stat } = await import('node:fs/promises')
              const content = await readFile(filePath, 'utf-8')
              const stats = await stat(filePath)

              const metadata = {
                id: 'temp' as any,
                path: filePath,
                relativePath: filePath.replace(path, '').replace(/^\//, ''),
                role: 'service' as any,
                language: 'TypeScript',
                size: stats.size,
                lines: content.split('\n').length,
                lastModified: stats.mtime,
                hash: 'temp',
              }

              const role = classifier.classifyFile(metadata, content)
              const displayName = RoleClassifier.getRoleDisplayName(role)

              classifications.push({
                path: metadata.relativePath,
                role,
                displayName,
                size: metadata.size,
                lines: metadata.lines,
              })

              roleStats.set(role, (roleStats.get(role) || 0) + 1)
            } catch (e) {
              // Skip files that can't be read
            }
          }

          // 역할별 통계
          console.log('📊 Role Statistics:')
          for (const [role, count] of roleStats) {
            const displayName = RoleClassifier.getRoleDisplayName(role)
            console.log(`  • ${displayName} (${role}): ${count} files`)
          }

          // 상세 분류 결과 (처음 10개)
          console.log('\n📋 Detailed Classifications (first 10):')
          console.log('Path                           | Role                | Lines')
          console.log('-------------------------------|--------------------|---------')

          classifications.slice(0, 10).forEach((c) => {
            const truncatedPath = c.path.length > 30 ? c.path.substring(0, 27) + '...' : c.path
            console.log(`${truncatedPath.padEnd(30)} | ${c.displayName.padEnd(18)} | ${c.lines}`)
          })

          if (classifications.length > 10) {
            console.log(`... and ${classifications.length - 10} more`)
          }

          if (options.detailed) {
            console.log('\n🔍 Classification Rules:')
            const rules = classifier.getRules()
            rules.slice(0, 5).forEach((rule, i) => {
              console.log(`  ${i + 1}. ${rule.role} (priority: ${rule.priority})`)
              console.log(`     Pattern: ${rule.pattern}`)
            })
            console.log(`     ... and ${rules.length - 5} more rules`)
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Role classification failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )

program
  .command('mapping')
  .description('🗺️ Mapping verification and utilities')
  .addCommand(
    program
      .createCommand('verify')
      .description('✅ Verify mapping integrity and consistency')
      .argument('[path]', 'Path to analyze', '.')
      .action(async (path) => {
        try {
          console.log('✅ Mapping Integrity Verification')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('⚠️ Full mapping verification requires generated mappings')
          console.log('🔄 Use "deps-cli experimental markdown" to generate mappings first')

          // 기본 구조 검증
          const { EnhancedDependencyAnalyzer } = await import('./analyzers/EnhancedDependencyAnalyzer.js')

          const analyzer = new EnhancedDependencyAnalyzer(path)
          const graph = await analyzer.buildProjectDependencyGraph()

          console.log('\n📊 Basic Structure Verification:')
          console.log(`  ✅ Files analyzed: ${graph.entryPoints.length}`)
          console.log(`  ✅ Dependencies mapped: ${graph.edges.length}`)
          console.log(`  ✅ Entry points identified: ${graph.entryPoints.length}`)

          // 순환 의존성 검사
          const circularDeps: string[][] = []
          for (const edge of graph.edges) {
            const reverseEdge = graph.edges.find((e) => e.from === edge.to && e.to === edge.from)
            if (reverseEdge && !circularDeps.some((c) => c.includes(edge.from) && c.includes(edge.to))) {
              circularDeps.push([edge.from, edge.to])
            }
          }

          if (circularDeps.length > 0) {
            console.log(`  ⚠️ Potential circular dependencies: ${circularDeps.length}`)
          } else {
            console.log(`  ✅ No circular dependencies detected`)
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Mapping verification failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )

program
  .command('docs')
  .description('📚 Document navigation and search utilities')
  .addCommand(
    program
      .createCommand('list')
      .description('📋 List all generated markdown documents')
      .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
      .option('--role <role>', 'Filter by role (service, test, config, etc.)')
      .option('--type <type>', 'Filter by type (file, method)')
      .option('--search <term>', 'Search in document titles')
      .option('--limit <number>', 'Limit number of results', '20')
      .option('--sort <field>', 'Sort by field (title, role, lastModified, size)', 'title')
      .option('--order <order>', 'Sort order (asc, desc)', 'asc')
      .option('--show-path', 'Show file paths in output')
      .option('--show-size', 'Show file sizes in output')
      .option('--show-role', 'Show roles in output')
      .option('--format <format>', 'Output format (table, json)', 'table')
      .action(async (options) => {
        try {
          console.log('📚 Document List')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { DocumentNavigator } = await import('./mapping/DocumentNavigator.js')
          const navigator = new DocumentNavigator(options.docsPath)

          const searchOptions = {
            role: options.role,
            type: options.type,
            searchTerm: options.search,
            limit: parseInt(options.limit),
            sortBy: options.sort,
            sortOrder: options.order,
          }

          console.log(`📂 Scanning documents in: ${options.docsPath}`)
          const result = await navigator.searchDocuments(searchOptions)

          console.log(`📊 Found ${result.totalCount} documents`)

          if (result.roles.size > 0) {
            console.log('\n📋 Role breakdown:')
            for (const [role, count] of result.roles) {
              console.log(`  • ${role}: ${count} documents`)
            }
          }

          console.log(`\n📄 Showing ${result.documents.length} documents:\n`)

          if (options.format === 'json') {
            console.log(JSON.stringify(result.documents, null, 2))
          } else {
            const formatted = navigator.formatDocumentsList(result.documents, {
              showPath: options.showPath,
              showSize: options.showSize,
              showRole: options.showRole,
              maxTitleLength: 60,
            })
            console.log(formatted)
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Document listing failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )
  .addCommand(
    program
      .createCommand('find')
      .description('🔍 Find specific document by ID or search term')
      .argument('<query>', 'Document ID or search term')
      .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
      .option('--show-dependencies', 'Show document dependencies')
      .option('--show-content', 'Show document content preview')
      .action(async (query, options) => {
        try {
          console.log('🔍 Document Search')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { DocumentNavigator } = await import('./mapping/DocumentNavigator.js')
          const navigator = new DocumentNavigator(options.docsPath)

          // ID로 직접 조회 시도
          let document = await navigator.getDocumentById(query)

          if (!document) {
            // 검색어로 조회
            console.log(`🔍 Searching for: "${query}"`)
            const result = await navigator.searchDocuments({ searchTerm: query, limit: 10 })

            if (result.documents.length === 0) {
              console.log('❌ No documents found')
              process.exit(0)
            }

            if (result.documents.length === 1) {
              document = result.documents[0]
            } else {
              console.log(`📋 Found ${result.documents.length} matching documents:\n`)
              const formatted = navigator.formatDocumentsList(result.documents, {
                showRole: true,
                maxTitleLength: 80,
              })
              console.log(formatted)
              process.exit(0)
            }
          }

          if (document) {
            console.log(`📄 Document: ${document.title}`)
            console.log(`🆔 ID: ${document.id}`)
            console.log(`🏷️ Role: ${document.role}`)
            console.log(`📁 Type: ${document.type}`)
            console.log(`📏 Size: ${Math.round(document.size / 1024)}KB`)
            console.log(`📅 Last Modified: ${document.lastModified.toLocaleString()}`)
            console.log(`📂 Path: ${document.relativePath}`)

            if (options.showDependencies) {
              const deps = await navigator.getDependencies(document.id)

              if (deps.dependencies.length > 0) {
                console.log(`\n📥 Dependencies (${deps.dependencies.length}):`)
                deps.dependencies.forEach((dep) => {
                  console.log(`  • ${dep.title} (${dep.id})`)
                })
              }

              if (deps.dependents.length > 0) {
                console.log(`\n📤 Dependents (${deps.dependents.length}):`)
                deps.dependents.forEach((dep) => {
                  console.log(`  • ${dep.title} (${dep.id})`)
                })
              }
            }

            if (options.showContent) {
              try {
                const { readFile } = await import('node:fs/promises')
                const content = await readFile(document.path, 'utf-8')
                const preview = content.split('\n').slice(0, 20).join('\n')
                console.log(`\n📖 Content Preview:\n${preview}...`)
              } catch (error) {
                console.log('\n⚠️ Could not read document content')
              }
            }
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Document search failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )
  .addCommand(
    program
      .createCommand('stats')
      .description('📊 Show document statistics and overview')
      .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
      .action(async (options) => {
        try {
          console.log('📊 Document Statistics')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { DocumentNavigator } = await import('./mapping/DocumentNavigator.js')
          const navigator = new DocumentNavigator(options.docsPath)

          const stats = await navigator.getDocumentStatistics()

          console.log(`📄 Total Documents: ${stats.totalDocuments}`)
          console.log(`📏 Average Size: ${Math.round(stats.averageSize / 1024)}KB`)
          console.log(`📅 Last Updated: ${stats.lastUpdated?.toLocaleString() || 'Unknown'}`)

          console.log('\n🏷️ Role Breakdown:')
          for (const [role, count] of stats.roleBreakdown) {
            const percentage = ((count / stats.totalDocuments) * 100).toFixed(1)
            console.log(`  • ${role}: ${count} documents (${percentage}%)`)
          }

          console.log('\n📁 Type Breakdown:')
          for (const [type, count] of stats.typeBreakdown) {
            const percentage = ((count / stats.totalDocuments) * 100).toFixed(1)
            console.log(`  • ${type}: ${count} documents (${percentage}%)`)
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Document statistics failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )
  .addCommand(
    program
      .createCommand('path')
      .description('🗂️ Get consistent document path for ID')
      .argument('<id>', 'Document ID')
      .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
      .action(async (id, options) => {
        try {
          const { DocumentNavigator } = await import('./mapping/DocumentNavigator.js')
          const navigator = new DocumentNavigator(options.docsPath)

          const path = navigator.getDocumentPath(id)
          console.log(path)

          process.exit(0)
        } catch (error) {
          console.error('❌ Path generation failed:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      })
  )

program.parse()
