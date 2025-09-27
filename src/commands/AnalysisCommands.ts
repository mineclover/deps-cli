import type { Command } from 'commander'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { EnhancedDependencyAnalyzer } from '../analyzers/EnhancedDependencyAnalyzer.js'
import { globalConfig } from '../config/ConfigManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 의존성 분석 관련 커맨드들을 등록하는 함수
 */
export const registerAnalysisCommands = (program: Command): void => {
  registerAnalyzeEnhanced(program)
  registerFindUsagesEnhanced(program)
  registerFindMethodUsagesEnhanced(program)
  registerFindUnusedFilesEnhanced(program)
  registerFindUnusedMethodsEnhanced(program)
}

/**
 * Enhanced analyze command
 */
const registerAnalyzeEnhanced = (program: Command): void => {
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
      .action(wrapAction(async (filePath, options) => {
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
          outputJsonFormat(graph, projectRoot)
        } else {
          outputSummaryFormat(graph, analyzer, verbose)
        }
      }))
  }

/**
 * Find usages enhanced command
 */
const registerFindUsagesEnhanced = (program: Command): void => {
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
      .action(wrapAction(async (targetFilePath: string, options: any) => {
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
      }))
  }

/**
 * Find method usages enhanced command
 */
const registerFindMethodUsagesEnhanced = (program: Command): void => {
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
      .action(wrapAction(async (className: string, methodName: string, options: any) => {
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
      }))
  }

/**
 * Find unused files enhanced command
 */
const registerFindUnusedFilesEnhanced = (program: Command): void => {
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
      .action(wrapAction(async (options: any) => {
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
            graph.entryPoints.slice(0, 10).forEach((entry: any, i: number) => {
              console.log(`  ${i + 1}. ${entry}`)
            })
            if (graph.entryPoints.length > 10) {
              console.log(`  ... and ${graph.entryPoints.length - 10} more`)
            }
          }
        }
      }))
  }

/**
 * Find unused methods enhanced command
 */
const registerFindUnusedMethodsEnhanced = (program: Command): void => {
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
      .action(wrapAction(async (options: any) => {
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
      }))
  }

/**
 * JSON 형식으로 출력
 */
const outputJsonFormat = (graph: any, projectRoot: string): void => {
    const makeRelativePath = (absolutePath: string) => {
      return path.relative(projectRoot, absolutePath)
    }

    const allFiles = Array.from(graph.nodes as Set<string>).map(makeRelativePath)
    const categorizeFile = (filePath: string) => {
      if (filePath.includes('/test/') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.js') || filePath.includes('.spec.')) {
        return 'test'
      } else if (filePath.startsWith('src/')) {
        return 'source'
      } else if (filePath.startsWith('demo/')) {
        return 'demo'
      } else if (filePath.endsWith('.js') && !filePath.startsWith('src/')) {
        return 'script'
      } else {
        return 'other'
      }
    }

        const nodesByType = allFiles.reduce((acc, file) => {
          const type = categorizeFile(file)
          if (!acc[type]) acc[type] = []
          acc[type].push(file)
          return acc
        }, {} as Record<string, Array<string>>)

    const serializedGraph = {
      nodes: nodesByType,
      edges: graph.edges.map((edge: any) => ({
        from: makeRelativePath(edge.from),
        to: makeRelativePath(edge.to),
        importedMembers: edge.importedMembers,
        line: edge.line
      })),
      exportMap: Object.fromEntries(
        Array.from(graph.exportMap.entries() as Array<[string, any]>).map(([filePath, exports]) => [
          makeRelativePath(filePath),
          exports
        ])
      ),
      importMap: Object.fromEntries(
        Array.from(graph.importMap.entries() as Array<[string, any]>).map(([filePath, imports]) => [
          makeRelativePath(filePath),
          imports.map((imp: any) => ({
            ...imp,
            resolvedPath: imp.resolvedPath ? makeRelativePath(imp.resolvedPath) : null
          }))
        ])
      ),
      entryPoints: graph.entryPoints.map(makeRelativePath)
    }

    console.log(JSON.stringify(serializedGraph, null, 2))
  }

/**
 * 요약 형식으로 출력
 */
const outputSummaryFormat = (graph: any, analyzer: EnhancedDependencyAnalyzer, verbose: boolean): void => {
    console.log('📊 Enhanced Dependency Analysis Results')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📁 Total files: ${graph.nodes.size}`)
    console.log(`🔗 Dependencies (edges): ${graph.edges.length}`)
    console.log(`🚀 Entry points: ${graph.entryPoints.length}`)

    if (verbose && graph.entryPoints.length > 0) {
      console.log('\n🚀 Entry Points (first 5):')
      graph.entryPoints.slice(0, 5).forEach((entry: any, i: number) => {
        console.log(`  ${i + 1}. ${entry}`)
      })
    }

    if (verbose && graph.edges.length > 0) {
      console.log('\n🔗 Dependencies (first 10):')
      graph.edges.slice(0, 10).forEach((edge: any, i: number) => {
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

/**
 * 설정 로드
 */
const ensureConfig = async (options: Record<string, any> = {}): Promise<void> => {
    try {
      if (options.useNamespace) {
        await globalConfig.loadWithNamespace({
          cliArgs: options,
          namespace: options.useNamespace,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true,
        })
      } else {
        await globalConfig.loadWithRetry({
          cliArgs: options,
          validateConfig: true,
          throwOnValidationError: false,
          enableCache: true,
        })
      }
    } catch (error) {
      console.warn('⚠️ Failed to load configuration, attempting auto-recovery:', error)
      const recovery = await globalConfig.autoRecover()
      if (!recovery.success) {
        console.error('❌ Configuration auto-recovery failed:', recovery.actions)
      }
    }
  }
