/**
 * Code Analysis Command
 *
 * Implements the code analysis functionality using dependency-linker
 * with Effect.js patterns and parallel processing.
 */

import {
  analyzeTypeScriptFile,
  analyzeMarkdownFile,
  AnalysisEngine,
  PathResolverInterpreter
} from "@context-action/dependency-linker"
import type { AnalysisResult } from "@context-action/dependency-linker"
import {
  analyzeFileWithPathResolution,
  analyzeDirectoryWithPathResolution,
  formatAnalysisResults,
  type EnhancedAnalysisResult,
  type AnalysisOptions
} from "../utils/EnhancedAnalyzer.js"
import { findProjectRoot, analyzeProjectRoot } from "../utils/ProjectRootDetector.js"
import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as path from "node:path"

// Filter options interface
interface FilterOptions {
  include?: string
  exclude?: string
  maxDepth?: number
  extensions?: Array<string>
  concurrency: number
}

// Arguments
const filePathArg = Args.text({ name: "filePath" }).pipe(
  Args.withDescription("Path to the file or directory to analyze")
)

// Options
const formatOption = Options.choice("format", ["json", "summary", "table", "csv"]).pipe(
  Options.withDefault("json" as const),
  Options.withDescription("Output format")
)

const parallelOption = Options.boolean("parallel").pipe(
  Options.withDefault(false),
  Options.withDescription("Enable parallel processing for multiple files")
)

const presetOption = Options.choice("preset", ["fast", "balanced", "comprehensive"]).pipe(
  Options.withDefault("balanced" as const),
  Options.withDescription("Analysis preset configuration")
)

const verboseOption = Options.boolean("verbose").pipe(
  Options.withDefault(false),
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output")
)

// File filtering options
const includeOption = Options.text("include").pipe(
  Options.optional,
  Options.withDescription("Glob pattern for files to include (e.g., '**/*.{ts,tsx}')")
)

const excludeOption = Options.text("exclude").pipe(
  Options.optional,
  Options.withDescription("Glob pattern for files to exclude (e.g., '**/*.test.*')")
)

const maxDepthOption = Options.integer("max-depth").pipe(
  Options.optional,
  Options.withDescription("Maximum directory depth to traverse")
)

const extensionsOption = Options.text("extensions").pipe(
  Options.optional,
  Options.withDescription("Comma-separated file extensions to include (default: 'ts,tsx,js,jsx')")
)

const concurrencyOption = Options.integer("concurrency").pipe(
  Options.withDefault(3),
  Options.withDescription("Number of files to process in parallel")
)
// Output directory option for multi-file mode
const outputDirOption = Options.text("output-dir").pipe(
  Options.optional,
  Options.withDescription("Output directory for saving individual analysis results as separate JSON files")
)

// Enhanced analysis option with interpreters
const enhancedOption = Options.boolean("enhanced").pipe(
  Options.withDefault(false),
  Options.withDescription("Enable enhanced analysis with path resolution and dependency interpretation")
)

// File type separation option
const byTypeOption = Options.choice("by-type", ["true", "false"]).pipe(
  Options.withDefault("true" as const),
  Options.withAlias("t"),
  Options.withDescription("Group analysis results by file type (TypeScript/TSX, Test files, Markdown)")
)

// Path resolution options
const pathResolutionOption = Options.choice("path-resolution", ["true", "false"]).pipe(
  Options.withDefault("true" as const),
  Options.withAlias("p"),
  Options.withDescription("Enable advanced path resolution with PathResolverInterpreter")
)

const resolveNodeModulesOption = Options.choice("resolve-node-modules", ["true", "false"]).pipe(
  Options.withDefault("true" as const),
  Options.withDescription("Resolve node_modules dependencies")
)

const validateFilesOption = Options.choice("validate-files", ["true", "false"]).pipe(
  Options.withDefault("true" as const),
  Options.withDescription("Validate that resolved file paths exist")
)

// Main command implementation
export const analyzeCommand = Command.make(
  "analyze",
  {
    filePath: filePathArg,
    format: formatOption,
    parallel: parallelOption,
    preset: presetOption,
    verbose: verboseOption,
    include: includeOption,
    exclude: excludeOption,
    maxDepth: maxDepthOption,
    extensions: extensionsOption,
    concurrency: concurrencyOption,
    outputDir: outputDirOption,
    enhanced: enhancedOption,
    byType: byTypeOption,
    pathResolution: pathResolutionOption,
    resolveNodeModules: resolveNodeModulesOption,
    validateFiles: validateFilesOption
  }
).pipe(
  Command.withDescription("Analyze code dependencies and structure"),
  Command.withHandler((args) =>
    Effect.gen(function*() {
      const {
        byType: byTypeString,
        concurrency,
        enhanced,
        exclude,
        extensions,
        filePath,
        format,
        include,
        maxDepth,
        outputDir,
        parallel,
        preset,
        verbose,
        pathResolution: pathResolutionString,
        resolveNodeModules: resolveNodeModulesString,
        validateFiles: validateFilesString
      } = args

      const byType = byTypeString === "true"
      const pathResolution = pathResolutionString === "true"
      const resolveNodeModules = resolveNodeModulesString === "true"
      const validateFiles = validateFilesString === "true"

      const filterOptions: {
        include?: string
        exclude?: string
        maxDepth?: number
        extensions?: Array<string>
        concurrency: number
      } = {
        concurrency
      }

      // Extract values from Option types
      const includeValue = Option.getOrUndefined(include)
      const excludeValue = Option.getOrUndefined(exclude)
      const maxDepthValue = Option.getOrUndefined(maxDepth)
      const extensionsValue = Option.getOrUndefined(extensions)
      const outputDirValue = Option.getOrUndefined(outputDir)

      if (includeValue) filterOptions.include = includeValue
      if (excludeValue) filterOptions.exclude = excludeValue
      if (maxDepthValue) filterOptions.maxDepth = maxDepthValue
      if (extensionsValue) {
        filterOptions.extensions = extensionsValue.split(",").map((ext) => ext.trim())
      }

      if (verbose) {
        yield* Console.log(`🔍 Starting analysis of: ${filePath}`)
        yield* Console.log(`📊 Format: ${format}, Preset: ${preset}, Parallel: ${parallel}`)
        yield* Console.log(`🛤️  Path Resolution: ${pathResolution}, Enhanced: ${enhanced}`)
        yield* Console.log(`📦 Resolve NodeModules: ${resolveNodeModules}, Validate Files: ${validateFiles}`)
        yield* Console.log(`🏷️  Group by Type: ${byType}`)
        if (includeValue) yield* Console.log(`📥 Include pattern: ${includeValue}`)
        if (excludeValue) yield* Console.log(`📤 Exclude pattern: ${excludeValue}`)
        if (maxDepthValue) yield* Console.log(`📏 Max depth: ${maxDepthValue}`)
        if (extensionsValue) yield* Console.log(`📄 Extensions: ${extensionsValue}`)
        if (outputDirValue) yield* Console.log(`📁 Output directory: ${outputDirValue}`)
        yield* Console.log(`🔄 Concurrency: ${concurrency}`)

        // 프로젝트 루트 정보 출력
        const projectRoot = findProjectRoot(filePath)
        const projectInfo = analyzeProjectRoot(projectRoot)
        yield* Console.log(`🏠 Project root: ${projectRoot}`)
        yield* Console.log(`📂 Project type: ${projectInfo.projectType}`)
        yield* Console.log(`📦 Package manager: ${projectInfo.packageManager}`)
        yield* Console.log(`📜 TypeScript: ${projectInfo.hasTypeScript ? '✅' : '❌'}`)
      }

      // Check if it's a single file or directory
      const isDirectory = yield* Effect.tryPromise({
        try: async () => {
          const fs = await import("fs/promises")
          const stat = await fs.stat(filePath)
          return stat.isDirectory()
        },
        catch: (error) => new Error(`Failed to access path: ${String(error)}`)
      })

      if (isDirectory) {
        // Directory analysis with enhanced path resolution
        yield* analyzeEnhancedDirectory(filePath, {
          format,
          parallel,
          verbose,
          byType,
          pathResolution,
          resolveNodeModules,
          validateFiles,
          filterOptions,
          outputDirValue
        })
      } else {
        // Single file analysis with enhanced path resolution
        yield* analyzeEnhancedSingleFileWrapper(filePath, {
          format,
          verbose,
          pathResolution,
          resolveNodeModules,
          validateFiles,
          outputDirValue
        })
      }
    })
  )
)

