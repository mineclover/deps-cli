# 미사용 Export 함수 식별 시스템

## 📋 기능 개요

TypeScript/JavaScript 프로젝트에서 **export되었지만 사용하지 않는 함수, 클래스, 변수**를 식별하여 데드 코드 제거를 지원하는 시스템입니다.

## 🎯 목표

### 핵심 목표
- **데드 코드 식별**: export되었지만 프로젝트 내에서 사용되지 않는 코드 탐지
- **번들 사이즈 최적화**: 불필요한 export 제거로 빌드 결과물 크기 감소
- **코드 품질 향상**: 사용하지 않는 코드 정리로 유지보수성 개선
- **기존 시스템 통합**: 현재 의존성 분석 시스템과 원활한 연동

### 부가 목표
- **라이브러리 고려**: 외부에서 사용될 수 있는 public API 보호
- **동적 import 지원**: `import()` 구문으로 동적 로딩되는 모듈 고려
- **트리셰이킹 분석**: 번들러의 트리셰이킹 효과 예측

## 🏗️ 시스템 아키텍처

### 1. 기존 시스템과의 통합 포인트

```typescript
// CodeDependencyAnalyzer 확장
export interface CodeAnalysisResult {
  internalModules: Array<CodeDependency>
  externalLibraries: Array<CodeDependency>
  builtinModules: Array<CodeDependency>
  todoAnalysis: TodoAnalysis
  unusedExportAnalysis?: UnusedExportAnalysis  // 새로 추가
}

// UnifiedDependencyAnalyzer에서 활용
export interface UnifiedAnalysisResult {
  // ... 기존 필드들
  unusedExports?: ProjectWideUnusedAnalysis    // 프로젝트 전체 분석 결과
}
```

### 2. 새로운 분석 엔진

```typescript
export class UnusedExportAnalyzer {
  constructor(private projectRoot: string, private dependencyGraph: DependencyGraph) {}

  // 단일 파일 분석
  async analyzeFileExports(filePath: string): Promise<FileExportAnalysis>

  // 프로젝트 전체 분석
  async analyzeProjectExports(files: string[]): Promise<ProjectWideUnusedAnalysis>

  // 사용량 추적
  private trackExportUsage(exports: ExportInfo[], imports: ImportInfo[]): UsageMap
}
```

## 📊 데이터 구조

### Export 정보
```typescript
export interface ExportInfo {
  name: string                           // export 이름
  type: ExportType                       // 'function' | 'class' | 'variable' | 'type' | 'interface'
  line: number                          // 소스코드 라인 번호
  filePath: string                      // 파일 경로
  isDefault: boolean                    // default export 여부
  isReExport: boolean                   // re-export 여부
  sourceLocation: {
    start: number
    end: number
    context: string                     // 주변 코드 컨텍스트
  }
  metadata: {
    complexity?: number                 // 함수/클래스 복잡도
    size: number                       // 코드 라인 수
    dependencies: string[]             // 이 export가 의존하는 다른 요소들
  }
}

export type ExportType = 'function' | 'class' | 'variable' | 'type' | 'interface' | 'namespace' | 'enum'
```

### Usage 추적 정보
```typescript
export interface ImportUsageInfo {
  importedName: string                  // import된 이름
  localName: string                    // 로컬에서 사용하는 이름 (alias 고려)
  filePath: string                     // import하는 파일
  line: number                         // import 라인
  usageCount: number                   // 파일 내 사용 횟수
  usageLocations: Array<{
    line: number
    context: string
    usageType: 'call' | 'reference' | 'type'
  }>
}

export interface UsageMap {
  [exportKey: string]: Array<ImportUsageInfo>  // "filePath:exportName" -> 사용처들
}
```

