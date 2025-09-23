# API 문서

## 개요

이 문서는 deps-cli 프로젝트의 핵심 API와 타입 정의를 설명합니다.

## 핵심 타입 정의

### FileMetadata

프로젝트 내 각 파일의 메타데이터를 표현하는 핵심 인터페이스입니다.

```typescript
interface FileMetadata {
  fileId: string                    // 고유 식별자
  filePath: string                  // 절대 파일 경로
  relativePath: string              // 프로젝트 루트 기준 상대 경로
  fileType: FileType                // 파일 타입 분류
  dependencies: FileDependencies    // 의존성 정보
  dependents: string[]              // 이 파일을 참조하는 파일들
  metadata: FileAnalysisMetadata    // 분석 메타데이터
}
```

### FileType

파일 타입 분류를 나타내는 열거형입니다.

```typescript
type FileType = 'code' | 'test' | 'docs' | 'library'
```

- `code`: TypeScript/JavaScript 코드 파일
- `test`: 테스트 파일 (.test., .spec., __tests__ 디렉토리)
- `docs`: 마크다운 문서 파일
- `library`: 외부 라이브러리 참조

### FileDependencies

파일의 의존성을 카테고리별로 분류한 구조체입니다.

```typescript
interface FileDependencies {
  internal: DependencyReference[]   // 내부 모듈 의존성
  external: DependencyReference[]   // 외부 라이브러리 의존성
  builtin: DependencyReference[]    // Node.js 내장 모듈
  test?: TestDependencies          // 테스트 관련 의존성
  docs?: DocumentDependencies      // 문서 관련 의존성
}
```

### DependencyReference

개별 의존성을 나타내는 기본 구조체입니다.

```typescript
interface DependencyReference {
  source: string                   // 원본 import/require 문자열
  resolved: string                 // 해결된 경로
  type: DependencyType            // 의존성 타입
  confidence: number              // 신뢰도 (0-100)
  location: SourceLocation       // 소스 코드 위치
}
```

### DependencyType

의존성 타입을 세분화한 열거형입니다.

```typescript
type DependencyType =
  | 'internal-module'              // 내부 모듈
  | 'external-library'             // 외부 라이브러리
  | 'builtin-module'              // Node.js 내장 모듈
  | 'test-target'                 // 테스트 대상
  | 'test-utility'                // 테스트 유틸리티
  | 'test-setup'                  // 테스트 설정
  | 'doc-reference'               // 문서 참조
  | 'doc-link'                    // 문서 링크
  | 'doc-asset'                   // 문서 에셋
```

## 핵심 클래스

### MetadataExtractor

의존성 분석 결과를 메타데이터로 변환하는 핵심 클래스입니다.

```typescript
class MetadataExtractor {
  constructor(projectRoot: string, config?: MetadataExtractionConfig)

  // 메인 추출 메서드
  extractMetadata(analysisResult: UnifiedAnalysisResult): ProjectReferenceData

  // 파일 ID 생성
  generateFileIds(analysisResult: UnifiedAnalysisResult): void

  // 참조 그래프 구성
  buildReferenceGraph(files: FileMetadata[]): ReferenceGraph
}
```

#### 사용 예시

```typescript
import { MetadataExtractor } from './src/analyzers/MetadataExtractor.js'

const extractor = new MetadataExtractor('/project/root')
const metadata = await extractor.extractMetadata(analysisResult)

// 특정 파일의 의존성 확인
const file = metadata.files.find(f => f.relativePath === 'src/main.ts')
console.log(`${file.relativePath}의 내부 의존성:`, file.dependencies.internal)
```

### UnifiedDependencyAnalyzer

다양한 파일 타입에 대한 통합 분석을 수행하는 클래스입니다.

```typescript
class UnifiedDependencyAnalyzer {
  constructor(projectRoot: string)

  // 프로젝트 전체 분석
  analyzeProject(files: string[]): Promise<UnifiedAnalysisResult>

  // 타입별 그룹 분석
  analyzeByType(files: string[]): Promise<TypeGroupedResult>

  // 개별 파일 분석
  analyzeFile(filePath: string): Promise<FileAnalysisResult>
}
```

### IdGenerator

파일의 고유 식별자를 생성하는 유틸리티 클래스입니다.

```typescript
class IdGenerator {
  constructor(config: IdGeneratorConfig)

  // 파일 ID 생성
  generateFileId(filePath: string, projectRoot: string): string

  // 프로젝트 ID 생성
  generateProjectId(projectRoot: string): string
}
```

#### ID 생성 전략

- `hash`: SHA-1 해시 기반 (기본값)
- `path-based`: 경로 기반 계층적 ID
- `sequential`: 순차적 번호

## 분석 결과 구조

### ProjectReferenceData

프로젝트의 완전한 참조 메타데이터를 포함하는 최상위 구조체입니다.

```typescript
interface ProjectReferenceData {
  project: ProjectMetadata         // 프로젝트 정보
  files: FileMetadata[]           // 파일 메타데이터 배열
  statistics: ProjectStatistics   // 분석 통계
  referenceGraph: ReferenceGraph  // 참조 관계 그래프
}
```

### ProjectMetadata

프로젝트 전체의 메타데이터입니다.

```typescript
interface ProjectMetadata {
  projectId: string               // 프로젝트 고유 ID
  name: string                   // 프로젝트 이름
  rootPath: string               // 프로젝트 루트 경로
  analysisTimestamp: string      // 분석 실행 시간
  version: string                // deps-cli 버전
}
```

### ReferenceGraph

파일 간 참조 관계를 그래프 구조로 표현합니다.