/**
 * Find files matching the specified filters
 */
const findMatchingFiles = (
  dirPath: string,
  filterOptions: FilterOptions,
  verbose: boolean
) =>
  Effect.gen(function*() {
    const { exclude, extensions, include, maxDepth } = filterOptions

    // Default patterns - 기본적으로 ts, tsx, js, jsx, md 모두 포함
    const defaultExtensions = extensions || ["ts", "tsx", "js", "jsx", "md"]

    // Create proper glob pattern for extensions
    let defaultInclude: string
    if (include) {
      defaultInclude = include
    } else if (defaultExtensions.length === 1) {
      defaultInclude = `**/*.${defaultExtensions[0]}`
    } else {
      defaultInclude = `**/*.{${defaultExtensions.join(",")}}`
    }

    const defaultExclude = [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/*.test.*",
      "**/*.spec.*",
      ...(exclude ? [exclude] : [])
    ]

    if (verbose) {
      yield* Console.log(`🔍 Search pattern: ${defaultInclude}`)
      yield* Console.log(`🚫 Exclude patterns: ${defaultExclude.join(", ")}`)
    }

    // Find files using glob
    const globPattern = dirPath.endsWith("/") ? dirPath + defaultInclude : `${dirPath}/${defaultInclude}`
    const allFiles = yield* Effect.tryPromise({
      try: async () => {
        const { glob } = await import("glob")
        const globOptions: any = {
          ignore: defaultExclude,
          absolute: true
        }
        if (maxDepth !== undefined) {
          globOptions.maxDepth = maxDepth
        }
        return await glob(globPattern, globOptions)
      },
      catch: (error) => new Error(`Failed to find files: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`📂 Found ${allFiles.length} files to analyze`)
    }

    return allFiles as Array<string>
  })

/**
 * Analyze a single file
 */
const analyzeSingleFile = (
  filePath: string,
  options: { format: string; verbose: boolean; outputDir?: string }
) =>
  Effect.gen(function*() {
    const { format, outputDir, verbose } = options

    if (verbose) {
      yield* Console.log(`📄 Analyzing single file: ${filePath}`)
    }

    // Determine file type and use appropriate analyzer
    const isMarkdown = filePath.toLowerCase().endsWith('.md') || filePath.toLowerCase().endsWith('.markdown')

    const result = yield* Effect.tryPromise({
      try: () => {
        if (isMarkdown) {
          if (verbose) {
            console.log(`📝 Using markdown analyzer for: ${filePath}`)
          }
          return analyzeMarkdownFile(filePath, {
            format: format as any,
            includeSources: true,
            classifyDependencies: true
          })
        } else {
          if (verbose) {
            console.log(`⚡ Using TypeScript analyzer for: ${filePath}`)
          }
          return analyzeTypeScriptFile(filePath, {
            format: format as any,
            includeSources: true,
            classifyDependencies: true
          })
        }
      },
      catch: (error) => new Error(`Analysis failed: ${String(error)}`)
    })

    // Save to individual file if outputDir is specified
    if (outputDir) {
      yield* createOutputDirectory(outputDir, verbose)
      yield* saveIndividualResult(result, outputDir, verbose)
    } else {
      // Output results based on format to console
      yield* outputResult(result, format, verbose)
    }
  })

/**
 * Analyze a single file with enhanced interpreters
 */
const analyzeEnhancedSingleFile = (
  filePath: string,
  options: { format: string; verbose: boolean; outputDir?: string }
) =>
  Effect.gen(function*() {
    const { format, outputDir, verbose } = options

    if (verbose) {
      yield* Console.log(`🚀 Enhanced analysis of single file: ${filePath}`)
    }

    // Create enhanced AnalysisEngine with default configuration
    const engine = new AnalysisEngine()

    // Register PathResolverInterpreter
    const pathInterpreter = new PathResolverInterpreter()
    engine.registerInterpreter('path-resolver', pathInterpreter)

    if (verbose) {
      const interpreters = Array.from(engine.getRegisteredInterpreters().keys())
      yield* Console.log(`🧠 Using interpreters: ${interpreters.join(', ')}`)
    }

    const result = yield* Effect.tryPromise({
      try: () => engine.analyzeFile(filePath),
      catch: (error) => new Error(`Enhanced analysis failed: ${String(error)}`)
    })

    // Save to individual file if outputDir is specified
    if (outputDir) {
      yield* createOutputDirectory(outputDir, verbose)
      yield* saveIndividualResult(result, outputDir, verbose)
    } else {
      // Output results based on format to console (enhanced version)
      yield* outputEnhancedResult(result, format, verbose)
    }
  })

/**
 * Analyze a directory with optional parallel processing
 */
const analyzeDirectory = (
  dirPath: string,
  options: {
    format: string
    parallel: boolean
    verbose: boolean
    outputDir?: string
    filterOptions: {
      include?: string
      exclude?: string
      maxDepth?: number
      extensions?: Array<string>
      maxFileSize?: string
      since?: string
      concurrency: number
    }
  }
) =>
  Effect.gen(function*() {
    const { filterOptions, format, outputDir, parallel, verbose } = options

    if (verbose) {
      yield* Console.log(`📁 Analyzing directory: ${dirPath}`)
    }

    // Build file search pattern
    const files = yield* findMatchingFiles(dirPath, filterOptions, verbose)

    if (files.length === 0) {
      yield* Console.log("⚠️ No TypeScript/JavaScript files found")
      return
    }

    if (verbose) {
      yield* Console.log(`📊 Found ${files.length} files to analyze`)
    }

    // Create output directory if specified
    if (outputDir) {
      yield* createOutputDirectory(outputDir, verbose)
    }

    const concurrency = filterOptions.concurrency

    if (parallel && files.length > 1) {
      // Separate files by type for different batch processing
      const markdownFiles = files.filter(f => f.toLowerCase().endsWith('.md') || f.toLowerCase().endsWith('.markdown'))
      const tsFiles = files.filter(f => !f.toLowerCase().endsWith('.md') && !f.toLowerCase().endsWith('.markdown'))

      const results: Array<any> = []

      // Process TypeScript files with getBatchAnalysis if any
      if (tsFiles.length > 0) {
        if (verbose) {
          yield* Console.log(`📊 Processing ${tsFiles.length} TypeScript/JavaScript files with batch analysis`)
        }
        const tsResults = yield* Effect.tryPromise({
          try: () =>
            getBatchAnalysis(tsFiles, {
              concurrency,
              format: "json",
              includeSources: false,
              classifyDependencies: true,
              onProgress: (completed, total) => {
                if (verbose) {
                  console.log(`TS Progress: ${completed}/${total}`)
                }
              }
            }),
          catch: (error) => new Error(`TypeScript batch analysis failed: ${String(error)}`)
        })
        results.push(...tsResults)
      }

      // Process Markdown files individually in parallel
      if (markdownFiles.length > 0) {
        if (verbose) {
          yield* Console.log(`📝 Processing ${markdownFiles.length} Markdown files individually`)
        }
        const mdResults = yield* Effect.forEach(
          markdownFiles,
          (file) =>
            Effect.tryPromise({
              try: () =>
                analyzeMarkdownFile(file, {
                  format: "json",
                  includeSources: false,
                  classifyDependencies: true
                }),
              catch: (error) => ({
                filePath: file,
                success: false,
                error: String(error)
              })
            }),
          { concurrency: parallel ? concurrency : 1 }
        )
        results.push(...mdResults)
      }

      if (outputDir) {
        yield* saveBatchResults(results, outputDir, verbose)
      } else {
        yield* outputBatchResults(results, format, verbose)
      }
    } else {
      // Sequential processing using Effect.forEach
      const results = yield* Effect.forEach(
        files,
        (file) =>
          Effect.tryPromise({
            try: () => {
              const isMarkdown = file.toLowerCase().endsWith('.md') || file.toLowerCase().endsWith('.markdown')

              if (isMarkdown) {
                return analyzeMarkdownFile(file, {
                  format: "json",
                  includeSources: false,
                  classifyDependencies: true
                })
              } else {
                return analyzeTypeScriptFile(file, {
                  format: "json",
                  includeSources: false,
                  classifyDependencies: true
                })
              }
            },
            catch: (error) => ({
              filePath: file,
              success: false,
              error: String(error)
            })
          }),
        { concurrency: parallel ? concurrency : 1 }
      )

      if (outputDir) {
        yield* saveBatchResults(results, outputDir, verbose)
      } else {
        yield* outputBatchResults(results, format, verbose)
      }
    }
  })

/**
 * Output enhanced analysis result with interpreter data
 */
// Removed old outputEnhancedResult - using new enhanced version

/**
 * Output single analysis result
 */
const outputResult = (
  result: AnalysisResult,
  format: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    switch (format) {
      case "json":
        yield* Console.log(JSON.stringify(result, null, 2))
        break
      case "summary":
        yield* outputSummary(result, verbose)
        break
      case "table":
        yield* outputTable(result, verbose)
        break
      case "csv":
        yield* outputCSV([result], verbose)
        break
      default:
        yield* Console.log(JSON.stringify(result, null, 2))
    }
  })

/**
 * Output batch analysis results
 */
const outputBatchResults = (
  results: Array<AnalysisResult>,
  format: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    switch (format) {
      case "json":
        yield* Console.log(JSON.stringify(results, null, 2))
        break
      case "summary":
        yield* outputBatchSummary(results, verbose)
        break
      case "table":
        yield* outputBatchTable(results, verbose)
        break
      case "csv":
        yield* outputCSV(results, verbose)
        break
      default:
        yield* Console.log(JSON.stringify(results, null, 2))
    }
  })

/**
 * Output summary format for single file
 */
const outputSummary = (result: AnalysisResult, verbose: boolean) =>
  Effect.gen(function*() {
    const { errors, extractedData, filePath, performanceMetrics } = result
    const dependencies = extractedData?.dependency?.dependencies || []
    const success = errors.length === 0

    yield* Console.log(`\n📄 Analysis Summary`)
    yield* Console.log(`File: ${filePath}`)
    yield* Console.log(`Status: ${success ? "✅ Success" : "❌ Failed"}`)

    if (success && dependencies.length > 0) {
      // 외부/내부 의존성 분류 (간단한 휴리스틱)
      const external = dependencies.filter((dep: any) =>
        !dep.source.startsWith("./") && !dep.source.startsWith("../") && !dep.source.startsWith("/")
      ).length
      const internal = dependencies.length - external

      yield* Console.log(`Dependencies: ${dependencies.length} total (${external} external, ${internal} internal)`)

      if (verbose && dependencies.length > 0) {
        yield* Console.log(`\nDependencies:`)
        for (const dep of dependencies.slice(0, 10)) {
          const isExternal = !dep.source.startsWith("./") && !dep.source.startsWith("../") &&
            !dep.source.startsWith("/")
          yield* Console.log(`  ${isExternal ? "📦" : "📁"} ${dep.source}`)
        }
        if (dependencies.length > 10) {
          yield* Console.log(`  ... and ${dependencies.length - 10} more`)
        }
      }
    } else if (dependencies.length === 0) {
      yield* Console.log(`Dependencies: No dependencies found`)
    }

    if (performanceMetrics) {
      yield* Console.log(`Analysis time: ${performanceMetrics.parseTime || performanceMetrics.totalTime}ms`)
    }

    if (!success && errors.length > 0) {
      yield* Console.log(`Errors: ${errors.length} error(s) occurred`)
      if (verbose) {
        for (const error of errors.slice(0, 3)) {
          yield* Console.log(`  ❌ ${error.message || error}`)
        }
      }
    }
  })

/**
 * Output summary for batch results
 */
const outputBatchSummary = (results: Array<AnalysisResult>, verbose: boolean) =>
  Effect.gen(function*() {
    const successful = results.filter((r) => (r.errors?.length ?? 0) === 0)
    const failed = results.filter((r) => (r.errors?.length ?? 0) > 0)

    yield* Console.log(`\n📊 Batch Analysis Summary`)
    yield* Console.log(`Total files: ${results.length}`)
    yield* Console.log(`Successful: ${successful.length}`)
    yield* Console.log(`Failed: ${failed.length}`)

    if (successful.length > 0) {
      const totalDeps = successful.reduce((sum, r) => {
        const deps = r.extractedData?.dependency?.dependencies ?? []
        return sum + deps.length
      }, 0)
      yield* Console.log(`Total dependencies found: ${totalDeps}`)
    }

    if (verbose && failed.length > 0) {
      yield* Console.log(`\nFailed files:`)
      for (const failure of failed) {
        const errorMsg = failure.errors?.[0]?.message || "Unknown error"
        yield* Console.log(`  ❌ ${failure.filePath}: ${errorMsg}`)
      }
    }
  })

/**
 * Output table format for single file
 */
const outputTable = (result: AnalysisResult, verbose: boolean) =>
  Effect.gen(function*() {
    const { extractedData } = result
    const dependencies = extractedData?.dependency?.dependencies || []

    if (dependencies.length === 0) {
      yield* Console.log("No dependencies found")
      return
    }

    yield* Console.log(`\n📋 Dependencies Table`)
    yield* Console.log("┌─────────────────────────────────┬──────────┬──────────────┐")
    yield* Console.log("│ Dependency                      │ Type     │ Location     │")
    yield* Console.log("├─────────────────────────────────┼──────────┼──────────────┤")

    for (const dep of dependencies.slice(0, verbose ? 50 : 20)) {
      const name = dep.source.padEnd(30).substring(0, 30)
      const isExternal = !dep.source.startsWith("./") && !dep.source.startsWith("../") && !dep.source.startsWith("/")
      const type = (isExternal ? "external" : "internal").padEnd(8).substring(0, 8)
      const loc = dep.location ? `L${dep.location.line}` : "unknown"
      const location = loc.padEnd(12).substring(0, 12)

      yield* Console.log(`│ ${name} │ ${type} │ ${location} │`)
    }

    yield* Console.log("└─────────────────────────────────┴──────────┴──────────────┘")

    if (dependencies.length > (verbose ? 50 : 20)) {
      yield* Console.log(`... and ${dependencies.length - (verbose ? 50 : 20)} more dependencies`)
    }
  })

/**
 * Output table format for batch results
 */
const outputBatchTable = (results: Array<AnalysisResult>, verbose: boolean) =>
  Effect.gen(function*() {
    yield* Console.log(`\n📋 Batch Analysis Table`)
    yield* Console.log("┌─────────────────────────────────┬──────────┬───────────────┐")
    yield* Console.log("│ File                           │ Status   │ Dependencies  │")
    yield* Console.log("├─────────────────────────────────┼──────────┼───────────────┤")

    for (const result of results.slice(0, verbose ? 50 : 20)) {
      const file = (result.filePath ?? "unknown").split("/").pop() || ""
      const fileName = file.padEnd(30).substring(0, 30)
      const status = (result.errors?.length ?? 0) === 0 ? "✅ OK    " : "❌ Error "
      const deps = result.extractedData?.dependency?.dependencies ?? []
      const depCount = deps.length.toString().padStart(13)

      yield* Console.log(`│ ${fileName} │ ${status} │ ${depCount} │`)
    }

    yield* Console.log("└─────────────────────────────────┴──────────┴───────────────┘")
  })

/**
 * Output CSV format
 */
const outputCSV = (results: Array<AnalysisResult>, _verbose: boolean) =>
  Effect.gen(function*() {
    yield* Console.log("File,Status,Dependencies,External,Internal,AnalysisTime")

    for (const result of results) {
      const filePath = result.filePath || "unknown"
      const success = (result.errors?.length ?? 0) === 0 ? "success" : "failed"
      const dependencies = result.extractedData?.dependency?.dependencies || []
      const external = dependencies.filter((dep: any) =>
        !dep.source.startsWith("./") && !dep.source.startsWith("../") && !dep.source.startsWith("/")
      ).length
      const internal = dependencies.length - external
      const analysisTime = result.performanceMetrics?.parseTime || result.performanceMetrics?.totalTime || 0

      yield* Console.log(`"${filePath}",${success},${dependencies.length},${external},${internal},${analysisTime}`)
    }
  })
/**
 * Create output directory for multi-file results
 */
const createOutputDirectory = (outputDir: string, verbose: boolean) =>
  Effect.gen(function*() {
    if (verbose) {
      yield* Console.log(`📁 Creating output directory: ${outputDir}`)
    }

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        const path = await import("path")

        // Create directory recursively if it doesn't exist
        await fs.mkdir(outputDir, { recursive: true })

        // Create subdirectories for organization
        await fs.mkdir(path.join(outputDir, "results"), { recursive: true })
        await fs.mkdir(path.join(outputDir, "summary"), { recursive: true })
      },
      catch: (error) => new Error(`Failed to create output directory: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`✅ Output directory created successfully`)
    }
  })

/**
 * Save individual analysis result to file
 */
const saveIndividualResult = (result: AnalysisResult, outputDir: string, verbose: boolean) =>
  Effect.gen(function*() {
    const fileName = generateFileName(result.filePath)
    const outputPath = yield* Effect.tryPromise({
      try: async () => {
        const path = await import("path")
        return path.join(outputDir, "results", `${fileName}.json`)
      },
      catch: (error) => new Error(`Failed to generate output path: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`💾 Saving result to: ${outputPath}`)
    }

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8")
      },
      catch: (error) => new Error(`Failed to save result file: ${String(error)}`)
    })
  })

/**
 * Save batch analysis results to multiple files
 */
const saveBatchResults = (results: Array<AnalysisResult>, outputDir: string, verbose: boolean) =>
  Effect.gen(function*() {
    if (verbose) {
      yield* Console.log(`💾 Saving ${results.length} analysis results to ${outputDir}`)
    }

    // Save individual results
    yield* Effect.forEach(
      results,
      (result) => saveIndividualResult(result, outputDir, false),
      { concurrency: 10 }
    )

    // Save summary
    const summary = generateBatchSummary(results)
    const summaryPath = yield* Effect.tryPromise({
      try: async () => {
        const path = await import("path")
        return path.join(outputDir, "summary", "batch-summary.json")
      },
      catch: (error) => new Error(`Failed to generate summary path: ${String(error)}`)
    })

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8")
      },
      catch: (error) => new Error(`Failed to save summary file: ${String(error)}`)
    })

    // Save file index
    const indexPath = yield* Effect.tryPromise({
      try: async () => {
        const path = await import("path")
        return path.join(outputDir, "file-index.json")
      },
      catch: (error) => new Error(`Failed to generate index path: ${String(error)}`)
    })

    const index = results.map((result) => ({
      originalPath: result.filePath,
      resultFile: `results/${generateFileName(result.filePath)}.json`,
      success: (result.errors?.length ?? 0) === 0,
      dependencyCount: result.extractedData?.dependency?.dependencies?.length ?? 0
    }))

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        await fs.writeFile(
          indexPath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              totalFiles: results.length,
              files: index
            },
            null,
            2
          ),
          "utf-8"
        )
      },
      catch: (error) => new Error(`Failed to save index file: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`✅ Saved ${results.length} individual results and summary`)
      yield* Console.log(`📄 File index: ${indexPath}`)
      yield* Console.log(`📊 Summary: ${summaryPath}`)
    }
  })

/**
 * Generate safe filename from file path
 */
const generateFileName = (filePath: string): string => {
  // Remove directory path and replace unsafe characters
  const baseName = filePath.split("/").pop() || "unknown"
  const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "")
  const hash = Math.abs(
    filePath.split("").reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
  ).toString(16).substring(0, 8)

  return `${nameWithoutExt}_${hash}`.replace(/[^a-zA-Z0-9_-]/g, "_")
}

/**
 * Generate batch analysis summary
 */
const generateBatchSummary = (results: Array<AnalysisResult>) => {
  const successful = results.filter((r) => (r.errors?.length ?? 0) === 0)
  const failed = results.filter((r) => (r.errors?.length ?? 0) > 0)

  const totalDeps = successful.reduce((sum, r) => {
    const deps = r.extractedData?.dependency?.dependencies ?? []
    return sum + deps.length
  }, 0)

  const totalExternal = successful.reduce((sum, r) => {
    const deps = r.extractedData?.dependency?.dependencies ?? []
    const external = deps.filter((dep: any) =>
      !dep.source.startsWith("./") && !dep.source.startsWith("../") && !dep.source.startsWith("/")
    ).length
    return sum + external
  }, 0)

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      successfulFiles: successful.length,
      failedFiles: failed.length,
      totalDependencies: totalDeps,
      totalExternalDependencies: totalExternal,
      totalInternalDependencies: totalDeps - totalExternal
    },
    failures: failed.map((f) => ({
      filePath: f.filePath,
      error: f.errors?.[0]?.message || "Unknown error"
    }))
  }
}

