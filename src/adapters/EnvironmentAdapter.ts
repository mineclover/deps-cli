/**
 * 환경 변수 기반 설정 어댑터
 */

import type {
  ConfigMetadata,
  ConfigSource,
  EnvironmentConfig,
  EnvironmentVariables,
} from '../types/EnvironmentConfig.js'
import type { ConfigAdapter } from './ConfigAdapter.js'

/**
 * 문자열을 boolean으로 변환
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue
  const lower = value.toLowerCase()
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on'
}

/**
 * 문자열을 숫자로 변환
 */
export function parseNumber(value: string | undefined, defaultValue: number = 0): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

/**
 * 문자열을 열거형 값으로 변환
 */
export function parseEnum<T extends string>(value: string | undefined, allowedValues: Array<T>, defaultValue: T): T {
  if (!value) return defaultValue
  const typedValue = value as T
  return allowedValues.includes(typedValue) ? typedValue : defaultValue
}

/**
 * 환경 변수 값의 유효성 검증
 */
export function validate(value: string | undefined, validator: (val: string) => boolean): boolean {
  if (!value) return true // undefined는 유효한 것으로 간주
  return validator(value)
}

/**
 * 환경 변수 어댑터
 */
export class EnvironmentAdapter implements ConfigAdapter {
  private metadata: Map<string, ConfigMetadata> = new Map()
  private validationErrors: Map<string, string> = new Map()

  constructor(private readonly env: EnvironmentVariables = process.env as any) {}

  async load(): Promise<Partial<EnvironmentConfig>> {
    const config: Partial<EnvironmentConfig> = {}

    // Notion API 설정
    config.notion = {
      apiKey: this.parseEnvVar('NOTION_API_KEY', this.env.NOTION_API_KEY),
      databaseId: this.parseEnvVar('NOTION_DATABASE_ID', this.env.NOTION_DATABASE_ID),
      pageId: this.parseEnvVar('NOTION_PAGE_ID', this.env.NOTION_PAGE_ID),
      version: this.parseEnvVar('NOTION_API_VERSION', this.env.NOTION_API_VERSION, '2022-06-28'),
    }

    // 분석 설정
    config.analysis = {
      maxConcurrency: this.parseNumberEnvVar('DEPS_CLI_MAX_CONCURRENCY', this.env.DEPS_CLI_MAX_CONCURRENCY, 4, {
        min: 1,
        max: 100,
      }),
      timeout: this.parseNumberEnvVar('DEPS_CLI_TIMEOUT', this.env.DEPS_CLI_TIMEOUT, 30000, { min: 1000, max: 300000 }),
      cacheEnabled: this.parseBooleanEnvVar('DEPS_CLI_CACHE_ENABLED', this.env.DEPS_CLI_CACHE_ENABLED, true),
      cacheTtl: this.parseNumberEnvVar(
        'DEPS_CLI_CACHE_TTL',
        this.env.DEPS_CLI_CACHE_TTL,
        3600000,
        { min: 60000, max: 86400000 } // 1분 ~ 24시간
      ),
    }

    // 로깅 설정
    config.logging = {
      level: this.parseEnumEnvVar(
        'DEPS_CLI_LOG_LEVEL',
        this.env.DEPS_CLI_LOG_LEVEL,
        ['debug', 'info', 'warn', 'error'],
        'info'
      ) as any,
      format: this.parseEnumEnvVar(
        'DEPS_CLI_LOG_FORMAT',
        this.env.DEPS_CLI_LOG_FORMAT,
        ['json', 'text'],
        'text'
      ) as any,
      enabled: this.parseBooleanEnvVar('DEPS_CLI_LOG_ENABLED', this.env.DEPS_CLI_LOG_ENABLED, true),
    }

    // 출력 설정
    config.output = {
      defaultFormat: this.parseEnumEnvVar(
        'DEPS_CLI_DEFAULT_FORMAT',
        this.env.DEPS_CLI_DEFAULT_FORMAT,
        ['json', 'summary'],
        'summary'
      ) as any,
      defaultDir: this.parsePathEnvVar('DEPS_CLI_DEFAULT_OUTPUT_DIR', this.env.DEPS_CLI_DEFAULT_OUTPUT_DIR),
      compression: this.parseBooleanEnvVar('DEPS_CLI_COMPRESSION', this.env.DEPS_CLI_COMPRESSION, false),
    }

    // 개발 환경 설정
    const nodeEnv = this.env.NODE_ENV || 'production'
    const isDevelopment = nodeEnv === 'development'

    config.development = {
      verbose: this.parseBooleanEnvVar('DEPS_CLI_VERBOSE', this.env.DEPS_CLI_VERBOSE, isDevelopment),
      debugMode: this.parseBooleanEnvVar('DEPS_CLI_DEBUG', this.env.DEPS_CLI_DEBUG || this.env.DEBUG, isDevelopment),
      mockApiCalls: this.parseBooleanEnvVar('DEPS_CLI_MOCK_API', this.env.DEPS_CLI_MOCK_API, false),
    }

    return config
  }

