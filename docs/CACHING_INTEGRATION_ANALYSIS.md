# 현재 캐싱 시스템 분석 및 미사용 Export 통합 방안

## 📊 현재 캐싱 시스템 구조 분석

### 1. 기존 AnalysisCache 구조

```typescript
// 현재 캐싱 데이터 구조
interface CachedAnalysisResult {
  fileMetadata: FileMetadata      // 파일 메타데이터 (크기, mtime, hash)
  analysisResult: any             // 분석 결과 (현재는 any 타입)
  dependencies: string[]          // 의존성 파일 경로들
  timestamp: number               // 캐시 생성 시각
  version: string                 // 캐시 버전
}

interface FileMetadata {
  path: string                    // 파일 경로
  size: number                    // 파일 크기
  mtime: number                   // 수정 시간
  hash: string                    // 파일 해시 (SHA-256)
  gitHash?: string                // Git 커밋 해시 (선택적)
}
```

### 2. 현재 캐싱 활용 지점

#### UnifiedDependencyAnalyzer에서의 사용

1. **analyzeProject()** - 기본 분석
2. **analyzeProjectIncremental()** - 점진적 분석
3. **analyzeProjectSmart()** - 스마트 분석

```typescript
// 현재 캐싱 프로세스:
const cache = getGlobalAnalysisCache(projectRoot)

// 1. 변경된 파일 식별
const changeAnalysis = await cache.getChangedFiles(files)

// 2. 캐시 히트/미스 처리
for (const file of changeAnalysis.unchanged) {
  const cachedResult = await cache.getAnalysisResult(file)
  if (cachedResult) {
    // 캐시 히트 - 기존 결과 사용
    cacheStats.hits++
  }
}

// 3. 변경된 파일만 새로 분석
for (const file of changeAnalysis.changed) {
  const newResult = await analyzer.analyzeFile(file)
  await cache.setAnalysisResult(file, newResult, dependencies)
  cacheStats.misses++
}
```

### 3. 캐시 무효화 전략

현재 시스템은 **3단계 검증**을 통해 캐시 유효성을 확인:

1. **파일 메타데이터 검증**: 크기, 수정시간, 해시 비교
2. **의존성 변경 검증**: 의존하는 파일들의 변경 여부 확인
3. **Git 상태 검증**: Git 커밋 해시 변경 시 전체 재검증

## 🔗 미사용 Export 분석 통합 방안

### Phase 1: 기존 캐싱 구조 확장

#### 1.1 CachedAnalysisResult 확장

```typescript
// 기존 구조를 확장하여 미사용 export 정보 포함
interface EnhancedCachedAnalysisResult extends CachedAnalysisResult {
  analysisResult: {
    // 기존 CodeAnalysisResult
    internalModules: Array<CodeDependency>
    externalLibraries: Array<CodeDependency>
    builtinModules: Array<CodeDependency>
    todoAnalysis: TodoAnalysis

    // 새로 추가 - 미사용 export 정보
    exports?: ExportInfo[]              // 이 파일의 모든 export 정보
    unusedExportAnalysis?: UnusedExportAnalysis  // 미사용 분석 결과
  }

  // 새 필드 추가
  exportDependents: string[]            // 이 파일을 import하는 파일들
  lastExportAnalysis?: number           // 마지막 export 분석 시각
}
```

#### 1.2 프로젝트 전체 캐시 추가

```typescript
// 새로운 프로젝트 레벨 캐시 구조
interface ProjectExportCache {
  projectHash: string                   // 전체 프로젝트 해시
  lastFullAnalysis: number              // 마지막 전체 분석 시각

  // Export-Import 매핑 정보 (프로젝트 전체)
  globalUsageMap: {
    [exportKey: string]: {              // "filePath:exportName"
      usedBy: string[]                  // 사용하는 파일들
      usageCount: number                // 총 사용 횟수
      lastUpdated: number               // 마지막 업데이트 시각
    }
  }

  // 캐시 메타데이터
  cacheVersion: string
  analysisOptions: UnusedExportAnalysisOptions
}
```

### Phase 2: 캐싱 프로세스 통합

#### 2.1 CodeDependencyAnalyzer 레벨 캐싱

