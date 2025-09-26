import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
// import * as fs from 'node:fs/promises' // unused
import { join } from 'path'
import { ConfigManager } from '../src/config/ConfigManager.js'
import type { NamespacedConfig } from '../src/types/EnvironmentConfig.js'

describe('Namespace Integration Tests', () => {
  let configManager: ConfigManager
  let testProjectPath: string
  let testConfigPath: string

  beforeEach(() => {
    testProjectPath = join(process.cwd(), 'test-namespace-integration')
    testConfigPath = join(testProjectPath, 'deps-cli.config.json')

    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true })
    }

    configManager = new ConfigManager()
  })

  afterEach(() => {
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  describe('Complex namespace scenarios', () => {
    it('다중 환경 설정을 올바르게 처리해야 함', async () => {
      const complexConfig: NamespacedConfig = {
        namespaces: {
          development: {
            analysis: {
              maxConcurrency: 8,
              timeout: 60000,
              cacheEnabled: true,
              cacheTtl: 3600
            },
            logging: {
              level: 'debug',
              format: 'json',
              enabled: true
            },
            output: {
              defaultFormat: 'json',
              defaultDir: './dev-output',
              compression: false
            },
            development: {
              verbose: true,
              debugMode: true,
              mockApiCalls: false
            }
          },
          production: {
            analysis: {
              maxConcurrency: 4,
              timeout: 30000,
              cacheEnabled: true,
              cacheTtl: 7200
            },
            logging: {
              level: 'warn',
              format: 'text',
              enabled: true
            },
            output: {
              defaultFormat: 'summary',
              defaultDir: './output',
              compression: true
            },
            development: {
              verbose: false,
              debugMode: false,
              mockApiCalls: false
            }
          },
          testing: {
            analysis: {
              maxConcurrency: 2,
              timeout: 15000,
              cacheEnabled: false,
              cacheTtl: 0
            },
            logging: {
              level: 'info',
              format: 'text',
              enabled: true
            },
            output: {
              defaultFormat: 'json',
              defaultDir: './test-output',
              compression: false
            },
            development: {
              verbose: true,
              debugMode: false,
              mockApiCalls: true
            }
          },
          staging: {
            analysis: {
              maxConcurrency: 6,
              timeout: 45000,
              cacheEnabled: true,
              cacheTtl: 5400
            },
            logging: {
              level: 'info',
              format: 'json',
              enabled: true
            },
            output: {
              defaultFormat: 'summary',
              defaultDir: './staging-output',
              compression: true
            },
            development: {
              verbose: false,
              debugMode: true,
              mockApiCalls: false
            }
          }
        },
        default: 'development',
        _metadata: {
          created: {
            source: 'test',
            raw: 'Complex namespace configuration',
            parsed: 'Test configuration with multiple environments',
            isValid: true,
            timestamp: new Date().toISOString()
          }
        }
      }

      writeFileSync(testConfigPath, JSON.stringify(complexConfig, null, 2))

      // 각 namespace 테스트
      const environments = ['development', 'production', 'testing', 'staging']

      for (const env of environments) {
        const config = await configManager.loadNamespacedConfig(testConfigPath, env)

        expect(config).toBeDefined()
        expect(config.analysis).toBeDefined()
        expect(config.logging).toBeDefined()
        expect(config.output).toBeDefined()
        expect(config.development).toBeDefined()
        expect(config._metadata?.['namespace.selected']).toBeDefined()

        // 환경별 특정 값 검증
        const expectedValues = {
          development: { maxConcurrency: 8, logLevel: 'debug', verbose: true },
          production: { maxConcurrency: 4, logLevel: 'warn', verbose: false },
          testing: { maxConcurrency: 2, logLevel: 'info', verbose: true },
          staging: { maxConcurrency: 6, logLevel: 'info', verbose: false }
        }

        const expected = expectedValues[env as keyof typeof expectedValues]
        expect(config.analysis?.maxConcurrency).toBe(expected.maxConcurrency)
        expect(config.logging?.level).toBe(expected.logLevel)
        expect(config.development?.verbose).toBe(expected.verbose)
      }
    })

    it('namespace 상속 및 오버라이드를 시뮬레이션해야 함', async () => {
      // 기본 설정
      const baseConfig = {
        analysis: { maxConcurrency: 4, timeout: 30000 },
        logging: { level: 'info', format: 'text', enabled: true },
        output: { defaultFormat: 'summary', compression: false },
        development: { verbose: false, debugMode: false, mockApiCalls: false }
      }

      // 첫 번째 namespace 생성
      await configManager.setNamespaceConfig('base', baseConfig, testConfigPath)

      // 기본 설정을 로드하고 수정하여 새 namespace 생성
      const baseLoaded = await configManager.loadNamespacedConfig(testConfigPath, 'base')
      const extendedConfig = {
        ...baseLoaded,
        analysis: {
          ...baseLoaded.analysis,
          maxConcurrency: 8,
          cacheEnabled: true
        },
        development: {
          ...baseLoaded.development,
          verbose: true,
          debugMode: true
        }
      }

      delete (extendedConfig as any)._metadata
      await configManager.setNamespaceConfig('extended', extendedConfig, testConfigPath)

      // 확장된 설정 검증
      const finalConfig = await configManager.loadNamespacedConfig(testConfigPath, 'extended')

      expect(finalConfig.analysis?.maxConcurrency).toBe(8)
      expect(finalConfig.analysis?.timeout).toBe(30000) // 기본값 유지
      expect(finalConfig.development?.verbose).toBe(true)
      expect(finalConfig.development?.debugMode).toBe(true)
      expect(finalConfig.logging?.level).toBe('info') // 기본값 유지
    })

    it('namespace 간 이동 및 migration을 시뮬레이션해야 함', async () => {
      // v1 namespace (기존 형식)
      const v1Config = {
        analysis: { maxConcurrency: 4 },
        logging: { level: 'info' }
      }

      await configManager.setNamespaceConfig('v1', v1Config, testConfigPath)

      // v1 설정을 로드하여 v2로 마이그레이션
      const loadedV1 = await configManager.loadNamespacedConfig(testConfigPath, 'v1')
      const v2Config = {
        ...loadedV1,
        analysis: {
          ...loadedV1.analysis,
          timeout: 30000,
          cacheEnabled: true,
          cacheTtl: 3600
        },
        output: {
          defaultFormat: 'json' as const,
          defaultDir: './output',
          compression: false
        },
        development: {
          verbose: false,
          debugMode: false,
          mockApiCalls: false
        }
      }

      delete (v2Config as any)._metadata
      await configManager.setNamespaceConfig('v2', v2Config, testConfigPath)

      // v1 삭제
      await configManager.deleteNamespace('v1', testConfigPath)

      // v2 설정 확인
      const finalV2 = await configManager.loadNamespacedConfig(testConfigPath, 'v2')

      expect(finalV2.analysis?.maxConcurrency).toBe(4) // 마이그레이션됨
      expect(finalV2.analysis?.timeout).toBe(30000) // 새로 추가됨
      expect(finalV2.output?.defaultFormat).toBe('json') // 새로 추가됨
      expect(finalV2.development?.verbose).toBe(false) // 새로 추가됨

      // v1이 더 이상 존재하지 않음을 확인
      const namespaces = await configManager.listNamespaces(testConfigPath)
      expect(namespaces.namespaces).not.toContain('v1')
      expect(namespaces.namespaces).toContain('v2')
    })

    it('대용량 namespace 설정을 처리해야 함', async () => {
      const largeConfig: NamespacedConfig = {
        namespaces: {},
        default: 'env_1'
      }

      // 50개의 namespace 생성
      for (let i = 1; i <= 50; i++) {
        largeConfig.namespaces[`env_${i}`] = {
          analysis: {
            maxConcurrency: i % 10 + 1,
            timeout: (i % 5 + 1) * 10000,
            cacheEnabled: i % 2 === 0,
            cacheTtl: i * 100
          },
          logging: {
            level: ['debug', 'info', 'warn', 'error'][i % 4] as any,
            format: i % 2 === 0 ? 'json' : 'text',
            enabled: true
          },
          output: {
            defaultFormat: i % 2 === 0 ? 'json' : 'summary',
            defaultDir: `./output_${i}`,
            compression: i % 3 === 0
          },
          development: {
            verbose: i % 2 === 0,
            debugMode: i % 4 === 0,
            mockApiCalls: i % 5 === 0
          }
        }
      }

      writeFileSync(testConfigPath, JSON.stringify(largeConfig, null, 2))

      // 모든 namespace 나열
      const namespaces = await configManager.listNamespaces(testConfigPath)
      expect(namespaces.namespaces).toHaveLength(50)
      expect(namespaces.default).toBe('env_1')

      // 몇 개의 랜덤 namespace 테스트
      const testEnvs = ['env_1', 'env_25', 'env_50']

      for (const env of testEnvs) {
        const config = await configManager.loadNamespacedConfig(testConfigPath, env)
        expect(config).toBeDefined()
        expect(config.analysis).toBeDefined()
        expect(config.logging).toBeDefined()
        expect(config.output).toBeDefined()
        expect(config.development).toBeDefined()
      }

      // 성능 테스트: 모든 namespace 로드
      const startTime = Date.now()
      for (let i = 1; i <= 50; i++) {
        await configManager.loadNamespacedConfig(testConfigPath, `env_${i}`)
      }
      const endTime = Date.now()

      // 50개 namespace 로드가 5초 이내에 완료되어야 함
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('잘못된 namespace 설정을 복구해야 함', async () => {
      // 유효한 설정으로 시작
      const validConfig: NamespacedConfig = {
        namespaces: {
          valid: {
            analysis: { maxConcurrency: 4 },
            logging: { level: 'info', enabled: true }
          }
        },
        default: 'valid'
      }

      writeFileSync(testConfigPath, JSON.stringify(validConfig, null, 2))

      // 설정을 손상시킴
      const corruptedConfig = {
        namespaces: {
          valid: {
            analysis: { maxConcurrency: 4 },
            logging: { level: 'info', enabled: true }
          },
          corrupted: {
            // 불완전한 설정
            analysis: null,
            logging: undefined
          }
        },
        default: 'corrupted' // 손상된 namespace를 기본으로 설정
      }

      writeFileSync(testConfigPath, JSON.stringify(corruptedConfig, null, 2))

      // 손상된 namespace를 로드하려고 시도
      try {
        await configManager.loadNamespacedConfig(testConfigPath, 'corrupted')
        // 에러가 발생하지 않으면 fallback이 작동한 것
      } catch (error) {
        // 에러가 발생하면 복구 시도
        const config = await configManager.loadNamespacedConfig(testConfigPath, 'valid')
        expect(config).toBeDefined()
        expect(config.analysis?.maxConcurrency).toBe(4)
      }

      // 유효한 namespace는 여전히 작동해야 함
      const validConfigLoaded = await configManager.loadNamespacedConfig(testConfigPath, 'valid')
      expect(validConfigLoaded).toBeDefined()
      expect(validConfigLoaded.analysis?.maxConcurrency).toBe(4)
    })

    it('동시 namespace 작업을 처리해야 함', async () => {
      const concurrentTasks: Array<Promise<any>> = []

      // 여러 namespace를 동시에 생성
      for (let i = 1; i <= 10; i++) {
        const config = {
          analysis: { maxConcurrency: i },
          logging: { level: 'info' }
        }

        concurrentTasks.push(
          configManager.setNamespaceConfig(`concurrent_${i}`, config, testConfigPath)
        )
      }

      // 모든 작업이 성공적으로 완료되어야 함
      await Promise.all(concurrentTasks)

      // 생성된 namespace들 확인
      const namespaces = await configManager.listNamespaces(testConfigPath)
      expect(namespaces.namespaces).toHaveLength(10)

      // 각 namespace 로드 테스트
      const loadTasks: Array<Promise<any>> = []
      for (let i = 1; i <= 10; i++) {
        loadTasks.push(
          configManager.loadNamespacedConfig(testConfigPath, `concurrent_${i}`)
        )
      }

      const loadedConfigs = await Promise.all(loadTasks)

      loadedConfigs.forEach((config, index) => {
        expect(config).toBeDefined()
        expect(config.analysis?.maxConcurrency).toBe(index + 1)
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('빈 namespace 이름을 처리해야 함', async () => {
      await expect(
        configManager.setNamespaceConfig('', { analysis: { maxConcurrency: 4 } }, testConfigPath)
      ).rejects.toThrow()
    })

    it('매우 긴 namespace 이름을 처리해야 함', async () => {
      const longName = 'a'.repeat(1000)
      const config = { analysis: { maxConcurrency: 4 } }

      await configManager.setNamespaceConfig(longName, config, testConfigPath)

      const loaded = await configManager.loadNamespacedConfig(testConfigPath, longName)
      expect(loaded.analysis?.maxConcurrency).toBe(4)
    })

    it('특수 문자가 포함된 namespace 이름을 처리해야 함', async () => {
      const specialNames = ['test-env', 'test_env', 'test.env', 'test@env']

      for (const name of specialNames) {
        const config = { analysis: { maxConcurrency: 4 } }
        await configManager.setNamespaceConfig(name, config, testConfigPath)

        const loaded = await configManager.loadNamespacedConfig(testConfigPath, name)
        expect(loaded.analysis?.maxConcurrency).toBe(4)
      }
    })

    it('깊게 중첩된 설정을 처리해야 함', async () => {
      const deepConfig = {
        analysis: {
          advanced: {
            performance: {
              optimization: {
                level: 'high',
                strategies: ['parallel', 'cache', 'memoization']
              }
            }
          }
        }
      }

      await configManager.setNamespaceConfig('deep', deepConfig, testConfigPath)

      const loaded = await configManager.loadNamespacedConfig(testConfigPath, 'deep')
      expect((loaded as any).analysis.advanced.performance.optimization.level).toBe('high')
    })

    it('순환 참조를 방지해야 함', async () => {
      const configWithCircular: any = {
        analysis: { maxConcurrency: 4 }
      }

      // 순환 참조 생성
      configWithCircular.self = configWithCircular

      // JSON.stringify가 순환 참조를 처리할 수 없으므로 에러가 발생해야 함
      await expect(
        configManager.setNamespaceConfig('circular', configWithCircular, testConfigPath)
      ).rejects.toThrow()
    })
  })
})