/**
 * Output enhanced summary with interpreter results
 */
const outputEnhancedSummary = (result: AnalysisResult, verbose: boolean) =>
  Effect.gen(function*() {
    const { errors, extractedData, filePath, interpretedData, performanceMetrics } = result
    const dependencies = extractedData?.dependency?.dependencies || []
    const success = errors.length === 0

    yield* Console.log(`\n🚀 Enhanced Analysis Summary`)
    yield* Console.log(`File: ${filePath}`)
    yield* Console.log(`Status: ${success ? "✅ Success" : "❌ Failed"}`)

    if (success && dependencies.length > 0) {
      // Basic dependency info
      const external = dependencies.filter((dep: any) =>
        !dep.source.startsWith("./") && !dep.source.startsWith("../") && !dep.source.startsWith("/")
      ).length
      const internal = dependencies.length - external

      yield* Console.log(`Dependencies: ${dependencies.length} total (${external} external, ${internal} internal)`)

      // Enhanced path resolution info
      if (interpretedData?.['path-resolver']) {
        const pathData = interpretedData['path-resolver']
        yield* Console.log(`\n🔍 Path Resolution Analysis:`)
        yield* Console.log(`  Resolved: ${pathData.summary?.resolvedCount || 0}/${pathData.summary?.totalDependencies || 0}`)
        yield* Console.log(`  External: ${pathData.summary?.externalCount || 0}`)
        yield* Console.log(`  Internal: ${pathData.summary?.internalCount || 0}`)
        yield* Console.log(`  Relative: ${pathData.summary?.relativeCount || 0}`)
        yield* Console.log(`  Aliases: ${pathData.summary?.aliasCount || 0}`)
      }

      // Dependency analysis insights
      if (interpretedData?.['dependency-analysis']) {
        const depAnalysis = interpretedData['dependency-analysis']
        yield* Console.log(`\n📊 Dependency Analysis:`)
        if (depAnalysis.summary?.circularDependencies?.length > 0) {
          yield* Console.log(`  ⚠️  Circular dependencies: ${depAnalysis.summary.circularDependencies.length}`)
        }
        if (depAnalysis.summary?.unusedImports?.length > 0) {
          yield* Console.log(`  🧹 Unused imports: ${depAnalysis.summary.unusedImports.length}`)
        }
        if (depAnalysis.insights?.riskFactors?.length > 0) {
          yield* Console.log(`  🚨 Risk factors: ${depAnalysis.insights.riskFactors.length}`)
        }
      }

      // Code structure insights
      if (interpretedData?.['identifier-analysis']) {
        const idAnalysis = interpretedData['identifier-analysis']
        yield* Console.log(`\n🏗️  Code Structure:`)
        const complexity = idAnalysis.summary?.complexity
        if (complexity) {
          yield* Console.log(`  Functions with many params: ${complexity.functionsWithManyParameters || 0}`)
          yield* Console.log(`  Large classes: ${complexity.largeClasses || 0}`)
          yield* Console.log(`  Deep inheritance: ${complexity.deepInheritance || 0}`)
        }
      }

      if (verbose && dependencies.length > 0) {
        yield* Console.log(`\nDependencies:`)
        for (const dep of dependencies.slice(0, 10)) {
          const isExternal = !dep.source.startsWith("./") && !dep.source.startsWith("../") &&
            !dep.source.startsWith("/")
          yield* Console.log(`  ${isExternal ? "📦" : "📁"} ${dep.source}`)
        }
        if (dependencies.length > 10) {
          yield* Console.log(`  ... and ${dependencies.length - 10} more`)
        }
      }
    } else if (dependencies.length === 0) {
      yield* Console.log(`Dependencies: No dependencies found`)
    }

    if (performanceMetrics) {
      yield* Console.log(`Analysis time: ${performanceMetrics.parseTime || performanceMetrics.totalTime}ms`)
    }

    if (!success && errors.length > 0) {
      yield* Console.log(`Errors: ${errors.length} error(s) occurred`)
      if (verbose) {
        for (const error of errors.slice(0, 3)) {
          yield* Console.log(`  ❌ ${error.message || error}`)
        }
      }
    }
  })

