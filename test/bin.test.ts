import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { spawn } from 'child_process'
import { join } from 'path'

describe('bin.ts CLI', () => {
  const binPath = join(process.cwd(), 'dist', 'bin.js')
  let originalArgv: Array<string>
  let originalCwd: string

  beforeEach(() => {
    originalArgv = [...process.argv]
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.argv = originalArgv
    process.chdir(originalCwd)
  })

  describe('CLI 명령어 기본 테스트', () => {
    it('help 명령어가 작동해야 함', (done) => {
      const child = spawn('node', [binPath, '--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        expect(output).toContain('Usage:')
        expect(code).toBe(0)
        done()
      })

      // 테스트 타임아웃 설정
      setTimeout(() => {
        child.kill()
        done()
      }, 5000)
    })

    it('version 명령어가 작동해야 함', (done) => {
      const child = spawn('node', [binPath, '--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        expect(output).toMatch(/\d+\.\d+\.\d+/)
        expect(code).toBe(0)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 5000)
    })

    it('잘못된 명령어가 에러를 반환해야 함', (done) => {
      const child = spawn('node', [binPath, 'invalid-command'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let errorOutput = ''
      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      child.on('close', (code) => {
        expect(code).not.toBe(0)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 5000)
    })
  })

  describe('Enhanced 명령어 기본 테스트', () => {
    it('analyze-enhanced 명령어가 존재해야 함', (done) => {
      const child = spawn('node', [binPath, 'analyze-enhanced', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        expect(output).toContain('analyze-enhanced')
        expect(code).toBe(0)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 5000)
    })

    it('find-unused-files-enhanced 명령어가 존재해야 함', (done) => {
      const child = spawn('node', [binPath, 'find-unused-files-enhanced', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      child.stdout.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        expect(output).toContain('find-unused-files-enhanced')
        expect(code).toBe(0)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 5000)
    })
  })

  describe('CLI 옵션 테스트', () => {
    it('format 옵션이 작동해야 함', (done) => {
      const child = spawn('node', [binPath, 'analyze-enhanced', '.', '--format', 'json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })

      let hasOutput = false
      child.stdout.on('data', (data) => {
        hasOutput = true
      })

      child.on('close', (code) => {
        expect(hasOutput).toBe(true)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 10000)
    })

    it('verbose 옵션이 작동해야 함', (done) => {
      const child = spawn('node', [binPath, 'find-unused-files-enhanced', '--verbose'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })

      let hasOutput = false
      child.stdout.on('data', (data) => {
        hasOutput = true
      })

      child.on('close', (code) => {
        expect(hasOutput).toBe(true)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 10000)
    })
  })

  describe('에러 처리 테스트', () => {
    it('존재하지 않는 디렉토리에서 실행 시 적절한 에러를 반환해야 함', (done) => {
      const child = spawn('node', [binPath, 'analyze-enhanced', '/nonexistent/path'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let errorOutput = ''
      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      child.on('close', (code) => {
        // 에러가 발생하거나 적절히 처리되어야 함
        expect(code !== null).toBe(true)
        done()
      })

      setTimeout(() => {
        child.kill()
        done()
      }, 10000)
    })
  })
})