/**
 * 네임스페이스 기반 의존성 데이터 수집을 위한 타입 정의
 */

/**
 * 문서 생성 전략
 */
export type DocumentStrategy = 'file-mirror' | 'method-mirror' | 'library-structure' | 'namespace-grouping'

/**
 * 문서 루트 경로 설정
 */
export interface DocumentPaths {
  /** 네임스페이스별 루트 문서 경로 */
  rootPath: string
  /** 전략별 하위 경로 (선택사항, 기본값 사용) */
  strategyPaths?: {
    /** 파일 미러링 하위 경로 (기본: mirror) */
    fileMirror?: string
    /** 라이브러리 구조 하위 경로 (기본: libraries) */
    libraryStructure?: string
    /** 네임스페이스 그룹핑 하위 경로 (기본: namespaces) */
    namespaceGrouping?: string
  }
}

/**
 * 문서 경로 템플릿 설정 (하위 호환성용, deprecated)
 */
export interface DocumentTemplates {
  /** 파일 미러링용 템플릿 - docs/mirror/{filePath}.md */
  fileMirror?: string
  /** 라이브러리 구조용 템플릿 - docs/libraries/{library}/{category}/{method}.md */
  libraryStructure?: string
  /** 네임스페이스 그룹핑용 템플릿 - docs/namespaces/{namespace}/{type}/{name}.md */
  namespaceGrouping?: string
}

/**
 * 네임스페이스별 수집 규칙 정의
 */
export interface NamespaceCollectionRule {
  /** 네임스페이스 이름 */
  namespace: string
  /** 수집할 키워드 패턴 목록 */
  keywords: string[]
  /** 수집할 파일 경로 패턴 목록 */
  filePaths: string[]
  /** 제외할 패턴 목록 */
  excludePatterns: string[]
  /** 문서 생성 전략 */
  documentStrategy?: DocumentStrategy
  /** 문서 루트 경로 */
  documentPath: string
  /** 미러링 추적 활성화 */
  enableMirrorTracking?: boolean
  /** 죽은 코드 자동 백업 */
  autoBackupDeadFiles?: boolean
  /** 라이브러리 이름 (library-structure 전략 사용시) */
  libraryName?: string
  /** 문서 경로 설정 (하위 호환성용, deprecated) */
  documentPaths?: DocumentPaths
  /** 문서 경로 템플릿들 (하위 호환성용, deprecated) */
  documentTemplates?: DocumentTemplates
  /** 문서 경로 생성 템플릿 (하위 호환성용, deprecated) */
  documentPathTemplate?: string
  /** 설명 (선택사항) */
  description?: string
}

/**
 * 수집된 데이터 항목
 */
export interface CollectedDataItem {
  /** 데이터 타입 */
  type: 'keyword' | 'file' | 'export' | 'import' | 'class' | 'function' | 'variable' | 'type' | 'library-import'
  /** 실제 값 (키워드 또는 파일 경로) */
  value: string
  /** 소스 파일 경로 */
  sourcePath: string
  /** 매칭된 패턴 */
  matchedPattern: string
  /** 메타데이터 */
  metadata?: Record<string, any>
}

/**
 * 네임스페이스별 수집 결과
 */
export interface NamespaceCollectionResult {
  /** 네임스페이스 이름 */
  namespace: string
  /** 수집된 데이터 항목들 */
  items: CollectedDataItem[]
  /** 수집 시간 */
  collectedAt: Date
  /** 총 수집 개수 */
  totalCount: number
  /** 추가 메타데이터 (모듈 실행 결과 등) */
  metadata?: Record<string, any>
}

/**
 * 생성된 문서 경로 정보
 */
export interface GeneratedDocumentPath {
  /** 네임스페이스 */
  namespace: string
  /** 생성된 문서 경로 */
  documentPath: string
  /** 기반이 된 데이터 항목 */
  sourceItem: CollectedDataItem
  /** 템플릿 변수들 */
  templateVariables: Record<string, string>
}

/**
 * 수집 규칙 설정 파일 구조
 */
export interface NamespaceCollectionConfig {
  /** 네임스페이스별 수집 규칙 */
  namespaces: Record<string, Omit<NamespaceCollectionRule, 'namespace'>>
}

/**
 * 수집 옵션
 */
export interface CollectionOptions {
  /** 특정 네임스페이스만 수집 (지정하지 않으면 모든 네임스페이스) */
  targetNamespace?: string
  /** 증분 수집 여부 */
  incremental?: boolean
  /** 결과 출력 형식 */
  outputFormat?: 'json' | 'summary' | 'paths-only'
  /** 결과 저장 경로 */
  outputPath?: string
}