  async validate(config: Partial<EnvironmentConfig>): Promise<boolean> {
    let isValid = true
    this.validationErrors.clear()

    // Notion API 키 검증 (강화된 버전)
    if (config.notion?.apiKey) {
      const apiKeyValidation = this.validateNotionApiKey(config.notion.apiKey)
      if (!apiKeyValidation.isValid) {
        this.addValidationError('NOTION_API_KEY', apiKeyValidation.error!)
        isValid = false
      }
    }

    // Database ID 검증
    if (config.notion?.databaseId) {
      const dbIdValidation = this.validateNotionDatabaseId(config.notion.databaseId)
      if (!dbIdValidation.isValid) {
        this.addValidationError('NOTION_DATABASE_ID', dbIdValidation.error!)
        isValid = false
      }
    }

    // Page ID 검증
    if (config.notion?.pageId) {
      const pageIdValidation = this.validateNotionPageId(config.notion.pageId)
      if (!pageIdValidation.isValid) {
        this.addValidationError('NOTION_PAGE_ID', pageIdValidation.error!)
        isValid = false
      }
    }

    // 숫자 값 검증은 이미 파싱 단계에서 처리됨
    // 추가적인 비즈니스 로직 검증
    if (config.analysis?.cacheTtl && config.analysis?.timeout) {
      if (config.analysis.cacheTtl < config.analysis.timeout) {
        this.addValidationError('DEPS_CLI_CACHE_TTL', 'Cache TTL should be greater than timeout')
        isValid = false
      }
    }

    // 출력 디렉토리 검증
    if (config.output?.defaultDir) {
      const pathValidation = this.validatePath(config.output.defaultDir)
      if (!pathValidation.isValid) {
        this.addValidationError('DEPS_CLI_DEFAULT_OUTPUT_DIR', pathValidation.error!)
        isValid = false
      }
    }

    return isValid
  }

  getSource(): ConfigSource {
    return 'env'
  }

  getMetadata(key: string): ConfigMetadata | undefined {
    return this.metadata.get(key)
  }

  getAllMetadata(): Map<string, ConfigMetadata> {
    return new Map(this.metadata)
  }

  /**
   * 검증 에러 목록 반환
   */
  getValidationErrors(): Map<string, string> {
    return new Map(this.validationErrors)
  }

  /**
   * Notion API 키 검증
   */
  private validateNotionApiKey(apiKey: string): { isValid: boolean; error?: string } {
    if (!apiKey.startsWith('secret_')) {
      return { isValid: false, error: 'Notion API key must start with "secret_"' }
    }

    if (apiKey.length !== 50) {
      return { isValid: false, error: 'Notion API key must be exactly 50 characters long' }
    }

    const secretPart = apiKey.slice(7) // Remove 'secret_' prefix
    if (!/^[a-zA-Z0-9]{43}$/.test(secretPart)) {
      return { isValid: false, error: 'Notion API key contains invalid characters' }
    }

    return { isValid: true }
  }

