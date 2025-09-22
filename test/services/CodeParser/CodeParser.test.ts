import { Effect } from "effect"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CodeParser } from "../../../src/services/CodeParser/CodeParser.js"
import type { ParseConfig } from "../../../src/services/CodeParser/ICodeParser.js"

describe("CodeParser", () => {
  const parser = new CodeParser()
  const testDir = join(process.cwd(), "test-temp")

  beforeAll(async () => {
    // Create temporary test directory
    await mkdir(testDir, { recursive: true })

    // Create test files
    await writeFile(
      join(testDir, "simple-imports.ts"),
      `import { useState, useEffect } from 'react'
import { Effect } from 'effect'

export function MyComponent() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}`
    )

    await writeFile(
      join(testDir, "complex-imports.ts"),
      `import React, { Component, useState as state, useCallback } from 'react'
import * as fs from 'node:fs'
import { Effect, pipe } from 'effect'
import { describe, it, expect } from 'vitest'

export class MyClass extends Component {
  render() {
    return <div>Hello</div>
  }
}`
    )

    await writeFile(
      join(testDir, "no-imports.ts"),
      `export function hello() {
  console.log("Hello, world!")
}

export const greeting = "Hello"`
    )

    await writeFile(
      join(testDir, "malformed.ts"),
      `import { useState from 'react'
export function broken() {
  return "broken code"
}`
    )
  })

  afterAll(async () => {
    parser.dispose()
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  describe("parseFile", () => {
    it("should parse file with named imports successfully", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "simple-imports.ts"), config)
      )

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.namedImports).toHaveLength(3)

      const imports = result.namedImports!
      expect(imports[0]).toEqual({
        name: "useState",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
      expect(imports[1]).toEqual({
        name: "useEffect",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
      expect(imports[2]).toEqual({
        name: "Effect",
        module: "effect",
        lineNumber: 2,
        columnNumber: expect.any(Number)
      })
    })

    it("should parse file with complex imports including aliases", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "complex-imports.ts"), config)
      )

      expect(result.success).toBe(true)
      expect(result.namedImports).toHaveLength(8)

      const imports = result.namedImports!

      // Check for aliased import
      const aliasedImport = imports.find((imp) => imp.alias === "state")
      expect(aliasedImport).toEqual({
        name: "useState",
        alias: "state",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })

      // Check for multiple imports from same module
      const effectImports = imports.filter((imp) => imp.module === "effect")
      expect(effectImports).toHaveLength(2)
      expect(effectImports.some((imp) => imp.name === "Effect")).toBe(true)
      expect(effectImports.some((imp) => imp.name === "pipe")).toBe(true)
    })

    it("should parse file without imports successfully", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "no-imports.ts"), config)
      )

      expect(result.success).toBe(true)
      expect(result.namedImports).toHaveLength(0)
    })

    it("should handle file parsing without named import extraction", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: false
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "simple-imports.ts"), config)
      )

      expect(result.success).toBe(true)
      expect(result.namedImports).toBeUndefined()
    })

    it("should handle non-existent file gracefully", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "non-existent.ts"), config)
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain("Failed to read file")
    })

    it("should handle malformed TypeScript files", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const result = await Effect.runPromise(
        parser.parseFile(join(testDir, "malformed.ts"), config)
      )

      // Parser should still succeed even with malformed code
      // Tree-sitter is robust and can handle partial/malformed code
      expect(result.success).toBe(true)
      expect(Array.isArray(result.namedImports)).toBe(true)
    })
  })

  describe("parseMany", () => {
    it("should parse multiple files in parallel", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const filePaths = [
        join(testDir, "simple-imports.ts"),
        join(testDir, "complex-imports.ts"),
        join(testDir, "no-imports.ts")
      ]

      const results = await Effect.runPromise(
        parser.parseMany(filePaths, config)
      )

      expect(results).toHaveLength(3)

      // All files should be parsed successfully
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
      })

      // Check that we got the expected number of imports from each file
      const [simpleResult, complexResult, noImportsResult] = results

      expect(simpleResult.namedImports).toHaveLength(3) // useState, useEffect, Effect
      expect(complexResult.namedImports).toHaveLength(8) // Component, useState as state, useCallback, Effect, pipe, describe, it, expect
      expect(noImportsResult.namedImports).toHaveLength(0)
    })

    it("should handle mixed successful and failed file parsing", async () => {
      const config: ParseConfig = {
        language: "typescript",
        extractNamedImports: true
      }

      const filePaths = [
        join(testDir, "simple-imports.ts"),
        join(testDir, "non-existent.ts"),
        join(testDir, "no-imports.ts")
      ]

      const results = await Effect.runPromise(
        parser.parseMany(filePaths, config)
      )

      expect(results).toHaveLength(3)

      // First and third should succeed, second should fail
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })
  })

  describe("extractNamedImports", () => {
    it("should extract named imports from source code string", async () => {
      const sourceCode = `import { useState, useEffect } from 'react'
import { Effect } from 'effect'`

      const result = await Effect.runPromise(
        parser.extractNamedImports(sourceCode, "inline.ts")
      )

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe("useState")
      expect(result[1].name).toBe("useEffect")
      expect(result[2].name).toBe("Effect")
    })

    it("should extract named imports without file path", async () => {
      const sourceCode = `import { pipe } from 'effect'`

      const result = await Effect.runPromise(
        parser.extractNamedImports(sourceCode)
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: "pipe",
        module: "effect",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })
  })
})