```typescript
// CodeDependencyAnalyzer.analyzeCodeFile()에 캐싱 통합
async analyzeCodeFile(contentOrFilePath: string, filePath?: string): Promise<CodeAnalysisResult> {
  const actualFilePath = /* ... 파일 경로 결정 로직 ... */

  // 🔄 캐시 확인 (기존 로직 활용)
  const cache = getGlobalAnalysisCache(this.projectRoot)
  const cachedResult = await cache.getAnalysisResult(actualFilePath)

  if (cachedResult) {
    // 캐시 히트: 기존 결과 반환
    return cachedResult
  }

  // 캐시 미스: 새로 분석
  const content = /* ... 컨텐츠 로드 ... */
  const dependencies = await this.extractDependencies(content, actualFilePath)

  const result = {
    internalModules: this.classifyInternalModules(dependencies, actualFilePath, processedSources),
    externalLibraries: this.classifyExternalLibraries(dependencies, actualFilePath, processedSources),
    builtinModules: this.classifyBuiltinModules(dependencies, actualFilePath, processedSources),
    todoAnalysis: this.analyzeTodoComments(content, actualFilePath),

    // ⭐ 새 추가: Export 정보 추출 (단일 파일 레벨)
    exports: this.extractExportInfo(content, actualFilePath)
  }

  // 🔄 캐시 저장 (기존 로직 활용)
  const dependencyFiles = dependencies.map(d => d.resolvedPath).filter(Boolean)
  await cache.setAnalysisResult(actualFilePath, result, dependencyFiles)

  return result
}
```

#### 2.2 UnifiedDependencyAnalyzer 레벨 프로젝트 분석

```typescript
// 프로젝트 전체 미사용 export 분석 (기존 스마트 분석과 통합)
async analyzeProjectSmart(files: Array<string>): Promise<UnifiedAnalysisResult> {
  const cache = getGlobalAnalysisCache(this.projectRoot)

  // 🔄 기존 변경 감지 로직 활용
  const changeAnalysis = await cache.getChangedFiles(files.map(f => path.resolve(f)))

  // 🔄 기존 파일별 분석 결과 수집 (캐시 활용)
  const codeResults = new Map<string, CodeAnalysisResult>()

  // 캐시된 파일들 처리
  for (const file of changeAnalysis.unchanged) {
    const cachedResult = await cache.getAnalysisResult(file)
    if (cachedResult) {
      codeResults.set(file, cachedResult)
      cacheStats.hits++
    }
  }

  // 변경된 파일들 새로 분석
  for (const file of changeAnalysis.changed) {
    const result = await this.codeAnalyzer.analyzeCodeFile(file)
    codeResults.set(file, result)
    cacheStats.misses++
  }

  // ⭐ 새 추가: 프로젝트 전체 미사용 export 분석
  const projectExportAnalysis = await this.analyzeProjectUnusedExports(
    codeResults,
    changeAnalysis
  )

  // 기존 결과에 미사용 export 정보 추가
  const result = {
    // ... 기존 필드들
    unusedExports: projectExportAnalysis,  // 새 필드 추가
    analysisMetadata: {
      // ... 기존 메타데이터
      cacheStats,
      exportAnalysisStats: {
        totalExports: projectExportAnalysis.projectStatistics.totalUnusedExports,
        analysisTime: /* ... */
      }
    }
  }

  return result
}
```

### Phase 3: 고성능 증분 분석

#### 3.1 Export 변경 영향 전파 분석

```typescript
// 파일 변경 시 영향받는 범위를 최소화
async analyzeExportChangeImpact(changedFiles: string[]): Promise<{
  affectedExports: ExportInfo[],
  affectedImporters: string[]
}> {
  const affectedExports = []
  const affectedImporters = new Set<string>()

  for (const file of changedFiles) {
    // 1. 변경된 파일의 export 정보 추출
    const exports = await this.extractExportInfo(file)
    affectedExports.push(...exports)

    // 2. 이 파일을 import하는 모든 파일 찾기 (의존성 그래프 활용)
    const importers = this.dependencyGraph.getImporters(file)
    importers.forEach(imp => affectedImporters.add(imp))
  }

  return {
    affectedExports,
    affectedImporters: Array.from(affectedImporters)
  }
}
```

