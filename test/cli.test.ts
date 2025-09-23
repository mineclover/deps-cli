/**
 * CLI 전체 기능 테스트 - 빌드된 파일 기준
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { execSync } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 테스트용 프로젝트 루트 및 빌드된 CLI 경로
const PROJECT_ROOT = path.resolve(__dirname, "..")
const CLI_PATH = path.join(PROJECT_ROOT, "dist", "bin.js")
const TEST_FIXTURES_DIR = path.join(__dirname, "fixtures")

// 테스트 타임아웃 설정
const TEST_TIMEOUT = 30000

describe("CLI 전체 기능 테스트", () => {
  beforeAll(async () => {
    // 빌드된 CLI 파일이 존재하는지 확인
    try {
      await fs.access(CLI_PATH)
    } catch {
      throw new Error(`빌드된 CLI 파일이 존재하지 않습니다: ${CLI_PATH}`)
    }

    // 테스트 픽스처 디렉토리 생성
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true })
  })

  afterAll(async () => {
    // 테스트 후 정리
    try {
      await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true })
    } catch {
      // 정리 실패해도 무시
    }
  })

  beforeEach(async () => {
    // 각 테스트 전에 픽스처 디렉토리 초기화
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true })
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true })
  })

  describe("기본 CLI 명령어", () => {
    test("--help 명령어 작동 확인", () => {
      try {
        execSync(`node "${CLI_PATH}" --help`, { encoding: "utf-8" })
        expect.fail("헬프 명령어는 exit code를 발생시켜야 합니다")
      } catch (error: any) {
        const output = error.stdout || error.stderr || ""
        expect(output).toContain("A dependency analysis CLI tool")
        expect(output).toContain("Commands:")
        expect(output).toContain("analyze")
        expect(output).toContain("classify")
      }
    })

    test("--version 명령어 작동 확인", () => {
      try {
        execSync(`node "${CLI_PATH}" --version`, { encoding: "utf-8" })
        expect.fail("버전 명령어는 exit code를 발생시켜야 합니다")
      } catch (error: any) {
        const output = error.stdout || error.stderr || ""
        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/)
      }
    })

    test("analyze --help 명령어 작동 확인", () => {
      const result = execSync(`node "${CLI_PATH}" analyze --help`, { encoding: "utf-8" })

      expect(result).toContain("Analyze code dependencies and structure")
      expect(result).toContain("--format")
      expect(result).toContain("--verbose")
    })

    test("classify --help 명령어 작동 확인", () => {
      const result = execSync(`node "${CLI_PATH}" classify --help`, { encoding: "utf-8" })

      expect(result).toContain("파일 타입별 의존성을 분류하여 저장")
      expect(result).toContain("--output-dir")
      expect(result).toContain("--verbose")
    })
  })

  describe("에러 처리", () => {
    test("존재하지 않는 파일 경로로 analyze 실행", async () => {
      const nonExistentPath = path.join(TEST_FIXTURES_DIR, "non-existent.ts")

      try {
        execSync(`node "${CLI_PATH}" analyze "${nonExistentPath}"`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
        expect(error.stderr || error.stdout).toContain("❌ Analysis failed")
      }
    })

    test("존재하지 않는 파일 경로로 classify 실행", async () => {
      const nonExistentPath = path.join(TEST_FIXTURES_DIR, "non-existent.ts")

      try {
        execSync(`node "${CLI_PATH}" classify "${nonExistentPath}"`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
        expect(error.stderr || error.stdout).toContain("❌ Classification failed")
      }
    })

    test("잘못된 명령어 실행", () => {
      try {
        execSync(`node "${CLI_PATH}" invalid-command`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
      }
    })
  })

  describe("단일 파일 분석", () => {
    test("TypeScript 파일 analyze", async () => {
      // 테스트용 TypeScript 파일 생성
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `
import * as fs from "node:fs"
import { join } from "node:path"
import React from "react"

export function testFunction() {
  return "Hello, World!"
}
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${testFile}" --format json`, {
        encoding: "utf-8"
      })

      // verbose 출력을 제거하고 JSON만 추출
      const lines = result.split("\n")
      const jsonStart = lines.findIndex(line => line.trim().startsWith("{"))
      if (jsonStart === -1) {
        throw new Error("JSON 출력을 찾을 수 없습니다: " + result)
      }
      const jsonContent = lines.slice(jsonStart).join("\n")
      const analysisResult = JSON.parse(jsonContent)

      expect(analysisResult).toHaveProperty("graph")
      expect(analysisResult).toHaveProperty("analysisMetadata")
      expect(analysisResult.analysisMetadata.filesProcessed).toBe(1)
    })

    test("JavaScript 파일 analyze", async () => {
      // 테스트용 JavaScript 파일 생성
      const testFile = path.join(TEST_FIXTURES_DIR, "test.js")
      await fs.writeFile(testFile, `
const fs = require("fs")
const path = require("path")

function testFunction() {
  return "Hello, World!"
}

module.exports = { testFunction }
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${testFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("🔍 Starting analysis of:")
      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("단일 파일 classify with verbose", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `
import { someFunction } from "./utils"
export const myVar = "test"
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${testFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📂 발견된 파일 분류 시작...")
      expect(result).toContain("🚀 의존성 분류 분석 시작...")
      expect(result).toContain("📊 의존성 분류 분석 결과")
      expect(result).toContain("📁 총 파일:")
      expect(result).toContain("🔗 총 의존성:")
      expect(result).toContain("⏱️ 분석 시간:")
      expect(result).toContain("📋 노드 타입별 분포:")
    })
  })

  describe("디렉토리 분석", () => {
    test("프로젝트 디렉토리 analyze", async () => {
      // 테스트용 프로젝트 구조 생성
      const srcDir = path.join(TEST_FIXTURES_DIR, "src")
      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "index.ts"), `
import { util } from "./utils"
export default function main() {
  return util()
}
      `)

      await fs.writeFile(path.join(srcDir, "utils.ts"), `
export function util() {
  return "utility function"
}
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${TEST_FIXTURES_DIR}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("🔍 Starting analysis of:")
      expect(result).toContain("📁 Found")
      expect(result).toContain("files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("프로젝트 디렉토리 classify with output", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "src")
      const outputDir = path.join(TEST_FIXTURES_DIR, "output")
      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "app.ts"), `
import React from "react"
import { Component } from "./components"

export function App() {
  return <Component />
}
      `)

      const result = execSync(
        `node "${CLI_PATH}" classify "${TEST_FIXTURES_DIR}" --output-dir "${outputDir}" --verbose`,
        { encoding: "utf-8" }
      )

      expect(result).toContain("📂 발견된 파일 분류 시작...")
      expect(result).toContain("✅ 분석 완료!")
      expect(result).toContain("💾 결과 저장됨:")

      // 출력 파일이 생성되었는지 확인
      const reportPath = path.join(outputDir, "analysis-report.json")
      await expect(fs.access(reportPath)).resolves.toBeUndefined()

      const reportContent = await fs.readFile(reportPath, "utf-8")
      const report = JSON.parse(reportContent)
      expect(report).toHaveProperty("graph")
      expect(report).toHaveProperty("analysisMetadata")
    })
  })

  describe("옵션 테스트", () => {
    test("analyze with 다양한 옵션", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "complex.ts")
      await fs.writeFile(testFile, `
import React, { useState, useEffect } from "react"
import * as fs from "node:fs"
import axios from "axios"
import { myUtil } from "./utils"

export const Component: React.FC = () => {
  const [state, setState] = useState(0)

  useEffect(() => {
    fs.readFile("test.txt", () => {})
    axios.get("/api/data")
  }, [])

  return <div>{myUtil(state)}</div>
}
      `)

      const result = execSync(
        `node "${CLI_PATH}" analyze "${testFile}" --format json --verbose`,
        { encoding: "utf-8" }
      )

      const lines = result.split("\n")
      const jsonStart = lines.findIndex(line => line.trim().startsWith("{"))
      if (jsonStart === -1) {
        throw new Error("JSON 출력을 찾을 수 없습니다: " + result)
      }
      const jsonContent = lines.slice(jsonStart).join("\n")

      const analysisResult = JSON.parse(jsonContent)

      expect(analysisResult).toHaveProperty("graph")
      expect(analysisResult.analysisMetadata.filesProcessed).toBe(1)
    })

    test("classify with 필터링 옵션", async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, "project")
      const srcDir = path.join(testDir, "src")
      const testsDir = path.join(testDir, "tests")

      await fs.mkdir(srcDir, { recursive: true })
      await fs.mkdir(testsDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "main.ts"), `export const main = "main"`)
      await fs.writeFile(path.join(testsDir, "main.test.ts"), `import { main } from "../src/main"`)

      const result = execSync(
        `node "${CLI_PATH}" classify "${testDir}" --verbose`,
        { encoding: "utf-8" }
      )

      expect(result).toContain("📋 노드 타입별 분포:")
      expect(result).toContain("🧪 test:") // 테스트 파일 포함 확인
      expect(result).toContain("📄 code:") // 코드 파일 포함 확인
    })
  })

  describe("출력 형식", () => {
    test("JSON 형식 출력", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "json-test.ts")
      await fs.writeFile(testFile, `
import { test } from "./test"
export const value = test()
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${testFile}" --format json`, {
        encoding: "utf-8"
      })

      // verbose 출력을 제거하고 JSON만 추출
      const lines = result.split("\n")
      const jsonStart = lines.findIndex(line => line.trim().startsWith("{"))
      if (jsonStart === -1) {
        throw new Error("JSON 출력을 찾을 수 없습니다: " + result)
      }
      const jsonContent = lines.slice(jsonStart).join("\n")

      expect(() => JSON.parse(jsonContent)).not.toThrow()

      const parsed = JSON.parse(jsonContent)
      expect(parsed).toHaveProperty("graph")
      expect(parsed).toHaveProperty("analysisMetadata")
    })

    test("기본 형식 출력", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "default-test.ts")
      await fs.writeFile(testFile, `
export const defaultValue = "default"
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${testFile}"`, {
        encoding: "utf-8"
      })

      // analyze 명령어는 기본적으로 verbose 출력과 summary를 보여줍니다
      expect(result).toContain("🔍 Starting analysis of:")
      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📈 Analysis Summary:")
      expect(result).toContain("Files processed: 1")
    })
  })

  describe("성능 테스트", () => {
    test("대용량 디렉토리 분석 성능", async () => {
      // 여러 파일 생성
      const srcDir = path.join(TEST_FIXTURES_DIR, "large-project", "src")
      await fs.mkdir(srcDir, { recursive: true })

      // 10개의 파일 생성
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(srcDir, `file${i}.ts`), `
import { util${i % 3} } from "./utils"
export const value${i} = util${i % 3}()
        `)
      }

      // utils 파일들 생성
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(path.join(srcDir, `utils${i}.ts`), `
export function util${i}() {
  return "util${i}"
}
        `)
      }

      const startTime = Date.now()
      const result = execSync(
        `node "${CLI_PATH}" classify "${path.join(TEST_FIXTURES_DIR, "large-project")}" --verbose`,
        { encoding: "utf-8" }
      )
      const endTime = Date.now()

      expect(result).toContain("📁 총 파일:")
      expect(result).toContain("⏱️ 분석 시간:")

      // 성능 확인 (10초 이내)
      expect(endTime - startTime).toBeLessThan(10000)
    }, TEST_TIMEOUT)
  })

  describe("실제 프로젝트 테스트", () => {
    test("현재 프로젝트 자체 분석", async () => {
      const result = execSync(
        `node "${CLI_PATH}" classify "${PROJECT_ROOT}" --verbose`,
        { encoding: "utf-8", cwd: PROJECT_ROOT }
      )

      expect(result).toContain("📂 발견된 파일 분류 시작...")
      expect(result).toContain("📊 의존성 분류 분석 결과")
      expect(result).toContain("📁 총 파일:")
      expect(result).toContain("🔗 총 의존성:")
      expect(result).toContain("📋 노드 타입별 분포:")
    }, TEST_TIMEOUT)
  })
})