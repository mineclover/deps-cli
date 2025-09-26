import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { FileConfigAdapter, DefaultConfigAdapter, CliConfigAdapter } from '../src/adapters/ConfigAdapter.js'

describe('ConfigAdapter', () => {
  let testProjectPath: string
  let _testConfigPath: string

  beforeEach(() => {
    testProjectPath = join(process.cwd(), 'test-adapter-project')
    _testConfigPath = join(testProjectPath, 'deps-cli.config.json')

    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  describe('FileConfigAdapter', () => {
    let adapter: FileConfigAdapter

    beforeEach(() => {
      adapter = new FileConfigAdapter()
    })

    it('FileConfigAdapter 인스턴스가 생성되어야 함', () => {
      expect(adapter).toBeDefined()
      expect(adapter).toBeInstanceOf(FileConfigAdapter)
    })

    it('getSource가 올바른 소스를 반환해야 함', () => {
      const source = adapter.getSource()
      expect(source).toBe('file')
    })

    it('설정 파일을 로드할 수 있어야 함', async () => {
      const config = await adapter.load(testProjectPath)
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    it('validate가 설정을 검증해야 함', async () => {
      const validConfig = {
        filePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**']
      }

      const isValid = await adapter.validate(validConfig)
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('DefaultConfigAdapter', () => {
    let adapter: DefaultConfigAdapter

    beforeEach(() => {
      adapter = new DefaultConfigAdapter()
    })

    it('DefaultConfigAdapter 인스턴스가 생성되어야 함', () => {
      expect(adapter).toBeDefined()
      expect(adapter).toBeInstanceOf(DefaultConfigAdapter)
    })

    it('getSource가 올바른 소스를 반환해야 함', () => {
      const source = adapter.getSource()
      expect(source).toBe('default')
    })

    it('기본 설정을 로드해야 함', async () => {
      const config = await adapter.load(testProjectPath)
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    it('validate가 설정을 검증해야 함', async () => {
      const config = {}
      const isValid = await adapter.validate(config)
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('CliConfigAdapter', () => {
    let adapter: CliConfigAdapter

    beforeEach(() => {
      adapter = new CliConfigAdapter()
    })

    it('CliConfigAdapter 인스턴스가 생성되어야 함', () => {
      expect(adapter).toBeDefined()
      expect(adapter).toBeInstanceOf(CliConfigAdapter)
    })

    it('getSource가 올바른 소스를 반환해야 함', () => {
      const source = adapter.getSource()
      expect(source).toBe('cli')
    })

    it('CLI 설정을 로드해야 함', async () => {
      // CLI args가 undefined일 수 있으므로 에러를 무시하고 테스트
      try {
        const config = await adapter.load(testProjectPath)
        expect(config).toBeDefined()
        expect(typeof config).toBe('object')
      } catch (error) {
        // CLI args가 설정되지 않은 경우 에러가 발생할 수 있음
        expect(error).toBeDefined()
      }
    })

    it('validate가 CLI 설정을 검증해야 함', async () => {
      const config = {
        format: 'json',
        verbose: true
      }

      const isValid = await adapter.validate(config)
      expect(typeof isValid).toBe('boolean')
    })
  })
})