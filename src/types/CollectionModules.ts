/**
 * 수집 모듈 시스템을 위한 타입 정의
 */

import type { ProjectDependencyGraph } from '../analyzers/EnhancedDependencyAnalyzer.js'
import type { CollectedDataItem, NamespaceCollectionRule } from './NamespaceCollection.js'

/**
 * 수집 모듈의 기본 인터페이스
 */
export interface CollectionModule {
  /** 모듈 고유 식별자 */
  readonly id: string
  /** 모듈 이름 */
  readonly name: string
  /** 모듈 설명 */
  readonly description: string
  /** 모듈 버전 */
  readonly version: string
  /** 지원하는 데이터 타입들 */
  readonly supportedTypes: CollectionDataType[]

  /**
   * 데이터 수집 실행
   */
  collect(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    options?: CollectionModuleOptions
  ): Promise<CollectedDataItem[]> | CollectedDataItem[]

  /**
   * 모듈이 특정 규칙을 지원하는지 확인
   */
  supports(rule: NamespaceCollectionRule): boolean

  /**
   * 모듈 설정 검증
   */
  validateConfig?(config: any): ValidationResult
}

/**
 * 수집 데이터 타입
 */
export type CollectionDataType = 'file' | 'keyword' | 'class' | 'function' | 'variable' | 'type' | 'export' | 'import'

/**
 * 수집 모듈 옵션
 */
export interface CollectionModuleOptions {
  /** 디버그 모드 */
  debug?: boolean
  /** 최대 수집 개수 */
  maxItems?: number
  /** 추가 필터링 옵션 */
  filters?: Record<string, any>
  /** 커스텀 설정 */
  custom?: Record<string, any>
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  /** 검증 통과 여부 */
  isValid: boolean
  /** 오류 메시지들 */
  errors: string[]
  /** 경고 메시지들 */
  warnings?: string[]
}

/**
 * 수집 모듈 메타데이터
 */
export interface CollectionModuleMetadata {
  /** 모듈 ID */
  id: string
  /** 모듈 이름 */
  name: string
  /** 설명 */
  description: string
  /** 버전 */
  version: string
  /** 지원 타입 */
  supportedTypes: CollectionDataType[]
  /** 작성자 */
  author?: string
  /** 의존성 */
  dependencies?: string[]
  /** 설정 스키마 */
  configSchema?: any
}

/**
 * 모듈 레지스트리 인터페이스
 */
export interface CollectionModuleRegistry {
  /**
   * 모듈 등록
   */
  register(module: CollectionModule): void

  /**
   * 모듈 조회
   */
  get(id: string): CollectionModule | undefined

  /**
   * 등록된 모든 모듈 목록
   */
  list(): CollectionModuleMetadata[]

  /**
   * 특정 데이터 타입을 지원하는 모듈들
   */
  getByType(type: CollectionDataType): CollectionModule[]

  /**
   * 특정 규칙과 호환되는 모듈들 찾기
   */
  findCompatibleModules(rule: NamespaceCollectionRule): CollectionModule[]

  /**
   * 모듈 제거
   */
  unregister(id: string): boolean
}

/**
 * 모듈 실행 결과
 */
export interface ModuleExecutionResult {
  /** 모듈 ID */
  moduleId: string
  /** 수집된 아이템들 */
  items: CollectedDataItem[]
  /** 실행 시간 (ms) */
  executionTime: number
  /** 성공 여부 */
  success: boolean
  /** 오류 메시지 */
  error?: string
  /** 메타데이터 */
  metadata?: Record<string, any>
}

/**
 * 모듈 선택 전략
 */
export type ModuleSelectionStrategy = 'all' | 'explicit' | 'auto' | 'priority'

/**
 * 모듈 실행 설정
 */
export interface ModuleExecutionConfig {
  /** 선택 전략 */
  strategy: ModuleSelectionStrategy
  /** 명시적으로 선택된 모듈 ID들 */
  selectedModules?: string[]
  /** 제외할 모듈 ID들 */
  excludedModules?: string[]
  /** 병렬 실행 여부 */
  parallel?: boolean
  /** 실패 시 중단 여부 */
  failFast?: boolean
}