/**
 * Output enhanced table with interpreter results
 */
// Removed old outputEnhancedTable - using new enhanced version

/**
 * File type classification utilities
 */
const getFileType = (filePath: string): 'typescript' | 'test' | 'markdown' | 'other' => {
  const normalizedPath = filePath.toLowerCase()

  // Check for markdown files
  if (normalizedPath.endsWith('.md') || normalizedPath.endsWith('.markdown')) {
    return 'markdown'
  }

  // Check for test files
  if (
    normalizedPath.includes('.test.') ||
    normalizedPath.includes('.spec.') ||
    normalizedPath.includes('/__tests__/') ||
    normalizedPath.includes('/test/') ||
    normalizedPath.includes('/tests/') ||
    normalizedPath.endsWith('.test.ts') ||
    normalizedPath.endsWith('.test.tsx') ||
    normalizedPath.endsWith('.spec.ts') ||
    normalizedPath.endsWith('.spec.tsx')
  ) {
    return 'test'
  }

  // Check for TypeScript/TSX files
  if (
    normalizedPath.endsWith('.ts') ||
    normalizedPath.endsWith('.tsx') ||
    normalizedPath.endsWith('.js') ||
    normalizedPath.endsWith('.jsx')
  ) {
    return 'typescript'
  }

  return 'other'
}

