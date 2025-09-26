/**
 * 설정 관리자 - 여러 어댑터를 조합하여 설정을 관리
 */

import type { EnvironmentConfig, EnvironmentConfigWithMetadata, ConfigMetadata, NamespacedConfig } from '../types/EnvironmentConfig.js'
import type { ConfigAdapter} from '../adapters/ConfigAdapter.js';
import { DefaultConfigAdapter, FileConfigAdapter, CliConfigAdapter } from '../adapters/ConfigAdapter.js'
import { EnvironmentAdapter } from '../adapters/EnvironmentAdapter.js'
import type { ConfigCache} from './ConfigCache.js';
import { globalConfigCache } from './ConfigCache.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * 설정 로딩 옵션
 */
export interface ConfigLoadOptions {
  configFile?: string
  cliArgs?: Record<string, any>
  validateConfig?: boolean
  throwOnValidationError?: boolean
  enableCache?: boolean
  cacheKey?: string
  namespace?: string  // 사용할 namespace 지정
}

/**
 * 설정 관리자
 */
export class ConfigManager {
  private config: EnvironmentConfigWithMetadata = {}
  private adapters: Array<ConfigAdapter> = []
  private isLoaded = false
  private loadPromise: Promise<EnvironmentConfigWithMetadata> | null = null
  private static instance: ConfigManager | null = null
  private cache: ConfigCache

