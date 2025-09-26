import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { ConfigManager } from '../src/config/ConfigManager.js'
import type { ProjectConfig } from '../src/types/ProjectConfig.js'

describe('ConfigManager', () => {
  let configManager: ConfigManager
  let testProjectPath: string
  let testConfigPath: string

  beforeEach(() => {
    testProjectPath = join(process.cwd(), 'test-config-project')
    testConfigPath = join(testProjectPath, 'deps-cli.config.json')

    // 테스트 프로젝트 디렉토리 생성
    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true })
    }

    configManager = new ConfigManager()
  })

  afterEach(() => {
    // 테스트 후 정리
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  describe('기본 기능 테스트', () => {
    it('ConfigManager 인스턴스가 생성되어야 함', () => {
      expect(configManager).toBeDefined()
      expect(configManager).toBeInstanceOf(ConfigManager)
    })

    it('load가 설정을 로드해야 함', async () => {
      await configManager.load(testProjectPath)

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })
  })

  describe('설정 파일 처리 테스트', () => {
    it('존재하지 않는 설정 파일의 경우 정상적으로 로드해야 함', async () => {
      await configManager.load(testProjectPath)

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })

    it('유효한 설정 파일을 로드할 수 있어야 함', async () => {
      const testConfig = {
        analysis: {
          enableUnusedFileDetection: true,
          enableUnusedMethodDetection: false
        }
      }

      writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2))

      await configManager.load(testProjectPath)

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })

    it('잘못된 JSON 형식의 설정 파일을 처리할 수 있어야 함', async () => {
      writeFileSync(testConfigPath, '{ invalid json }')

      await configManager.load(testProjectPath)

      // 잘못된 JSON인 경우에도 로드되어야 함 (폴백 사용)
      expect(configManager.isConfigLoaded()).toBe(true)
    })
  })

  describe('설정 검증 및 관리 테스트', () => {
    it('get과 set 메서드가 작동해야 함', async () => {
      await configManager.load(testProjectPath)

      const testValue = { enableUnusedFileDetection: false }
      configManager.set('analysis', testValue)

      const retrievedValue = configManager.get('analysis')
      expect(retrievedValue).toEqual(testValue)
    })

    it('reset 메서드가 설정을 초기화해야 함', async () => {
      await configManager.load(testProjectPath)
      expect(configManager.isConfigLoaded()).toBe(true)

      configManager.reset()
      expect(configManager.isConfigLoaded()).toBe(false)
    })
  })

  describe('캐시 및 유틸리티 테스트', () => {
    it('getCacheStats가 캐시 통계를 반환해야 함', async () => {
      await configManager.load(testProjectPath)

      const stats = configManager.getCacheStats()
      expect(stats).toBeDefined()
      expect(typeof stats).toBe('object')
    })

    it('cleanupCache가 정상 작동해야 함', () => {
      configManager.cleanupCache()
      expect(true).toBe(true) // 에러가 발생하지 않으면 성공
    })

    it('dump와 dumpSafe 메서드가 작동해야 함', async () => {
      await configManager.load(testProjectPath)

      const dump = configManager.dump()
      expect(dump).toBeDefined()

      const safeDump = configManager.dumpSafe()
      expect(safeDump).toBeDefined()
    })
  })

  describe('진단 기능 테스트', () => {
    it('diagnose 메서드가 작동해야 함', async () => {
      await configManager.load(testProjectPath)

      const diagnosis = await configManager.diagnose()
      expect(diagnosis).toBeDefined()
      expect(typeof diagnosis).toBe('object')
    })

    it('autoRecover 메서드가 작동해야 함', async () => {
      const recovered = await configManager.autoRecover(testProjectPath)
      expect(recovered).toBeDefined()
      expect(typeof recovered).toBe('object')
    })
  })

  describe('정적 메서드 테스트', () => {
    it('getInstance가 싱글톤 인스턴스를 반환해야 함', () => {
      const instance1 = ConfigManager.getInstance()
      const instance2 = ConfigManager.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(ConfigManager)
    })
  })
})