#!/usr/bin/env node

import { Command } from "commander"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { UnifiedDependencyAnalyzer } from "./analyzers/UnifiedDependencyAnalyzer.js"

const program = new Command()

program
  .name("effect-cli")
  .description("A dependency analysis CLI tool")
  .version("1.0.0")

// Analyze command
program
  .command("analyze")
  .description("Analyze code dependencies and structure")
  .argument("<filePath>", "Path to the file or directory to analyze")
  .option("--format <format>", "Output format", "json")
  .option("--parallel", "Enable parallel processing for multiple files")
  .option("--preset <preset>", "Analysis preset configuration", "balanced")
  .option("-v, --verbose", "Enable verbose output")
  .option("--include <pattern>", "Glob pattern for files to include")
  .option("--exclude <pattern>", "Glob pattern for files to exclude")
  .option("--max-depth <depth>", "Maximum directory depth to traverse", parseInt)
  .option("--extensions <exts>", "Comma-separated file extensions to include")
  .option("--concurrency <num>", "Number of files to process in parallel", parseInt, 4)
  .option("--output-dir <dir>", "Output directory for saving analysis results")
  .option("--enhanced", "Enable enhanced analysis")
  .option("-t, --by-type <value>", "Group analysis results by file type", "false")
  .option("-p, --path-resolution <value>", "Enable advanced path resolution", "false")
  .option("--resolve-node-modules <value>", "Resolve node_modules dependencies", "false")
  .option("--validate-files <value>", "Validate that resolved file paths exist", "false")
  .action(async (filePath, options) => {
    try {
      console.log(`🔍 Starting analysis of: ${filePath}`)

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
      if (options.verbose) {
        console.log("Files:", files.slice(0, 5)) // Show first 5 files
      }

      const projectRoot = stat.isDirectory() ? fullPath : path.dirname(fullPath)
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot)
      const result = await analyzer.analyzeProject(files)

      if (options.verbose) {
        console.log(`📊 Analysis completed:`)
        console.log(`📁 Total files: ${result.analysisMetadata.filesProcessed}`)
        console.log(`🔗 Dependencies found: ${Object.keys(result.graph).length}`)
        console.log(`⏱️ Duration: ${result.analysisMetadata.duration}ms`)
      }

      if (options.format === "json") {
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
  .option("--format <format>", "Output format", "json")
  .option("--output-dir <dir>", "Output directory")
  .option("--include-tests", "Include test files")
  .option("--include-docs", "Include documentation files")
  .option("--include-node-modules", "Include node_modules")
  .option("--max-depth <depth>", "Maximum directory depth", parseInt)
  .option("-v, --verbose", "Enable verbose output")
  .option("--node-type <type>", "Node type filter")
  .option("--compression", "Enable compression")
  .option("--incremental", "Enable incremental analysis")
  .option("--analysis-depth <depth>", "Analysis depth level", "standard")
  .option("--exclude <pattern>", "Exclude pattern")
  .option("--include <pattern>", "Include pattern")
  .option("--min-file-size <size>", "Minimum file size", parseInt)
  .option("--max-file-size <size>", "Maximum file size", parseInt)
  .option("--output-name <name>", "Output file name")
  .option("--generate-report", "Generate analysis report")
  .option("--generate-viz", "Generate visualization")
  .option("--confidence-threshold <threshold>", "Confidence threshold", parseInt)
  .option("--enable-cache", "Enable caching")
  .option("--parallel", "Enable parallel processing")
  .option("--output-metadata", "Output metadata")
  .action(async (filePath, options) => {
    try {
      console.log(`📂 발견된 파일 분류 시작...`)

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

      if (options.verbose) {
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
      if (options.outputDir) {
        const outputDir = path.resolve(options.outputDir)
        await fs.mkdir(outputDir, { recursive: true })

        const reportPath = path.join(outputDir, "analysis-report.json")
        await fs.writeFile(reportPath, JSON.stringify(result, null, 2))

        console.log(`✅ 분석 완료!`)
        console.log(`💾 결과 저장됨: ${outputDir}`)
      }

      process.exit(0)
    } catch (error) {
      console.error("❌ Classification failed:", error instanceof Error ? error.message : String(error))
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
