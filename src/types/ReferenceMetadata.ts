/**
 * 참조 관계 구성을 위한 메타데이터 타입 정의
 */

export type FileType = "code" | "test" | "docs"
export type DependencyCategory =
  | "internal"
  | "external"
  | "builtin"
  | "test-utility"
  | "test-setup"
  | "doc-reference"
  | "doc-link"
  | "doc-asset"

/**
 * 의존성 참조 정보
 */
export interface DependencyReference {
  /** 의존성 소스 (import path) */
  source: string
  /** 해결된 파일 경로 (internal인 경우) */
  resolvedPath: string | null
  /** 의존성 카테고리 */
  category: DependencyCategory
  /** 의존성 타입 세부 정보 */
  type: string
  /** 라인 번호 */
  line: number
  /** 신뢰도 */
  confidence: number
  /** 타입 전용 import 여부 */
  isTypeOnly: boolean
  /** 참조된 파일의 고유 식별자 (internal인 경우) */
  targetFileId?: string
}

/**
 * 파일 메타데이터 - 참조 관계 구성용
 */
export interface FileMetadata {
  /** 커스텀 고유 식별자 */
  fileId: string
  /** 프로젝트 루트 기준 파일 경로 */
  filePath: string
  /** 상대 경로 (프로젝트 루트 기준) */
  relativePath: string
  /** 파일 타입 */
  fileType: FileType
  /** 파일 언어 */
  language: string
  /** 파일 크기 (bytes) */
  size: number
  /** 마지막 수정 시간 */
  lastModified: Date
  /** 복잡도 점수 */
  complexity: number
  /** 유지보수성 점수 */
  maintainability: number

  /** 의존성 리스트 - 카테고리별 분류 */
  dependencies: {
    /** 내부 모듈 의존성 */
    internal: Array<DependencyReference>
    /** 외부 라이브러리 의존성 */
    external: Array<DependencyReference>
    /** 내장 모듈 의존성 */
    builtin: Array<DependencyReference>
    /** 테스트 관련 의존성 (test 파일인 경우) */
    test?: {
      targets: Array<DependencyReference> // 테스트 대상
      utilities: Array<DependencyReference> // 테스트 유틸리티
      setup: Array<DependencyReference> // 테스트 설정
    }
    /** 문서 관련 의존성 (docs 파일인 경우) */
    docs?: {
      references: Array<DependencyReference> // 문서 참조
      links: Array<DependencyReference> // 외부 링크
      assets: Array<DependencyReference> // 자산 파일
    }
  }

  /** 이 파일을 참조하는 파일들의 ID 리스트 */
  dependents: Array<string>

  /** 추가 메타데이터 */
  metadata: {
    /** 프레임워크 정보 (해당되는 경우) */
    framework?: string
    /** 테스트 커버리지 (test 파일인 경우) */
    testCoverage?: number
    /** 문서화 점수 (docs 파일인 경우) */
    documentation?: number
    /** 위험 요소들 */
    riskFactors: Array<string>
    /** 클러스터 정보 */
    clusters: Array<string>
  }
}

/**
 * 프로젝트 전체 참조 데이터
 */
export interface ProjectReferenceData {
  /** 프로젝트 정보 */
  project: {
    /** 프로젝트 루트 경로 */
    root: string
    /** 프로젝트 이름 */
    name: string
    /** 분석 시각 */
    analyzedAt: Date
    /** 분석 버전 */
    version: string
  }

  /** 파일 메타데이터 배열 */
  files: Array<FileMetadata>

  /** 통계 정보 */
  statistics: {
    /** 총 파일 수 */
    totalFiles: number
    /** 파일 타입별 개수 */
    filesByType: Record<FileType, number>
    /** 총 의존성 개수 */
    totalDependencies: number
    /** 카테고리별 의존성 개수 */
    dependenciesByCategory: Record<DependencyCategory, number>
    /** 평균 의존성 수 */
    averageDependenciesPerFile: number
    /** 순환 의존성 개수 */
    circularDependencies: number
    /** 고립된 파일 개수 */
    orphanedFiles: number
  }

  /** 참조 관계 그래프 */
  referenceGraph: {
    /** 엣지 리스트 (파일 간 참조 관계) */
    edges: Array<{
      from: string // 소스 파일 ID
      to: string // 타겟 파일 ID
      dependency: DependencyReference
      weight: number // 참조 강도
    }>
  }
}

/**
 * 고유 식별자 생성 전략
 */
export interface IdGenerationConfig {
  /** ID 생성 방식 */
  strategy: "hash" | "path-based" | "sequential"
  /** 프리픽스 */
  prefix?: string
  /** 해시 길이 (hash 방식인 경우) */
  hashLength?: number
}
