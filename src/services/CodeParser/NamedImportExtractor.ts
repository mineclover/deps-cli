import type { Effect } from "effect"
import type { NamedImport } from "./ICodeParser.js"
import { RegexNamedImportExtractor } from "./RegexNamedImportExtractor.js"

/**
 * Utility class for extracting named imports from TypeScript source code
 * Falls back to regex-based parsing when TreeSitter is not available
 */
export class NamedImportExtractor {
  private readonly fallbackExtractor: RegexNamedImportExtractor
  constructor() {
    this.fallbackExtractor = new RegexNamedImportExtractor()

    // For now, always use regex fallback
    // TODO: Implement TreeSitter support in the future
  }

  /**
   * Extract named imports from TypeScript source code
   * @param sourceCode The source code to analyze
   * @param filePath Optional file path for context
   * @returns Effect containing array of named imports
   */
  extractFromSource(sourceCode: string, filePath?: string): Effect.Effect<ReadonlyArray<NamedImport>, Error> {
    // For now, always use the fallback regex implementation
    return this.fallbackExtractor.extractFromSource(sourceCode, filePath)
  }

  /**
   * Clean up parser resources
   */
  dispose(): void {
    this.fallbackExtractor.dispose()
  }
}