  /**
   * Notion Database ID 검증
   */
  private validateNotionDatabaseId(databaseId: string): { isValid: boolean; error?: string } {
    // Remove hyphens for validation
    const cleanId = databaseId.replace(/-/g, '')

    if (cleanId.length !== 32) {
      return { isValid: false, error: 'Database ID must be 32 characters (excluding hyphens)' }
    }

    if (!/^[a-f0-9]{32}$/i.test(cleanId)) {
      return { isValid: false, error: 'Database ID must contain only hexadecimal characters' }
    }

    return { isValid: true }
  }

  /**
   * Notion Page ID 검증
   */
  private validateNotionPageId(pageId: string): { isValid: boolean; error?: string } {
    // Same format as database ID
    return this.validateNotionDatabaseId(pageId)
  }

  /**
   * 경로 검증
   */
  private validatePath(path: string): { isValid: boolean; error?: string } {
    if (path.includes('..')) {
      return { isValid: false, error: 'Path cannot contain ".." (parent directory references)' }
    }

    // 기본적인 경로 형식 검증
    const invalidChars = /[<>:"|?*]/
    if (invalidChars.test(path)) {
      return { isValid: false, error: 'Path contains invalid characters' }
    }

    return { isValid: true }
  }

  /**
   * 환경 변수 파싱 및 메타데이터 설정
   */
  private parseEnvVar(key: string, value: string | undefined, defaultValue?: string): string | undefined {
    const result = value || defaultValue
    this.setMetadata(key, {
      source: 'env',
      raw: value,
      parsed: result,
      isValid: true,
    })
    return result
  }

  private parseNumberEnvVar(
    key: string,
    value: string | undefined,
    defaultValue: number,
    range?: { min?: number; max?: number }
  ): number {
    const result = parseNumber(value, defaultValue)
    let isValid = true
    let error: string | undefined

    // 범위 검증
    if (range) {
      if (range.min !== undefined && result < range.min) {
        isValid = false
        error = `Value must be at least ${range.min}`
      } else if (range.max !== undefined && result > range.max) {
        isValid = false
        error = `Value must be at most ${range.max}`
      }
    }

    this.setMetadata(key, {
      source: 'env',
      raw: value,
      parsed: result,
      isValid,
      error,
    })

    if (!isValid) {
      this.addValidationError(key, error!)
    }

    return result
  }

  private parseBooleanEnvVar(key: string, value: string | undefined, defaultValue: boolean): boolean {
    const result = parseBoolean(value, defaultValue)
    this.setMetadata(key, {
      source: 'env',
      raw: value,
      parsed: result,
      isValid: true,
    })
    return result
  }

  private parseEnumEnvVar<T extends string>(
    key: string,
    value: string | undefined,
    allowedValues: Array<T>,
    defaultValue: T
  ): T {
    const result = parseEnum(value, allowedValues, defaultValue)
    const isValid = !value || allowedValues.includes(value as T)
    const error = isValid ? undefined : `Value must be one of: ${allowedValues.join(', ')}`

    this.setMetadata(key, {
      source: 'env',
      raw: value,
      parsed: result,
      isValid,
      error,
    })

    if (!isValid) {
      this.addValidationError(key, error!)
    }

    return result
  }

  private parsePathEnvVar(key: string, value: string | undefined): string | undefined {
    if (!value) {
      this.setMetadata(key, {
        source: 'env',
        raw: value,
        parsed: undefined,
        isValid: true,
      })
      return undefined
    }

    const validation = this.validatePath(value)
    this.setMetadata(key, {
      source: 'env',
      raw: value,
      parsed: value,
      isValid: validation.isValid,
      error: validation.error,
    })

    if (!validation.isValid) {
      this.addValidationError(key, validation.error!)
    }

    return value
  }

  private setMetadata(key: string, metadata: ConfigMetadata): void {
    this.metadata.set(key, {
      ...metadata,
      timestamp: new Date().toISOString(),
    })
  }

  private addValidationError(key: string, error: string): void {
    this.validationErrors.set(key, error)
  }
}
