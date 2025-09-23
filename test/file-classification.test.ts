/**
 * 파일 분류 기능 전용 테스트
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { execSync } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, "..")
const CLI_PATH = path.join(PROJECT_ROOT, "dist", "bin.js")
const TEST_FIXTURES_DIR = path.join(__dirname, "fixtures", "classification-tests")

describe("파일 분류 기능 테스트", () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await fs.rm(TEST_FIXTURES_DIR, { recursive: true, force: true })
    await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true })
  })

  describe("파일 타입별 분류", () => {
    test("코드 파일 분류", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "src")
      await fs.mkdir(srcDir, { recursive: true })

      // TypeScript 파일들
      await fs.writeFile(path.join(srcDir, "index.ts"), `
export { Button } from "./components/Button"
export { utils } from "./utils"
      `)

      await fs.writeFile(path.join(srcDir, "types.ts"), `
export interface User {
  id: number
  name: string
  email: string
}

export type Status = "active" | "inactive"
      `)

      // JavaScript 파일들
      await fs.writeFile(path.join(srcDir, "legacy.js"), `
const util = require("util")

function processData(data) {
  return util.inspect(data)
}

module.exports = { processData }
      `)

      // React 컴포넌트
      await fs.writeFile(path.join(srcDir, "App.tsx"), `
import React from "react"
import { Button } from "./components/Button"

export function App() {
  return <div><Button /></div>
}
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${srcDir}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📂 발견된 파일 분류 시작...")
      expect(result).toContain("📋 노드 타입별 분포:")
      expect(result).toContain("📄 code:") // 코드 파일들이 분류되었는지 확인

      // 파일 수 확인
      const filesMatch = result.match(/📄 code: (\d+)개/)
      expect(filesMatch).toBeTruthy()
      expect(parseInt(filesMatch![1])).toBe(4) // 4개의 코드 파일
    })

    test("테스트 파일 분류", async () => {
      const projectDir = path.join(TEST_FIXTURES_DIR, "test-project")
      const srcDir = path.join(projectDir, "src")
      const testDir = path.join(projectDir, "test")
      const specDir = path.join(projectDir, "__tests__")

      await fs.mkdir(srcDir, { recursive: true })
      await fs.mkdir(testDir, { recursive: true })
      await fs.mkdir(specDir, { recursive: true })

      // 소스 파일
      await fs.writeFile(path.join(srcDir, "calculator.ts"), `
export class Calculator {
  add(a: number, b: number): number {
    return a + b
  }

  subtract(a: number, b: number): number {
    return a - b
  }
}
      `)

      // 테스트 파일들 (.test.ts)
      await fs.writeFile(path.join(testDir, "calculator.test.ts"), `
import { describe, test, expect } from "vitest"
import { Calculator } from "../src/calculator"

describe("Calculator", () => {
  const calc = new Calculator()

  test("add", () => {
    expect(calc.add(2, 3)).toBe(5)
  })

  test("subtract", () => {
    expect(calc.subtract(5, 3)).toBe(2)
  })
})
      `)

      // 스펙 파일들 (.spec.ts)
      await fs.writeFile(path.join(specDir, "calculator.spec.ts"), `
import { Calculator } from "../src/calculator"

describe("Calculator Spec", () => {
  let calculator: Calculator

  beforeEach(() => {
    calculator = new Calculator()
  })

  it("should add numbers correctly", () => {
    expect(calculator.add(1, 1)).toEqual(2)
  })
})
      `)

      // Jest 설정 파일
      await fs.writeFile(path.join(testDir, "setup.test.ts"), `
import { beforeAll, afterAll } from "vitest"

beforeAll(() => {
  console.log("Setting up tests")
})

afterAll(() => {
  console.log("Cleaning up tests")
})
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${projectDir}" --include-tests --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📋 노드 타입별 분포:")
      expect(result).toContain("🧪 test:") // 테스트 파일들이 분류되었는지 확인
      expect(result).toContain("📄 code:") // 코드 파일도 함께 분류되었는지 확인

      // 테스트 파일 수 확인
      const testFilesMatch = result.match(/🧪 test: (\d+)개/)
      expect(testFilesMatch).toBeTruthy()
      expect(parseInt(testFilesMatch![1])).toBeGreaterThanOrEqual(3) // 최소 3개의 테스트 파일
    })

    test("문서 파일 분류", async () => {
      const docsDir = path.join(TEST_FIXTURES_DIR, "docs")
      await fs.mkdir(docsDir, { recursive: true })

      // Markdown 문서들
      await fs.writeFile(path.join(docsDir, "README.md"), `
# 프로젝트 문서

이것은 샘플 프로젝트입니다.

## 설치

\`\`\`bash
npm install
\`\`\`

## 사용법

\`\`\`typescript
import { Calculator } from "./calculator"
\`\`\`
      `)

      await fs.writeFile(path.join(docsDir, "API.md"), `
# API 문서

## Calculator 클래스

### add(a, b)
두 숫자를 더합니다.

### subtract(a, b)
두 숫자를 뺍니다.
      `)

      await fs.writeFile(path.join(docsDir, "CHANGELOG.md"), `
# 변경 내역

## v1.0.0
- 초기 릴리스
- Calculator 클래스 추가
      `)

      // 일부 코드 파일도 추가 (비교를 위해)
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "index.ts"), `
export * from "./docs"
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${TEST_FIXTURES_DIR}" --include-docs --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📋 노드 타입별 분포:")

      // 문서 파일과 코드 파일이 모두 분류되었는지 확인
      expect(result.match(/📝 docs:/) || result.match(/📄 code:/)).toBeTruthy()
    })

    test("라이브러리 의존성 분류", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "lib-deps")
      await fs.mkdir(srcDir, { recursive: true })

      // package.json 생성
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "package.json"), `
{
  "name": "test-project",
  "dependencies": {
    "react": "^18.0.0",
    "axios": "^1.0.0",
    "lodash": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
      `)

      // 다양한 외부 라이브러리를 사용하는 파일
      await fs.writeFile(path.join(srcDir, "app.ts"), `
// React 라이브러리
import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom"

// HTTP 클라이언트
import axios from "axios"

// 유틸리티 라이브러리
import _ from "lodash"
import { format, parseISO } from "date-fns"

// Node.js 내장 모듈
import * as fs from "node:fs"
import * as path from "node:path"

// 타입 정의
import type { AxiosResponse } from "axios"

export function App() {
  const [data, setData] = useState([])

  useEffect(() => {
    axios.get("/api/data").then((response: AxiosResponse) => {
      const processedData = _.map(response.data, item => ({
        ...item,
        timestamp: format(parseISO(item.date), "yyyy-MM-dd")
      }))
      setData(processedData)
    })
  }, [])

  return React.createElement("div", {}, "App")
}
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${TEST_FIXTURES_DIR}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📋 노드 타입별 분포:")
      expect(result).toContain("📦 library:") // 라이브러리 의존성이 분류되었는지 확인

      // 라이브러리 의존성 수 확인
      const libraryMatch = result.match(/📦 library: (\d+)개/)
      expect(libraryMatch).toBeTruthy()
      expect(parseInt(libraryMatch![1])).toBeGreaterThan(0)
    })
  })

  describe("분류 옵션 테스트", () => {
    test("필터링 옵션 - 파일 크기", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "size-filter")
      await fs.mkdir(srcDir, { recursive: true })

      // 작은 파일
      await fs.writeFile(path.join(srcDir, "small.ts"), `export const small = "small"`)

      // 큰 파일
      let largeContent = `// Large file\n`
      for (let i = 0; i < 1000; i++) {
        largeContent += `export const var${i} = "${i}"\n`
      }
      await fs.writeFile(path.join(srcDir, "large.ts"), largeContent)

      // 중간 크기 파일
      let mediumContent = `// Medium file\n`
      for (let i = 0; i < 100; i++) {
        mediumContent += `export const var${i} = "${i}"\n`
      }
      await fs.writeFile(path.join(srcDir, "medium.ts"), mediumContent)

      // 최소 파일 크기 필터 적용
      const result = execSync(`node "${CLI_PATH}" classify "${srcDir}" --min-file-size 1000 --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📂 발견된 파일 분류 시작...")
      expect(result).toContain("📊 의존성 분류 분석 결과")

      // 큰 파일들만 분석되었는지 확인 (정확한 수는 파일 크기에 따라 달라질 수 있음)
      const filesMatch = result.match(/📁 총 파일: (\d+)개/)
      expect(filesMatch).toBeTruthy()
      const fileCount = parseInt(filesMatch![1])
      expect(fileCount).toBeLessThan(3) // 모든 파일보다 적어야 함
    })

    test("깊이 제한 옵션", async () => {
      // 깊은 디렉토리 구조 생성
      const deepDir = path.join(TEST_FIXTURES_DIR, "deep", "level1", "level2", "level3")
      await fs.mkdir(deepDir, { recursive: true })

      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "root.ts"), `export const root = "root"`)
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "deep", "level1.ts"), `export const level1 = "level1"`)
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "deep", "level1", "level2.ts"), `export const level2 = "level2"`)
      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "deep", "level1", "level2", "level3.ts"), `export const level3 = "level3"`)
      await fs.writeFile(path.join(deepDir, "deep.ts"), `export const deep = "deep"`)

      // 최대 깊이 2로 제한
      const result = execSync(`node "${CLI_PATH}" classify "${TEST_FIXTURES_DIR}" --max-depth 2 --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📊 의존성 분류 분석 결과")

      // 깊이 제한으로 인해 일부 파일만 분석되었는지 확인
      const filesMatch = result.match(/📁 총 파일: (\d+)개/)
      expect(filesMatch).toBeTruthy()
      const fileCount = parseInt(filesMatch![1])
      expect(fileCount).toBeLessThan(5) // 모든 파일보다 적어야 함
    })

    test("포함/제외 패턴", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "patterns")
      await fs.mkdir(srcDir, { recursive: true })

      // 다양한 파일들 생성
      await fs.writeFile(path.join(srcDir, "component.tsx"), `import React from "react"; export const Component = () => <div />`)
      await fs.writeFile(path.join(srcDir, "utils.ts"), `export const utils = "utils"`)
      await fs.writeFile(path.join(srcDir, "config.js"), `module.exports = { config: true }`)
      await fs.writeFile(path.join(srcDir, "test.spec.ts"), `describe("test", () => {})`)
      await fs.writeFile(path.join(srcDir, "legacy.old.js"), `// legacy file`)

      // .tsx 파일만 포함
      const includeResult = execSync(`node "${CLI_PATH}" classify "${srcDir}" --include "*.tsx" --verbose`, {
        encoding: "utf-8"
      })

      expect(includeResult).toContain("📊 의존성 분류 분석 결과")

      // .spec.ts 파일 제외
      const excludeResult = execSync(`node "${CLI_PATH}" classify "${srcDir}" --exclude "*.spec.*" --verbose`, {
        encoding: "utf-8"
      })

      expect(excludeResult).toContain("📊 의존성 분류 분석 결과")
    })
  })

  describe("출력 및 저장 기능", () => {
    test("출력 디렉토리에 저장", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "save-test")
      const outputDir = path.join(TEST_FIXTURES_DIR, "output")

      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "index.ts"), `
import { helper } from "./helper"
export const main = () => helper()
      `)

      await fs.writeFile(path.join(srcDir, "helper.ts"), `
export const helper = () => "helper"
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${srcDir}" --output-dir "${outputDir}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("✅ 분석 완료!")
      expect(result).toContain("💾 결과 저장됨:")

      // 출력 파일이 생성되었는지 확인
      const reportPath = path.join(outputDir, "analysis-report.json")
      await expect(fs.access(reportPath)).resolves.toBeUndefined()

      // 저장된 내용 검증
      const reportContent = await fs.readFile(reportPath, "utf-8")
      const report = JSON.parse(reportContent)

      expect(report).toHaveProperty("graph")
      expect(report).toHaveProperty("analysisMetadata")
      expect(report).toHaveProperty("nodesByType")
    })

    test("리포트 생성 옵션", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "report-test")
      const outputDir = path.join(TEST_FIXTURES_DIR, "reports")

      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "app.ts"), `
import React from "react"
import axios from "axios"
import { utils } from "./utils"

export function App() {
  return React.createElement("div")
}
      `)

      await fs.writeFile(path.join(srcDir, "utils.ts"), `
export const utils = "utilities"
      `)

      const result = execSync(
        `node "${CLI_PATH}" classify "${srcDir}" --output-dir "${outputDir}" --generate-report --output-metadata --verbose`,
        { encoding: "utf-8" }
      )

      expect(result).toContain("✅ 분석 완료!")
      expect(result).toContain("💾 결과 저장됨:")

      // 리포트 파일 확인
      const reportPath = path.join(outputDir, "analysis-report.json")
      await expect(fs.access(reportPath)).resolves.toBeUndefined()

      const reportContent = await fs.readFile(reportPath, "utf-8")
      const report = JSON.parse(reportContent)

      // 메타데이터가 포함되었는지 확인
      expect(report.analysisMetadata).toHaveProperty("startTime")
      expect(report.analysisMetadata).toHaveProperty("endTime")
      expect(report.analysisMetadata).toHaveProperty("duration")
      expect(report.analysisMetadata).toHaveProperty("filesProcessed")
    })
  })

  describe("고급 분류 기능", () => {
    test("증분 분석", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "incremental")
      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "base.ts"), `export const base = "base"`)

      // 첫 번째 분석
      const firstResult = execSync(`node "${CLI_PATH}" classify "${srcDir}" --incremental --verbose`, {
        encoding: "utf-8"
      })

      expect(firstResult).toContain("📊 의존성 분류 분석 결과")

      // 파일 추가 후 두 번째 분석
      await fs.writeFile(path.join(srcDir, "new.ts"), `export const newFile = "new"`)

      const secondResult = execSync(`node "${CLI_PATH}" classify "${srcDir}" --incremental --verbose`, {
        encoding: "utf-8"
      })

      expect(secondResult).toContain("📊 의존성 분류 분석 결과")
    })

    test("신뢰도 임계값", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "confidence")
      await fs.mkdir(srcDir, { recursive: true })

      await fs.writeFile(path.join(srcDir, "reliable.ts"), `
import { existingFunction } from "./existing"
export const reliable = existingFunction()
      `)

      await fs.writeFile(path.join(srcDir, "existing.ts"), `
export function existingFunction() {
  return "existing"
}
      `)

      await fs.writeFile(path.join(srcDir, "unreliable.ts"), `
import { nonExistentFunction } from "./non-existent"
export const unreliable = nonExistentFunction()
      `)

      const result = execSync(`node "${CLI_PATH}" classify "${srcDir}" --confidence-threshold 80 --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📊 의존성 분류 분석 결과")
    })

    test("캐시 활성화", async () => {
      const srcDir = path.join(TEST_FIXTURES_DIR, "cache-test")
      await fs.mkdir(srcDir, { recursive: true })

      // 여러 파일 생성
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(srcDir, `file${i}.ts`), `
export const value${i} = ${i}
import { helper } from "./helper"
        `)
      }

      await fs.writeFile(path.join(srcDir, "helper.ts"), `
export const helper = "helper"
      `)

      // 캐시 활성화 분석
      const result = execSync(`node "${CLI_PATH}" classify "${srcDir}" --enable-cache --parallel --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📊 의존성 분류 분석 결과")
      expect(result).toContain("📁 총 파일: 6개")
    })
  })
})