const groupFilesByType = (files: Array<string>) => {
  const groups = {
    typescript: [] as Array<string>,
    test: [] as Array<string>,
    markdown: [] as Array<string>,
    other: [] as Array<string>
  }

  files.forEach(file => {
    const type = getFileType(file)
    groups[type].push(file)
  })

  return groups
}

/**
 * Analyze directory with type-based grouping
 */
const analyzeDirectoryByType = (
  dirPath: string,
  options: {
    format: string
    parallel: boolean
    verbose: boolean
    enhanced: boolean
    outputDir?: string
    filterOptions: {
      include?: string
      exclude?: string
      maxDepth?: number
      extensions?: Array<string>
      concurrency: number
    }
  }
) =>
  Effect.gen(function*() {
    const { filterOptions, format, outputDir, parallel, verbose, enhanced } = options

    if (verbose) {
      yield* Console.log(`📁 Analyzing directory by type: ${dirPath}`)
    }

    // Find all matching files
    const files = yield* findMatchingFiles(dirPath, filterOptions, verbose)

    if (files.length === 0) {
      yield* Console.log("⚠️ No files found")
      return
    }

    // Group files by type
    const fileGroups = groupFilesByType(files)

    yield* Console.log(`\n📊 File Type Distribution:`)
    yield* Console.log(`  📄 TypeScript/JS: ${fileGroups.typescript.length} files`)
    yield* Console.log(`  🧪 Test files: ${fileGroups.test.length} files`)
    yield* Console.log(`  📝 Markdown: ${fileGroups.markdown.length} files`)
    if (fileGroups.other.length > 0) {
      yield* Console.log(`  📋 Other: ${fileGroups.other.length} files`)
    }

    const allResults: Array<any> = []

    // Analyze each group separately
    for (const [groupType, groupFiles] of Object.entries(fileGroups)) {
      if (groupFiles.length === 0) continue

      yield* Console.log(`\n${getGroupIcon(groupType)} Analyzing ${groupType} files (${groupFiles.length} files)`)

      if (groupType === 'markdown') {
        // Use markdown analyzer for markdown files
        const results = yield* Effect.forEach(
          groupFiles,
          (file) =>
            Effect.tryPromise({
              try: () =>
                analyzeMarkdownFile(file, {
                  format: "json",
                  includeSources: false,
                  classifyDependencies: true
                }),
              catch: (error) => ({
                filePath: file,
                success: false,
                error: String(error)
              })
            }),
          { concurrency: parallel ? filterOptions.concurrency : 1 }
        )

        allResults.push(...results.map(r => ({ ...r, fileType: groupType })))
        yield* outputGroupResults(results, groupType, format, verbose)
      } else {
        // Use appropriate analyzer for other file types
        if (enhanced) {
          // Enhanced analysis for TypeScript and test files
          const results = yield* Effect.forEach(
            groupFiles,
            (file) =>
              Effect.tryPromise({
                try: async () => {
                  const engine = new AnalysisEngine()
                  const pathInterpreter = new PathResolverInterpreter()
                  engine.registerInterpreter('path-resolver', pathInterpreter)
                  return engine.analyzeFile(file)
                },
                catch: (error) => ({
                  filePath: file,
                  success: false,
                  error: String(error)
                })
              }),
            { concurrency: parallel ? filterOptions.concurrency : 1 }
          )

          allResults.push(...results.map(r => ({ ...r, fileType: groupType })))
          yield* outputGroupResults(results, groupType, format, verbose)
        } else {
          // Basic analysis for TypeScript and test files
          const results = yield* Effect.forEach(
            groupFiles,
            (file) =>
              Effect.tryPromise({
                try: () =>
                  analyzeTypeScriptFile(file, {
                    format: "json",
                    includeSources: false,
                    classifyDependencies: true
                  }),
                catch: (error) => ({
                  filePath: file,
                  success: false,
                  error: String(error)
                })
              }),
            { concurrency: parallel ? filterOptions.concurrency : 1 }
          )

          allResults.push(...results.map(r => ({ ...r, fileType: groupType })))
          yield* outputGroupResults(results, groupType, format, verbose)
        }
      }
    }

    // Save results if output directory is specified
    if (outputDir) {
      yield* createOutputDirectory(outputDir, verbose)
      yield* saveBatchResults(allResults, outputDir, verbose)
    }

    // Show overall summary
    yield* outputOverallSummary(fileGroups, allResults, verbose)
  })

