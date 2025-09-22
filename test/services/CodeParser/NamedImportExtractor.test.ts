import { Effect } from "effect"
import { afterAll, describe, expect, it } from "vitest"
import { NamedImportExtractor } from "../../../src/services/CodeParser/NamedImportExtractor.js"

describe("NamedImportExtractor", () => {
  const extractor = new NamedImportExtractor()

  describe("extractFromSource", () => {
    it("should extract simple named imports", async () => {
      const sourceCode = `import { useState, useEffect } from 'react'`

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "test.ts")
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: "useState",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
      expect(result[1]).toEqual({
        name: "useEffect",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })

    it("should extract named imports with aliases", async () => {
      const sourceCode = `import { useState as state, useEffect as effect } from 'react'`

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "test.ts")
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: "useState",
        alias: "state",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
      expect(result[1]).toEqual({
        name: "useEffect",
        alias: "effect",
        module: "react",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })

    it("should extract multiple import statements", async () => {
      const sourceCode = `
import { useState } from 'react'
import { Effect } from 'effect'
import { describe, it } from 'vitest'
      `

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "test.ts")
      )

      expect(result).toHaveLength(4)

      // Check first import
      expect(result[0]).toEqual({
        name: "useState",
        module: "react",
        lineNumber: 2,
        columnNumber: expect.any(Number)
      })

      // Check second import
      expect(result[1]).toEqual({
        name: "Effect",
        module: "effect",
        lineNumber: 3,
        columnNumber: expect.any(Number)
      })

      // Check third import (multiple named imports)
      expect(result[2]).toEqual({
        name: "describe",
        module: "vitest",
        lineNumber: 4,
        columnNumber: expect.any(Number)
      })

      expect(result[3]).toEqual({
        name: "it",
        module: "vitest",
        lineNumber: 4,
        columnNumber: expect.any(Number)
      })
    })

    it("should handle mixed import types (ignoring default and namespace imports)", async () => {
      const sourceCode = `
import React, { useState, useEffect } from 'react'
import * as fs from 'node:fs'
import { Effect } from 'effect'
      `

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "test.ts")
      )

      // Should only extract named imports, not default or namespace imports
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe("useState")
      expect(result[1].name).toBe("useEffect")
      expect(result[2].name).toBe("Effect")
    })

    it("should handle empty source code", async () => {
      const sourceCode = ""

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "empty.ts")
      )

      expect(result).toHaveLength(0)
    })

    it("should handle source code with no imports", async () => {
      const sourceCode = `
function hello() {
  console.log("Hello, world!")
}
      `

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "no-imports.ts")
      )

      expect(result).toHaveLength(0)
    })

    it("should handle single named import", async () => {
      const sourceCode = `import { Effect } from 'effect'`

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "single.ts")
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: "Effect",
        module: "effect",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })

    it("should handle imports with double quotes", async () => {
      const sourceCode = `import { Effect } from "effect"`

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "double-quotes.ts")
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: "Effect",
        module: "effect",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })

    it("should handle relative path imports", async () => {
      const sourceCode = `import { MyComponent } from './components/MyComponent.js'`

      const result = await Effect.runPromise(
        extractor.extractFromSource(sourceCode, "relative.ts")
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: "MyComponent",
        module: "./components/MyComponent.js",
        lineNumber: 1,
        columnNumber: expect.any(Number)
      })
    })
  })

  describe("error handling", () => {
    it("should handle malformed code gracefully", async () => {
      const sourceCode = `import { useState from 'react'` // Missing closing brace

      // Should not throw, but may return empty results or partial results
      const resultEffect = extractor.extractFromSource(sourceCode, "malformed.ts")

      // Depending on tree-sitter's error recovery, this might succeed with partial results
      // or fail gracefully
      try {
        const result = await Effect.runPromise(resultEffect)
        expect(Array.isArray(result)).toBe(true)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  afterAll(() => {
    extractor.dispose()
  })
})
