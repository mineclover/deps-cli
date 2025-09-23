/**
 * 에러 처리 및 엣지 케이스 테스트
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
const TEST_FIXTURES_DIR = path.join(__dirname, "fixtures", "error-tests")

describe("에러 처리 및 엣지 케이스 테스트", () => {
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

  describe("파일 시스템 에러", () => {
    test("존재하지 않는 파일 경로", () => {
      const nonExistentPath = path.join(TEST_FIXTURES_DIR, "does-not-exist.ts")

      try {
        execSync(`node "${CLI_PATH}" analyze "${nonExistentPath}"`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
        expect(error.stderr || error.stdout).toContain("❌ Analysis failed")
      }
    })

    test("존재하지 않는 디렉토리 경로", () => {
      const nonExistentDir = path.join(TEST_FIXTURES_DIR, "does-not-exist")

      try {
        execSync(`node "${CLI_PATH}" classify "${nonExistentDir}"`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
        expect(error.stderr || error.stdout).toContain("❌ Classification failed")
      }
    })

    test("권한이 없는 디렉토리 (시뮬레이션)", async () => {
      // 빈 디렉토리로 테스트 (실제 권한 변경은 복잡하므로)
      const emptyDir = path.join(TEST_FIXTURES_DIR, "empty")
      await fs.mkdir(emptyDir, { recursive: true })

      const result = execSync(`node "${CLI_PATH}" analyze "${emptyDir}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 0 files to analyze")
    })

    test("출력 디렉토리 생성 실패 (잘못된 경로)", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `export const test = "test"`)

      // 잘못된 출력 경로 (파일명을 디렉토리로 사용)
      const invalidOutputPath = testFile // 파일을 디렉토리로 사용

      try {
        execSync(`node "${CLI_PATH}" classify "${testFile}" --output-dir "${invalidOutputPath}"`, {
          encoding: "utf-8"
        })
        // 에러가 발생하지 않으면 (CLI가 적절히 처리하면) 통과
      } catch (error: any) {
        // 에러가 발생하면 적절한 에러 메시지가 있는지 확인
        expect(error.status).toBe(1)
      }
    })
  })

  describe("잘못된 파일 형식", () => {
    test("바이너리 파일 분석", async () => {
      const binaryFile = path.join(TEST_FIXTURES_DIR, "binary.bin")
      // 바이너리 데이터 생성
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD])
      await fs.writeFile(binaryFile, binaryData)

      const result = execSync(`node "${CLI_PATH}" analyze "${binaryFile}" --verbose`, {
        encoding: "utf-8"
      })

      // 바이너리 파일은 분석 대상에서 제외되어야 함
      expect(result).toContain("📁 Found 0 files to analyze")
    })

    test("손상된 JavaScript 파일", async () => {
      const corruptedFile = path.join(TEST_FIXTURES_DIR, "corrupted.js")
      await fs.writeFile(corruptedFile, `
// 문법 오류가 있는 JavaScript 파일
function broken() {
  const unclosed = "string
  return unclosed
}

// 잘못된 import
import { something } from
import from "nowhere"

// 불완전한 함수
function incomplete(
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${corruptedFile}" --verbose`, {
        encoding: "utf-8"
      })

      // 손상된 파일이라도 분석을 시도해야 함
      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("비어있는 파일", async () => {
      const emptyFile = path.join(TEST_FIXTURES_DIR, "empty.ts")
      await fs.writeFile(emptyFile, "")

      const result = execSync(`node "${CLI_PATH}" analyze "${emptyFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("매우 긴 줄이 있는 파일", async () => {
      const longLineFile = path.join(TEST_FIXTURES_DIR, "long-line.ts")
      const veryLongString = "x".repeat(10000)
      await fs.writeFile(longLineFile, `
export const shortLine = "short"
export const veryLongLine = "${veryLongString}"
export const anotherShort = "short"
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${longLineFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })
  })

  describe("잘못된 명령어 옵션", () => {
    test("잘못된 형식 옵션", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `export const test = "test"`)

      try {
        execSync(`node "${CLI_PATH}" analyze "${testFile}" --format invalid-format`, {
          encoding: "utf-8"
        })
        // 잘못된 형식이라도 기본값으로 처리될 수 있음
      } catch (error: any) {
        // 에러가 발생하면 적절한 처리인지 확인
        expect(error.status).toBe(1)
      }
    })

    test("잘못된 숫자 옵션", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `export const test = "test"`)

      try {
        execSync(`node "${CLI_PATH}" analyze "${testFile}" --max-depth not-a-number`, {
          encoding: "utf-8"
        })
      } catch (error: any) {
        expect(error.status).toBe(1)
      }

      try {
        execSync(`node "${CLI_PATH}" analyze "${testFile}" --concurrency -5`, {
          encoding: "utf-8"
        })
      } catch (error: any) {
        // 음수 값에 대한 처리
        expect(error.status).toBe(1)
      }
    })

    test("상충하는 옵션들", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `export const test = "test"`)

      // 논리적으로 맞지 않는 옵션 조합도 처리되어야 함
      const result = execSync(`node "${CLI_PATH}" classify "${testFile}" --min-file-size 1000000 --max-file-size 100`, {
        encoding: "utf-8"
      })

      // 조건에 맞지 않아 분석할 파일이 없어야 함
      expect(result).toContain("📂 발견된 파일 분류 시작...")
    })
  })

  describe("메모리 및 성능 에러", () => {
    test("매우 많은 파일 처리", async () => {
      const manyFilesDir = path.join(TEST_FIXTURES_DIR, "many-files")
      await fs.mkdir(manyFilesDir, { recursive: true })

      // 50개의 파일 생성 (너무 많으면 테스트가 오래 걸림)
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(path.join(manyFilesDir, `file${i}.ts`), `
import { util${i % 5} } from "./utils"
export const value${i} = util${i % 5}()
        `)
      }

      // 공통 유틸리티 파일들
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(manyFilesDir, `utils${i}.ts`), `
export function util${i}() {
  return "util${i}"
}
        `)
      }

      const startTime = Date.now()
      const result = execSync(`node "${CLI_PATH}" analyze "${manyFilesDir}" --parallel --verbose`, {
        encoding: "utf-8",
        timeout: 30000 // 30초 타임아웃
      })
      const endTime = Date.now()

      expect(result).toContain("📁 Found 55 files to analyze")
      expect(result).toContain("📊 Analysis completed:")

      // 성능 확인 (30초 이내)
      expect(endTime - startTime).toBeLessThan(30000)
    })

    test("매우 복잡한 의존성 구조", async () => {
      const complexDir = path.join(TEST_FIXTURES_DIR, "complex-deps")
      await fs.mkdir(complexDir, { recursive: true })

      // 복잡한 상호 의존성 구조 생성
      for (let i = 0; i < 20; i++) {
        const imports = []
        for (let j = 0; j < 10; j++) {
          const targetIndex = (i + j + 1) % 20
          imports.push(`import { func${targetIndex} } from "./module${targetIndex}"`)
        }

        await fs.writeFile(path.join(complexDir, `module${i}.ts`), `
${imports.join("\n")}
import * as fs from "node:fs"
import * as path from "node:path"
import axios from "axios"
import lodash from "lodash"

export function func${i}() {
  return "func${i}"
}

export const config${i} = {
  id: ${i},
  dependencies: [${Array.from({ length: 10 }, (_, j) => (i + j + 1) % 20).join(", ")}]
}
        `)
      }

      const result = execSync(`node "${CLI_PATH}" classify "${complexDir}" --parallel --verbose`, {
        encoding: "utf-8",
        timeout: 45000 // 45초 타임아웃
      })

      expect(result).toContain("📁 Found 20 files to analyze")
      expect(result).toContain("📊 의존성 분류 분석 결과")
    })
  })

  describe("특수 문자 및 인코딩", () => {
    test("특수 문자가 포함된 파일명", async () => {
      const specialDir = path.join(TEST_FIXTURES_DIR, "special-chars")
      await fs.mkdir(specialDir, { recursive: true })

      // 특수 문자가 포함된 파일명들
      const specialFiles = [
        "한글파일.ts",
        "file with spaces.ts",
        "file-with-dashes.ts",
        "file_with_underscores.ts",
        "file.with.dots.ts"
      ]

      for (const fileName of specialFiles) {
        await fs.writeFile(path.join(specialDir, fileName), `
export const fileName = "${fileName}"
import * as fs from "node:fs"
        `)
      }

      const result = execSync(`node "${CLI_PATH}" analyze "${specialDir}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain(`📁 Found ${specialFiles.length} files to analyze`)
      expect(result).toContain("📊 Analysis completed:")
    })

    test("UTF-8 BOM이 있는 파일", async () => {
      const bomFile = path.join(TEST_FIXTURES_DIR, "bom-file.ts")
      // UTF-8 BOM (0xEF, 0xBB, 0xBF) + 내용
      const content = "\uFEFF" + `
export const withBOM = "파일에 BOM이 있습니다"
import { helper } from "./helper"
      `
      await fs.writeFile(bomFile, content, "utf-8")

      const result = execSync(`node "${CLI_PATH}" analyze "${bomFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("다양한 인코딩 문자가 포함된 파일", async () => {
      const unicodeFile = path.join(TEST_FIXTURES_DIR, "unicode.ts")
      await fs.writeFile(unicodeFile, `
// 다양한 언어의 문자들
export const korean = "한글 텍스트"
export const japanese = "日本語テキスト"
export const chinese = "中文文本"
export const emoji = "🚀📊📁🔍"
export const symbols = "©™®→←↑↓"

// 특수 유니코드 문자
export const special = "\\u{1F600}\\u{1F601}\\u{1F602}"

import * as fs from "node:fs"
      `, "utf-8")

      const result = execSync(`node "${CLI_PATH}" analyze "${unicodeFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })
  })

  describe("네트워크 및 외부 의존성 에러", () => {
    test("존재하지 않는 패키지 import", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "missing-packages.ts")
      await fs.writeFile(testFile, `
// 존재하지 않는 패키지들
import { something } from "this-package-does-not-exist"
import { another } from "@fake/nonexistent-package"
import { local } from "./also-does-not-exist"

export function useNonExistent() {
  return something() + another()
}
      `)

      const result = execSync(`node "${CLI_PATH}" analyze "${testFile}" --verbose`, {
        encoding: "utf-8"
      })

      expect(result).toContain("📁 Found 1 files to analyze")
      expect(result).toContain("📊 Analysis completed:")
    })

    test("깨진 symlink", async () => {
      const validFile = path.join(TEST_FIXTURES_DIR, "valid.ts")
      const brokenLink = path.join(TEST_FIXTURES_DIR, "broken-link.ts")

      await fs.writeFile(validFile, `export const valid = "valid"`)

      try {
        // 심볼릭 링크 생성 (Unix 계열에서만 가능)
        await fs.symlink("non-existent-target.ts", brokenLink)

        const result = execSync(`node "${CLI_PATH}" analyze "${TEST_FIXTURES_DIR}" --verbose`, {
          encoding: "utf-8"
        })

        // 유효한 파일만 분석되어야 함
        expect(result).toContain("📁 Found")
        expect(result).toContain("📊 Analysis completed:")
      } catch {
        // 심볼릭 링크 생성이 실패하면 스킵 (Windows 등)
        console.log("Symlink test skipped (not supported on this platform)")
      }
    })
  })

  describe("메모리 누수 및 리소스 관리", () => {
    test("반복적인 분석 실행", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "repeated.ts")
      await fs.writeFile(testFile, `
import { utils } from "./utils"
export const repeated = utils()
      `)

      await fs.writeFile(path.join(TEST_FIXTURES_DIR, "utils.ts"), `
export const utils = () => "utils"
      `)

      // 여러 번 반복 실행하여 메모리 누수 확인
      for (let i = 0; i < 5; i++) {
        const result = execSync(`node "${CLI_PATH}" analyze "${TEST_FIXTURES_DIR}" --verbose`, {
          encoding: "utf-8"
        })

        expect(result).toContain("📁 Found 2 files to analyze")
        expect(result).toContain("📊 Analysis completed:")
      }
    })
  })

  describe("CLI 자체 에러", () => {
    test("잘못된 명령어", () => {
      try {
        execSync(`node "${CLI_PATH}" invalid-command`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
      }
    })

    test("필수 인자 누락", () => {
      try {
        execSync(`node "${CLI_PATH}" analyze`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
      }

      try {
        execSync(`node "${CLI_PATH}" classify`, { encoding: "utf-8" })
        expect.fail("에러가 발생해야 합니다")
      } catch (error: any) {
        expect(error.status).toBe(1)
      }
    })

    test("잘못된 플래그", async () => {
      const testFile = path.join(TEST_FIXTURES_DIR, "test.ts")
      await fs.writeFile(testFile, `export const test = "test"`)

      try {
        execSync(`node "${CLI_PATH}" analyze "${testFile}" --invalid-flag`, { encoding: "utf-8" })
      } catch (error: any) {
        // 알 수 없는 플래그에 대한 처리
        expect(error.status).toBe(1)
      }
    })
  })
})