### 분석 결과
```typescript
export interface UnusedExportAnalysis {
  // 미사용 exports
  unusedExports: Array<ExportInfo>

  // 사용량이 적은 exports (임계값 기반)
  underutilizedExports: Array<{
    export: ExportInfo
    usageCount: number
    usedBy: string[]
  }>

  // export 사용량 맵핑
  exportUsageMap: UsageMap

  // 잠재적 데드 코드 (연쇄적으로 사용되지 않는 코드)
  potentialDeadCode: Array<ExportInfo>

  // 통계
  statistics: {
    totalExports: number
    unusedCount: number
    unusedPercentage: number
    potentialSavings: {
      lines: number
      estimatedBytes: number
    }
  }
}

export interface ProjectWideUnusedAnalysis {
  // 파일별 미사용 export 분석
  fileAnalyses: Map<string, UnusedExportAnalysis>

  // 프로젝트 전체 통계
  projectStatistics: {
    totalFiles: number
    filesWithUnusedExports: number
    totalUnusedExports: number
    mostUnusedFiles: Array<{
      filePath: string
      unusedCount: number
    }>
  }

  // 추천 사항
  recommendations: Array<{
    type: 'remove' | 'review' | 'make-internal'
    target: ExportInfo
    reason: string
    impact: 'low' | 'medium' | 'high'
  }>
}
```

## 🔍 분석 알고리즘

### 1. Export 수집 단계
```typescript
// 1단계: 모든 파일에서 export 추출
const allExports = await Promise.all(
  files.map(file => this.extractExports(file))
)

// 2단계: export 정보 정규화 및 인덱싱
const exportIndex = this.buildExportIndex(allExports)
```

### 2. Import 추적 단계
```typescript
// 1단계: 모든 import 구문 분석
const allImports = await Promise.all(
  files.map(file => this.extractImports(file))
)

// 2단계: import-export 매칭
const usageMap = this.matchImportsToExports(allImports, exportIndex)
```

### 3. 사용량 분석 단계
```typescript
// 1단계: 실제 사용량 계산 (심화 분석)
const usageAnalysis = await Promise.all(
  files.map(file => this.analyzeActualUsage(file, usageMap))
)

// 2단계: 미사용 export 식별
const unusedExports = this.identifyUnusedExports(exportIndex, usageMap)
```

### 4. 고급 분석
```typescript
// 연쇄 분석: A가 미사용이고 A만 사용하는 B도 미사용 판정
const deadCodeChains = this.analyzeDeadCodeChains(unusedExports, usageMap)

// 외부 사용 가능성 분석
const potentialPublicAPIs = this.analyzePublicAPILikelihood(unusedExports)
```

## 🎛️ 설정 옵션

### 분석 설정
```typescript
export interface UnusedExportAnalysisOptions {
  // 제외할 파일 패턴
  excludePatterns: string[]              // ["**/*.test.ts", "**/*.spec.ts"]

  // 외부 사용 가능성이 있는 파일들
  publicApiPatterns: string[]            // ["src/index.ts", "src/api/**/*.ts"]

  // 분석 깊이
  analysisDepth: {
    trackActualUsage: boolean            // import 후 실제 사용 여부까지 추적
    analyzeDeadCodeChains: boolean       // 연쇄적 미사용 분석
    considerDynamicImports: boolean      // 동적 import 고려
  }

  // 임계값
  thresholds: {
    underutilizedUsageCount: number      // 이 값 이하면 저활용 export로 분류
    complexityWarningLevel: number       // 복잡도가 높은 미사용 코드 경고 레벨
  }

  // 출력 옵션
  output: {
    includeContext: boolean              // 코드 컨텍스트 포함
    includeMetadata: boolean             // 복잡도, 크기 등 메타데이터 포함
    groupByFile: boolean                 // 파일별로 그룹핑
  }
}
```

## 🔧 구현 계획

### Phase 1: 기본 Export/Import 분석기
- [x] TODO 분석 기능 완료 (기반 작업)
- [ ] Export 파서 구현 (정규식 → AST 기반으로 진화 가능)
- [ ] Import-Export 매칭 로직
- [ ] 기본 미사용 export 식별

### Phase 2: 기존 시스템 통합
- [ ] `CodeDependencyAnalyzer`에 `UnusedExportAnalysis` 통합
- [ ] **캐싱 시스템 연동**: `AnalysisCache`와 미사용 export 분석 통합
  - [ ] `CachedUnusedExportResult` 구조 구현
  - [ ] 기존 `getGlobalAnalysisCache()` 확장
  - [ ] Git 기반 변경 감지와 연동
- [ ] `UnifiedDependencyAnalyzer`에서 프로젝트 전체 분석
- [ ] CLI 명령어에 미사용 export 분석 옵션 추가

