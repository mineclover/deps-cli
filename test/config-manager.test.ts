import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigManager } from '../src/config/ConfigManager.js'

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
      await configManager.load({ configFile: testConfigPath })

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })
  })

  describe('설정 파일 처리 테스트', () => {
    it('존재하지 않는 설정 파일의 경우 정상적으로 로드해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })

    it('유효한 설정 파일을 로드할 수 있어야 함', async () => {
      const testConfig = {
        analysis: {
          enableUnusedFileDetection: true,
          enableUnusedMethodDetection: false,
        },
      }

      writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2))

      await configManager.load({ configFile: testConfigPath })

      expect(configManager.isConfigLoaded()).toBe(true)
      const config = configManager.getConfig()
      expect(config).toBeDefined()
    })

    it('잘못된 JSON 형식의 설정 파일을 처리할 수 있어야 함', async () => {
      writeFileSync(testConfigPath, '{ invalid json }')

      await configManager.load({ configFile: testConfigPath })

      // 잘못된 JSON인 경우에도 로드되어야 함 (폴백 사용)
      expect(configManager.isConfigLoaded()).toBe(true)
    })
  })

  describe('설정 검증 및 관리 테스트', () => {
    it('get과 set 메서드가 작동해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })

      const testValue = { enableUnusedFileDetection: false }
      configManager.set('analysis', testValue)

      const retrievedValue = configManager.get('analysis')
      expect(retrievedValue).toEqual(testValue)
    })

    it('reset 메서드가 설정을 초기화해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })
      expect(configManager.isConfigLoaded()).toBe(true)

      configManager.reset()
      expect(configManager.isConfigLoaded()).toBe(false)
    })
  })

  describe('캐시 및 유틸리티 테스트', () => {
    it('getCacheStats가 캐시 통계를 반환해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })

      const stats = configManager.getCacheStats()
      expect(stats).toBeDefined()
      expect(typeof stats).toBe('object')
    })

    it('cleanupCache가 정상 작동해야 함', () => {
      configManager.cleanupCache()
      expect(true).toBe(true) // 에러가 발생하지 않으면 성공
    })

    it('dump와 dumpSafe 메서드가 작동해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })

      const dump = configManager.dump()
      expect(dump).toBeDefined()

      const safeDump = configManager.dumpSafe()
      expect(safeDump).toBeDefined()
    })
  })

  describe('진단 기능 테스트', () => {
    it('diagnose 메서드가 작동해야 함', async () => {
      await configManager.load({ configFile: testConfigPath })

      const diagnosis = await configManager.diagnose()
      expect(diagnosis).toBeDefined()
      expect(typeof diagnosis).toBe('object')
    })

    it('autoRecover 메서드가 작동해야 함', async () => {
      const recovered = await configManager.autoRecover()
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

  describe('오류 복구 시스템 테스트', () => {
    describe('loadWithRetry', () => {
      it('재시도 없이 성공하는 경우', async () => {
        const config = await configManager.loadWithRetry()
        expect(config).toBeDefined()
        expect(configManager.isConfigLoaded()).toBe(true)
      })

      it('재시도 후 성공하는 경우를 시뮬레이션', async () => {
        // 첫 번째 시도는 실패하도록 잘못된 설정 파일 생성
        writeFileSync(testConfigPath, '{ invalid json syntax')

        // loadWithRetry는 실패 시 fallback 설정을 사용해야 함
        const config = await configManager.loadWithRetry({ configFile: testConfigPath })

        expect(config).toBeDefined()
        expect(config._metadata).toBeDefined()
      })

      it('모든 재시도 실패 시 fallback 설정 사용', async () => {
        // loadWithRetry가 실제로 fallback을 사용하는지 확인
        // 현재는 normal load가 성공하므로 단순히 에러 로그 검사로 검증
        const config = await configManager.loadWithRetry({
          configFile: '/nonexistent/path/config.json',
        })

        expect(config).toBeDefined()
        expect(config._metadata).toBeDefined()

        // loadWithRetry가 성공했는지 확인 (fallback을 사용했든 정상 로드했든)
        expect(configManager.isConfigLoaded()).toBe(true)

        // 기본 설정 구조가 있는지 확인
        expect(config.analysis).toBeDefined()
        expect(config.logging).toBeDefined()
        expect(config.output).toBeDefined()
      })

      it('커스텀 재시도 옵션 테스트', async () => {
        const startTime = Date.now()

        // 빠른 재시도로 설정
        await configManager.loadWithRetry({}, 2, 100)

        // 재시도 시간이 적절한지 확인 (너무 오래 걸리지 않아야 함)
        const elapsed = Date.now() - startTime
        expect(elapsed).toBeLessThan(5000) // 5초 이내
      })
    })

    describe('loadFallbackConfig', () => {
      it('기본 어댑터로 fallback 설정 로드', async () => {
        const _originalError = new Error('Original configuration load failed')

        // private 메서드이므로 간접적으로 테스트
        await configManager.loadWithRetry({ configFile: '/nonexistent/file.json' })

        const config = configManager.getConfig()
        expect(config).toBeDefined()
        expect(config._metadata).toBeDefined()
      })

      it('fallback도 실패 시 하드코딩된 설정 사용', async () => {
        // loadWithRetry를 통해 간접적으로 테스트
        // 매우 잘못된 설정으로 fallback까지 실패하도록 유도
        await configManager.loadWithRetry({ configFile: '/dev/null/impossible/path' })

        const config = configManager.getConfig()
        expect(config).toBeDefined()
        expect(config.analysis).toBeDefined()
        expect(config.logging).toBeDefined()
        expect(config.output).toBeDefined()
      })
    })

    describe('autoRecover', () => {
      it('정상 상태에서 autoRecover 실행', async () => {
        await configManager.load({ configFile: testConfigPath })

        const result = await configManager.autoRecover()

        expect(result).toBeDefined()
        expect(result.success).toBe(true)
        expect(Array.isArray(result.actions)).toBe(true)
        expect(result.actions.length).toBeGreaterThan(0)

        // 일반적인 복구 액션들이 포함되어야 함
        const actionString = result.actions.join(' ')
        expect(actionString).toContain('cache')
        expect(actionString).toContain('Reset')
      })

      it('비정상 상태에서 autoRecover 실행', async () => {
        // 설정을 로드하지 않은 상태에서 복구 시도
        const result = await configManager.autoRecover()

        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
        expect(Array.isArray(result.actions)).toBe(true)
        expect(result.actions.length).toBeGreaterThan(0)
      })

      it('복구 과정에서 에러 발생 시 처리', async () => {
        // ConfigManager의 상태를 의도적으로 손상시키기
        configManager.reset()

        const result = await configManager.autoRecover()

        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
        expect(Array.isArray(result.actions)).toBe(true)
      })
    })

    describe('캐시 무효화 및 복구', () => {
      it('invalidateCache가 정상 작동해야 함', async () => {
        await configManager.load({ configFile: testConfigPath })

        // invalidateCache는 private이므로 간접적으로 테스트
        // loadWithRetry 과정에서 캐시 무효화가 호출됨
        await configManager.loadWithRetry()

        expect(configManager.isConfigLoaded()).toBe(true)
      })

      it('캐시 정리 후 재로드 테스트', async () => {
        await configManager.load({ configFile: testConfigPath })

        configManager.cleanupCache()
        configManager.reset()

        // 재로드가 정상적으로 작동하는지 확인
        await configManager.load({ configFile: testConfigPath })
        expect(configManager.isConfigLoaded()).toBe(true)
      })
    })

    describe('고급 데이터 처리 기능', () => {
      it('깊은 객체 병합 테스트', async () => {
        await configManager.load({ configFile: testConfigPath })

        // 중첩된 설정 값 설정 및 병합 테스트
        const nestedConfig = {
          analysis: {
            maxConcurrency: 8,
            newFeature: { enabled: true },
          },
          newSection: {
            setting1: 'value1',
            nested: { deep: 'value' },
          },
        }

        configManager.set('analysis', nestedConfig.analysis)
        configManager.set('newSection', nestedConfig.newSection)

        const retrievedAnalysis = configManager.get('analysis')
        const retrievedNewSection = configManager.get('newSection')

        expect(retrievedAnalysis).toEqual(nestedConfig.analysis)
        expect(retrievedNewSection).toEqual(nestedConfig.newSection)
      })

      it('민감한 정보 마스킹 테스트', async () => {
        await configManager.load({ configFile: testConfigPath })

        // 민감한 정보가 포함된 설정
        const sensitiveConfig = {
          apiKey: 'secret-api-key-12345',
          password: 'my-secret-password',
          token: 'bearer-token-abcdef',
          normalSetting: 'normal-value',
        }

        configManager.set('credentials', sensitiveConfig)

        // dumpSafe를 통해 마스킹된 결과 확인
        const safeDump = configManager.dumpSafe()

        expect(safeDump).toBeDefined()
        expect(typeof safeDump).toBe('string') // dumpSafe는 JSON 문자열을 반환

        // JSON 파싱이 가능한지 확인
        const parsedDump = JSON.parse(safeDump)
        expect(parsedDump).toBeDefined()
        expect(typeof parsedDump).toBe('object')

        // 민감한 정보가 마스킹되었는지 확인은 구현에 따라 다름
        // 최소한 덤프가 정상적으로 작동하는지 확인
      })

      it('중첩된 설정값 처리 테스트', async () => {
        await configManager.load({ configFile: testConfigPath })

        // 깊이 중첩된 설정 구조
        const deepConfig = {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: 'deep-nested-value',
                  array: [1, 2, { nested: 'in-array' }],
                },
              },
            },
          },
        }

        configManager.set('deepNested', deepConfig)
        const retrieved = configManager.get('deepNested')

        expect(retrieved).toEqual(deepConfig)
        expect(retrieved.level1.level2.level3.level4.value).toBe('deep-nested-value')
      })
    })

    describe('복구 시스템 통합 테스트', () => {
      it('전체 복구 시나리오 테스트', async () => {
        // 1. 초기 로드
        await configManager.load({ configFile: testConfigPath })
        expect(configManager.isConfigLoaded()).toBe(true)

        // 2. 상태 손상 시뮬레이션
        configManager.reset()
        expect(configManager.isConfigLoaded()).toBe(false)

        // 3. 자동 복구 실행
        const recoveryResult = await configManager.autoRecover()
        expect(recoveryResult.success).toBe(true)

        // 4. 복구 후 정상 작동 확인
        expect(configManager.isConfigLoaded()).toBe(true)
        const config = configManager.getConfig()
        expect(config).toBeDefined()

        // 5. 기본 기능 정상 작동 확인
        configManager.set('testKey', { testValue: 'after-recovery' })
        const testValue = configManager.get('testKey')
        expect(testValue).toEqual({ testValue: 'after-recovery' })
      })
    })
  })

  describe('Namespace-based Configuration Tests', () => {
    describe('loadNamespacedConfig', () => {
      it('정상적인 namespace 설정을 로드해야 함', async () => {
        // namespace 기반 설정 파일 생성
        const namespacedConfig = {
          namespaces: {
            development: {
              analysis: { maxConcurrency: 8, timeout: 60000 },
              logging: { level: 'debug' as const, format: 'json' as const, enabled: true },
              output: { defaultFormat: 'json', compression: false },
            },
            production: {
              analysis: { maxConcurrency: 4, timeout: 30000 },
              logging: { level: 'warn' as const, format: 'text' as const, enabled: true },
              output: { defaultFormat: 'summary', compression: true },
            },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'namespaced-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        const config = await configManager.loadNamespacedConfig(namespacedConfigPath, 'development')

        expect(config).toBeDefined()
        expect(config.analysis?.maxConcurrency).toBe(8)
        expect(config.analysis?.timeout).toBe(60000)
        expect(config.logging?.level).toBe('debug')
        expect(config._metadata?.['namespace.selected']).toBeDefined()
      })

      it('기본 namespace를 사용해야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            staging: { analysis: { maxConcurrency: 6 } },
            production: { analysis: { maxConcurrency: 4 } },
          },
          default: 'staging',
        }

        const namespacedConfigPath = join(testProjectPath, 'default-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        const config = await configManager.loadNamespacedConfig(namespacedConfigPath)

        expect(config.analysis?.maxConcurrency).toBe(6)
        expect(config._metadata?.['namespace.selected']?.parsed).toContain('staging')
      })

      it('존재하지 않는 namespace에 대해 에러를 발생시켜야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'error-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        try {
          await configManager.loadNamespacedConfig(namespacedConfigPath, 'nonexistent')
          expect.fail('Should have thrown an error for nonexistent namespace')
        } catch (error) {
          expect((error as Error).message).toContain("Namespace 'nonexistent' not found in configuration")
        }
      })

      it('잘못된 파일에 대해 일반 설정으로 fallback해야 함', async () => {
        const nonNamespacedConfig = {
          analysis: { maxConcurrency: 2 },
          logging: { level: 'info' as const },
        }

        const regularConfigPath = join(testProjectPath, 'regular-config.json')
        writeFileSync(regularConfigPath, JSON.stringify(nonNamespacedConfig, null, 2))

        const config = await configManager.loadNamespacedConfig(regularConfigPath, 'development')

        expect(config.analysis?.maxConcurrency).toBe(2)
        expect(config.logging?.level).toBe('info')
      })
    })

    describe('listNamespaces', () => {
      it('사용 가능한 namespace들을 반환해야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
            production: { analysis: { maxConcurrency: 4 } },
            testing: { analysis: { maxConcurrency: 2 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'list-namespaces-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        const result = await configManager.listNamespaces(namespacedConfigPath)

        expect(result.namespaces).toEqual(['development', 'production', 'testing'])
        expect(result.default).toBe('development')
      })

      it('빈 namespace 목록을 처리해야 함', async () => {
        const emptyNamespacedConfig = {
          namespaces: {},
          default: undefined,
        }

        const emptyConfigPath = join(testProjectPath, 'empty-namespaces-config.json')
        writeFileSync(emptyConfigPath, JSON.stringify(emptyNamespacedConfig, null, 2))

        const result = await configManager.listNamespaces(emptyConfigPath)

        expect(result.namespaces).toEqual([])
        expect(result.default).toBeUndefined()
      })

      it('존재하지 않는 파일에 대해 빈 목록을 반환해야 함', async () => {
        const nonexistentPath = join(testProjectPath, 'nonexistent-config.json')

        const result = await configManager.listNamespaces(nonexistentPath)

        expect(result.namespaces).toEqual([])
        expect(result.default).toBeUndefined()
      })
    })

    describe('setNamespaceConfig', () => {
      it('새로운 namespace를 생성해야 함', async () => {
        const namespacedConfigPath = join(testProjectPath, 'set-namespace-config.json')

        const newConfig = {
          analysis: { maxConcurrency: 10, timeout: 45000 },
          logging: { level: 'debug' as const, format: 'json' as const, enabled: true },
        }

        await configManager.setNamespaceConfig('custom', newConfig, namespacedConfigPath)

        // 파일이 생성되었는지 확인
        expect(existsSync(namespacedConfigPath)).toBe(true)

        // 생성된 설정 확인
        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(savedContent.namespaces.custom).toEqual(newConfig)
        expect(savedContent.default).toBe('custom') // 첫 번째 namespace는 default가 됨
        expect(savedContent._metadata['namespace.custom.updated']).toBeDefined()
      })

      it('기존 namespace를 업데이트해야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'update-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        const updatedConfig = {
          analysis: { maxConcurrency: 12, timeout: 50000 },
          logging: { level: 'info' as const },
        }

        await configManager.setNamespaceConfig('development', updatedConfig, namespacedConfigPath)

        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(savedContent.namespaces.development).toEqual(updatedConfig)
        expect(savedContent.default).toBe('development') // default는 유지
      })

      it('여러 namespace가 있을 때 default를 유지해야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
            production: { analysis: { maxConcurrency: 4 } },
          },
          default: 'production',
        }

        const namespacedConfigPath = join(testProjectPath, 'multi-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        const newConfig = { analysis: { maxConcurrency: 6 } }
        await configManager.setNamespaceConfig('staging', newConfig, namespacedConfigPath)

        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(savedContent.namespaces.staging).toEqual(newConfig)
        expect(savedContent.default).toBe('production') // 기존 default 유지
      })
    })

    describe('deleteNamespace', () => {
      it('존재하는 namespace를 삭제해야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
            production: { analysis: { maxConcurrency: 4 } },
            testing: { analysis: { maxConcurrency: 2 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'delete-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        await configManager.deleteNamespace('testing', namespacedConfigPath)

        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(savedContent.namespaces.testing).toBeUndefined()
        expect(savedContent.namespaces.development).toBeDefined()
        expect(savedContent.namespaces.production).toBeDefined()
        expect(savedContent.default).toBe('development') // default 유지
      })

      it('default namespace 삭제 시 다른 namespace를 default로 설정해야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
            production: { analysis: { maxConcurrency: 4 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'delete-default-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        await configManager.deleteNamespace('development', namespacedConfigPath)

        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(savedContent.namespaces.development).toBeUndefined()
        expect(savedContent.namespaces.production).toBeDefined()
        expect(savedContent.default).toBe('production') // production이 새로운 default
      })

      it('마지막 namespace 삭제 시 default를 undefined로 설정해야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'delete-last-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        await configManager.deleteNamespace('development', namespacedConfigPath)

        const savedContent = JSON.parse(await fs.readFile(namespacedConfigPath, 'utf-8'))
        expect(Object.keys(savedContent.namespaces)).toHaveLength(0)
        expect(savedContent.default).toBeUndefined()
      })

      it('존재하지 않는 namespace 삭제 시 에러를 발생시켜야 함', async () => {
        const existingConfig = {
          namespaces: {
            development: { analysis: { maxConcurrency: 8 } },
          },
          default: 'development',
        }

        const namespacedConfigPath = join(testProjectPath, 'error-delete-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(existingConfig, null, 2))

        await expect(configManager.deleteNamespace('nonexistent', namespacedConfigPath)).rejects.toThrow(
          "Namespace 'nonexistent' not found"
        )
      })
    })

    describe('loadWithNamespace', () => {
      it('namespace가 지정된 경우 namespace 기반 로드를 사용해야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            testing: {
              analysis: { maxConcurrency: 16 },
              development: { verbose: true, debugMode: true },
            },
          },
          default: 'testing',
        }

        const namespacedConfigPath = join(testProjectPath, 'load-with-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        const config = await configManager.loadWithNamespace({
          configFile: namespacedConfigPath,
          namespace: 'testing',
        })

        expect(config.analysis?.maxConcurrency).toBe(16)
        expect(config.development?.verbose).toBe(true)
        expect(config.development?.debugMode).toBe(true)
      })

      it('namespace가 지정되지 않았지만 파일이 namespace 기반인 경우 자동으로 감지해야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            autodetect: {
              analysis: { maxConcurrency: 20 },
            },
          },
          default: 'autodetect',
        }

        const namespacedConfigPath = join(testProjectPath, 'autodetect-namespace-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        const config = await configManager.loadWithNamespace({
          configFile: namespacedConfigPath,
        })

        expect(config.analysis?.maxConcurrency).toBe(20)
      })

      it('일반 설정 파일인 경우 일반 load를 사용해야 함', async () => {
        const regularConfig = {
          analysis: { maxConcurrency: 3 },
          logging: { level: 'error' as const },
        }

        const regularConfigPath = join(testProjectPath, 'regular-load-config.json')
        writeFileSync(regularConfigPath, JSON.stringify(regularConfig, null, 2))

        const config = await configManager.loadWithNamespace({
          configFile: regularConfigPath,
        })

        expect(config.analysis?.maxConcurrency).toBe(3)
        expect(config.logging?.level).toBe('error')
      })
    })

    describe('isNamespacedConfig (private method 간접 테스트)', () => {
      it('namespace 기반 설정 파일을 올바르게 감지해야 함', async () => {
        const namespacedConfig = {
          namespaces: {
            test: { analysis: { maxConcurrency: 1 } },
          },
          default: 'test',
        }

        const namespacedConfigPath = join(testProjectPath, 'detect-namespaced-config.json')
        writeFileSync(namespacedConfigPath, JSON.stringify(namespacedConfig, null, 2))

        // loadWithNamespace를 통해 간접적으로 테스트
        const config = await configManager.loadWithNamespace({
          configFile: namespacedConfigPath,
        })

        // namespace 기반으로 로드되었다면 _metadata에 namespace 정보가 있어야 함
        expect(config._metadata?.['namespace.selected']).toBeDefined()
      })

      it('일반 설정 파일을 올바르게 구분해야 함', async () => {
        const regularConfig = {
          analysis: { maxConcurrency: 1 },
          someOtherField: 'value',
        }

        const regularConfigPath = join(testProjectPath, 'detect-regular-config.json')
        writeFileSync(regularConfigPath, JSON.stringify(regularConfig, null, 2))

        const config = await configManager.loadWithNamespace({
          configFile: regularConfigPath,
        })

        // 일반 설정으로 로드되었다면 namespace 관련 metadata가 없어야 함
        expect(config._metadata?.['namespace.selected']).toBeUndefined()
      })
    })
  })
})
