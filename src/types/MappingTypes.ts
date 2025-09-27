/**
 * 구조적 마크다운 매핑 시스템을 위한 타입 정의
 * Phase 2.5: Structural Markdown Mapping System
 */

// 파일과 메서드를 위한 고유 ID 시스템
export type FileId = string & { readonly brand: unique symbol }
export type MethodId = string & { readonly brand: unique symbol }
export type NodeId = FileId | MethodId

// 코드 엔티티의 역할 분류
export enum CodeRole {
  SERVICE = 'service', // 비즈니스 로직 서비스
  UTILITY = 'utility', // 유틸리티 함수
  TEST = 'test', // 테스트 코드
  CONFIG = 'config', // 설정 파일
  TYPE = 'type', // 타입 정의
  ADAPTER = 'adapter', // 어댑터 패턴
  CONTROLLER = 'controller', // 컨트롤러
  MODEL = 'model', // 데이터 모델
  COMPONENT = 'component', // UI 컴포넌트
  HOOK = 'hook', // React Hook
  DEMO = 'demo', // 데모/예제 코드
  SCRIPT = 'script', // 빌드/배포 스크립트
  SPEC = 'spec', // 스펙/문서
  ENTRY_POINT = 'entry_point', // 엔트리 포인트
}

// 파일 메타데이터 인터페이스
export interface FileMetadata {
  id: FileId
  path: string
  relativePath: string
  role: CodeRole
  language: string
  size: number
  lines: number
  lastModified: Date
  hash: string // 컨텐츠 해시 (파일 변경 감지용)
  documentPath?: string // MirrorPathMapper를 통한 문서 경로
  mirrorPath?: string // 미러링된 상대 경로
}

// 메서드/함수 메타데이터 인터페이스
export interface MethodMetadata {
  id: MethodId
  name: string
  signature: string
  type: 'function' | 'method' | 'class' | 'interface' | 'type' | 'variable'
  exported: boolean
  startLine: number
  endLine: number
  complexity?: number
  parentId?: FileId // 속한 파일의 ID
  hash: string // 시그니처 해시 (메서드 변경 감지용)
}

// 의존성 관계 매핑
export interface DependencyMapping {
  fromId: NodeId
  toId: NodeId
  type: 'import' | 'call' | 'extend' | 'implement' | 'reference'
  importedMembers?: string[]
  line?: number
}

// 마크다운 생성을 위한 노드 인터페이스
export interface MarkdownNode {
  id: NodeId
  title: string
  type: 'file' | 'method'
  role: CodeRole
  metadata: FileMetadata | MethodMetadata
  dependencies: DependencyMapping[]
  dependents: DependencyMapping[]
  content?: string // 생성된 마크다운 컨텐츠
}

// ID 매핑 테이블
export interface IdMappingTable {
  files: Map<string, FileId> // 파일 경로 → 파일 ID
  methods: Map<string, MethodId> // 메서드 시그니처 → 메서드 ID
  pathToId: Map<string, NodeId> // 통합 경로 → ID 매핑
  idToPath: Map<NodeId, string> // ID → 경로 역매핑
  roles: Map<NodeId, CodeRole> // ID → 역할 매핑
}

// 역할 분류 규칙
export interface RoleClassificationRule {
  pattern: string | RegExp
  role: CodeRole
  priority: number // 높을수록 우선순위
  conditions?: {
    fileNamePattern?: RegExp
    directoryPattern?: RegExp
    importPattern?: RegExp
    contentPattern?: RegExp
  }
}

// 마크다운 생성 설정
export interface MarkdownGenerationConfig {
  outputDirectory: string
  templateType: 'detailed' | 'summary' | 'compact'
  includeMetrics: boolean
  includeDependencyGraph: boolean
  includeSourceCode: boolean
  linkStyle: 'relative' | 'absolute' | 'id-based'
  frontMatterFormat: 'yaml' | 'json'
  namespace?: string // 예측 가능한 ID 생성을 위한 namespace
}

// 매핑 시스템 상태
export interface MappingSystemState {
  initialized: boolean
  lastUpdate: Date
  totalNodes: number
  mappingTable: IdMappingTable
  classificationRules: RoleClassificationRule[]
  generationConfig: MarkdownGenerationConfig
}
