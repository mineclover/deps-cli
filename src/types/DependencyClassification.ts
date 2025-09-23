/**
 * 의존성 분류 시스템 타입 정의
 * 파일 타입별로 다른 의존성 유형을 구분하여 저장하는 시스템
 */

// 노드 타입 정의
export type NodeType = 'test' | 'code' | 'library' | 'docs'

// 의존성 유형 정의
export type DependencyType =
  | 'test-target'      // 테스트가 대상으로 하는 코드
  | 'test-utility'     // 테스트에서 사용하는 유틸리티/라이브러리
  | 'test-setup'       // 테스트 설정/목업
  | 'internal-module'  // 프로젝트 내부 모듈
  | 'external-library' // 외부 라이브러리
  | 'builtin-module'   // Node.js 내장 모듈
  | 'doc-reference'    // 문서 간 참조
  | 'doc-link'         // 문서 내 외부 링크
  | 'doc-asset'        // 문서의 이미지/파일 참조

// 기본 의존성 정보
export interface BaseDependency {
  source: string                    // 원본 소스 경로/이름
  resolvedPath: string | null       // 해결된 절대 경로
  exists: boolean                   // 파일 존재 여부
  line?: number                     // 소스 코드 내 위치
  column?: number                   // 소스 코드 내 컬럼
  confidence: number                // 의존성 신뢰도 (0-1)
}

// 테스트 의존성 정보
export interface TestDependency extends BaseDependency {
  type: 'test-target' | 'test-utility' | 'test-setup'
  testType: 'unit' | 'integration' | 'e2e' | 'component'
  targetFunction?: string           // 테스트 대상 함수명
  targetClass?: string              // 테스트 대상 클래스명
  mockType?: 'jest' | 'sinon' | 'manual' | 'none'
  isAsync: boolean                  // 비동기 테스트 여부
}

// 코드 의존성 정보
export interface CodeDependency extends BaseDependency {
  type: 'internal-module' | 'external-library' | 'builtin-module'
  importType: 'import' | 'require' | 'dynamic'
  isTypeOnly: boolean               // 타입 전용 import
  exportedMembers?: string[]        // 사용된 export 멤버들
  packageVersion?: string           // 패키지 버전 (외부 라이브러리인 경우)
  usage: 'runtime' | 'devtime' | 'buildtime'
}

// 문서 의존성 정보
export interface DocumentDependency extends BaseDependency {
  type: 'doc-reference' | 'doc-link' | 'doc-asset'
  linkType: 'relative' | 'absolute' | 'external'
  title?: string                    // 링크 제목
  anchor?: string                   // 앵커 태그
  isImage: boolean                  // 이미지 파일 여부
  mimeType?: string                 // 파일 MIME 타입
}

// 통합 의존성 타입
export type ClassifiedDependency = TestDependency | CodeDependency | DocumentDependency

// 파일 노드 정보
export interface FileNode {
  filePath: string                  // 파일 경로
  nodeType: NodeType                // 노드 타입
  relativePath: string              // 프로젝트 루트 기준 상대 경로
  size: number                      // 파일 크기
  lastModified: Date                // 마지막 수정 시간
  language: string                  // 프로그래밍 언어
  framework?: string                // 사용 프레임워크 (React, Vue 등)

  // 메타데이터
  metadata: {
    complexity?: number             // 코드 복잡도
    testCoverage?: number           // 테스트 커버리지
    documentation?: number          // 문서화 수준
    maintainability?: number        // 유지보수성 점수
  }
}

// 의존성 그래프 노드
export interface DependencyNode extends FileNode {
  dependencies: ClassifiedDependency[]
  dependents: string[]              // 이 파일에 의존하는 파일들
  clusters: string[]                // 속한 클러스터들

  // 분석 결과
  analysis: {
    totalDependencies: number
    internalDependencies: number
    externalDependencies: number
    cyclicDependencies: string[]    // 순환 의존성
    riskFactors: string[]          // 위험 요소들
  }
}

// 의존성 그래프
export interface DependencyGraph {
  projectRoot: string
  timestamp: Date
  version: string

  nodes: Map<string, DependencyNode>
  edges: Array<{
    from: string
    to: string
    dependency: ClassifiedDependency
    weight: number                  // 의존성 강도
  }>

  // 그래프 메트릭
  metrics: {
    totalFiles: number
    totalDependencies: number
    averageDependenciesPerFile: number
    cyclicDependencyCount: number
    isolatedFileCount: number
    maxDepth: number
  }

  // 클러스터 정보
  clusters: Map<string, {
    name: string
    files: string[]
    type: 'feature' | 'layer' | 'domain' | 'infrastructure'
    cohesion: number                // 응집도
    coupling: number                // 결합도
  }>
}

// 저장 형식 옵션
export interface StorageOptions {
  format: 'json' | 'sqlite' | 'neo4j' | 'graphml'
  compression: boolean
  incremental: boolean              // 증분 저장
  includeMetadata: boolean
  includeSourceCode: boolean
}

// 분석 결과 보고서
export interface DependencyReport {
  summary: {
    projectName: string
    analysisDate: Date
    fileTypes: Record<NodeType, number>
    dependencyTypes: Record<DependencyType, number>
  }

  // 타입별 상세 분석
  testAnalysis: {
    testFiles: number
    testedFiles: number
    testCoverage: number
    uncoveredFiles: string[]
    testDependencyGraph: Map<string, string[]>
  }

  codeAnalysis: {
    internalModules: number
    externalLibraries: number
    circularDependencies: string[][]
    heaviestDependencies: Array<{ file: string; count: number }>
    isolatedFiles: string[]
  }

  documentationAnalysis: {
    documentFiles: number
    brokenLinks: Array<{ file: string; link: string }>
    orphanedDocs: string[]
    documentationGraph: Map<string, string[]>
  }

  recommendations: Array<{
    type: 'refactor' | 'test' | 'documentation' | 'architecture'
    priority: 'high' | 'medium' | 'low'
    description: string
    affectedFiles: string[]
  }>
}

// 분석 설정
export interface AnalysisConfig {
  includeTests: boolean
  includeDocumentation: boolean
  includeNodeModules: boolean
  maxDepth: number
  excludePatterns: string[]

  // 각 타입별 설정
  testConfig: {
    detectTestFrameworks: boolean
    analyzeMocks: boolean
    calculateCoverage: boolean
  }

  codeConfig: {
    resolveTypeImports: boolean
    analyzeUsage: boolean
    detectCircularDeps: boolean
  }

  docConfig: {
    validateLinks: boolean
    extractMetadata: boolean
    analyzeStructure: boolean
  }
}