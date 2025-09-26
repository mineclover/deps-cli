import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EnvironmentAdapter } from '../src/adapters/EnvironmentAdapter.js'

describe('EnvironmentAdapter', () => {
  let adapter: EnvironmentAdapter
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    adapter = new EnvironmentAdapter()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('기본 기능 테스트', () => {
    it('EnvironmentAdapter 인스턴스가 생성되어야 함', () => {
      expect(adapter).toBeDefined()
      expect(adapter).toBeInstanceOf(EnvironmentAdapter)
    })

    it('getSource가 소스를 반환해야 함', () => {
      const source = adapter.getSource()
      expect(typeof source).toBe('string')
      expect(source.length).toBeGreaterThan(0)
    })

    it('getAllMetadata가 메타데이터를 반환해야 함', () => {
      const allMetadata = adapter.getAllMetadata()
      expect(allMetadata).toBeDefined()
      expect(typeof allMetadata).toBe('object')
    })
  })

  describe('설정 로드 및 검증 테스트', () => {
    it('load가 설정을 로드해야 함', async () => {
      const config = await adapter.load('/test/path')
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    it('validate가 설정을 검증해야 함', async () => {
      const testConfig = {
        filePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**']
      }

      const isValid = await adapter.validate(testConfig)
      expect(typeof isValid).toBe('boolean')
    })
  })
})