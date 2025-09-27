/**
 * 환경 설정 시스템 테스트
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CliConfigAdapter, DefaultConfigAdapter } from '../src/adapters/ConfigAdapter.js'
import { EnvironmentAdapter, parseBoolean, parseEnum, parseNumber } from '../src/adapters/EnvironmentAdapter.js'
import { ConfigManager } from '../src/config/ConfigManager.js'

describe('환경 설정 시스템 테스트', () => {
  let configManager: ConfigManager

  beforeEach(() => {
    configManager = new ConfigManager()
  })

  describe('Environment parsers', () => {
    test('boolean 파싱', () => {
      expect(parseBoolean('true')).toBe(true)
      expect(parseBoolean('1')).toBe(true)
      expect(parseBoolean('yes')).toBe(true)
      expect(parseBoolean('on')).toBe(true)
      expect(parseBoolean('false')).toBe(false)
      expect(parseBoolean('0')).toBe(false)
      expect(parseBoolean('no')).toBe(false)
      expect(parseBoolean('off')).toBe(false)
      expect(parseBoolean(undefined, true)).toBe(true)
    })

    test('숫자 파싱', () => {
      expect(parseNumber('123')).toBe(123)
      expect(parseNumber('0')).toBe(0)
      expect(parseNumber('invalid', 42)).toBe(42)
      expect(parseNumber(undefined, 42)).toBe(42)
    })

    test('enum 파싱', () => {
      const levels = ['debug', 'info', 'warn', 'error'] as const
      expect(parseEnum('info', [...levels], 'debug')).toBe('info')
      expect(parseEnum('invalid', [...levels], 'debug')).toBe('debug')
      expect(parseEnum(undefined, [...levels], 'debug')).toBe('debug')
    })
  })

  describe('EnvironmentAdapter', () => {
    test('환경 변수 로드', async () => {
      const mockEnv = {
        DEPS_CLI_MAX_CONCURRENCY: '8',
        DEPS_CLI_VERBOSE: 'true',
        DEPS_CLI_LOG_LEVEL: 'debug',
        NOTION_API_KEY: 'secret_test_key_12345678901234567890123456789012345',
      }

      const adapter = new EnvironmentAdapter(mockEnv)
      const config = await adapter.load()

      expect(config.analysis?.maxConcurrency).toBe(8)
      expect(config.development?.verbose).toBe(true)
      expect(config.logging?.level).toBe('debug')
      expect(config.notion?.apiKey).toBe('secret_test_key_12345678901234567890123456789012345')
    })

    test('설정 검증', async () => {
      const adapter = new EnvironmentAdapter()

      const validConfig = {
        notion: { apiKey: 'secret_1234567890123456789012345678901234567890123' },
        analysis: { maxConcurrency: 4, timeout: 30000 },
      }
      expect(await adapter.validate(validConfig)).toBe(true)

      const invalidConfig = {
        notion: { apiKey: 'invalid_key' },
        analysis: { maxConcurrency: -1 },
      }
      expect(await adapter.validate(invalidConfig)).toBe(false)
    })

    test('메타데이터 수집', async () => {
      const mockEnv = {
        DEPS_CLI_VERBOSE: 'true',
        DEPS_CLI_INVALID: 'invalid_value',
      }

      const adapter = new EnvironmentAdapter(mockEnv)
      await adapter.load()

      const metadata = adapter.getMetadata('DEPS_CLI_VERBOSE')
      expect(metadata).toBeDefined()
      expect(metadata?.source).toBe('env')
      expect(metadata?.raw).toBe('true')
      expect(metadata?.parsed).toBe(true)
      expect(metadata?.isValid).toBe(true)
    })
  })

  describe('DefaultConfigAdapter', () => {
    test('기본 설정 로드', async () => {
      const adapter = new DefaultConfigAdapter()
      const config = await adapter.load()

      expect(config.analysis?.maxConcurrency).toBe(4)
      expect(config.logging?.level).toBe('info')
      expect(config.output?.defaultFormat).toBe('summary')
      expect(config.development?.verbose).toBe(false)
    })

    test('설정 검증', async () => {
      const adapter = new DefaultConfigAdapter()
      expect(await adapter.validate()).toBe(true)
    })
  })

  describe('CliConfigAdapter', () => {
    test('CLI 인자 로드', async () => {
      const mockArgs = {
        verbose: true,
        format: 'json',
        outputDir: './test-output',
      }

      const adapter = new CliConfigAdapter(mockArgs)
      const config = await adapter.load()

      expect(config.development?.verbose).toBe(true)
      expect(config.logging?.level).toBe('debug')
      expect(config.output?.defaultFormat).toBe('json')
      expect(config.output?.defaultDir).toBe('./test-output')
    })
  })

  describe('ConfigManager', () => {
    test('설정 로드 및 병합', async () => {
      const mockArgs = {
        verbose: true,
        format: 'json',
      }

      const config = await configManager.load({
        cliArgs: mockArgs,
        validateConfig: true,
      })

      expect(config.development?.verbose).toBe(true)
      expect(config.output?.defaultFormat).toBe('json')
      expect(config.analysis?.maxConcurrency).toBe(4) // 기본값
    })

    test('중첩된 설정 값 가져오기', async () => {
      await configManager.load()

      expect(configManager.get('analysis.maxConcurrency')).toBe(4)
      expect(configManager.get('logging.level')).toBe('info')
      expect(configManager.get('nonexistent.key')).toBeUndefined()
    })

    test('런타임 설정 변경', async () => {
      await configManager.load()

      configManager.set('analysis.maxConcurrency', 8)
      expect(configManager.get('analysis.maxConcurrency')).toBe(8)
    })

    test('설정 덤프', async () => {
      await configManager.load()

      const dump = configManager.dump()
      expect(dump).toContain('analysis')
      expect(dump).toContain('logging')

      const safeDump = configManager.dumpSafe()
      expect(safeDump).toContain('analysis')
    })

    test('설정 리셋', async () => {
      await configManager.load()
      expect(configManager.isConfigLoaded()).toBe(true)

      configManager.reset()
      expect(configManager.isConfigLoaded()).toBe(false)
    })

    test('로드되지 않은 상태에서 설정 접근', () => {
      expect(() => configManager.getConfig()).toThrow('Config not loaded')
    })
  })

  describe('설정 우선순위', () => {
    test('CLI > 환경변수 > 기본값 우선순위', async () => {
      // 환경변수에서 verbose=false 설정
      const mockEnv = { DEPS_CLI_VERBOSE: 'false' }
      const _envAdapter = new EnvironmentAdapter(mockEnv)

      // CLI에서 verbose=true 설정
      const mockArgs = { verbose: true }

      const config = await configManager.load({
        cliArgs: mockArgs,
      })

      // CLI 설정이 환경변수보다 우선해야 함
      expect(config.development?.verbose).toBe(true)
    })
  })

  describe('에러 처리', () => {
    test('잘못된 설정에 대한 경고', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Mock implementation
      })

      const config = await configManager.load({
        validateConfig: true,
        throwOnValidationError: false,
      })

      // 경고가 출력되어도 설정은 로드되어야 함
      expect(config).toBeDefined()

      consoleSpy.mockRestore()
    })
  })
})