```typescript
interface ReferenceGraph {
  nodes: GraphNode[]             // 노드 목록
  edges: GraphEdge[]            // 엣지 목록
  clusters: ClusterInfo[]       // 클러스터 정보
}

interface GraphNode {
  id: string                    // 파일 ID
  label: string                 // 표시 라벨
  type: FileType               // 파일 타입
  metadata: NodeMetadata       // 노드 메타데이터
}

interface GraphEdge {
  source: string               // 소스 파일 ID
  target: string               // 타겟 파일 ID
  type: DependencyType        // 의존성 타입
  weight: number              // 가중치
}
```

## CLI 명령어 API

### classify 명령어

프로젝트 의존성을 분석하고 분류하는 메인 명령어입니다.

```bash
node dist/bin.cjs classify <directory> [options]
```

#### 기본 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--output-dir` | string | `.deps-analysis` | 결과 저장 디렉토리 |
| `--output-name` | string | `analysis-result` | 출력 파일명 프리픽스 |
| `--format` | choice | `json` | 출력 형식 |
| `--analysis-depth` | choice | `standard` | 분석 깊이 |

#### 필터링 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--include` | string | 포함할 파일 패턴 (쉼표 구분) |
| `--exclude` | string | 제외할 파일 패턴 (쉼표 구분) |
| `--min-file-size` | number | 최소 파일 크기 (bytes) |
| `--max-file-size` | number | 최대 파일 크기 (bytes) |
| `--confidence-threshold` | number | 신뢰도 임계값 (0-100%) |

#### 출력 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--generate-report` | boolean | `true` | 리포트 생성 여부 |
| `--generate-viz` | boolean | `false` | 시각화 생성 여부 |
| `--compression` | boolean | `false` | 결과 압축 |

#### 성능 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--parallel` | boolean | `true` | 병렬 처리 활성화 |
| `--enable-cache` | boolean | `true` | 캐싱 활성화 |
| `--incremental` | boolean | `false` | 증분 분석 모드 |

## 사용 패턴

### 기본 분석

```typescript
// 프로그래밍 방식 사용
import { UnifiedDependencyAnalyzer } from './src/analyzers/UnifiedDependencyAnalyzer.js'
import { MetadataExtractor } from './src/analyzers/MetadataExtractor.js'

const analyzer = new UnifiedDependencyAnalyzer('/project/root')
const result = await analyzer.analyzeProject(['src/**/*.ts'])

const extractor = new MetadataExtractor('/project/root')
const metadata = extractor.extractMetadata(result)
```

### 타입별 분석

```typescript
// 파일 타입별 분석
const typeGroupedResult = await analyzer.analyzeByType([
  'src/**/*.ts',
  'src/**/*.test.ts',
  'docs/**/*.md'
])

console.log('코드 파일:', typeGroupedResult.code.length)
console.log('테스트 파일:', typeGroupedResult.test.length)
console.log('문서 파일:', typeGroupedResult.docs.length)
```

### 참조 관계 탐색

```typescript
// 특정 파일의 참조 관계 확인
const fileId = 'src/main.ts'
const file = metadata.files.find(f => f.fileId === fileId)

// 이 파일이 의존하는 파일들
const dependencies = file.dependencies.internal.map(dep => dep.resolved)

// 이 파일을 참조하는 파일들
const dependents = file.dependents
```

### 클러스터 분석

```typescript
// 파일 클러스터 정보 확인
const clusters = metadata.referenceGraph.clusters
clusters.forEach(cluster => {
  console.log(`클러스터 ${cluster.id}: ${cluster.files.length}개 파일`)
  console.log('클러스터 특성:', cluster.characteristics)
})
```

## 에러 처리

### 일반적인 에러 타입

```typescript
// 분석 실패 시 반환되는 에러 정보
interface AnalysisError {
  code: string                    // 에러 코드
  message: string                 // 에러 메시지
  filePath?: string              // 문제가 발생한 파일 경로
  context?: Record<string, any>  // 추가 컨텍스트
}
```

### 에러 처리 예시

```typescript
try {
  const result = await analyzer.analyzeProject(files)
} catch (error) {
  if (error.code === 'PARSE_ERROR') {
    console.error(`파싱 오류: ${error.filePath}`)
  } else if (error.code === 'DEPENDENCY_RESOLUTION_ERROR') {
    console.error(`의존성 해결 실패: ${error.message}`)
  }
}
```

## 확장성

### 커스텀 분석기 추가

```typescript
// 새로운 파일 타입 분석기 구현
class CustomAnalyzer implements FileAnalyzer {
  async analyze(filePath: string): Promise<FileAnalysisResult> {
    // 커스텀 분석 로직
    return {
      filePath,
      dependencies: [],
      metadata: {}
    }
  }
}

// UnifiedDependencyAnalyzer에 등록
analyzer.registerCustomAnalyzer('custom', new CustomAnalyzer())
```

### 메타데이터 확장

```typescript
// 커스텀 메타데이터 필드 추가
interface ExtendedFileMetadata extends FileMetadata {
  customData: {
    complexity: number
    maintainability: number
    riskFactors: string[]
  }
}
```

## 성능 고려사항

### 메모리 사용량

- 대용량 프로젝트 분석 시 `--max-file-size` 옵션으로 메모리 사용량 제한
- `--confidence-threshold` 를 높여 신뢰도가 낮은 의존성 필터링

### 처리 속도

- `--parallel` 옵션으로 병렬 처리 활성화
- `--enable-cache` 옵션으로 캐싱 활용
- `--incremental` 옵션으로 변경된 파일만 재분석

## 관련 문서

- [CLI 사용 가이드](../ENHANCED_CLI_GUIDE.md)
- [개발자 가이드](../README.md#개발-가이드)
- [아키텍처 문서](../README.md#아키텍처)