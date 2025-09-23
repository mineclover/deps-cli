# Analysis Types Documentation

이 디렉토리는 Effect CLI의 코드 분석 결과에 대한 TypeScript 타입 정의를 포함합니다.

## 파일 구조

- `AnalysisTypes.ts` - 메인 타입 정의 파일

## 주요 타입들

### 1. 기본 분석 결과 타입

```typescript
interface TypedAnalysisResult {
  filePath: string                    // 분석된 파일 경로
  pathInfo: PathInfo                  // 파일 경로 정보
  language: string                    // 감지된 언어 (typescript, javascript 등)
  extractedData: {                    // 추출된 데이터
    dependency: {
      dependencies: DependencyInfo[]  // 의존성 배열
    }
  }
  performanceMetrics: PerformanceMetrics  // 성능 지표
  errors: any[]                       // 오류 배열
  metadata: AnalysisMetadata          // 메타데이터
}
```

### 2. 의존성 정보

```typescript
interface DependencyInfo {
  source: string                      // 의존성 소스 (예: "react", "./utils")
  specifiers: string[]                // import 지정자들
  type: "import" | "export" | "require"  // 의존성 타입
  isTypeOnly: boolean                 // 타입 전용 import 여부
  location: {                         // 소스 코드 위치
    line: number
    column: number
    endLine: number
    endColumn: number
  }
}
```

### 3. 배치 분석 결과

```typescript
interface TypedBatchResult {
  results: TypedAnalysisResult[]      // 개별 파일 분석 결과들
  summary: {                          // 요약 통계
    totalFiles: number
    successfulFiles: number
    failedFiles: number
    totalDependencies: number
    totalExternalDependencies: number
    totalInternalDependencies: number
  }
  failures: Array<{                   // 실패한 파일들
    filePath: string
    error: string
  }>
  timestamp: string                   // 분석 실행 시간
}
```

### 4. 필터 옵션

```typescript
interface FilterOptions {
  include?: string                    // 포함할 파일 글롭 패턴
  exclude?: string                    // 제외할 파일 글롭 패턴
  maxDepth?: number                   // 최대 디렉토리 깊이
  extensions?: string[]               // 허용할 파일 확장자들
  concurrency: number                 // 병렬 처리 수
}
```

## 유틸리티 함수들

### 타입 가드

```typescript
// 분석 성공 여부 확인
function isSuccessfulResult(result: TypedAnalysisResult): boolean

// 외부 의존성 여부 확인
function isExternalDependency(dependency: DependencyInfo): boolean
```

### 데이터 추출

```typescript
// 의존성 정보 추출
function extractDependencies(result: TypedAnalysisResult): DependencyInfo[]

// 외부/내부 의존성 개수 카운트
function countDependencyTypes(dependencies: DependencyInfo[]): {
  external: number
  internal: number
}
```

## 사용 예시

```typescript
import {
  TypedAnalysisResult,
  isSuccessfulResult,
  extractDependencies,
  countDependencyTypes
} from "./types/AnalysisTypes.js"

function processAnalysisResult(result: TypedAnalysisResult) {
  if (isSuccessfulResult(result)) {
    const deps = extractDependencies(result)
    const { external, internal } = countDependencyTypes(deps)

    console.log(`Found ${deps.length} dependencies:`)
    console.log(`- External: ${external}`)
    console.log(`- Internal: ${internal}`)
  }
}
```

## 출력 형식

- `json` - 전체 분석 결과를 JSON으로 출력
- `summary` - 요약된 형태로 출력
- `table` - 테이블 형태로 출력
- `csv` - CSV 형태로 출력

## 다중 파일 출력 구조

```
output-directory/
├── file-index.json                 # 파일 인덱스
├── results/                        # 개별 분석 결과들
│   ├── Component_abc123.json
│   └── utils_def456.json
└── summary/                        # 요약 정보
    └── batch-summary.json
```