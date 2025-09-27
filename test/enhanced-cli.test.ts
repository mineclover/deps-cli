/**
 * Enhanced CLI 시스템 테스트 - 빌드된 파일 기준
 * AST 기반 99%+ 정확도 의존성 분석 시스템 테스트
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 테스트용 프로젝트 루트 및 빌드된 CLI 경로
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CLI_PATH = path.join(PROJECT_ROOT, 'dist', 'bin.js')
const TEST_FIXTURES_DIR = path.join(__dirname, 'fixtures')

// 테스트 타임아웃 설정
const TEST_TIMEOUT = 30000

describe('Enhanced CLI 전체 기능 테스트', () => {
  beforeAll(async () => {
    // 빌드된 CLI 파일이 존재하는지 확인
    try {
      await fs.access(CLI_PATH)
    } catch {
      throw new Error(`빌드된 CLI 파일이 존재하지 않습니다: ${CLI_PATH}`)
    }

    // 테스트 fixture 디렉토리 생성
    try {
      await fs.mkdir(TEST_FIXTURES_DIR, { recursive: true })
    } catch {
      // 이미 존재하는 경우 무시
    }
  }, TEST_TIMEOUT)

  describe('기본 CLI 명령어', () => {
    test('--help 명령어 작동 확인', () => {
      const result = execSync(`node "${CLI_PATH}" --help`, { encoding: 'utf-8' })

      expect(result).toContain('Enhanced dependency analysis CLI tool with 99%+ accuracy')
      expect(result).toContain('analyze-enhanced')
      expect(result).toContain('find-usages-enhanced')
      expect(result).toContain('find-unused-files-enhanced')
      expect(result).toContain('find-unused-methods-enhanced')
      expect(result).toContain('find-method-usages-enhanced')
    })

    test('--version 명령어 작동 확인', () => {
      const result = execSync(`node "${CLI_PATH}" --version`, { encoding: 'utf-8' })

      expect(result.trim()).toMatch(/^2\.\d+\.\d+$/)
    })

    test('analyze-enhanced --help 명령어 작동 확인', () => {
      const result = execSync(`node "${CLI_PATH}" analyze-enhanced --help`, { encoding: 'utf-8' })

      expect(result).toContain('Enhanced dependency analysis with AST-based parsing')
      expect(result).toContain('--format')
      expect(result).toContain('--verbose')
    })

    test('find-usages-enhanced --help 명령어 작동 확인', () => {
      const result = execSync(`node "${CLI_PATH}" find-usages-enhanced --help`, { encoding: 'utf-8' })

      expect(result).toContain('Enhanced AST-based analysis to find all files that import/use a specific file')
      expect(result).toContain('<filePath>')
    })
  })

  describe('Enhanced 분석 명령어', () => {
    test(
      'find-unused-files-enhanced 실행',
      async () => {
        const result = execSync(`node "${CLI_PATH}" find-unused-files-enhanced`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        expect(result).toContain('Enhanced Unused Files Analysis')
        expect(result).toContain('Total files:')
        expect(result).toContain('Entry points:')
      },
      TEST_TIMEOUT
    )

    test(
      'find-unused-methods-enhanced 실행',
      async () => {
        const result = execSync(`node "${CLI_PATH}" find-unused-methods-enhanced`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        expect(result).toContain('Enhanced Unused Methods Analysis')
        expect(result).toContain('Total files analyzed:')
      },
      TEST_TIMEOUT
    )

    test(
      'analyze-enhanced 현재 프로젝트 실행',
      async () => {
        const result = execSync(`node "${CLI_PATH}" analyze-enhanced . --format summary`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        expect(result).toContain('Enhanced Dependency Analysis Results')
        expect(result).toContain('Total files:')
        expect(result).toContain('Dependencies (edges):')
        expect(result).toContain('Entry points:')
      },
      TEST_TIMEOUT
    )
  })

  describe('JSON 출력 형식', () => {
    test(
      'find-unused-files-enhanced JSON 출력',
      async () => {
        const result = execSync(`node "${CLI_PATH}" find-unused-files-enhanced --format json`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        // JSON 형식인지 확인
        expect(() => JSON.parse(result)).not.toThrow()

        const parsed = JSON.parse(result)
        expect(parsed).toHaveProperty('totalFiles')
        expect(parsed).toHaveProperty('unusedFiles')
        expect(parsed).toHaveProperty('entryPoints')
      },
      TEST_TIMEOUT
    )

    test(
      'analyze-enhanced JSON 출력',
      async () => {
        const result = execSync(`node "${CLI_PATH}" analyze-enhanced src/ --format json`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        // JSON 형식인지 확인
        expect(() => JSON.parse(result)).not.toThrow()

        const parsed = JSON.parse(result)
        expect(parsed).toHaveProperty('nodes')
        expect(parsed).toHaveProperty('edges')
        expect(parsed).toHaveProperty('entryPoints')
      },
      TEST_TIMEOUT
    )
  })

  describe('에러 처리', () => {
    test('존재하지 않는 파일 경로로 find-usages-enhanced 실행', () => {
      const nonExistentPath = '/nonexistent/file.ts'

      // Enhanced 시스템은 존재하지 않는 파일을 우아하게 처리합니다
      const result = execSync(`node "${CLI_PATH}" find-usages-enhanced "${nonExistentPath}"`, { encoding: 'utf-8' })

      expect(result).toContain('No files found using this file')
    })

    test('잘못된 명령어 실행', () => {
      expect(() => {
        execSync(`node "${CLI_PATH}" invalid-command`, { encoding: 'utf-8' })
      }).toThrow()
    })

    test('레거시 명령어는 더 이상 사용할 수 없음', () => {
      expect(() => {
        execSync(`node "${CLI_PATH}" analyze`, { encoding: 'utf-8' })
      }).toThrow()

      expect(() => {
        execSync(`node "${CLI_PATH}" find-usages`, { encoding: 'utf-8' })
      }).toThrow()
    })
  })

  describe('성능 테스트', () => {
    test(
      'Enhanced 시스템 분석 속도',
      async () => {
        const startTime = Date.now()

        execSync(`node "${CLI_PATH}" find-unused-files-enhanced`, {
          encoding: 'utf-8',
          cwd: PROJECT_ROOT,
        })

        const duration = Date.now() - startTime

        // Enhanced 시스템은 그래프 구축 후 즉시 응답해야 함
        expect(duration).toBeLessThan(5000) // 5초 이내
      },
      TEST_TIMEOUT
    )
  })
})
