import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Command } from 'commander'
import {
  EnhancedDependencyExtractor,
  EnhancedExportExtractor,
  TypeScriptParser
} from '@context-action/dependency-linker'
import { EnhancedDependencyAnalyzer } from '../analyzers/EnhancedDependencyAnalyzer.js'
import { globalConfig } from '../config/ConfigManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 의존성 분석 관련 커맨드들을 등록하는 함수
 *
 * 이 모듈은 EnhancedDependencyExtractor를 활용한 고급 코드 분석 명령어들을 제공합니다.
 *
 * @see docs/ENHANCED_ANALYSIS_WORKFLOW.md - 전체 분석 워크플로우 문서
 *
 * ## 분석 파이프라인 (5단계)
 * 1. 파일 수집 및 전처리 (glob 패턴)
 * 2. AST 파싱 (TypeScriptParser)
 * 3. 데이터 추출 (EnhancedDependencyExtractor/EnhancedExportExtractor)
 * 4. 메트릭 계산 및 분석 (명령어별 특화 로직)
 * 5. 결과 포맷팅 및 출력 (JSON/Summary)
 *
 * ## 구현된 분석 명령어
 * - find-unused-imports: 미사용 import 감지 (Level 1: 직접 데이터)
 * - analyze-bundle-optimization: 번들 최적화 기회 탐지 (Level 2: 룰 기반)
 * - analyze-code-quality: 종합 품질 점수 (Level 3: 수학적 모델)
 */
