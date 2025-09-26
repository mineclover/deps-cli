#!/usr/bin/env node

import { Command } from "commander"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { UnifiedDependencyAnalyzer } from "./analyzers/UnifiedDependencyAnalyzer.js"
import { DependencyTracker } from "./analyzers/DependencyTracker.js"
import { ExportUsageTracker } from "./analyzers/ExportUsageTracker.js"
import { globalConfig } from "./config/ConfigManager.js"

const program = new Command()

// 전역 설정 로드
let configLoaded = false

async function ensureConfig(options: Record<string, any> = {}) {
  if (!configLoaded) {
    try {
      // 강화된 로딩 방식 사용 (재시도 + 캐싱)
      await globalConfig.loadWithRetry({
        cliArgs: options,
        validateConfig: true,
        throwOnValidationError: false,
        enableCache: true
      })
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

// 전역 에러 핸들러
process.on('unhandledRejection', (reason, promise) => {
  if (globalConfig.get('development.debugMode')) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  }
})

program
  .name("effect-cli")
  .description("A dependency analysis CLI tool")
  .version("1.0.0")

// Analyze command
program
  .command("analyze")
  .description("Analyze code dependencies and structure")
  .argument("<filePath>", "Path to the file or directory to analyze")
  .option("--format <format>", "Output format (json, summary)")
  .option("-v, --verbose", "Enable verbose output")
  .option("--method-flow", "Enable method flow analysis (detailed method-level analysis)")
  .action(async (filePath, options) => {
    try {
      // 설정 로드
      await ensureConfig(options)

      // 설정에서 값 가져오기
      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false
      const timeout = config.analysis?.timeout || 30000

      if (verbose) {
        console.log(`🔍 Starting analysis of: ${filePath}`)
        console.log(`⚙️ Using timeout: ${timeout}ms`)
      } else {
        console.log(`🔍 Starting analysis of: ${filePath}`)
      }

      // Check if path exists
      const fullPath = path.resolve(filePath)
      await fs.access(fullPath)

      // Get file list
      const stat = await fs.stat(fullPath)
      let files: Array<string> = []

      if (stat.isDirectory()) {
        // Read directory recursively for TypeScript/JavaScript files
        const glob = await import("glob")
        files = glob.globSync("**/*.{ts,tsx,js,jsx,mjs}", {
          cwd: fullPath,
          absolute: true,
          ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"]
        })
      } else {
        files = [fullPath]
      }

      console.log(`📁 Found ${files.length} files to analyze`)
      if (verbose) {
        console.log("Files:", files.slice(0, 5)) // Show first 5 files
      }

      const projectRoot = stat.isDirectory() ? fullPath : path.dirname(fullPath)
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot, {
        includeMethodFlow: options.methodFlow
      })
      const result = await analyzer.analyzeProject(files)

      if (verbose) {
        console.log(`📊 Analysis completed:`)
        console.log(`📁 Total files: ${result.analysisMetadata.filesProcessed}`)
        console.log(`🔗 Dependencies found: ${Object.keys(result.graph).length}`)
        console.log(`⏱️ Duration: ${result.analysisMetadata.duration}ms`)
      }

      const outputFormat = options.format || config.output?.defaultFormat || 'summary'

      if (outputFormat === "json") {
        // Convert Map to plain object for JSON serialization
        const serializable = {
          ...result,
          nodesByType: Object.fromEntries(result.nodesByType)
        }
        console.log(JSON.stringify(serializable, null, 2))
      } else {
        console.log("📈 Analysis Summary:")
        console.log(`Files processed: ${result.analysisMetadata.filesProcessed}`)
        console.log(`Analysis duration: ${result.analysisMetadata.duration}ms`)
        console.log(`Dependencies: ${Object.keys(result.graph).length}`)
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Analysis failed:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Classify command
program
  .command("classify")
  .description("파일 타입별 의존성을 분류하여 저장")
  .argument("<filePath>", "Path to the file or directory to classify")
  .option("--output-dir <dir>", "Output directory for saving analysis results")
  .option("-v, --verbose", "Enable verbose output")
  .option("--method-flow", "Enable method flow analysis (detailed method-level analysis)")
  .action(async (filePath, options) => {
    try {
      // 설정 로드
      await ensureConfig(options)

      // 설정에서 값 가져오기
      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false
      const defaultOutputDir = config.output?.defaultDir

      if (verbose) {
        console.log(`📂 발견된 파일 분류 시작...`)
        console.log(`⚙️ Using configuration from: ${Object.keys(config._metadata || {}).length} sources`)
      } else {
        console.log(`📂 발견된 파일 분류 시작...`)
      }

      // Check if path exists
      const fullPath = path.resolve(filePath)
      await fs.access(fullPath)

      // Get file list
      const stat = await fs.stat(fullPath)
      let files: Array<string> = []

      if (stat.isDirectory()) {
        // Read directory recursively for TypeScript/JavaScript files
        const glob = await import("glob")
        files = glob.globSync("**/*.{ts,tsx,js,jsx,mjs}", {
          cwd: fullPath,
          absolute: true,
          ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"]
        })
      } else {
        files = [fullPath]
      }

      const projectRoot = stat.isDirectory() ? fullPath : path.dirname(fullPath)
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot, {
        includeMethodFlow: options.methodFlow
      })

      // Perform analysis
      const result = await analyzer.analyzeProject(files)

      if (verbose) {
        console.log(`🚀 의존성 분류 분석 시작...`)
      }

      console.log(`📊 의존성 분류 분석 결과`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📁 총 파일: ${result.analysisMetadata.filesProcessed}개`)
      console.log(`🔗 총 의존성: ${Object.keys(result.graph).length}개`)
      console.log(`⏱️ 분석 시간: ${result.analysisMetadata.duration}ms`)

      console.log(`\n📋 노드 타입별 분포:`)
      result.nodesByType.forEach((nodes, type) => {
        const icon = type === "test" ? "🧪" : type === "code" ? "📄" : type === "docs" ? "📝" : "📦"
        console.log(`  ${icon} ${type}: ${nodes.length}개`)
      })

      // Save output if needed
      const outputDir = options.outputDir || defaultOutputDir
      if (outputDir) {
        const resolvedOutputDir = path.resolve(outputDir)
        await fs.mkdir(resolvedOutputDir, { recursive: true })

        const reportPath = path.join(resolvedOutputDir, "analysis-report.json")
        await fs.writeFile(reportPath, JSON.stringify(result, null, 2))

        console.log(`✅ 분석 완료!`)
        console.log(`💾 결과 저장됨: ${resolvedOutputDir}`)

        if (verbose) {
          console.log(`📄 Report saved to: ${reportPath}`)
        }
      }

      process.exit(0)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("❌ Classification failed:", errorMessage)

      // 디버그 모드에서 자세한 오류 정보 출력
      if (globalConfig.get('development.debugMode')) {
        console.error('Full error details:', error)
      }

      process.exit(1)
    }
  })

// Find file usages command
program
  .command("find-usages")
  .description("특정 파일을 사용하는 모든 파일들을 찾습니다")
  .argument("<filePath>", "분석할 대상 파일 경로")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (targetFilePath, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🔍 파일 사용처 추적 시작: ${targetFilePath}`)
      }

      const projectRoot = process.cwd()
      const tracker = new DependencyTracker(projectRoot)
      const result = await tracker.findFileUsages(targetFilePath)

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`📄 파일 사용처 분석 결과`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`🎯 대상 파일: ${targetFilePath}`)
        console.log(`⏱️ 분석 시간: ${result.metadata.analysisTime}ms`)
        console.log(`📁 총 파일: ${result.metadata.totalFiles}개`)

        if (result.results.length > 0) {
          console.log(`\n✅ 사용하는 파일들 (${result.results.length}개):`)
          result.results.forEach((fileUsage: any, index) => {
            console.log(`  ${index + 1}. ${fileUsage.importedBy?.[0]?.filePath || 'Unknown'}`)
            if (verbose && fileUsage.importedBy) {
              fileUsage.importedBy.forEach((ref: any) => {
                console.log(`     라인 ${ref.line}: ${ref.importStatement}`)
              })
            }
          })
        } else {
          console.log(`\n❌ 이 파일을 사용하는 파일이 없습니다.`)
        }

        if (result.metadata.warnings.length > 0 && verbose) {
          console.log(`\n⚠️ 경고사항:`)
          result.metadata.warnings.forEach(warning => console.log(`  • ${warning}`))
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ 파일 사용처 추적 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Find method usages command
program
  .command("find-method-usages")
  .description("특정 메서드를 사용하는 모든 파일들을 찾습니다")
  .argument("<className>", "클래스 이름")
  .argument("<methodName>", "메서드 이름")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (className, methodName, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🔍 메서드 사용처 추적 시작: ${className}.${methodName}`)
      }

      const projectRoot = process.cwd()
      const tracker = new DependencyTracker(projectRoot)
      const result = await tracker.findMethodUsages(className, methodName)

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`🔧 메서드 사용처 분석 결과`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`🎯 대상 메서드: ${className}.${methodName}`)
        console.log(`⏱️ 분석 시간: ${result.metadata.analysisTime}ms`)
        console.log(`📁 총 파일: ${result.metadata.totalFiles}개`)

        if (result.results.length > 0) {
          const methodUsage: any = result.results[0]
          console.log(`\n📍 메서드 정의: ${methodUsage.filePath}`)
          console.log(`   접근 제어: ${methodUsage.visibility}`)
          console.log(`   정적 메서드: ${methodUsage.isStatic ? 'Yes' : 'No'}`)
          console.log(`   비동기: ${methodUsage.isAsync ? 'Yes' : 'No'}`)

          if (methodUsage.usedBy.length > 0) {
            console.log(`\n✅ 사용하는 파일들 (${methodUsage.usedBy.length}개):`)
            methodUsage.usedBy.forEach((ref: any, index: number) => {
              console.log(`  ${index + 1}. ${ref.filePath}:${ref.line}`)
              if (verbose) {
                console.log(`     컨텍스트: ${ref.context}`)
              }
            })
          } else {
            console.log(`\n❌ 이 메서드를 사용하는 곳이 없습니다.`)
          }
        } else {
          console.log(`\n❌ 메서드를 찾을 수 없습니다.`)
        }

        if (result.metadata.warnings.length > 0 && verbose) {
          console.log(`\n⚠️ 경고사항:`)
          result.metadata.warnings.forEach(warning => console.log(`  • ${warning}`))
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ 메서드 사용처 추적 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Find unused files command
program
  .command("find-unused-files")
  .description("어디서도 사용되지 않는 파일들을 찾습니다")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .option("--include-tests", "테스트 파일 포함", false)
  .action(async (options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🔍 미사용 파일 탐지 시작...`)
      }

      const projectRoot = process.cwd()
      const tracker = new DependencyTracker(projectRoot, {
        includeTestFiles: options.includeTests
      })
      const result = await tracker.findUnusedFiles()

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`🗑️  미사용 파일 분석 결과`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`⏱️ 분석 시간: ${result.metadata.analysisTime}ms`)
        console.log(`📁 총 파일: ${result.metadata.totalFiles}개`)
        console.log(`🗑️ 미사용 파일: ${result.results.length}개`)

        if (result.results.length > 0) {
          console.log(`\n📋 미사용 파일 목록:`)
          result.results.forEach((unusedFile: any, index) => {
            console.log(`  ${index + 1}. ${path.relative(projectRoot, unusedFile.filePath)}`)
            console.log(`     크기: ${(unusedFile.size / 1024).toFixed(1)}KB`)
            console.log(`     마지막 수정: ${new Date(unusedFile.lastModified).toLocaleDateString()}`)

            if (verbose && unusedFile.exports.length > 0) {
              console.log(`     exports: ${unusedFile.exports.join(', ')}`)
            }
            console.log('')
          })

          console.log(`💡 총 ${(result.results.reduce((sum: number, file: any) => sum + file.size, 0) / 1024).toFixed(1)}KB의 미사용 코드가 발견되었습니다.`)
        } else {
          console.log(`\n✅ 모든 파일이 사용되고 있습니다!`)
        }

        if (result.metadata.warnings.length > 0 && verbose) {
          console.log(`\n⚠️ 경고사항:`)
          result.metadata.warnings.forEach(warning => console.log(`  • ${warning}`))
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ 미사용 파일 탐지 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Find unused methods command
program
  .command("find-unused-methods")
  .description("어디서도 사용되지 않는 메서드들을 찾습니다")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .option("--include-private", "private 메서드 포함", false)
  .action(async (options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🔍 미사용 메서드 탐지 시작...`)
      }

      const projectRoot = process.cwd()
      const tracker = new DependencyTracker(projectRoot)
      const result = await tracker.findUnusedMethods()

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`🔧 미사용 메서드 분석 결과`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`⏱️ 분석 시간: ${result.metadata.analysisTime}ms`)
        console.log(`📁 총 파일: ${result.metadata.totalFiles}개`)
        console.log(`🔧 총 메서드: ${result.metadata.totalMethods}개`)

        const filteredResults = options.includePrivate
          ? result.results
          : result.results.filter((method: any) => method.visibility === 'public')

        console.log(`🗑️ 미사용 메서드: ${filteredResults.length}개`)

        if (filteredResults.length > 0) {
          console.log(`\n📋 미사용 메서드 목록:`)

          const byImpact = filteredResults.reduce((groups: any, method: any) => {
            const impact = method.potentialImpact
            if (!groups[impact]) groups[impact] = []
            groups[impact].push(method)
            return groups
          }, {})

          Object.entries(byImpact).forEach(([impact, methods]: [string, any[]]) => {
            const icon = impact === 'high' ? '🔴' : impact === 'medium' ? '🟡' : '🟢'
            console.log(`\n  ${icon} ${impact.toUpperCase()} IMPACT (${methods.length}개):`)

            methods.forEach((method, index) => {
              const className = method.className ? `${method.className}.` : ''
              console.log(`    ${index + 1}. ${className}${method.methodName}`)
              console.log(`       위치: ${path.relative(projectRoot, method.filePath)}:${method.line}`)
              console.log(`       접근: ${method.visibility} ${method.isStatic ? 'static' : 'instance'}`)

              if (verbose) {
                console.log(`       이유: ${method.reason}`)
              }
              console.log('')
            })
          })
        } else {
          console.log(`\n✅ 모든 메서드가 사용되고 있습니다!`)
        }

        if (result.metadata.warnings.length > 0 && verbose) {
          console.log(`\n⚠️ 경고사항:`)
          result.metadata.warnings.forEach(warning => console.log(`  • ${warning}`))
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ 미사용 메서드 탐지 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Check export usage command
program
  .command("check-exports")
  .description("특정 파일의 export들이 실제로 사용되는지 확인합니다")
  .argument("<filePath>", "분석할 파일 경로")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (targetFilePath, options) => {
    try {
      await ensureConfig(options)

      const config = globalConfig.getConfig()
      const verbose = options.verbose || config.development?.verbose || false

      if (verbose) {
        console.log(`🔍 Export 사용 분석 시작: ${targetFilePath}`)
      }

      const projectRoot = process.cwd()

      // 모든 프로젝트 파일 수집
      const { glob } = await import("glob")
      const allFiles = glob.globSync("**/*.{ts,tsx,js,jsx,mjs}", {
        cwd: projectRoot,
        absolute: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"]
      })

      const tracker = new ExportUsageTracker(projectRoot)
      const result = await tracker.analyzeFileExports(targetFilePath, allFiles)

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`📊 Export 사용 분석 결과`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`🎯 대상 파일: ${path.relative(projectRoot, result.filePath)}`)
        console.log(`📦 총 Export: ${result.totalExports}개`)
        console.log(`✅ 사용됨: ${result.usedExports}개`)
        console.log(`❌ 미사용: ${result.unusedExports}개`)

        if (result.unusedExports > 0) {
          console.log(`\n🗑️ 미사용 Export 목록:`)
          result.exports
            .filter(exp => !exp.isUsed)
            .forEach((exp, index) => {
              console.log(`  ${index + 1}. ${exp.exportName} (${exp.exportType})`)
              if (verbose) {
                console.log(`     타입: ${exp.exportType}`)
              }
            })

          console.log(`\n💡 ${result.unusedExports}개의 미사용 export를 정리하면 코드가 더 깔끔해집니다.`)
        } else {
          console.log(`\n✅ 모든 export가 사용되고 있습니다!`)
        }

        if (result.usedExports > 0 && verbose) {
          console.log(`\n✅ 사용되는 Export 목록:`)
          result.exports
            .filter(exp => exp.isUsed)
            .forEach((exp, index) => {
              console.log(`  ${index + 1}. ${exp.exportName} (${exp.exportType})`)
              console.log(`     사용 횟수: ${exp.usageCount}회`)
              console.log(`     사용 파일: ${exp.usedInFiles.length}개`)

              if (verbose && exp.usageLocations.length > 0) {
                exp.usageLocations.slice(0, 3).forEach(loc => {
                  console.log(`     • ${path.relative(projectRoot, loc.filePath)}:${loc.line}`)
                })
                if (exp.usageLocations.length > 3) {
                  console.log(`     • ... ${exp.usageLocations.length - 3}개 더`)
                }
              }
              console.log('')
            })
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Export 사용 분석 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Help command
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name()
})

program
  .command("analyze-enhanced")
  .description("EnhancedExportExtractor 기반 전체 프로젝트 의존성 그래프 분석")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (options) => {
    try {
      const tracker = new DependencyTracker(process.cwd())

      const graph = await tracker.analyzeWithEnhancedDependencyGraph()

      if (options.format === 'json') {
        console.log(JSON.stringify({
          nodes: Array.from(graph.nodes),
          edges: graph.edges,
          entryPoints: graph.entryPoints,
          statistics: {
            totalFiles: graph.nodes.size,
            totalEdges: graph.edges.length,
            entryPoints: graph.entryPoints.length
          }
        }, null, 2))
      } else {
        console.log('📊 Enhanced Dependency Graph Analysis')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Total Files: ${graph.nodes.size}`)
        console.log(`🔗 Total Dependencies: ${graph.edges.length}`)
        console.log(`🚀 Entry Points: ${graph.entryPoints.length}`)

        if (options.verbose) {
          console.log('\n🚀 Entry Points:')
          graph.entryPoints.forEach((entry, i) => {
            const relative = path.relative(process.cwd(), entry)
            console.log(`  ${i + 1}. ${relative}`)
          })

          console.log('\n🔗 Dependencies (first 10):')
          graph.edges.slice(0, 10).forEach((edge, i) => {
            const fromRel = path.relative(process.cwd(), edge.from)
            const toRel = path.relative(process.cwd(), edge.to)
            console.log(`  ${i + 1}. ${fromRel} → ${toRel} (${edge.importedMembers.join(', ')})`)
          })

          if (graph.edges.length > 10) {
            console.log(`  ... and ${graph.edges.length - 10} more`)
          }
        }

        // 미사용 파일들 표시
        const unusedFiles = tracker.findUnusedFilesFromGraph(graph)
        console.log(`\n🗑️ Unused Files: ${unusedFiles.length}`)
        if (unusedFiles.length > 0) {
          unusedFiles.slice(0, 5).forEach((file, i) => {
            const relative = path.relative(process.cwd(), file)
            console.log(`  ${i + 1}. ${relative}`)
          })
          if (unusedFiles.length > 5) {
            console.log(`  ... and ${unusedFiles.length - 5} more`)
          }
        }

        // 미사용 메서드들 표시
        const unusedMethods = tracker.findUnusedMethodsFromGraph(graph)
        console.log(`\n🔧 Unused Methods: ${unusedMethods.length}`)
        if (unusedMethods.length > 0) {
          unusedMethods.slice(0, 5).forEach((method, i) => {
            const relative = path.relative(process.cwd(), method.filePath)
            const methodName = method.className ? `${method.className}.${method.methodName}` : method.methodName
            console.log(`  ${i + 1}. ${methodName} (${relative})`)
          })
          if (unusedMethods.length > 5) {
            console.log(`  ... and ${unusedMethods.length - 5} more`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced dependency analysis 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Enhanced dependency analysis commands (edges 기반)
program
  .command("find-usages-enhanced")
  .description("EnhancedExportExtractor 기반으로 특정 파일을 사용하는 모든 파일들을 찾습니다")
  .argument("<filePath>", "분석할 대상 파일 경로")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (filePath, options) => {
    try {
      const tracker = new DependencyTracker(process.cwd())

      console.log('🔄 Building dependency graph...')
      const graph = await tracker.analyzeWithEnhancedDependencyGraph()

      const usingFiles = tracker.findFilesUsingTargetFromGraph(graph, filePath)

      if (options.format === 'json') {
        console.log(JSON.stringify({ targetFile: filePath, usingFiles }, null, 2))
      } else {
        console.log('📄 Enhanced 파일 사용처 분석 결과')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`🎯 대상 파일: ${filePath}`)
        console.log(`📁 총 파일: ${graph.nodes.size}개`)

        if (usingFiles.length === 0) {
          console.log('\n❌ 이 파일을 사용하는 파일이 없습니다.')
        } else {
          console.log(`\n✅ 사용하는 파일들 (${usingFiles.length}개):`)
          usingFiles.forEach((file, i) => {
            const relative = path.relative(process.cwd(), file)
            console.log(`  ${i + 1}. ${relative}`)
          })
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced 파일 사용처 분석 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-method-usages-enhanced")
  .description("EnhancedExportExtractor 기반으로 특정 메서드를 사용하는 모든 파일들을 찾습니다")
  .argument("<className>", "클래스 이름 (없으면 null 입력)")
  .argument("<methodName>", "메서드 이름")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (className, methodName, options) => {
    try {
      const tracker = new DependencyTracker(process.cwd())
      const actualClassName = className === 'null' ? null : className

      console.log('🔄 Building dependency graph...')
      const graph = await tracker.analyzeWithEnhancedDependencyGraph()

      const usingFiles = tracker.findFilesUsingMethodFromGraph(graph, actualClassName, methodName)

      if (options.format === 'json') {
        console.log(JSON.stringify({
          className: actualClassName,
          methodName,
          usingFiles
        }, null, 2))
      } else {
        console.log('🔧 Enhanced 메서드 사용처 분석 결과')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`🎯 대상 메서드: ${actualClassName ? `${actualClassName}.` : ''}${methodName}`)
        console.log(`📁 총 파일: ${graph.nodes.size}개`)

        if (usingFiles.length === 0) {
          console.log('\n❌ 이 메서드를 사용하는 파일이 없습니다.')
        } else {
          console.log(`\n✅ 사용하는 파일들 (${usingFiles.length}개):`)
          usingFiles.forEach((usage, i) => {
            const relative = path.relative(process.cwd(), usage.filePath)
            console.log(`  ${i + 1}. ${relative}:${usage.line}`)
            if (options.verbose) {
              console.log(`     Import된 멤버들: [${usage.importedMembers.join(', ')}]`)
            }
          })
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced 메서드 사용처 분석 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-unused-files-enhanced")
  .description("EnhancedExportExtractor 기반으로 어디서도 사용되지 않는 파일들을 찾습니다")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (options) => {
    try {
      const tracker = new DependencyTracker(process.cwd())

      console.log('🔄 Building dependency graph...')
      const graph = await tracker.analyzeWithEnhancedDependencyGraph()

      const unusedFiles = tracker.findUnusedFilesFromGraph(graph)

      if (options.format === 'json') {
        console.log(JSON.stringify({ unusedFiles }, null, 2))
      } else {
        console.log('🗑️ Enhanced 미사용 파일 분석 결과')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 총 파일: ${graph.nodes.size}개`)
        console.log(`🚀 엔트리 포인트: ${graph.entryPoints.length}개`)

        if (unusedFiles.length === 0) {
          console.log('\n✅ 모든 파일이 사용되고 있습니다.')
        } else {
          console.log(`\n🗑️ 미사용 파일들 (${unusedFiles.length}개):`)
          unusedFiles.forEach((file, i) => {
            const relative = path.relative(process.cwd(), file)
            console.log(`  ${i + 1}. ${relative}`)
          })
        }

        if (options.verbose) {
          console.log(`\n🚀 엔트리 포인트들 (${graph.entryPoints.length}개):`)
          graph.entryPoints.slice(0, 10).forEach((entry, i) => {
            const relative = path.relative(process.cwd(), entry)
            console.log(`  ${i + 1}. ${relative}`)
          })
          if (graph.entryPoints.length > 10) {
            console.log(`  ... and ${graph.entryPoints.length - 10} more`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced 미사용 파일 분석 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command("find-unused-methods-enhanced")
  .description("EnhancedExportExtractor 기반으로 어디서도 사용되지 않는 메서드들을 찾습니다")
  .option("--format <format>", "출력 형식 (json, summary)", "summary")
  .option("-v, --verbose", "상세 출력 활성화")
  .action(async (options) => {
    try {
      const tracker = new DependencyTracker(process.cwd())

      console.log('🔄 Building dependency graph...')
      const graph = await tracker.analyzeWithEnhancedDependencyGraph()

      const unusedMethods = tracker.findUnusedMethodsFromGraph(graph)

      if (options.format === 'json') {
        console.log(JSON.stringify({ unusedMethods }, null, 2))
      } else {
        console.log('🔧 Enhanced 미사용 메서드 분석 결과')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 총 파일: ${graph.nodes.size}개`)
        console.log(`🔗 총 의존성: ${graph.edges.length}개`)

        if (unusedMethods.length === 0) {
          console.log('\n✅ 모든 메서드가 사용되고 있습니다.')
        } else {
          console.log(`\n🔧 미사용 메서드들 (${unusedMethods.length}개):`)
          const displayCount = options.verbose ? unusedMethods.length : Math.min(10, unusedMethods.length)

          unusedMethods.slice(0, displayCount).forEach((method, i) => {
            const relative = path.relative(process.cwd(), method.filePath)
            const methodName = method.className ?
              `${method.className}.${method.methodName}` :
              method.methodName
            console.log(`  ${i + 1}. ${methodName}`)
            console.log(`     위치: ${relative}`)
            console.log(`     타입: ${method.exportType}`)
          })

          if (!options.verbose && unusedMethods.length > 10) {
            console.log(`\n  ... and ${unusedMethods.length - 10} more (use --verbose to see all)`)
          }
        }
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Enhanced 미사용 메서드 분석 실패:", error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Error handling
program.exitOverride()

try {
  program.parse()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