const getGroupIcon = (groupType: string): string => {
  switch (groupType) {
    case 'typescript': return '📄'
    case 'test': return '🧪'
    case 'markdown': return '📝'
    case 'other': return '📋'
    default: return '📄'
  }
}

const outputGroupResults = (
  results: Array<any>,
  groupType: string,
  format: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    const successful = results.filter((r) => !r.error && (r.errors?.length ?? 0) === 0)
    const failed = results.filter((r) => r.error || (r.errors?.length ?? 0) > 0)

    yield* Console.log(`  ✅ Success: ${successful.length}, ❌ Failed: ${failed.length}`)

    if (successful.length > 0) {
      const totalDeps = successful.reduce((sum, r) => {
        const deps = r.extractedData?.dependency?.dependencies ?? []
        return sum + deps.length
      }, 0)
      yield* Console.log(`  📦 Dependencies found: ${totalDeps}`)
    }

    if (verbose && failed.length > 0) {
      yield* Console.log(`  Failed files:`)
      failed.slice(0, 3).forEach((failure, i) => {
        Console.log(`    ${i + 1}. ${failure.filePath}: ${failure.error || failure.errors?.[0]?.message || 'Unknown error'}`)
      })
    }
  })

const outputOverallSummary = (
  fileGroups: Record<string, Array<string>>,
  allResults: Array<any>,
  verbose: boolean
) =>
  Effect.gen(function*() {
    yield* Console.log(`\n🎯 Overall Analysis Summary`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    const totalFiles = Object.values(fileGroups).reduce((sum, files) => sum + files.length, 0)
    const successful = allResults.filter((r) => !r.error && (r.errors?.length ?? 0) === 0)
    const failed = allResults.filter((r) => r.error || (r.errors?.length ?? 0) > 0)

    yield* Console.log(`📊 Total files analyzed: ${totalFiles}`)
    yield* Console.log(`✅ Successful: ${successful.length}`)
    yield* Console.log(`❌ Failed: ${failed.length}`)

    // Group results by type for summary
    const resultsByType = allResults.reduce((acc, result) => {
      const type = result.fileType || 'unknown'
      if (!acc[type]) acc[type] = []
      acc[type].push(result)
      return acc
    }, {} as Record<string, Array<any>>)

    yield* Console.log(`\n📈 Results by Type:`)
    Object.entries(resultsByType).forEach(([type, results]) => {
      const icon = getGroupIcon(type)
      const successCount = (results as any[]).filter((r: any) => !r.error && (r.errors?.length ?? 0) === 0).length
      const totalDeps = (results as any[]).reduce((sum: number, r: any) => {
        const deps = r.extractedData?.dependency?.dependencies ?? []
        return sum + deps.length
      }, 0)

      Console.log(`  ${icon} ${type}: ${successCount}/${results.length} success, ${totalDeps} dependencies`)
    })
  })

/**
 * Enhanced single file analysis with PathResolver
 */
const analyzeEnhancedSingleFileWrapper = (
  filePath: string,
  options: {
    format: string
    verbose: boolean
    pathResolution: boolean
    resolveNodeModules: boolean
    validateFiles: boolean
    outputDirValue?: string
  }
) =>
  Effect.gen(function*() {
    const { format, verbose, pathResolution, resolveNodeModules, validateFiles, outputDirValue } = options

    if (verbose) {
      yield* Console.log(`🚀 Enhanced analysis of single file: ${filePath}`)
    }

    const analysisOptions: AnalysisOptions = {
      enablePathResolution: pathResolution,
      resolveNodeModules,
      includePackageInfo: true,
      validateFileExists: validateFiles,
      verbose
    }

    const result = yield* Effect.tryPromise({
      try: () => analyzeFileWithPathResolution(filePath, analysisOptions),
      catch: (error) => new Error(`Enhanced analysis failed: ${String(error)}`)
    })

    // Output results based on format
    if (outputDirValue) {
      yield* createOutputDirectory(outputDirValue, verbose)
      yield* saveEnhancedResult(result, outputDirValue, verbose)
    } else {
      yield* outputEnhancedResult(result, format, verbose)
    }
  })

/**
 * Enhanced directory analysis with PathResolver
 */
const analyzeEnhancedDirectory = (
  dirPath: string,
  options: {
    format: string
    parallel: boolean
    verbose: boolean
    byType: boolean
    pathResolution: boolean
    resolveNodeModules: boolean
    validateFiles: boolean
    filterOptions: FilterOptions
    outputDirValue?: string
  }
) =>
  Effect.gen(function*() {
    const {
      format,
      parallel,
      verbose,
      byType,
      pathResolution,
      resolveNodeModules,
      validateFiles,
      filterOptions,
      outputDirValue
    } = options

    if (verbose) {
      yield* Console.log(`🚀 Enhanced directory analysis: ${dirPath}`)
    }

    const analysisOptions: AnalysisOptions & {
      extensions?: string[]
      exclude?: string[]
      maxDepth?: number
      parallel?: boolean
      concurrency?: number
    } = {
      enablePathResolution: pathResolution,
      resolveNodeModules,
      includePackageInfo: true,
      validateFileExists: validateFiles,
      verbose,
      extensions: filterOptions.extensions || ['.ts', '.tsx', '.js', '.jsx', '.md', '.markdown'],
      exclude: filterOptions.exclude ? [filterOptions.exclude] : ['node_modules', '.git'],
      maxDepth: filterOptions.maxDepth || 10,
      parallel,
      concurrency: filterOptions.concurrency
    }

    const results = yield* Effect.tryPromise({
      try: () => analyzeDirectoryWithPathResolution(dirPath, analysisOptions),
      catch: (error) => new Error(`Enhanced directory analysis failed: ${String(error)}`)
    })

    if (byType) {
      yield* outputEnhancedResultsByType(results, format, verbose)
    } else {
      // Standard output format
      const formattedOutput = formatAnalysisResults(results, format === 'summary' ? 'detailed' : format as any)
      yield* Console.log(formattedOutput)
    }

    if (outputDirValue) {
      yield* createOutputDirectory(outputDirValue, verbose)
      yield* saveEnhancedBatchResults(results, outputDirValue, verbose)
    }
  })

/**
 * Output enhanced results grouped by file type
 */
const outputEnhancedResultsByType = (
  results: EnhancedAnalysisResult[],
  format: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    // Group results by file type
    const fileGroups: Record<string, EnhancedAnalysisResult[]> = {}

    for (const result of results) {
      const fileType = getFileType(result.filePath)
      if (!fileGroups[fileType]) {
        fileGroups[fileType] = []
      }
      fileGroups[fileType].push(result)
    }

    // Display file type distribution
    yield* Console.log(`📊 Enhanced File Type Distribution:`)
    Object.entries(fileGroups).forEach(([type, files]) => {
      const icon = getGroupIcon(type)
      Console.log(`  ${icon} ${type}: ${files.length} files`)
    })

    // Analyze each group
    for (const [type, groupResults] of Object.entries(fileGroups)) {
      if (groupResults.length === 0) continue

      const icon = getGroupIcon(type)
      yield* Console.log(`\n${icon} Analyzing ${type} files (${groupResults.length} files)`)

      const totalDeps = groupResults.reduce((sum, r) => sum + (r.pathResolution?.summary.totalDependencies || 0), 0)
      const totalResolved = groupResults.reduce((sum, r) => sum + (r.pathResolution?.summary.resolvedCount || 0), 0)
      const totalInternal = groupResults.reduce((sum, r) => sum + (r.pathResolution?.summary.internalCount || 0), 0)
      const successful = groupResults.filter(r => !r.errors || r.errors.length === 0)
      const failed = groupResults.filter(r => r.errors && r.errors.length > 0)

      yield* Console.log(`  ✅ Success: ${successful.length}, ❌ Failed: ${failed.length}`)
      yield* Console.log(`  📦 Dependencies found: ${totalDeps}`)
      yield* Console.log(`  🔗 Resolved: ${totalResolved} (${Math.round(totalResolved / totalDeps * 100)}%)`)
      yield* Console.log(`  🏠 Internal: ${totalInternal}, 📦 External: ${totalResolved - totalInternal}`)

      if (verbose && failed.length > 0) {
        yield* Console.log(`  Failed files:`)
        failed.slice(0, 3).forEach((failure, i) => {
          Console.log(`    ${i + 1}. ${failure.filePath}: ${failure.errors?.[0]?.message || 'Unknown error'}`)
        })
      }
    }

    // Overall summary
    yield* outputEnhancedOverallSummary(fileGroups, results, verbose)
  })

