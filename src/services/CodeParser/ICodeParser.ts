import type { Effect } from "effect"

/**
 * Represents a named import in a TypeScript file
 */
export interface NamedImport {
  /** The imported name (e.g., 'useState' from 'import { useState } from "react"') */
  readonly name: string
  /** The alias if any (e.g., 'state' from 'import { useState as state } from "react"') */
  readonly alias?: string
  /** The module specifier (e.g., 'react' from 'import { useState } from "react"') */
  readonly module: string
  /** Line number where the import appears */
  readonly lineNumber: number
  /** Column number where the import starts */
  readonly columnNumber: number
}

/**
 * Represents parsing configuration for the code parser
 */
export interface ParseConfig {
  /** The language to parse (currently only 'typescript' is supported) */
  readonly language: "typescript"
  /** Whether to extract named imports */
  readonly extractNamedImports?: boolean
  /** Additional extraction options */
  readonly extractOptions?: {
    /** Whether to include default imports */
    readonly includeDefaults?: boolean
    /** Whether to include namespace imports */
    readonly includeNamespaces?: boolean
  }
}

/**
 * Result of parsing a source file
 */
export interface ParseResult {
  /** Path to the parsed file */
  readonly filePath: string
  /** Whether parsing was successful */
  readonly success: boolean
  /** Error message if parsing failed */
  readonly error?: string
  /** Extracted named imports if requested */
  readonly namedImports?: ReadonlyArray<NamedImport> | undefined
  /** Raw syntax tree (for debugging) */
  readonly syntaxTree?: unknown
}

/**
 * Interface for the code parser service
 */
export interface ICodeParser {
  /**
   * Parse a single source file
   * @param filePath Path to the source file
   * @param config Parsing configuration
   * @returns Effect that resolves to parse result
   */
  readonly parseFile: (filePath: string, config: ParseConfig) => Effect.Effect<ParseResult, Error>

  /**
   * Parse multiple source files in parallel
   * @param filePaths Array of file paths to parse
   * @param config Parsing configuration
   * @returns Effect that resolves to array of parse results
   */
  readonly parseMany: (
    filePaths: ReadonlyArray<string>,
    config: ParseConfig
  ) => Effect.Effect<ReadonlyArray<ParseResult>, Error>

  /**
   * Extract named imports from source code string
   * @param sourceCode The source code to parse
   * @param filePath Optional file path for context
   * @returns Effect that resolves to named imports
   */
  readonly extractNamedImports: (
    sourceCode: string,
    filePath?: string
  ) => Effect.Effect<ReadonlyArray<NamedImport>, Error>
}

// Interface tag is handled in CodeParser.ts to avoid circular imports
