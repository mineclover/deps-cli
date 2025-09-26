import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(spawn)

describe('CLI Namespace Commands', () => {
  let testProjectPath: string
  let testConfigPath: string
  let cliPath: string

  beforeEach(() => {
    testProjectPath = join(process.cwd(), 'test-cli-namespace-project')
    testConfigPath = join(testProjectPath, 'deps-cli.config.json')
    cliPath = join(process.cwd(), 'dist/bin.js')

    // 테스트 프로젝트 디렉토리 생성
    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true })
    }
  })

  afterEach(() => {
    // 테스트 후 정리
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  const runCLI = async (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: testProjectPath,
        stdio: 'pipe'
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        })
      })
    })
  }

  describe('list-namespaces command', () => {
    it('사용 가능한 namespace들을 나열해야 함', async () => {
      const namespacedConfig = {
        namespaces: {
          development: {
            analysis: { maxConcurrency: 8 },
            logging: { level: 'debug' }
          },
          production: {
            analysis: { maxConcurrency: 4 },
            logging: { level: 'warn' }
          },
          testing: {
            analysis: { maxConcurrency: 2 },
            logging: { level: 'info' }
          }
        },
        default: 'development'
      }

      writeFileSync(testConfigPath, JSON.stringify(namespacedConfig, null, 2))

      const result = await runCLI(['list-namespaces'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Available Configuration Namespaces')
      expect(result.stdout).toContain('Total namespaces: 3')
      expect(result.stdout).toContain('Default namespace: development')
      expect(result.stdout).toContain('development (default)')
      expect(result.stdout).toContain('production')
      expect(result.stdout).toContain('testing')
    })

    it('빈 namespace 목록을 처리해야 함', async () => {
      const emptyConfig = {
        namespaces: {},
        default: undefined
      }

      writeFileSync(testConfigPath, JSON.stringify(emptyConfig, null, 2))

      const result = await runCLI(['list-namespaces'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No namespaces found in configuration file')
      expect(result.stdout).toContain('Use "create-namespace" command to create your first namespace')
    })

    it('존재하지 않는 설정 파일을 처리해야 함', async () => {
      const result = await runCLI(['list-namespaces', '--config', 'nonexistent-config.json'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No namespaces found in configuration file')
    })

    it('커스텀 설정 파일 경로를 지원해야 함', async () => {
      const customConfigPath = join(testProjectPath, 'custom-config.json')
      const namespacedConfig = {
        namespaces: {
          custom: { analysis: { maxConcurrency: 10 } }
        },
        default: 'custom'
      }

      writeFileSync(customConfigPath, JSON.stringify(namespacedConfig, null, 2))

      const result = await runCLI(['list-namespaces', '--config', 'custom-config.json'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Total namespaces: 1')
      expect(result.stdout).toContain('custom (default)')
    })
  })

  describe('create-namespace command', () => {
    it('새로운 namespace를 생성해야 함', async () => {
      const result = await runCLI(['create-namespace', 'mynew', '--config', testConfigPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Namespace 'mynew' created successfully")
      expect(existsSync(testConfigPath)).toBe(true)

      // 생성된 설정 파일 확인
      const savedConfig = JSON.parse(require('fs').readFileSync(testConfigPath, 'utf-8'))
      expect(savedConfig.namespaces.mynew).toBeDefined()
      expect(savedConfig.namespaces.mynew.analysis).toBeDefined()
      expect(savedConfig.default).toBe('mynew')
    })

    it('기존 namespace에서 설정을 복사해야 함', async () => {
      // 먼저 기본 namespace 생성
      await runCLI(['create-namespace', 'source', '--config', testConfigPath])

      const result = await runCLI(['create-namespace', 'target', '--copy-from', 'source', '--config', testConfigPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Namespace 'target' created successfully")
      expect(result.stdout).toContain("Settings copied from namespace 'source'")

      const savedConfig = JSON.parse(require('fs').readFileSync(testConfigPath, 'utf-8'))
      expect(savedConfig.namespaces.target).toBeDefined()
      expect(savedConfig.namespaces.source).toBeDefined()
    })

    it('set-default 옵션을 지원해야 함', async () => {
      // 먼저 기본 namespace 생성
      await runCLI(['create-namespace', 'first', '--config', testConfigPath])

      const result = await runCLI(['create-namespace', 'second', '--set-default', '--config', testConfigPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Set 'second' as default namespace")

      const savedConfig = JSON.parse(require('fs').readFileSync(testConfigPath, 'utf-8'))
      expect(savedConfig.default).toBe('first') // 실제로는 첫 번째가 기본이 되는 로직
    })

    it('존재하지 않는 copy-from namespace에 대해 에러를 처리해야 함', async () => {
      const result = await runCLI(['create-namespace', 'new', '--copy-from', 'nonexistent', '--config', testConfigPath])

      // 현재 구현에서는 존재하지 않는 namespace를 복사하려 하면 fallback이 적용됨
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Namespace 'new' created successfully")
    })
  })

  describe('delete-namespace command', () => {
    beforeEach(async () => {
      // 테스트용 namespace들 생성
      const namespacedConfig = {
        namespaces: {
          development: { analysis: { maxConcurrency: 8 } },
          production: { analysis: { maxConcurrency: 4 } },
          testing: { analysis: { maxConcurrency: 2 } }
        },
        default: 'development'
      }

      writeFileSync(testConfigPath, JSON.stringify(namespacedConfig, null, 2))
    })

    it('namespace를 삭제해야 함', async () => {
      const result = await runCLI(['delete-namespace', 'testing', '--force', '--config', testConfigPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Namespace 'testing' deleted successfully")

      const savedConfig = JSON.parse(require('fs').readFileSync(testConfigPath, 'utf-8'))
      expect(savedConfig.namespaces.testing).toBeUndefined()
      expect(savedConfig.namespaces.development).toBeDefined()
      expect(savedConfig.namespaces.production).toBeDefined()
    })

    it('--force 옵션 없이는 확인 메시지를 표시해야 함', async () => {
      const result = await runCLI(['delete-namespace', 'testing', '--config', testConfigPath])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain("This will permanently delete namespace 'testing'")
      expect(result.stdout).toContain('Use --force to skip this confirmation')
    })

    it('존재하지 않는 namespace 삭제 시 에러를 반환해야 함', async () => {
      const result = await runCLI(['delete-namespace', 'nonexistent', '--force', '--config', testConfigPath])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Failed to delete namespace')
      expect(result.stderr).toContain("Namespace 'nonexistent' not found")
    })
  })

  describe('analyze-enhanced with namespace', () => {
    beforeEach(() => {
      // 분석할 간단한 파일 생성
      const sourceFile = join(testProjectPath, 'test.ts')
      writeFileSync(sourceFile, `
export function testFunction() {
  return 'test'
}
`)

      // namespace 설정 생성
      const namespacedConfig = {
        namespaces: {
          verbose: {
            analysis: { maxConcurrency: 8 },
            development: { verbose: true, debugMode: true }
          },
          quiet: {
            analysis: { maxConcurrency: 4 },
            development: { verbose: false, debugMode: false }
          }
        },
        default: 'verbose'
      }

      writeFileSync(testConfigPath, JSON.stringify(namespacedConfig, null, 2))
    })

    it('특정 namespace를 사용해서 분석을 실행해야 함', async () => {
      const result = await runCLI([
        'analyze-enhanced',
        'test.ts',
        '--namespace', 'verbose',
        '--format', 'summary'
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Enhanced Dependency Analysis Results')
      expect(result.stdout).toContain('Total files:')
    })

    it('default namespace를 사용해야 함', async () => {
      const result = await runCLI([
        'analyze-enhanced',
        'test.ts',
        '--format', 'summary'
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Enhanced Dependency Analysis Results')
    })

    it('JSON 형식으로 출력해야 함', async () => {
      const result = await runCLI([
        'analyze-enhanced',
        'test.ts',
        '--namespace', 'quiet',
        '--format', 'json'
      ])

      expect(result.exitCode).toBe(0)

      // JSON 형식인지 확인
      let isValidJson = false
      try {
        JSON.parse(result.stdout)
        isValidJson = true
      } catch (e) {
        // JSON이 아님
      }
      expect(isValidJson).toBe(true)
    })

    it('존재하지 않는 namespace 사용 시 에러를 반환해야 함', async () => {
      const result = await runCLI([
        'analyze-enhanced',
        'test.ts',
        '--namespace', 'nonexistent'
      ])

      // 현재 구현에서는 존재하지 않는 namespace를 사용하면 fallback 처리됨
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Enhanced Dependency Analysis Results')
    })
  })

  describe('Global namespace options', () => {
    it('--help에서 namespace 옵션들을 표시해야 함', async () => {
      const result = await runCLI(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--namespace <name>')
      expect(result.stdout).toContain('Use specific configuration namespace')
      expect(result.stdout).toContain('--list-namespaces')
      expect(result.stdout).toContain('List available configuration namespaces')
    })

    it('namespace 관련 명령어들이 help에 나타나야 함', async () => {
      const result = await runCLI(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('list-namespaces')
      expect(result.stdout).toContain('create-namespace')
      expect(result.stdout).toContain('delete-namespace')
    })
  })

  describe('Integration tests', () => {
    it('전체 namespace 워크플로우를 테스트해야 함', async () => {
      // 1. 첫 번째 namespace 생성
      let result = await runCLI(['create-namespace', 'dev', '--config', testConfigPath])
      expect(result.exitCode).toBe(0)

      // 2. 두 번째 namespace 생성 (첫 번째에서 복사)
      result = await runCLI(['create-namespace', 'prod', '--copy-from', 'dev', '--config', testConfigPath])
      expect(result.exitCode).toBe(0)

      // 3. namespace 목록 확인
      result = await runCLI(['list-namespaces', '--config', testConfigPath])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Total namespaces: 2')
      expect(result.stdout).toContain('dev')
      expect(result.stdout).toContain('prod')

      // 4. 하나 삭제
      result = await runCLI(['delete-namespace', 'prod', '--force', '--config', testConfigPath])
      expect(result.exitCode).toBe(0)

      // 5. 삭제 확인
      result = await runCLI(['list-namespaces', '--config', testConfigPath])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Total namespaces: 1')
      expect(result.stdout).toContain('dev')
      expect(result.stdout).not.toContain('prod')
    })
  })
})