import { Effect } from "effect"
import type { NamedImport } from "./ICodeParser.js"

/**
 * Fallback regex-based implementation for extracting named imports
 * This is a simplified implementation for testing when TreeSitter is not available
 */
export class RegexNamedImportExtractor {
  /**
   * Extract named imports from TypeScript source code using regex
   * @param sourceCode The source code to analyze
   * @param filePath Optional file path for context
   * @returns Effect containing array of named imports
   */
  extractFromSource(sourceCode: string, filePath?: string): Effect.Effect<ReadonlyArray<NamedImport>, Error> {
    return Effect.try({
      try: () => {
        const namedImports: Array<NamedImport> = []
        const lines = sourceCode.split("\n")

        lines.forEach((line, index) => {
          const lineNumber = index + 1

          // Match import statements with named imports
          // This regex handles mixed imports like: import React, { useState, useEffect } from 'react'
          const mixedImportRegex = /^import\s+(?:[^,{]+,\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/
          // This regex handles pure named imports like: import { useState, useEffect } from 'react'
          const pureNamedImportRegex = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/

          const match = line.match(mixedImportRegex) || line.match(pureNamedImportRegex)

          if (match) {
            const [, importsString, module] = match
            const imports = importsString.split(",")

            imports.forEach((importStr) => {
              const trimmed = importStr.trim()
              if (!trimmed) return

              // Check if it's an aliased import (name as alias)
              const aliasMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
              if (aliasMatch) {
                const [, name, alias] = aliasMatch
                namedImports.push({
                  name,
                  alias,
                  module,
                  lineNumber,
                  columnNumber: line.indexOf(trimmed)
                })
              } else {
                // Simple named import
                namedImports.push({
                  name: trimmed,
                  module,
                  lineNumber,
                  columnNumber: line.indexOf(trimmed)
                })
              }
            })
          }
        })

        return namedImports
      },
      catch: (error) =>
        new Error(`Failed to extract named imports${filePath ? ` from ${filePath}` : ""}: ${String(error)}`)
    })
  }

  /**
   * Clean up resources (no-op for regex implementation)
   */
  dispose(): void {
    // No resources to clean up
  }
}
