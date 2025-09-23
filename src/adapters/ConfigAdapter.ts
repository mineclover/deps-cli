/**
 * 설정 어댑터 인터페이스 및 구현체들
 */

import { EnvironmentConfig, ConfigMetadata, ConfigSource } from '../types/EnvironmentConfig.js'

/**
 * 설정 어댑터 인터페이스
 */
export interface ConfigAdapter {
  /**
   * 설정 로드
   */
  load(): Promise<Partial<EnvironmentConfig>>

  /**
   * 설정 검증
   */
  validate(config: Partial<EnvironmentConfig>): Promise<boolean>

  /**
   * 설정 소스 타입
   */
  getSource(): ConfigSource

  /**
   * 설정 메타데이터 제공
   */
  getMetadata?(key: string): ConfigMetadata | undefined
}

/**
 * 기본 설정 어댑터 (기본값 제공)
 */
export class DefaultConfigAdapter implements ConfigAdapter {
  private readonly defaultConfig: EnvironmentConfig = {
    analysis: {
      maxConcurrency: 4,
      timeout: 30000,
      cacheEnabled: true,
      cacheTtl: 3600000 // 1시간
    },
    logging: {
      level: 'info',
      format: 'text',
      enabled: true
    },
    output: {
      defaultFormat: 'summary',
      compression: false
    },
    development: {
      verbose: false,
      debugMode: false,
      mockApiCalls: false
    }
  }

  async load(): Promise<Partial<EnvironmentConfig>> {
    return this.defaultConfig
  }

  async validate(): Promise<boolean> {
    return true
  }

  getSource(): ConfigSource {
    return 'default'
  }
}

/**
 * 파일 기반 설정 어댑터
 */
export class FileConfigAdapter implements ConfigAdapter {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Partial<EnvironmentConfig>> {
    try {
      const fs = await import('node:fs/promises')
      const content = await fs.readFile(this.filePath, 'utf-8')

      if (this.filePath.endsWith('.json')) {
        return JSON.parse(content)
      }

      // 다른 형식 지원 (YAML, TOML 등) 시 확장 가능
      throw new Error(`Unsupported file format: ${this.filePath}`)
    } catch (error) {
      console.warn(`Failed to load config from ${this.filePath}:`, error)
      return {}
    }
  }

  async validate(config: Partial<EnvironmentConfig>): Promise<boolean> {
    // 기본적인 검증 로직
    try {
      if (config.notion?.apiKey && typeof config.notion.apiKey !== 'string') {
        return false
      }
      if (config.analysis?.maxConcurrency &&
          (typeof config.analysis.maxConcurrency !== 'number' || config.analysis.maxConcurrency < 1)) {
        return false
      }
      return true
    } catch {
      return false
    }
  }

  getSource(): ConfigSource {
    return 'file'
  }
}

/**
 * CLI 인자 기반 설정 어댑터
 */
export class CliConfigAdapter implements ConfigAdapter {
  constructor(private readonly args: Record<string, any>) {}

  async load(): Promise<Partial<EnvironmentConfig>> {
    const config: Partial<EnvironmentConfig> = {}

    // CLI 옵션을 설정으로 매핑
    if (this.args.verbose) {
      config.development = { ...config.development, verbose: true }
      config.logging = { ...config.logging, level: 'debug' }
    }

    if (this.args.format) {
      config.output = { ...config.output, defaultFormat: this.args.format }
    }

    if (this.args.outputDir) {
      config.output = { ...config.output, defaultDir: this.args.outputDir }
    }

    return config
  }

  async validate(): Promise<boolean> {
    return true
  }

  getSource(): ConfigSource {
    return 'cli'
  }
}