### Phase 3: 고급 분석 기능
- [ ] 실제 사용량 추적 (import 후 실제 호출/참조 여부)
- [ ] 동적 import 지원
- [ ] 연쇄 미사용 분석 (dead code chains)

### Phase 4: 사용성 개선
- [ ] 설정 파일 지원 (`deps-cli.config.js`)
- [ ] 다양한 출력 포맷 (JSON, 표, 리포트)
- [ ] IDE 플러그인 연동 준비

## 📝 사용 시나리오

### CLI 사용 예제
```bash
# 기본 분석
node dist/bin.js analyze . --unused-exports

# 상세 분석
node dist/bin.js unused-exports . --include-context --analyze-chains

# 특정 디렉토리 분석
node dist/bin.js unused-exports src/ --exclude "**/*.test.ts"

# JSON 출력으로 CI/CD 연동
node dist/bin.js unused-exports . --format json --output unused-exports.json
```

### 프로그래밍 API
```typescript
import { UnusedExportAnalyzer } from 'deps-cli'

const analyzer = new UnusedExportAnalyzer('./src', {
  excludePatterns: ['**/*.test.ts'],
  analysisDepth: {
    trackActualUsage: true,
    analyzeDeadCodeChains: true
  }
})

const result = await analyzer.analyzeProjectExports(['./src/**/*.ts'])
console.log(`Found ${result.projectStatistics.totalUnusedExports} unused exports`)
```

## ⚠️ 고려사항

### 제한사항
1. **정적 분석의 한계**: 런타임에만 결정되는 동적 import는 완전히 추적하기 어려움
2. **외부 사용 가능성**: 라이브러리로 배포되는 경우 외부에서 사용될 수 있음
3. **복잡한 모듈 패턴**: barrel exports, conditional exports 등 복잡한 케이스

### 해결 방안
1. **설정을 통한 제외**: `publicApiPatterns`로 외부 사용 가능 파일 지정
2. **점진적 분석**: 확실한 미사용만 1차로 식별, 의심스러운 것은 별도 카테고리
3. **사용자 검토 단계**: 자동 삭제가 아닌 검토용 리포트 제공

## 🔗 기존 시스템과의 연동

### DependencyGraph 활용
- 기존 의존성 그래프를 기반으로 export 사용처 추적
- 순환 의존성 정보와 함께 미사용 export 분석
- 클러스터 정보를 활용한 모듈별 미사용 export 분류

### 캐싱 시스템 연동 (핵심 성능 최적화)

#### 기존 AnalysisCache 활용
```typescript
// 기존 캐싱 시스템 확장
export interface CachedUnusedExportResult {
  fileHash: string                     // 파일 해시 (변경 감지용)
  gitCommitHash: string               // Git 커밋 해시
  exports: ExportInfo[]               // 해당 파일의 export 정보
  lastAnalyzed: Date                  // 마지막 분석 시각
  dependencies: string[]              // 이 파일이 의존하는 파일들
}

// 프로젝트 전체 캐시
export interface ProjectExportCache {
  projectHash: string                 // 전체 프로젝트 해시
  fileExportMap: Map<string, CachedUnusedExportResult>
  usageMap: UsageMap                  // 전체 사용량 맵
  lastFullAnalysis: Date              // 마지막 전체 분석 시각
}
```

#### 점진적 분석 전략
1. **변경된 파일만 재분석**: Git diff 기반으로 변경된 파일의 export만 업데이트
2. **영향 전파 분석**: 변경된 파일을 import하는 파일들의 사용량만 재계산
3. **캐시 무효화 최소화**: 파일 간 의존성 그래프를 활용한 정밀한 무효화

#### 성능 최적화 효과
- **첫 분석**: 전체 스캔 (1회만)
- **증분 분석**: 변경된 파일 + 의존 파일만 (95% 시간 단축 예상)
- **캐시 히트율**: 기존 시스템 기반 80%+ 예상

### 리포팅 시스템 확장
- 기존 의존성 리포트에 미사용 export 섹션 추가
- 시각화 도구와 연동하여 미사용 export 분포 표시
- 시계열 분석으로 미사용 export 변화 추적

이 문서를 기반으로 단계적으로 구현하여 기존 시스템과 자연스럽게 통합된 미사용 export 분석 기능을 제공할 예정입니다.