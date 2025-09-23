#!/usr/bin/env node

import { Command } from "commander"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { UnifiedDependencyAnalyzer } from "./analyzers/UnifiedDependencyAnalyzer.js"
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
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot)
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
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot)

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

// Help command
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name()
})

// Error handling
program.exitOverride()

try {
  program.parse()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
