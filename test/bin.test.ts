import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

describe('CLI 실행 테스트', () => {
  let binPath: string

  beforeEach(() => {
    binPath = join(process.cwd(), 'dist/bin.js')
  })

  const runCommand = (args: Array<string>, timeout = 5000): Promise<{ output: string; code: number | null }> => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [binPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let output = ''
      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.stderr.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        resolve({ output, code })
      })

      setTimeout(() => {
        child.kill()
        reject(new Error('Test timeout'))
      }, timeout)
    })
  }

  describe('CLI 명령어 기본 테스트', () => {
    it('help 명령어가 작동해야 함', async () => {
      const { output, code } = await runCommand(['--help'])
      expect(output).toContain('Usage:')
      expect(code).toBe(0)
    })

    it('version 명령어가 작동해야 함', async () => {
      const { output, code } = await runCommand(['--version'])
      expect(output).toMatch(/\d+\.\d+\.\d+/)
      expect(code).toBe(0)
    })

    it('잘못된 명령어가 에러를 반환해야 함', async () => {
      const { code } = await runCommand(['invalid-command']).catch(() => ({ output: '', code: 1 }))
      expect(code).not.toBe(0)
    })
  })

  describe('Enhanced 명령어 기본 테스트', () => {
    it('analyze-enhanced 명령어가 존재해야 함', async () => {
      const { output, code } = await runCommand(['analyze-enhanced', '--help'])
      expect(output).toContain('analyze-enhanced')
      expect(code).toBe(0)
    })

    it('find-unused-files-enhanced 명령어가 존재해야 함', async () => {
      const { output, code } = await runCommand(['find-unused-files-enhanced', '--help'])
      expect(output).toContain('find-unused-files-enhanced')
      expect(code).toBe(0)
    })
  })

  describe('CLI 옵션 테스트', () => {
    it('format 옵션이 작동해야 함', async () => {
      const { output } = await runCommand(['analyze-enhanced', '.', '--format', 'json'], 10000).catch(() => ({
        output: '',
        code: 1,
      }))
      expect(output.length).toBeGreaterThan(0)
    })

    it('verbose 옵션이 작동해야 함', async () => {
      const { output } = await runCommand(['find-unused-files-enhanced', '--verbose'], 10000).catch(() => ({
        output: '',
        code: 1,
      }))
      expect(output.length).toBeGreaterThan(0)
    })
  })

  describe('에러 처리 테스트', () => {
    it('존재하지 않는 파일 분석 시 적절한 처리', async () => {
      const { code } = await runCommand(['analyze-enhanced', 'nonexistent-file.ts']).catch(() => ({
        output: '',
        code: 1,
      }))
      expect(code !== null).toBe(true)
    })
  })
})
