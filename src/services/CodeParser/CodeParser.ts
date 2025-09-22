import { Context, Effect, Layer } from "effect"
import { readFile } from "node:fs/promises"
import type { ICodeParser, NamedImport, ParseConfig, ParseResult } from "./ICodeParser.js"
import { NamedImportExtractor } from "./NamedImportExtractor.js"

/**
 * Implementation of ICodeParser using Tree-sitter
 */
export class CodeParser implements ICodeParser {
  private readonly extractor: NamedImportExtractor

  constructor() {
    this.extractor = new NamedImportExtractor()
  }

  /**
   * Parse a single source file
   */
  parseFile(filePath: string, config: ParseConfig): Effect.Effect<ParseResult, Error> {
    const extractor = this.extractor
    return Effect.gen(function*() {
      // Read file contents
      const sourceCodeResult = yield* Effect.tryPromise({
        try: () => readFile(filePath, "utf-8"),
        catch: (error) => new Error(`Failed to read file ${filePath}: ${String(error)}`)
      }).pipe(Effect.either)

      if (sourceCodeResult._tag === "Left") {
        return {
          filePath,
          success: false,
          error: sourceCodeResult.left.message
        }
      }

      const sourceCode = sourceCodeResult.right

      // Extract named imports if requested
      let namedImports: ReadonlyArray<NamedImport> | undefined
      if (config.extractNamedImports) {
        const importResult = yield* extractor.extractFromSource(sourceCode, filePath).pipe(Effect.either)
        if (importResult._tag === "Left") {
          return {
            filePath,
            success: false,
            error: importResult.left.message
          }
        }
        namedImports = importResult.right
      }

      return {
        filePath,
        success: true,
        namedImports: namedImports ?? undefined
      }
    })
  }

  /**
   * Parse multiple source files in parallel
   */
  parseMany(filePaths: ReadonlyArray<string>, config: ParseConfig): Effect.Effect<ReadonlyArray<ParseResult>, Error> {
    const parseFile = this.parseFile.bind(this)
    return Effect.gen(function*() {
      // Process files in parallel with controlled concurrency
      const results = yield* Effect.forEach(
        filePaths,
        (filePath) => parseFile(filePath, config),
        { concurrency: "unbounded" }
      )
      return results
    })
  }

  /**
   * Extract named imports from source code string
   */
  extractNamedImports(sourceCode: string, filePath?: string): Effect.Effect<ReadonlyArray<NamedImport>, Error> {
    return this.extractor.extractFromSource(sourceCode, filePath)
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.extractor.dispose()
  }
}

/**
 * Service tag for dependency injection
 */
export const CodeParserTag = Context.GenericTag<ICodeParser>("@services/CodeParser")

/**
 * Service implementation for dependency injection
 */
export const CodeParserService = Layer.succeed(CodeParserTag, new CodeParser())