  constructor(cache?: ConfigCache) {
    // 기본 어댑터들을 우선순위 순서로 등록 (Lazy initialization)
    this.adapters = []
    this.cache = cache || globalConfigCache
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  /**
   * 어댑터 초기화 (Lazy loading)
   */
  private initializeAdapters(): void {
    if (this.adapters.length === 0) {
      this.adapters = [
        new DefaultConfigAdapter(), // 최하위 우선순위 (기본값)
        new EnvironmentAdapter(),   // 환경 변수
        // 파일과 CLI는 load() 시에 동적으로 추가
      ]
    }
  }

  /**
   * 설정 로드 (중복 호출 방지)
   */
  async load(options: ConfigLoadOptions = {}): Promise<EnvironmentConfigWithMetadata> {
    // 캐시 키 생성
    const cacheKey = options.cacheKey || this.generateCacheKey(options)
    
    // 캐시에서 먼저 조회 (활성화된 경우)
    if (options.enableCache !== false) {
      const cachedConfig = await this.cache.get(cacheKey)
      if (cachedConfig) {
        this.config = cachedConfig
        this.isLoaded = true
        return cachedConfig
      }
    }

    // 이미 로딩 중이거나 완료된 경우 기존 결과 반환
    if (this.loadPromise) {
      return this.loadPromise
    }

    // 이미 로드된 경우이지만 새로운 옵션이 있는 경우 재로드
    if (this.isLoaded && (options.configFile || options.cliArgs)) {
      this.reset()
    } else if (this.isLoaded) {
      return this.config
    }

    this.loadPromise = this.performLoad(options, cacheKey)
    
    try {
      const result = await this.loadPromise
      return result
    } finally {
      this.loadPromise = null
    }
  }

  /**
   * 실제 로딩 수행
   */
  private async performLoad(options: ConfigLoadOptions, cacheKey: string): Promise<EnvironmentConfigWithMetadata> {
    this.initializeAdapters()
    const adapters: Array<ConfigAdapter> = [...this.adapters]

    // 파일 어댑터 추가 (환경 변수보다 높은 우선순위)
    if (options.configFile) {
      adapters.push(new FileConfigAdapter(options.configFile))
    }

    // CLI 어댑터 추가 (최고 우선순위)
    if (options.cliArgs) {
      adapters.push(new CliConfigAdapter(options.cliArgs))
    }

    // 병렬로 모든 어댑터에서 설정 로드
    const loadResults = await Promise.allSettled(
      adapters.map(adapter => this.loadFromAdapter(adapter))
    )

    // 성공한 결과들만 병합
    let mergedConfig: EnvironmentConfig = {}
    const metadata: Record<string, ConfigMetadata> = {}

    loadResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { config: partialConfig, metadata: adapterMetadata } = result.value
        mergedConfig = this.deepMerge(mergedConfig, partialConfig)
        Object.assign(metadata, adapterMetadata)
      } else {
        console.warn(`Failed to load config from ${adapters[index].getSource()}:`, result.reason)
      }
    })

    // 설정 검증
    if (options.validateConfig !== false) {
      await this.validateConfig(adapters, mergedConfig, options.throwOnValidationError)
    }

    this.config = { ...mergedConfig, _metadata: metadata }
    this.isLoaded = true

    // 캐시에 저장 (활성화된 경우)
    if (options.enableCache !== false) {
      try {
        await this.cache.set(cacheKey, this.config)
      } catch (error) {
        console.warn('Failed to cache configuration:', error)
      }
    }

    return this.config
  }

  /**
   * 개별 어댑터에서 로드
   */
  private async loadFromAdapter(adapter: ConfigAdapter): Promise<{
    config: Partial<EnvironmentConfig>,
    metadata: Record<string, ConfigMetadata>
  }> {
    const config = await adapter.load()
    const metadata: Record<string, ConfigMetadata> = {}

    // 메타데이터 수집
    if (adapter.getMetadata) {
      // EnvironmentAdapter의 경우
      if (adapter instanceof EnvironmentAdapter) {
        const envMetadata = adapter.getAllMetadata()
        for (const [key, meta] of envMetadata) {
          metadata[key] = meta
        }
      }
    }

    return { config, metadata }
  }

  /**
   * 현재 설정 반환 (메모이제이션)
   */
  getConfig(): EnvironmentConfigWithMetadata {
    if (!this.isLoaded) {
      throw new Error('Config not loaded. Call load() first.')
    }
    return this.config
  }

  /**
   * 특정 설정 값 반환 (캐싱된 참조 사용)
   */
  get<T = any>(path: string): T | undefined {
    return this.getNestedValue(this.config, path)
  }

  /**
   * 설정 값 설정 (런타임) - 변경 추적
   */
  set(path: string, value: any): void {
    this.setNestedValue(this.config, path, value)
    
    // 메타데이터에 런타임 변경 기록
    if (!this.config._metadata) {
      this.config._metadata = {}
    }
    this.config._metadata[`runtime.${path}`] = {
      source: 'runtime',
      raw: String(value),
      parsed: value,
      isValid: true,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 설정이 로드되었는지 확인
   */
  isConfigLoaded(): boolean {
    return this.isLoaded
  }

  /**
   * 설정 리셋
   */
  reset(): void {
    this.config = {}
    this.isLoaded = false
    this.loadPromise = null
    // 캐시도 무효화
    this.cache.invalidate().catch(error => {
      console.warn('Failed to invalidate cache during reset:', error)
    })
  }

  /**
   * 설정 덤프 (디버깅용)
   */
  dump(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /**
   * 민감한 정보를 마스킹한 설정 덤프
   */
  dumpSafe(): string {
    const safeConfig = this.maskSensitiveData(this.config)
    return JSON.stringify(safeConfig, null, 2)
  }

  /**
   * 설정 검증 (최적화된 병렬 처리)
   */
  private async validateConfig(
    adapters: Array<ConfigAdapter>,
    config: EnvironmentConfig,
    throwOnError = false
  ): Promise<void> {
    const validationResults = await Promise.allSettled(
      adapters.map(adapter => 
        adapter.validate(config).then(isValid => ({ adapter, isValid }))
      )
    )

    const errors: Array<string> = []
    
    validationResults.forEach(result => {
      if (result.status === 'fulfilled') {
        if (!result.value.isValid) {
          errors.push(`Validation failed for ${result.value.adapter.getSource()} adapter`)
        }
      } else {
        errors.push(`Validation error: ${result.reason}`)
      }
    })

    if (errors.length > 0) {
      const errorMessage = `Config validation failed:\n${errors.join('\n')}`
      if (throwOnError) {
        throw new Error(errorMessage)
      } else {
        console.warn(errorMessage)
      }
    }
  }

  /**
   * 깊은 병합 (최적화된 버전)
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target }

    for (const key in source) {
      const sourceValue = source[key]
      const targetValue = result[key]

      if (sourceValue === undefined) {
        continue
      }

      if (this.isObject(sourceValue) && this.isObject(targetValue)) {
        result[key] = this.deepMerge(targetValue, sourceValue)
      } else {
        result[key] = sourceValue
      }
    }

    return result
  }

  /**
   * 중첩된 객체에서 값 가져오기 (최적화된 버전)
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.')
    let current = obj
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined
      }
      current = current[key]
    }
    
    return current
  }

  /**
   * 중첩된 객체에 값 설정
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {}
      }
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  /**
   * 객체인지 확인
   */
  private isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  /**
   * 민감한 데이터 마스킹
   */
  private maskSensitiveData(config: any): any {
    const masked = JSON.parse(JSON.stringify(config))

    // API 키 마스킹
    if (masked.notion?.apiKey) {
      masked.notion.apiKey = this.maskString(masked.notion.apiKey)
    }

    // 메타데이터에서도 민감한 정보 마스킹
    if (masked._metadata) {
      for (const key in masked._metadata) {
        if (key.includes('API_KEY') || key.includes('SECRET')) {
          if (masked._metadata[key].raw) {
            masked._metadata[key].raw = this.maskString(masked._metadata[key].raw)
          }
          if (masked._metadata[key].parsed) {
            masked._metadata[key].parsed = this.maskString(masked._metadata[key].parsed)
          }
        }
      }
    }

    return masked
  }

  /**
   * 문자열 마스킹
   */
  private maskString(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length)
    }
    return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4)
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(options: ConfigLoadOptions): string {
    const keyParts: Array<string> = ['config']
    
    if (options.configFile) {
      keyParts.push(`file:${options.configFile}`)
    }
    
    if (options.cliArgs) {
      // CLI 인자들을 정렬하여 일관된 키 생성
      const sortedArgs = Object.keys(options.cliArgs)
        .sort()
        .map(key => `${key}:${options.cliArgs![key]}`)
        .join(',')
      keyParts.push(`cli:${sortedArgs}`)
    }
    
    // 환경 변수 해시 추가 (변경 감지용)
    const envHash = this.generateEnvHash()
    keyParts.push(`env:${envHash}`)
    
    return keyParts.join('|')
  }

  /**
   * 환경 변수 해시 생성 (캐시 무효화용)
   */
  private generateEnvHash(): string {
    const relevantEnvVars = [
      'NOTION_API_KEY',
      'NOTION_DATABASE_ID', 
      'NOTION_PAGE_ID',
      'NOTION_API_VERSION',
      'DEPS_CLI_MAX_CONCURRENCY',
      'DEPS_CLI_TIMEOUT',
      'DEPS_CLI_CACHE_ENABLED',
      'DEPS_CLI_CACHE_TTL',
      'DEPS_CLI_LOG_LEVEL',
      'DEPS_CLI_LOG_FORMAT',
      'DEPS_CLI_LOG_ENABLED',
      'DEPS_CLI_DEFAULT_FORMAT',
      'DEPS_CLI_DEFAULT_OUTPUT_DIR',
      'DEPS_CLI_COMPRESSION',
      'DEPS_CLI_VERBOSE',
      'DEPS_CLI_DEBUG',
      'DEPS_CLI_MOCK_API',
      'NODE_ENV'
    ]
    
    const envString = relevantEnvVars
      .map(key => `${key}=${process.env[key] || ''}`)
      .join('|')
    
    return this.simpleHash(envString)
  }

  /**
   * 간단한 해시 함수
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32비트 정수로 변환
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * 캐시 무효화
   */
  async invalidateCache(key?: string): Promise<void> {
    await this.cache.invalidate(key)
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats(): any {
    return this.cache.getStats()
  }

  /**
   * 캐시 정리
   */
  cleanupCache(): void {
    this.cache.cleanup()
  }

  /**
   * 설정 로드 시 재시도 메커니즘 (복구 로직)
   */
  async loadWithRetry(
    options: ConfigLoadOptions = {},
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<EnvironmentConfigWithMetadata> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.load(options)
      } catch (error) {
        lastError = error as Error
        console.warn(`Configuration load attempt ${attempt}/${maxRetries} failed:`, error)
        
        if (attempt < maxRetries) {
          // 재시도 전 짧은 대기
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          
          // 캐시 무효화 후 재시도
          await this.invalidateCache()
          this.reset()
        }
      }
    }
    
    // 모든 재시도 실패 시 기본 설정으로 폴백
    console.error(`All ${maxRetries} configuration load attempts failed. Using fallback configuration.`)
    return this.loadFallbackConfig(lastError!)
  }

  /**
   * 폴백 설정 로드
   */
  private async loadFallbackConfig(originalError: Error): Promise<EnvironmentConfigWithMetadata> {
    try {
      // 기본 어댑터만 사용하여 최소한의 설정 로드
      const defaultAdapter = new (await import('../adapters/ConfigAdapter.js')).DefaultConfigAdapter()
      const fallbackConfig = await defaultAdapter.load()
      
      const configWithMetadata: EnvironmentConfigWithMetadata = {
        ...fallbackConfig,
        _metadata: {
          'fallback.reason': {
            source: 'fallback',
            raw: originalError.message,
            parsed: 'Configuration loaded with fallback due to errors',
            isValid: true,
            error: originalError.message,
            timestamp: new Date().toISOString()
          }
        }
      }
      
      this.config = configWithMetadata
      this.isLoaded = true
      
      return configWithMetadata
    } catch (fallbackError) {
      // 폴백도 실패한 경우 하드코딩된 최소 설정 사용
      const hardcodedConfig: EnvironmentConfigWithMetadata = {
        analysis: { maxConcurrency: 4, timeout: 30000 },
        logging: { level: 'info', format: 'text', enabled: true },
        output: { defaultFormat: 'summary', compression: false },
        development: { verbose: false, debugMode: false, mockApiCalls: false },
        _metadata: {
          'hardcoded.fallback': {
            source: 'hardcoded',
            raw: 'Emergency fallback configuration',
            parsed: 'Using hardcoded configuration due to critical errors',
            isValid: true,
            error: `Original: ${originalError.message}, Fallback: ${fallbackError}`,
            timestamp: new Date().toISOString()
          }
        }
      }
      
      this.config = hardcodedConfig
      this.isLoaded = true
      
      console.error('Critical configuration failure. Using hardcoded fallback:', {
        originalError: originalError.message,
        fallbackError
      })
      
      return hardcodedConfig
    }
  }

  /**
   * 설정 상태 진단
   */
  async diagnose(): Promise<{
    isHealthy: boolean
    issues: Array<string>
    recommendations: Array<string>
    adapters: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message?: string }>
  }> {
    const issues: Array<string> = []
    const recommendations: Array<string> = []
    const adapters: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message?: string }> = []
    
    this.initializeAdapters()
    
    // 각 어댑터 상태 확인
    for (const adapter of this.adapters) {
      try {
        const testConfig = await adapter.load()
        const isValid = await adapter.validate(testConfig)
        
        if (isValid) {
          adapters.push({ name: adapter.getSource(), status: 'ok' })
        } else {
          adapters.push({ 
            name: adapter.getSource(), 
            status: 'warning', 
            message: 'Configuration validation failed' 
          })
          issues.push(`${adapter.getSource()} adapter has validation issues`)
        }
      } catch (error) {
        adapters.push({ 
          name: adapter.getSource(), 
          status: 'error', 
          message: (error as Error).message 
        })
        issues.push(`${adapter.getSource()} adapter failed to load: ${(error as Error).message}`)
      }
    }
    
    // 환경 변수 특별 검사
    if (this.adapters.find(a => a.getSource() === 'env')) {
      const envAdapter = this.adapters.find(a => a.getSource() === 'env') as EnvironmentAdapter
      const validationErrors = envAdapter.getValidationErrors()
      
      if (validationErrors.size > 0) {
        for (const [key, error] of validationErrors.entries()) {
          issues.push(`Environment variable ${key}: ${error}`)
          recommendations.push(`Fix environment variable ${key}`)
        }
      }
    }
    
    // 캐시 상태 확인
    const cacheStats = this.getCacheStats()
    if (cacheStats.memorySize > cacheStats.maxSize * 0.8) {
      issues.push('Cache is nearly full')
      recommendations.push('Consider increasing cache size or cleaning up old entries')
    }
    
    // 설정 로드 상태 확인
    if (!this.isLoaded) {
      issues.push('Configuration has not been loaded')
      recommendations.push('Call load() to initialize configuration')
    }
    
    const isHealthy = issues.length === 0
    
    return {
      isHealthy,
      issues,
      recommendations,
      adapters
    }
  }

  /**
   * 자동 복구 시도
   */
  async autoRecover(): Promise<{ success: boolean; actions: Array<string> }> {
    const actions: Array<string> = []
    
    try {
      // 1. 캐시 정리
      this.cleanupCache()
      actions.push('Cleaned up cache')
      
      // 2. 설정 리셋
      this.reset()
      actions.push('Reset configuration state')
      
      // 3. 진단 실행
      const diagnosis = await this.diagnose()
      actions.push('Performed system diagnosis')
      
      // 4. 문제가 있는 경우 기본 설정으로 로드
      if (!diagnosis.isHealthy) {
        await this.loadFallbackConfig(new Error('Auto-recovery triggered due to unhealthy state'))
        actions.push('Loaded fallback configuration')
      } else {
        // 5. 정상인 경우 일반 로드
        await this.load()
        actions.push('Reloaded configuration successfully')
      }
      
      return { success: true, actions }
    } catch (error) {
      actions.push(`Recovery failed: ${(error as Error).message}`)
      return { success: false, actions }
    }
  }

  // ========================================
  // NAMESPACE-BASED CONFIGURATION METHODS
  // ========================================

  /**
   * namespace 기반 설정 파일 로드
   */
  async loadNamespacedConfig(configFile?: string, namespace?: string): Promise<EnvironmentConfigWithMetadata> {
    const filePath = configFile || this.getDefaultConfigPath()
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const namespacedConfig = JSON.parse(content) as NamespacedConfig
      
      // namespace가 지정되지 않은 경우 default 사용
      const targetNamespace = namespace || namespacedConfig.default || 'default'
      
      if (!namespacedConfig.namespaces[targetNamespace]) {
        throw new Error(`Namespace '${targetNamespace}' not found in configuration`)
      }
      
      // 해당 namespace의 설정을 일반 설정으로 변환
      const config = namespacedConfig.namespaces[targetNamespace]
      
      return {
        ...config,
        _metadata: {
          'namespace.selected': {
            source: 'namespace',
            raw: targetNamespace,
            parsed: `Using namespace: ${targetNamespace}`,
            isValid: true,
            timestamp: new Date().toISOString()
          },
          ...namespacedConfig._metadata
        }
      }
    } catch (error) {
      console.warn(`Failed to load namespaced config from ${filePath}:`, error)
      // 일반 설정 파일로 fallback
      return this.load({ configFile: filePath })
    }
  }

  /**
   * 사용 가능한 namespace 목록 반환
   */
  async listNamespaces(configFile?: string): Promise<{ namespaces: Array<string>, default?: string }> {
    const filePath = configFile || this.getDefaultConfigPath()
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const namespacedConfig = JSON.parse(content) as NamespacedConfig
      
      return {
        namespaces: Object.keys(namespacedConfig.namespaces || {}),
        default: namespacedConfig.default
      }
    } catch (error) {
      console.warn(`Failed to read namespaces from ${filePath}:`, error)
      return { namespaces: [] }
    }
  }

  /**
   * 특정 namespace의 설정 생성/업데이트
   */
  async setNamespaceConfig(namespace: string, config: EnvironmentConfig, configFile?: string): Promise<void> {
    const filePath = configFile || this.getDefaultConfigPath()
    let namespacedConfig: NamespacedConfig
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      namespacedConfig = JSON.parse(content) as NamespacedConfig
    } catch (error) {
      // 파일이 없으면 새로 생성
      namespacedConfig = {
        namespaces: {},
        default: namespace
      }
    }
    
    // namespace 설정 업데이트
    namespacedConfig.namespaces[namespace] = config
    
    // 첫 번째 namespace인 경우 default로 설정
    if (!namespacedConfig.default && Object.keys(namespacedConfig.namespaces).length === 1) {
      namespacedConfig.default = namespace
    }
    
    // 메타데이터 업데이트
    if (!namespacedConfig._metadata) {
      namespacedConfig._metadata = {}
    }
    namespacedConfig._metadata[`namespace.${namespace}.updated`] = {
      source: 'namespace-update',
      raw: JSON.stringify(config),
      parsed: `Updated namespace ${namespace}`,
      isValid: true,
      timestamp: new Date().toISOString()
    }
    
    await fs.writeFile(filePath, JSON.stringify(namespacedConfig, null, 2))
  }

  /**
   * namespace 삭제
   */
  async deleteNamespace(namespace: string, configFile?: string): Promise<void> {
    const filePath = configFile || this.getDefaultConfigPath()
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const namespacedConfig = JSON.parse(content) as NamespacedConfig
      
      if (!namespacedConfig.namespaces[namespace]) {
        throw new Error(`Namespace '${namespace}' not found`)
      }
      
      delete namespacedConfig.namespaces[namespace]
      
      // 삭제된 namespace가 default였다면 다른 namespace를 default로 설정
      if (namespacedConfig.default === namespace) {
        const remainingNamespaces = Object.keys(namespacedConfig.namespaces)
        namespacedConfig.default = remainingNamespaces.length > 0 ? remainingNamespaces[0] : undefined
      }
      
      await fs.writeFile(filePath, JSON.stringify(namespacedConfig, null, 2))
    } catch (error) {
      throw new Error(`Failed to delete namespace '${namespace}': ${error}`)
    }
  }

  /**
   * 기본 설정 파일 경로 반환
   */
  private getDefaultConfigPath(): string {
    return path.join(process.cwd(), 'deps-cli.config.json')
  }

  /**
   * load 메서드를 namespace 지원으로 확장
   */
  async loadWithNamespace(options: ConfigLoadOptions = {}): Promise<EnvironmentConfigWithMetadata> {
    // namespace가 지정된 경우 namespace 기반 로드 시도
    if (options.namespace || await this.isNamespacedConfig(options.configFile)) {
      return this.loadNamespacedConfig(options.configFile, options.namespace)
    }
    
    // 일반 로드
    return this.load(options)
  }

  /**
   * 설정 파일이 namespace 기반인지 확인
   */
  private async isNamespacedConfig(configFile?: string): Promise<boolean> {
    const filePath = configFile || this.getDefaultConfigPath()
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const config = JSON.parse(content)
      return 'namespaces' in config && typeof config.namespaces === 'object'
    } catch {
      return false
    }
  }
}

/**
 * 전역 설정 관리자 인스턴스
 */
export const globalConfig = ConfigManager.getInstance()