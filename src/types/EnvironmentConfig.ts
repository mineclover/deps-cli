/**
 * 환경 설정 타입 정의
 */

/**
 * 기본 환경 설정 인터페이스
 */
export interface EnvironmentConfig {
  // API 관련 설정
  notion?: {
    apiKey?: string
    databaseId?: string
    pageId?: string
    version?: string
  }

  // 분석 관련 설정
  analysis?: {
    maxConcurrency?: number
    timeout?: number
    cacheEnabled?: boolean
    cacheTtl?: number
  }

  // 파일 패턴 설정 (namespace별 파일 영역 지정)
  filePatterns?: {
    include?: string[]
    exclude?: string[]
  }

  // 로깅 관련 설정
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error'
    format?: 'json' | 'text'
    enabled?: boolean
  }

  // 출력 관련 설정
  output?: {
    defaultFormat?: 'json' | 'summary'
    defaultDir?: string
    compression?: boolean
  }

  // 마크다운 문서 관련 설정
  markdown?: {
    outputDir?: string
    template?: 'detailed' | 'summary' | 'compact'
    includeSource?: boolean
    frontMatterFormat?: 'yaml' | 'json'
    generateToc?: boolean
    roleBasedOrganization?: boolean
  }

  // 개발 환경 설정
  development?: {
    verbose?: boolean
    debugMode?: boolean
    mockApiCalls?: boolean
  }
}

/**
 * 환경 변수 매핑 정의
 */
export interface EnvironmentVariables {
  // Notion API
  NOTION_API_KEY?: string
  NOTION_DATABASE_ID?: string
  NOTION_PAGE_ID?: string
  NOTION_API_VERSION?: string

  // 분석 설정
  DEPS_CLI_MAX_CONCURRENCY?: string
  DEPS_CLI_TIMEOUT?: string
  DEPS_CLI_CACHE_ENABLED?: string
  DEPS_CLI_CACHE_TTL?: string

  // 로깅 설정
  DEPS_CLI_LOG_LEVEL?: string
  DEPS_CLI_LOG_FORMAT?: string
  DEPS_CLI_LOG_ENABLED?: string

  // 출력 설정
  DEPS_CLI_DEFAULT_FORMAT?: string
  DEPS_CLI_DEFAULT_OUTPUT_DIR?: string
  DEPS_CLI_COMPRESSION?: string

  // 개발 환경
  DEPS_CLI_VERBOSE?: string
  DEPS_CLI_DEBUG?: string
  DEPS_CLI_MOCK_API?: string

  // 일반적인 환경 변수
  NODE_ENV?: string
  DEBUG?: string
}

/**
 * 설정 소스 타입
 */
export type ConfigSource =
  | 'env'
  | 'file'
  | 'cli'
  | 'default'
  | 'runtime'
  | 'fallback'
  | 'hardcoded'
  | 'namespace'
  | 'namespace-update'

/**
 * 설정 항목 메타데이터
 */
export interface ConfigMetadata {
  source: ConfigSource
  raw?: string
  parsed?: any
  isValid: boolean
  error?: string
  timestamp?: string
}

/**
 * 확장된 설정 객체 (메타데이터 포함)
 */
export type EnvironmentConfigWithMetadata = EnvironmentConfig & {
  _metadata?: Record<string, ConfigMetadata>
}
// Namespace-based configuration support
export interface NamespacedConfig {
  namespaces: Record<string, EnvironmentConfig>
  default?: string // 기본 사용할 namespace 이름
  _metadata?: Record<string, ConfigMetadata>
}

export type NamespacedConfigWithMetadata = NamespacedConfig & {
  _metadata?: Record<string, ConfigMetadata>
}

// CLI에서 사용할 namespace 관련 옵션
export interface NamespaceOptions {
  namespace?: string // 사용할 specific namespace
  listNamespaces?: boolean // 사용 가능한 namespace 목록 표시
}