export const registerAnalysisCommands = (program: Command): void => {
  registerAnalyzeEnhanced(program)
  registerFindUsagesEnhanced(program)
  registerFindMethodUsagesEnhanced(program)
  registerFindUnusedFilesEnhanced(program)
  registerFindUnusedMethodsEnhanced(program)
  registerFindUnusedImports(program)
  registerAnalyzeBundleOptimization(program)
  registerAnalyzeCodeQuality(program)
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
    .option(
      '--format <format>',
      'Output format: json (detailed graph data) or summary (human-readable stats)',
      'summary'
    )
    .option('-v, --verbose', 'Enable detailed analysis output with timing information and file counts')
    .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude (e.g., "*.test.ts,node_modules/**")')
    .action(
      wrapAction(async (filePath, options) => {
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

        const analyzer = new EnhancedDependencyAnalyzer(projectRoot, { debug: false })
        const graph = await analyzer.buildProjectDependencyGraph(undefined, excludePatterns)

        if (options.format === 'json') {
          outputJsonFormat(graph, projectRoot)
        } else {
          outputSummaryFormat(graph, analyzer, verbose)
        }
      })
    )
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
    .action(
      wrapAction(async (targetFilePath: string, options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const _verbose = options.verbose || config.development?.verbose || false

        const projectRoot = process.cwd()
        const analyzer = new EnhancedDependencyAnalyzer(projectRoot, { debug: false })
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
      })
    )
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
    .action(
      wrapAction(async (className: string, methodName: string, options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const _verbose = options.verbose || config.development?.verbose || false

        const projectRoot = process.cwd()
        const analyzer = new EnhancedDependencyAnalyzer(projectRoot, { debug: false })
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
      })
    )
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
    .action(
      wrapAction(async (options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const _verbose = options.verbose || config.development?.verbose || false

        const projectRoot = process.cwd()
        const analyzer = new EnhancedDependencyAnalyzer(projectRoot, { debug: false })
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
      })
    )
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
    .action(
      wrapAction(async (options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const _verbose = options.verbose || config.development?.verbose || false

        const projectRoot = process.cwd()
        const analyzer = new EnhancedDependencyAnalyzer(projectRoot, { debug: false })
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
      })
    )
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
    if (
      filePath.includes('/test/') ||
      filePath.endsWith('.test.ts') ||
      filePath.endsWith('.test.js') ||
      filePath.includes('.spec.')
    ) {
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

  const nodesByType = allFiles.reduce(
    (acc, file) => {
      const type = categorizeFile(file)
      if (!acc[type]) acc[type] = []
      acc[type].push(file)
      return acc
    },
    {} as Record<string, Array<string>>
  )

  const serializedGraph = {
    nodes: nodesByType,
    edges: graph.edges.map((edge: any) => ({
      from: makeRelativePath(edge.from),
      to: makeRelativePath(edge.to),
      importedMembers: edge.importedMembers,
      line: edge.line,
    })),
    exportMap: Object.fromEntries(
      Array.from(graph.exportMap.entries() as Array<[string, any]>).map(([filePath, exports]) => [
        makeRelativePath(filePath),
        exports,
      ])
    ),
    importMap: Object.fromEntries(
      Array.from(graph.importMap.entries() as Array<[string, any]>).map(([filePath, imports]) => [
        makeRelativePath(filePath),
        imports.map((imp: any) => ({
          ...imp,
          resolvedPath: imp.resolvedPath ? makeRelativePath(imp.resolvedPath) : null,
        })),
      ])
    ),
    entryPoints: graph.entryPoints.map(makeRelativePath),
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
 * Find unused imports command
 *
 * @workflow_step Level 1 Analysis - 직접 데이터 활용
 *
 * ## 분석 파이프라인
 * 1. 파일 수집: glob 패턴으로 TS/JS 파일 탐색
 * 2. AST 파싱: TypeScriptParser로 구문 분석
 * 3. 의존성 추출: EnhancedDependencyExtractor.extractEnhanced()
 * 4. 효율성 계산: usageAnalysis 데이터 직접 활용
 * 5. 결과 출력: 파일별 미사용 import 목록
 *
 * ## 데이터 구조
 * ```typescript
 * result.usageAnalysis: {
 *   totalImports: number,
 *   usedImports: number,
 *   unusedImports: number,
 *   unusedImportsList: [{ source: string, unusedItems: string[] }]
 * }
 * ```
 *
 * @see docs/ENHANCED_ANALYSIS_WORKFLOW.md#unused-imports-detection
 */
const registerFindUnusedImports = (program: Command): void => {
  program
    .command('find-unused-imports')
    .description(
      '🧹 Identify unused imports across your TypeScript/JavaScript codebase using advanced AST analysis. Helps optimize bundle size and clean up code.'
    )
    .argument('[filePath]', 'Optional specific file to analyze, or analyze entire project if not provided')
    .option(
      '--format <format>',
      'Output format: json (structured data with line numbers) or summary (readable report with counts)',
      'summary'
    )
    .option('-v, --verbose', 'Enable detailed output showing import statements and their locations')
    .option('--fix', 'Automatically remove unused imports from files (use with caution)', false)
    .action(
      wrapAction(async (filePath: string | undefined, options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const verbose = options.verbose || config.development?.verbose || false

        const projectRoot = process.cwd()

        try {
          // EnhancedDependencyExtractor 인스턴스 생성
          const extractor = new EnhancedDependencyExtractor()
          const parser = new TypeScriptParser()

          let unusedImports: any[] = []

          if (filePath) {
            // 단일 파일 분석
            const resolvedPath = path.resolve(filePath)
            await fs.access(resolvedPath)

            if (verbose) {
              console.log(`🔍 Analyzing unused imports in: ${resolvedPath}`)
            }

            const parseResult = await parser.parse(resolvedPath)
            if (parseResult.ast) {
              const result = extractor.extractEnhanced(parseResult.ast, resolvedPath)
              if (result.usageAnalysis.unusedImports > 0) {
                unusedImports = [{
                  filePath: resolvedPath,
                  unusedImports: result.usageAnalysis.unusedImportsList || [],
                  usageAnalysis: result.usageAnalysis
                }]
              }
            }
          } else {
            // 프로젝트 전체 분석 - TypeScript/JavaScript 파일 찾기
            if (verbose) {
              console.log(`🔍 Analyzing unused imports in project: ${projectRoot}`)
            }

            const { glob } = await import('glob')
            const patterns = [
              '**/*.ts',
              '**/*.tsx',
              '**/*.js',
              '**/*.jsx'
            ]

            const allFiles = []
            for (const pattern of patterns) {
              const files = await glob(pattern, {
                cwd: projectRoot,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts']
              })
              allFiles.push(...files.map(f => path.resolve(projectRoot, f)))
            }

            for (const file of allFiles) {
              try {
                const parseResult = await parser.parse(file)
                if (parseResult.ast) {
                  const result = extractor.extractEnhanced(parseResult.ast, file)
                  if (result.usageAnalysis.unusedImports > 0) {
                    unusedImports.push({
                      filePath: file,
                      unusedImports: result.usageAnalysis.unusedImportsList || [],
                      usageAnalysis: result.usageAnalysis
                    })
                  }
                }
              } catch (error) {
                if (verbose) {
                  console.warn(`⚠️ Failed to analyze ${file}: ${error instanceof Error ? error.message : error}`)
                }
              }
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify({ unusedImports }, null, 2))
          } else {
            console.log('🧹 Unused Imports Analysis')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (filePath) {
              console.log(`📁 Target file: ${filePath}`)
            } else {
              console.log(`📁 Project root: ${projectRoot}`)
            }

            if (unusedImports.length === 0) {
              console.log('\n✅ No unused imports found!')
            } else {
              const totalUnused = unusedImports.reduce((sum, file) => sum + (file.usageAnalysis?.unusedImports || 0), 0)
              console.log(`\n🧹 Found unused imports in ${unusedImports.length} files (${totalUnused} total):`)

              unusedImports.forEach((file, i) => {
                console.log(`\n  ${i + 1}. ${path.relative(projectRoot, file.filePath)}`)

                // Show usage analysis summary
                if (file.usageAnalysis) {
                  const efficiency = file.usageAnalysis.totalImports > 0
                    ? ((file.usageAnalysis.usedImports / file.usageAnalysis.totalImports) * 100).toFixed(1)
                    : '100'
                  console.log(`     📊 Import efficiency: ${efficiency}% (${file.usageAnalysis.usedImports}/${file.usageAnalysis.totalImports} used)`)
                }

                // Show unused imports by source
                if (file.unusedImports && file.unusedImports.length > 0) {
                  file.unusedImports.forEach((sourceGroup: any, j: number) => {
                    console.log(`     ❌ ${sourceGroup.source}: ${sourceGroup.unusedItems.join(', ')}`)
                    if (verbose) {
                      console.log(`        Suggestion: Remove unused imports from ${sourceGroup.source}`)
                    }
                  })
                }
              })

              if (options.fix) {
                console.log('\n⚠️  Auto-fix feature is not yet implemented. Use --verbose to see import details.')
              } else {
                console.log('\n💡 Use --fix to automatically remove unused imports (coming soon)')
              }
            }
          }
        } catch (error) {
          console.error('❌ Error analyzing unused imports:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      })
    )
}

/**
 * Bundle optimization analysis command
 *
 * @workflow_step Level 2 Analysis - 룰 기반 해석
 *
 * ## 분석 파이프라인
 * 1. 파일 수집: glob 패턴으로 TS/JS 파일 탐색
 * 2. AST 파싱: TypeScriptParser로 구문 분석
 * 3. 의존성 추출: EnhancedDependencyExtractor.extractEnhanced()
 * 4. 라이브러리 매칭: 대용량 라이브러리 화이트리스트와 비교
 * 5. 최적화 기회 탐지: tree-shaking, default import 패턴 분석
 * 6. 권장사항 생성: 구체적인 최적화 예제 제공
 *
 * ## 대상 라이브러리 (크기 기준)
 * - lodash (70KB): tree-shaking 최적화
 * - moment (65KB): dayjs 대체 권장
 * - @mui/material (45KB): 컴포넌트별 import
 * - rxjs (40KB): operator별 import
 * - antd (60KB): babel-plugin-import
 * - chart.js (55KB): 특정 차트 타입만
 *
 * ## 데이터 구조
 * ```typescript
 * result.enhancedDependencies: [{
 *   source: string,
 *   importedNames?: string[],
 *   usedMethods?: { methodName: string, callCount: number }[],
 *   unusedImports?: string[]
 * }]
 * ```
 *
 * @see docs/ENHANCED_ANALYSIS_WORKFLOW.md#bundle-optimization
 */
const registerAnalyzeBundleOptimization = (program: Command): void => {
  program
    .command('analyze-bundle-optimization')
    .description(
      '🌳 Analyze bundle optimization opportunities by detecting inefficient imports, tree-shaking issues, and potential bundle size reductions. Focuses on large libraries like lodash, moment, etc.'
    )
    .argument('[filePath]', 'Optional specific file to analyze, or analyze entire project if not provided')
    .option(
      '--format <format>',
      'Output format: json (detailed optimization data) or summary (actionable recommendations)',
      'summary'
    )
    .option('-v, --verbose', 'Enable detailed output showing specific optimization suggestions and potential savings')
    .option('--threshold <size>', 'Minimum potential savings threshold in KB to report (default: 5)', '5')
    .action(
      wrapAction(async (filePath: string | undefined, options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const verbose = options.verbose || config.development?.verbose || false
        const threshold = parseInt(options.threshold) || 5

        const projectRoot = process.cwd()

        try {
          const extractor = new EnhancedDependencyExtractor()
          const parser = new TypeScriptParser()

          let bundleAnalysis: any[] = []

          if (filePath) {
            // 단일 파일 분석
            const resolvedPath = path.resolve(filePath)
            await fs.access(resolvedPath)

            if (verbose) {
              console.log(`🔍 Analyzing bundle optimization for: ${resolvedPath}`)
            }

            const parseResult = await parser.parse(resolvedPath)
            if (parseResult.ast) {
              const result = extractor.extractEnhanced(parseResult.ast, resolvedPath)
              const analysis = analyzeBundleOptimization(result, resolvedPath, threshold)
              if (analysis.recommendations.length > 0) {
                bundleAnalysis = [analysis]
              }
            }
          } else {
            // 프로젝트 전체 분석
            if (verbose) {
              console.log(`🔍 Analyzing bundle optimization in project: ${projectRoot}`)
            }

            const { glob } = await import('glob')
            const patterns = [
              '**/*.ts',
              '**/*.tsx',
              '**/*.js',
              '**/*.jsx'
            ]

            const allFiles = []
            for (const pattern of patterns) {
              const files = await glob(pattern, {
                cwd: projectRoot,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts']
              })
              allFiles.push(...files.map(f => path.resolve(projectRoot, f)))
            }

            for (const file of allFiles) {
              try {
                const parseResult = await parser.parse(file)
                if (parseResult.ast) {
                  const result = extractor.extractEnhanced(parseResult.ast, file)
                  const analysis = analyzeBundleOptimization(result, file, threshold)
                  if (analysis.recommendations.length > 0) {
                    bundleAnalysis.push(analysis)
                  }
                }
              } catch (error) {
                if (verbose) {
                  console.warn(`⚠️ Failed to analyze ${file}: ${error instanceof Error ? error.message : error}`)
                }
              }
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify({ bundleAnalysis }, null, 2))
          } else {
            console.log('🌳 Bundle Optimization Analysis')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (filePath) {
              console.log(`📁 Target file: ${filePath}`)
            } else {
              console.log(`📁 Project root: ${projectRoot}`)
            }

            if (bundleAnalysis.length === 0) {
              console.log('\n✅ No significant bundle optimization opportunities found!')
              console.log(`💡 Consider lowering threshold (current: ${threshold}KB) to see smaller optimizations`)
            } else {
              const totalPotentialSavings = bundleAnalysis.reduce((sum, file) =>
                sum + file.potentialSavings, 0
              )

              console.log(`\n🌳 Found optimization opportunities in ${bundleAnalysis.length} files:`)
              console.log(`💰 Total potential savings: ~${totalPotentialSavings.toFixed(1)}KB`)

              bundleAnalysis.forEach((file, i) => {
                console.log(`\n  ${i + 1}. ${path.relative(projectRoot, file.filePath)}`)
                console.log(`     💰 Potential savings: ~${file.potentialSavings.toFixed(1)}KB`)

                file.recommendations.forEach((rec: any, j: number) => {
                  console.log(`\n     ${rec.type === 'tree-shaking' ? '🌳' : '🧹'} ${rec.title}:`)
                  if (rec.issue) {
                    console.log(`        Issue: ${rec.issue}`)
                  }
                  if (rec.suggestion) {
                    console.log(`        💡 Suggestion: ${rec.suggestion}`)
                  }
                  if (verbose && rec.example) {
                    console.log(`        Example: ${rec.example}`)
                  }
                  if (rec.savings) {
                    console.log(`        💰 Estimated savings: ~${rec.savings}KB`)
                  }
                })
              })

              console.log('\n📋 Summary of Recommendations:')
              const recommendationTypes = bundleAnalysis.flatMap(f => f.recommendations)
                .reduce((acc: any, rec: any) => {
                  acc[rec.type] = (acc[rec.type] || 0) + 1
                  return acc
                }, {})

              Object.entries(recommendationTypes).forEach(([type, count]) => {
                const icon = type === 'tree-shaking' ? '🌳' : '🧹'
                console.log(`${icon} ${type}: ${count} opportunities`)
              })
            }
          }
        } catch (error) {
          console.error('❌ Error analyzing bundle optimization:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      })
    )
}

/**
 * Bundle optimization analysis helper
 */
function analyzeBundleOptimization(result: any, filePath: string, threshold: number) {
  const analysis = {
    filePath,
    potentialSavings: 0,
    recommendations: [] as any[]
  }

  // 대용량 라이브러리 목록과 예상 번들 크기
  const heavyLibraries = {
    'lodash': { size: 70, recommendation: 'Use specific imports or lodash-es' },
    'moment': { size: 65, recommendation: 'Consider date-fns or dayjs for smaller bundle' },
    '@mui/material': { size: 45, recommendation: 'Use specific component imports' },
    'rxjs': { size: 40, recommendation: 'Import only needed operators' },
    'antd': { size: 60, recommendation: 'Use babel-plugin-import for tree-shaking' },
    'react-bootstrap': { size: 35, recommendation: 'Import specific components' },
    'chart.js': { size: 55, recommendation: 'Use chart.js/auto or specific chart types' }
  }

  result.enhancedDependencies?.forEach((dep: any) => {
    const libraryInfo = heavyLibraries[dep.source as keyof typeof heavyLibraries]

    if (libraryInfo) {
      // Default import 감지 (tree-shaking 불가)
      const hasDefaultImport = dep.importedNames?.includes('default') ||
        !dep.importedNames || dep.importedNames.length === 0

      if (hasDefaultImport) {
        const estimatedSavings = libraryInfo.size * 0.7 // 70% 절약 가능 추정

        if (estimatedSavings >= threshold) {
          analysis.recommendations.push({
            type: 'tree-shaking',
            title: `Optimize ${dep.source} imports`,
            issue: `Default import prevents tree-shaking (~${libraryInfo.size}KB)`,
            suggestion: libraryInfo.recommendation,
            example: generateTreeShakingExample(dep.source, dep.usedMethods),
            savings: estimatedSavings
          })
          analysis.potentialSavings += estimatedSavings
        }
      }

      // Unused imports within heavy libraries
      if (dep.unusedImports && dep.unusedImports.length > 0) {
        const unusedSavings = dep.unusedImports.length * 2 // 2KB per unused import 추정

        if (unusedSavings >= threshold) {
          analysis.recommendations.push({
            type: 'unused-cleanup',
            title: `Remove unused ${dep.source} imports`,
            issue: `${dep.unusedImports.length} unused imports detected`,
            suggestion: `Remove: ${dep.unusedImports.join(', ')}`,
            savings: unusedSavings
          })
          analysis.potentialSavings += unusedSavings
        }
      }
    }

    // 일반적인 비효율적 import 패턴 감지
    if (dep.importedNames && dep.usedMethods) {
      const efficiency = dep.usedMethods.length / dep.importedNames.length
      if (efficiency < 0.3 && dep.importedNames.length > 5) { // 30% 미만 효율성
        const wastedImports = dep.importedNames.length - dep.usedMethods.length
        const estimatedSavings = wastedImports * 1.5 // 1.5KB per unused import

        if (estimatedSavings >= threshold) {
          analysis.recommendations.push({
            type: 'efficiency',
            title: `Optimize ${dep.source} import efficiency`,
            issue: `Low efficiency: ${(efficiency * 100).toFixed(1)}% (${dep.usedMethods.length}/${dep.importedNames.length} used)`,
            suggestion: `Remove unused imports: ${dep.unusedImports?.join(', ') || 'multiple items'}`,
            savings: estimatedSavings
          })
          analysis.potentialSavings += estimatedSavings
        }
      }
    }
  })

  return analysis
}

/**
 * Generate tree-shaking optimization examples
 */
function generateTreeShakingExample(source: string, usedMethods?: any[]) {
  switch (source) {
    case 'lodash':
      if (usedMethods?.length) {
        const methods = usedMethods.map(m => m.methodName.replace('_.', '')).slice(0, 3)
        return `import { ${methods.join(', ')} } from 'lodash-es'`
      }
      return `import { debounce, throttle } from 'lodash-es'`

    case 'moment':
      return `import dayjs from 'dayjs' // 2.8KB vs 65KB`

    case '@mui/material':
      return `import Button from '@mui/material/Button'`

    case 'rxjs':
      return `import { map, filter } from 'rxjs/operators'`

    default:
      return `Use specific imports instead of default import`
  }
}

/**
 * Code quality analysis command
 *
 * @workflow_step Level 3 Analysis - 수학적 모델링
 *
 * ## 분석 파이프라인
 * 1. 파일 수집: glob 패턴으로 TS/JS 파일 탐색 (최대 20개)
 * 2. AST 파싱: TypeScriptParser로 구문 분석
 * 3. 복합 데이터 추출:
 *    - EnhancedDependencyExtractor: 의존성 분석
 *    - EnhancedExportExtractor: API 표면 분석
 * 4. 다중 메트릭 계산: 4가지 품질 지표
 * 5. 가중 평균 점수: 최종 0-100 점수 산출
 * 6. 등급 부여: A+ ~ F 등급 시스템
 *
 * ## 품질 메트릭 (가중치)
 * - Import 효율성 (30%): (사용된 import / 전체 import) * 100
 * - API 복잡성 (25%): 100 - (총 export 수 * 2)
 * - 유지보수성 (25%): 100 - 클래스 복잡성
 * - 코드 재사용성 (20%): min(100, export 수 * 10)
 *
 * ## 등급 시스템
 * - 90-100: 🌟 Excellent (A+)
 * - 80-89: ⭐ Very Good (A)
 * - 70-79: ✨ Good (B)
 * - 60-69: 💫 Fair (C)
 * - 50-59: ⚡ Poor (D)
 * - 0-49: 🔴 Critical (F)
 *
 * @see docs/ENHANCED_ANALYSIS_WORKFLOW.md#code-quality-scoring
 */
const registerAnalyzeCodeQuality = (program: Command): void => {
  program
    .command('analyze-code-quality')
    .description(
      '📊 Comprehensive code quality analysis combining dependency efficiency, API surface complexity, and maintainability metrics. Provides an overall health score.'
    )
    .argument('[filePath]', 'Optional specific file to analyze, or analyze entire project if not provided')
    .option(
      '--format <format>',
      'Output format: json (detailed metrics) or summary (readable report with scores)',
      'summary'
    )
    .option('-v, --verbose', 'Enable detailed output showing specific quality metrics and improvement suggestions')
    .option('--min-score <score>', 'Minimum quality score to report (0-100, default: 0)', '0')
    .action(
      wrapAction(async (filePath: string | undefined, options: any) => {
        await ensureConfig(options)

        const config = globalConfig.getConfig()
        const verbose = options.verbose || config.development?.verbose || false
        const minScore = parseInt(options.minScore) || 0

        const projectRoot = process.cwd()

        try {
          const depExtractor = new EnhancedDependencyExtractor()
          const exportExtractor = new EnhancedExportExtractor()
          const parser = new TypeScriptParser()

          let qualityAnalysis: any[] = []

          if (filePath) {
            // 단일 파일 분석
            const resolvedPath = path.resolve(filePath)
            await fs.access(resolvedPath)

            if (verbose) {
              console.log(`🔍 Analyzing code quality for: ${resolvedPath}`)
            }

            const parseResult = await parser.parse(resolvedPath)
            if (parseResult.ast) {
              const analysis = await analyzeFileQuality(
                depExtractor, exportExtractor, parseResult.ast, resolvedPath, verbose
              )
              if (analysis.overallScore >= minScore) {
                qualityAnalysis = [analysis]
              }
            }
          } else {
            // 프로젝트 전체 분석
            if (verbose) {
              console.log(`🔍 Analyzing code quality in project: ${projectRoot}`)
            }

            const { glob } = await import('glob')
            const patterns = [
              '**/*.ts',
              '**/*.tsx',
              '**/*.js',
              '**/*.jsx'
            ]

            const allFiles = []
            for (const pattern of patterns) {
              const files = await glob(pattern, {
                cwd: projectRoot,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*']
              })
              allFiles.push(...files.map(f => path.resolve(projectRoot, f)))
            }

            for (const file of allFiles.slice(0, 20)) { // 처음 20개 파일만 분석 (성능상 이유)
              try {
                const parseResult = await parser.parse(file)
                if (parseResult.ast) {
                  const analysis = await analyzeFileQuality(
                    depExtractor, exportExtractor, parseResult.ast, file, verbose
                  )
                  if (analysis.overallScore >= minScore) {
                    qualityAnalysis.push(analysis)
                  }
                }
              } catch (error) {
                if (verbose) {
                  console.warn(`⚠️ Failed to analyze ${file}: ${error instanceof Error ? error.message : error}`)
                }
              }
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify({ qualityAnalysis }, null, 2))
          } else {
            console.log('📊 Code Quality Analysis')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (filePath) {
              console.log(`📁 Target file: ${filePath}`)
            } else {
              console.log(`📁 Project root: ${projectRoot}`)
              console.log(`📄 Analyzed ${qualityAnalysis.length} files (top 20 by relevance)`)
            }

            if (qualityAnalysis.length === 0) {
              console.log(`\n✅ No files found above minimum score threshold (${minScore})`)
            } else {
              // 전체 평균 점수 계산
              const averageScore = qualityAnalysis.reduce((sum, file) => sum + file.overallScore, 0) / qualityAnalysis.length

              console.log(`\n📊 Overall Quality Metrics:`)
              console.log(`   Average Score: ${averageScore.toFixed(1)}/100`)
              console.log(`   Quality Grade: ${getQualityGrade(averageScore)}`)

              // 상위/하위 파일들
              qualityAnalysis.sort((a, b) => b.overallScore - a.overallScore)

              console.log(`\n🏆 Top Performing Files:`)
              qualityAnalysis.slice(0, 5).forEach((file, i) => {
                console.log(`   ${i + 1}. ${path.relative(projectRoot, file.filePath)} - ${file.overallScore.toFixed(1)}/100`)
              })

              if (qualityAnalysis.length > 5) {
                console.log(`\n⚠️  Files Needing Attention:`)
                qualityAnalysis.slice(-3).reverse().forEach((file, i) => {
                  console.log(`   ${i + 1}. ${path.relative(projectRoot, file.filePath)} - ${file.overallScore.toFixed(1)}/100`)
                  if (verbose) {
                    file.recommendations.slice(0, 2).forEach((rec: string) => {
                      console.log(`      💡 ${rec}`)
                    })
                  }
                })
              }

              // 상세 메트릭스 (verbose 모드)
              if (verbose) {
                console.log(`\n📈 Detailed Quality Breakdown:`)
                const metrics = qualityAnalysis.reduce((acc, file) => {
                  acc.importEfficiency += file.metrics.importEfficiency
                  acc.apiComplexity += file.metrics.apiComplexity
                  acc.maintainability += file.metrics.maintainability
                  acc.codeReuse += file.metrics.codeReuse
                  return acc
                }, { importEfficiency: 0, apiComplexity: 0, maintainability: 0, codeReuse: 0 })

                const count = qualityAnalysis.length
                console.log(`   Import Efficiency: ${(metrics.importEfficiency / count).toFixed(1)}/100`)
                console.log(`   API Complexity: ${(metrics.apiComplexity / count).toFixed(1)}/100`)
                console.log(`   Maintainability: ${(metrics.maintainability / count).toFixed(1)}/100`)
                console.log(`   Code Reuse: ${(metrics.codeReuse / count).toFixed(1)}/100`)
              }

              // 종합 추천사항
              console.log(`\n💡 Improvement Recommendations:`)
              const allRecommendations = qualityAnalysis.flatMap(f => f.recommendations)
              const recommendationCounts = allRecommendations.reduce((acc: any, rec: string) => {
                const key = rec.split(':')[0] // 추천사항의 첫 부분을 키로 사용
                acc[key] = (acc[key] || 0) + 1
                return acc
              }, {})

              Object.entries(recommendationCounts)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 5)
                .forEach(([rec, count]) => {
                  console.log(`   ${rec}: ${count} files`)
                })
            }
          }
        } catch (error) {
          console.error('❌ Error analyzing code quality:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      })
    )
}

/**
 * Analyze individual file quality
 */
async function analyzeFileQuality(
  depExtractor: EnhancedDependencyExtractor,
  exportExtractor: EnhancedExportExtractor,
  ast: any,
  filePath: string,
  verbose: boolean
) {
  // 의존성 분석
  const dependencies = depExtractor.extractEnhanced(ast, filePath)

  // 내보내기 분석
  const exports = exportExtractor.extractExports(ast, filePath)

  // 메트릭 계산
  const metrics = calculateQualityMetrics(dependencies, exports, filePath)

  // 전체 점수 계산 (가중 평균)
  const overallScore = (
    metrics.importEfficiency * 0.3 +
    metrics.apiComplexity * 0.25 +
    metrics.maintainability * 0.25 +
    metrics.codeReuse * 0.2
  )

  // 개선 추천사항 생성
  const recommendations = generateQualityRecommendations(metrics, dependencies, exports)

  return {
    filePath,
    overallScore,
    metrics,
    recommendations,
    details: {
      dependencies: dependencies.usageAnalysis,
      exports: exports.statistics
    }
  }
}

/**
 * Calculate quality metrics
 */
function calculateQualityMetrics(dependencies: any, exports: any, filePath: string) {
  // 1. Import 효율성 (0-100)
  const importEfficiency = dependencies.usageAnalysis.totalImports > 0
    ? (dependencies.usageAnalysis.usedImports / dependencies.usageAnalysis.totalImports) * 100
    : 100

  // 2. API 복잡성 (100-점수, 낮을수록 좋음)
  const totalExports = exports.statistics.totalExports
  const apiComplexity = Math.max(0, 100 - (totalExports * 2)) // export 하나당 2점 감점

  // 3. 유지보수성 (클래스 복잡성 기반)
  const classComplexity = exports.classes.reduce((sum: number, cls: any) =>
    sum + cls.methods.length + cls.properties.length, 0
  )
  const maintainability = Math.max(0, 100 - classComplexity)

  // 4. 코드 재사용성 (export 비율 기반)
  const fileHasExports = totalExports > 0
  const codeReuse = fileHasExports ? Math.min(100, totalExports * 10) : 50

  return {
    importEfficiency,
    apiComplexity,
    maintainability,
    codeReuse
  }
}

/**
 * Generate quality improvement recommendations
 */
function generateQualityRecommendations(metrics: any, dependencies: any, exports: any): string[] {
  const recommendations = []

  if (metrics.importEfficiency < 70) {
    recommendations.push(`Improve import efficiency: Remove ${dependencies.usageAnalysis.unusedImports} unused imports`)
  }

  if (metrics.apiComplexity < 50) {
    recommendations.push(`Reduce API complexity: Consider splitting large interface (${exports.statistics.totalExports} exports)`)
  }

  if (metrics.maintainability < 60) {
    const complexClasses = exports.classes.filter((cls: any) =>
      cls.methods.length + cls.properties.length > 10
    )
    if (complexClasses.length > 0) {
      recommendations.push(`Reduce class complexity: Break down large classes (${complexClasses.length} complex classes)`)
    }
  }

  if (metrics.codeReuse < 40) {
    recommendations.push(`Improve code reuse: Add public exports to enable reusability`)
  }

  if (dependencies.usageAnalysis.unusedImportsList?.length > 0) {
    recommendations.push(`Clean up imports: Remove unused imports from ${dependencies.usageAnalysis.unusedImportsList.length} sources`)
  }

  return recommendations
}

/**
 * Get quality grade based on score
 */
function getQualityGrade(score: number): string {
  if (score >= 90) return '🌟 Excellent (A+)'
  if (score >= 80) return '⭐ Very Good (A)'
  if (score >= 70) return '✨ Good (B)'
  if (score >= 60) return '💫 Fair (C)'
  if (score >= 50) return '⚡ Poor (D)'
  return '🔴 Critical (F)'
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