#### 3.2 선택적 캐시 무효화

```typescript
// 미사용 export 분석에 특화된 캐시 무효화
async invalidateExportAnalysisCache(
  changedFiles: string[],
  impactAnalysis: ExportChangeImpact
): Promise<void> {

  // 1. 직접 변경된 파일들의 export 캐시 무효화
  for (const file of changedFiles) {
    await this.cache.invalidateFileExportCache(file)
  }

  // 2. 영향받는 importer들의 사용량 분석 캐시 무효화
  for (const importer of impactAnalysis.affectedImporters) {
    await this.cache.invalidateUsageAnalysisCache(importer)
  }

  // 3. 프로젝트 레벨 통계는 유지 (부분 업데이트)
  await this.updateProjectExportStatistics(impactAnalysis)
}
```

## 🎯 최적 통합 지점 및 프로세스

### 1. 단일 파일 분석 (CodeDependencyAnalyzer)

**통합 지점**: `CodeDependencyAnalyzer.analyzeCodeFile()`
**캐싱 전략**: 기존 파일 메타데이터 기반 캐싱 100% 활용

```typescript
// 의사코드
if (cacheHit) {
  return cachedResult.exports  // export 정보도 캐시에서 가져옴
} else {
  const exports = extractExports(content)
  const result = { /* 기존 필드들 */, exports }
  saveToCache(result)  // export 정보도 함께 캐시
  return result
}
```

### 2. 프로젝트 전체 분석 (UnifiedDependencyAnalyzer)

**통합 지점**: `analyzeProjectSmart()`, `analyzeProjectIncremental()`
**캐싱 전략**: 기존 변경 감지 + 새로운 프로젝트 레벨 캐시

```typescript
// 의사코드
const changedFiles = await cache.getChangedFiles()

if (changedFiles.length === 0) {
  // 전체 캐시 히트 - 프로젝트 캐시에서 미사용 export 정보 로드
  return loadFromProjectCache()
} else {
  // 부분 업데이트
  const impact = await analyzeChangeImpact(changedFiles)
  const partialResult = await updateAffectedExports(impact)
  await updateProjectCache(partialResult)
  return partialResult
}
```

### 3. Git 훅 통합 시나리오

**Pre-commit**: 변경된 파일들의 미사용 export만 빠르게 체크
**Post-commit**: 전체 프로젝트 통계 업데이트 및 캐시 최적화
**CI/CD**: 주기적인 전체 미사용 export 리포트 생성

## 📈 예상 성능 효과

### 초기 분석 (Cold Start)
- **기존**: 전체 파일 분석 (100% 시간)
- **통합 후**: 전체 파일 분석 + export 추출 (110% 시간) - 10% 오버헤드

### 증분 분석 (Warm Cache)
- **기존**: 변경된 파일만 분석 (10-20% 시간)
- **통합 후**: 변경된 파일 + 영향받는 import 관계만 재계산 (15-25% 시간)

### 캐시 히트율 예상
- **파일 레벨**: 80-90% (기존과 동일)
- **프로젝트 레벨**: 95%+ (Git 커밋 단위 변경)

### 메모리 사용량 증가
- **파일당**: +20% (export 정보 저장)
- **프로젝트 전체**: +50% (전역 사용량 맵핑)

## 🔧 구현 우선순위

### Priority 1: 기존 시스템 최소 변경
1. `CodeAnalysisResult`에 `exports` 필드 추가
2. `CodeDependencyAnalyzer`에서 export 추출 로직 추가
3. 기존 캐싱 메커니즘 그대로 활용

### Priority 2: 프로젝트 전체 분석
1. `UnusedExportAnalyzer` 클래스 신규 생성
2. `UnifiedDependencyAnalyzer`와 통합
3. 프로젝트 레벨 캐시 구조 추가

### Priority 3: 성능 최적화
1. 선택적 캐시 무효화 로직
2. 변경 영향 전파 분석
3. 메모리 사용량 최적화

이러한 접근 방식을 통해 **기존 캐싱 시스템의 장점을 100% 활용**하면서도 **미사용 export 분석 기능을 자연스럽게 통합**할 수 있습니다.