/**
 * Output enhanced overall summary
 */
const outputEnhancedOverallSummary = (
  fileGroups: Record<string, EnhancedAnalysisResult[]>,
  allResults: EnhancedAnalysisResult[],
  verbose: boolean
) =>
  Effect.gen(function*() {
    yield* Console.log(`\n🎯 Enhanced Overall Analysis Summary`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    const totalFiles = Object.values(fileGroups).reduce((sum, files) => sum + files.length, 0)
    const successful = allResults.filter((r) => !r.errors || r.errors.length === 0)
    const failed = allResults.filter((r) => r.errors && r.errors.length > 0)
    const totalDeps = allResults.reduce((sum, r) => sum + (r.pathResolution?.summary.totalDependencies || 0), 0)
    const totalResolved = allResults.reduce((sum, r) => sum + (r.pathResolution?.summary.resolvedCount || 0), 0)
    const totalInternal = allResults.reduce((sum, r) => sum + (r.pathResolution?.summary.internalCount || 0), 0)

    yield* Console.log(`📊 Total files analyzed: ${totalFiles}`)
    yield* Console.log(`✅ Successful: ${successful.length}`)
    yield* Console.log(`❌ Failed: ${failed.length}`)
    yield* Console.log(`📦 Total dependencies: ${totalDeps}`)
    yield* Console.log(`🔗 Resolved: ${totalResolved} (${Math.round(totalResolved / totalDeps * 100)}%)`)
    yield* Console.log(`🏠 Internal: ${totalInternal}, 📦 External: ${totalResolved - totalInternal}`)

    // Project information
    const projectInfo = allResults[0]?.projectInfo
    if (projectInfo) {
      yield* Console.log(`\n🏠 Project Information:`)
      yield* Console.log(`  Root: ${projectInfo.rootPath}`)
      yield* Console.log(`  Type: ${projectInfo.projectType}`)
      yield* Console.log(`  Package Manager: ${projectInfo.packageManager}`)
      yield* Console.log(`  TypeScript: ${projectInfo.hasTypeScript ? '✅' : '❌'}`)
    }

    // Results by Type
    yield* Console.log(`\n📈 Results by Type:`)
    Object.entries(fileGroups).forEach(([type, results]) => {
      const icon = getGroupIcon(type)
      const successCount = results.filter(r => !r.errors || r.errors.length === 0).length
      const totalDeps = results.reduce((sum, r) => {
        return sum + (r.pathResolution?.summary.totalDependencies || 0)
      }, 0)

      Console.log(`  ${icon} ${type}: ${successCount}/${results.length} success, ${totalDeps} dependencies`)
    })
  })

/**
 * Output enhanced single result
 */
const outputEnhancedResult = (
  result: EnhancedAnalysisResult,
  format: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    switch (format) {
      case "json":
        yield* Console.log(JSON.stringify(result, null, 2))
        break
      case "summary":
        const formattedOutput = formatAnalysisResults([result], 'detailed')
        yield* Console.log(formattedOutput)
        break
      case "table":
        yield* outputEnhancedTable(result, verbose)
        break
      case "csv":
        yield* outputEnhancedCSV([result], verbose)
        break
      default:
        yield* Console.log(JSON.stringify(result, null, 2))
    }
  })

/**
 * Output enhanced table format
 */
const outputEnhancedTable = (
  result: EnhancedAnalysisResult,
  verbose: boolean
) =>
  Effect.gen(function*() {
    yield* Console.log(`\n📊 Enhanced Analysis Table`)
    yield* Console.log(`${'='.repeat(60)}`)
    yield* Console.log(`File: ${result.filePath}`)
    yield* Console.log(`Project: ${result.projectInfo.rootPath}`)
    yield* Console.log(`Type: ${result.projectInfo.projectType}`)
    yield* Console.log(`Language: ${result.language}`)

    if (result.pathResolution) {
      yield* Console.log(`\n📦 Path Resolution Summary:`)
      yield* Console.log(`Total Dependencies: ${result.pathResolution.summary.totalDependencies}`)
      yield* Console.log(`Resolved: ${result.pathResolution.summary.resolvedCount}`)
      yield* Console.log(`Internal: ${result.pathResolution.summary.internalCount}`)
      yield* Console.log(`External: ${result.pathResolution.summary.externalCount}`)

      if (verbose && result.pathResolution.resolvedDependencies.length > 0) {
        yield* Console.log(`\n📁 Resolved Dependencies:`)
        result.pathResolution.resolvedDependencies.forEach(dep => {
          const status = dep.exists ? '✅' : '❌'
          const location = dep.isInternal ? '🏠' : '📦'
          Console.log(`  ${dep.originalSource} → ${dep.projectRelativePath || dep.resolvedPath} ${status} ${location}`)
        })
      }
    }
  })

/**
 * Output enhanced CSV format
 */
const outputEnhancedCSV = (
  results: EnhancedAnalysisResult[],
  verbose: boolean
) =>
  Effect.gen(function*() {
    const headers = [
      'FilePath',
      'ProjectRoot',
      'ProjectType',
      'Language',
      'TotalDependencies',
      'ResolvedCount',
      'InternalCount',
      'ExternalCount',
      'Errors'
    ]

    yield* Console.log(headers.join(','))

    results.forEach(result => {
      const row = [
        result.filePath,
        result.projectInfo.rootPath,
        result.projectInfo.projectType,
        result.language,
        result.pathResolution?.summary.totalDependencies || 0,
        result.pathResolution?.summary.resolvedCount || 0,
        result.pathResolution?.summary.internalCount || 0,
        result.pathResolution?.summary.externalCount || 0,
        result.errors?.length || 0
      ]
      Console.log(row.join(','))
    })
  })

/**
 * Save enhanced result to file
 */
const saveEnhancedResult = (
  result: EnhancedAnalysisResult,
  outputDir: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    const fileName = `${path.basename(result.filePath, path.extname(result.filePath))}_enhanced.json`
    const outputPath = path.join(outputDir, fileName)

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2))
      },
      catch: (error) => new Error(`Failed to save enhanced result: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`💾 Enhanced result saved: ${outputPath}`)
    }
  })

/**
 * Save enhanced batch results to files
 */
const saveEnhancedBatchResults = (
  results: EnhancedAnalysisResult[],
  outputDir: string,
  verbose: boolean
) =>
  Effect.gen(function*() {
    for (const result of results) {
      yield* saveEnhancedResult(result, outputDir, verbose)
    }

    // Save summary file
    const summaryPath = path.join(outputDir, 'enhanced_summary.json')
    const summary = {
      totalFiles: results.length,
      projectInfo: results[0]?.projectInfo,
      overallStats: {
        totalDependencies: results.reduce((sum, r) => sum + (r.pathResolution?.summary.totalDependencies || 0), 0),
        totalResolved: results.reduce((sum, r) => sum + (r.pathResolution?.summary.resolvedCount || 0), 0),
        totalInternal: results.reduce((sum, r) => sum + (r.pathResolution?.summary.internalCount || 0), 0),
        totalExternal: results.reduce((sum, r) => sum + (r.pathResolution?.summary.externalCount || 0), 0)
      }
    }

    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import("fs/promises")
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))
      },
      catch: (error) => new Error(`Failed to save enhanced summary: ${String(error)}`)
    })

    if (verbose) {
      yield* Console.log(`📊 Enhanced summary saved: ${summaryPath}`)
    }
  })

