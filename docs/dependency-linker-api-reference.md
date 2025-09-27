# @context-action/dependency-linker API Reference

> 현재 사용 중인 버전: **2.3.0**
> 목적: deps-cli 프로젝트에서 스펙 유지 및 API 호환성 관리
> **⚠️ 중요**: v2.4.0 개발 시 이 문서의 모든 스펙을 준수해야 함

## 📋 deps-cli에서 정확히 사용 중인 API 스펙

### 1. EnhancedExportExtractor

**주요 메서드:**
```typescript
class EnhancedExportExtractor {
  extractExports(ast: Parser.Tree, filePath: string, options?: ExtractorOptions): EnhancedExportExtractionResult
}
```

**반환 타입:**
```typescript
interface EnhancedExportExtractionResult {
  exportMethods: ExportMethodInfo[]     // ⭐ 주요 사용 필드
  statistics: ExportStatistics
  classes: ClassExportInfo[]
}

interface ExportMethodInfo {
  name: string                          // 메서드/함수 이름
  exportType: ExportType               // 'function' | 'class' | 'variable' | 'type' | 'enum' | 'default' | 'class_method' | 'class_property' | 're_export'
  declarationType: DeclarationType      // 'named_export' | 'default_export' | 'assignment_export' | 'class_member' | 're_export'
  location: SourceLocation            // 소스 위치 정보
  parentClass?: string                 // 클래스 메서드인 경우 부모 클래스명
  isAsync?: boolean
  isStatic?: boolean
  visibility?: 'public' | 'private' | 'protected'
  parameters?: ParameterInfo[]
  returnType?: string
}

interface ExportStatistics {
  totalExports: number
  functionExports: number
  classExports: number
  variableExports: number
  typeExports: number
  defaultExports: number
  classMethodsExports: number
  classPropertiesExports: number
}
```

**실제 deps-cli 사용 패턴 (정확한 라인 번호와 함께):**

#### 1.1 초기화 (src/analyzers/EnhancedDependencyAnalyzer.ts:48-49)
```typescript
constructor(private projectRoot: string) {
  this.parser = new TypeScriptParser()
  this.extractor = new EnhancedExportExtractor()  // ⭐ 생성자 없이 초기화
}
```

#### 1.2 Export 추출 (src/analyzers/EnhancedDependencyAnalyzer.ts:104)
```typescript
if (parseResult.ast) {
  const exportResult = this.extractor.extractExports(parseResult.ast, filePath)  // ⭐ 핵심 호출
  exportMap.set(filePath, exportResult)
}
```

#### 1.3 exportMethods 필드 사용 - 의존성 매칭 (src/analyzers/EnhancedDependencyAnalyzer.ts:192)
```typescript
const validImports = importDecl.importedMembers.filter(member =>
  targetExports.exportMethods.some(exp => exp.name === member)  // ⭐ CRITICAL: exportMethods 필드
)
```

#### 1.4 exportMethods 필드 사용 - 미사용 메서드 찾기 (src/analyzers/EnhancedDependencyAnalyzer.ts:399-400)
```typescript
if (exportResult.exportMethods) {  // ⭐ CRITICAL: null 체크 필요
  exportResult.exportMethods.forEach((exp: any) => {  // ⭐ any 타입으로 처리
    if (exp.type === 'class_method' || exp.type === 'function') {
      // 미사용 메서드 식별 로직
    }
  })
}
```

**⚠️ 중요한 구현 디테일:**
- `exportMethods` 필드는 반드시 존재해야 함 (v2.3.0에서 `exports` → `exportMethods`로 변경됨)
- `exportMethods`는 배열이며 `null`일 수 있으므로 체크 필요
- 각 export 객체는 `name`, `type` 필드를 반드시 포함해야 함

### 2. TypeScriptParser

**주요 메서드:**
```typescript
class TypeScriptParser implements ILanguageParser {
  parse(filePath: string, content?: string): Promise<ParseResult>
  supports(language: string): boolean
  detectLanguage(filePath: string, content?: string): string
  validateSyntax(content: string): SyntaxValidationResult
  parseFile(filePath: string, content?: string): Promise<any>  // ⭐ deps-cli에서 사용
}
```

**반환 타입:**
```typescript
interface ParseResult {
  ast: AST | null                      // ⭐ 주요 사용 필드 (Tree-sitter AST)
  typedAST?: TypeSafeAST
  language: string
  parseTime: number
  cacheHit: boolean
  errors: ParseError[]
  warnings: ParseWarning[]
  metadata: ParseMetadata
}

interface ParseMetadata {
  nodeCount: number
  maxDepth: number
  fileSize: number
  encoding: string
  parserVersion: string
  grammarVersion: string
  memoryUsage: number
  incremental: boolean
  timings: ParseTimings
}
```

**실제 deps-cli 사용 패턴 (정확한 라인 번호와 함께):**

#### 2.1 초기화 (src/analyzers/EnhancedDependencyAnalyzer.ts:48)
```typescript
constructor(private projectRoot: string) {
  this.parser = new TypeScriptParser()  // ⭐ 생성자 없이 초기화
  this.extractor = new EnhancedExportExtractor()
}
```

#### 2.2 캐시와 함께 파싱 (src/analyzers/EnhancedDependencyAnalyzer.ts:242)
```typescript
// parseWithCache 메서드 내부
const parseResult = await this.parser.parse(filePath, content)  // ⭐ 핵심 호출
this.parseCache.set(filePath, parseResult)
return parseResult
```

#### 2.3 AST 사용 패턴 (src/analyzers/EnhancedDependencyAnalyzer.ts:104)
```typescript
const parseResult = await this.parseWithCache(filePath, content)
if (parseResult.ast) {  // ⭐ CRITICAL: ast 필드 체크 필수
  const exportResult = this.extractor.extractExports(parseResult.ast, filePath)
  exportMap.set(filePath, exportResult)
}
```

**⚠️ 중요한 구현 디테일:**
- `TypeScriptParser` 생성자는 매개변수 없이 호출됨
- `parse()` 메서드는 반드시 `{ ast: Parser.Tree | null, ... }` 형태를 반환해야 함
- `parseResult.ast`는 `null`일 수 있으므로 반드시 체크해야 함
- 캐싱 시스템을 고려하여 동일한 파일에 대해 동일한 결과를 반환해야 함

### 3. 공통 타입 정의

**SourceLocation:**
```typescript
interface SourceLocation {
  line: number
  column: number
  endLine?: number
  endColumn?: number
  offset?: number
  length?: number
}
```

**ParserOptions:**
```typescript
interface ParserOptions {
  maxFileSize?: number
  memoryLimit?: number
  timeout?: number
  enableErrorRecovery?: boolean
  enableIncremental?: boolean
  includeLocations?: boolean
  includeTrivia?: boolean
  grammarOptions?: Record<string, any>
  encoding?: string
  language?: string
}
```

## 🔧 deps-cli의 완전한 워크플로우 분석

### 1. EnhancedDependencyAnalyzer 클래스 구조

#### 1.1 클래스 필드 (src/analyzers/EnhancedDependencyAnalyzer.ts:42-44)
```typescript
export class EnhancedDependencyAnalyzer {
  private parser: TypeScriptParser              // ⭐ v2.4.0에서 유지 필요
  private extractor: EnhancedExportExtractor     // ⭐ v2.4.0에서 유지 필요
  private parseCache = new Map<string, any>()   // ⭐ 성능 최적화용 캐시
}
```

#### 1.2 생성자 패턴 (src/analyzers/EnhancedDependencyAnalyzer.ts:46-49)
```typescript
constructor(private projectRoot: string) {
  this.parser = new TypeScriptParser()        // ⭐ 매개변수 없는 생성자
  this.extractor = new EnhancedExportExtractor() // ⭐ 매개변수 없는 생성자
}
```

### 2. 핵심 메서드별 상세 분석

#### 2.1 parseWithCache - 캐싱 전략 (src/analyzers/EnhancedDependencyAnalyzer.ts:236-244)
```typescript
private async parseWithCache(filePath: string, content?: string): Promise<any> {
  if (this.parseCache.has(filePath)) {
    return this.parseCache.get(filePath)       // ⭐ 캐시 히트 최우선
  }

  const parseResult = await this.parser.parse(filePath, content) // ⭐ 필수 시그니처
  this.parseCache.set(filePath, parseResult)  // ⭐ 결과 캐싱
  return parseResult                           // ⭐ Promise<ParseResult> 타입
}
```

#### 2.2 collectAllExports - Export 수집 로직 (src/analyzers/EnhancedDependencyAnalyzer.ts:94-112)
```typescript
private async collectAllExports(sortedFiles: Array<string>): Promise<Map<string, EnhancedExportExtractionResult>> {
  const exportMap = new Map<string, EnhancedExportExtractionResult>()

  for (const filePath of sortedFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const parseResult = await this.parseWithCache(filePath, content)

      if (parseResult.ast) {  // ⭐ CRITICAL: null 체크 필수
        const exportResult = this.extractor.extractExports(parseResult.ast, filePath)
        exportMap.set(filePath, exportResult)  // ⭐ Map에 저장
      }
    } catch (error) {
      console.warn(`Failed to extract exports from ${filePath}:`, error)  // ⭐ 에러 처리
    }
  }

  return exportMap
}
```

#### 2.3 buildDependencyEdges - Import-Export 매칭 (src/analyzers/EnhancedDependencyAnalyzer.ts:176-206)
```typescript
private buildDependencyEdges(
  importMap: Map<string, Array<ImportDeclaration>>,
  exportMap: Map<string, EnhancedExportExtractionResult>
): Array<DependencyEdge> {
  const edges: Array<DependencyEdge> = []

  for (const [fromFile, imports] of importMap) {
    for (const importDecl of imports) {
      if (!importDecl.resolvedPath) continue    // ⭐ 경로 검증

      const targetExports = exportMap.get(importDecl.resolvedPath)
      if (!targetExports) continue              // ⭐ Export 존재 확인

      // ⭐ CRITICAL: exportMethods 필드 사용 (line 192)
      const validImports = importDecl.importedMembers.filter(member =>
        targetExports.exportMethods.some(exp => exp.name === member)
      )

      if (validImports.length > 0) {
        edges.push({                           // ⭐ DependencyEdge 생성
          from: fromFile,
          to: importDecl.resolvedPath,
          importedMembers: validImports,
          line: importDecl.line
        })
      }
    }
  }

  return edges
}
```

### 3. 미사용 코드 분석 메서드

#### 3.1 findUnusedMethodsFromGraph (src/analyzers/EnhancedDependencyAnalyzer.ts:393-422)
```typescript
findUnusedMethodsFromGraph(graph: ProjectDependencyGraph): Array<any> {
  const unusedMethods: Array<any> = []

  for (const [filePath, exportResult] of graph.exportMap) {
    if (exportResult.exportMethods) {          // ⭐ CRITICAL: null 체크
      exportResult.exportMethods.forEach((exp: any) => {  // ⭐ any 타입 처리
        if (exp.type === 'class_method' || exp.type === 'function') {
          const isImported = graph.edges.some(edge =>
            edge.to === filePath && edge.importedMembers.includes(exp.name)
          )

          if (!isImported) {
            unusedMethods.push({               // ⭐ 결과 객체 구조
              className: exp.className || 'standalone',
              methodName: exp.name,            // ⭐ exp.name 필드 필수
              type: exp.type,                  // ⭐ exp.type 필드 필수
              filePath,
              line: exp.line || 0,
              visibility: exp.visibility || 'public'
            })
          }
        }
      })
    }
  }

  return unusedMethods
}
```

## 🚨 v2.4.0 개발을 위한 엄격한 호환성 요구사항

### CRITICAL: 반드시 유지해야 하는 API 시그니처

#### 1. EnhancedExportExtractor
```typescript
// ⭐ MUST KEEP: 생성자 시그니처
class EnhancedExportExtractor {
  constructor()  // 매개변수 없는 생성자 필수

  // ⭐ MUST KEEP: 메서드 시그니처
  extractExports(ast: Parser.Tree, filePath: string, options?: ExtractorOptions): EnhancedExportExtractionResult
}

// ⭐ MUST KEEP: 반환 타입 구조
interface EnhancedExportExtractionResult {
  exportMethods: ExportMethodInfo[]     // 필드명 변경 금지!
  statistics: ExportStatistics
  classes: ClassExportInfo[]
}

// ⭐ MUST KEEP: ExportMethodInfo 최소 필드
interface ExportMethodInfo {
  name: string                          // 필수 필드
  exportType: ExportType               // type 별칭 사용 금지
  // ... 기타 필드들은 추가 가능하지만 삭제 금지
}
```

#### 2. TypeScriptParser
```typescript
// ⭐ MUST KEEP: 생성자 시그니처
class TypeScriptParser {
  constructor(options?: ParserOptions)  // 매개변수 선택적

  // ⭐ MUST KEEP: 메서드 시그니처
  parse(filePath: string, content?: string): Promise<ParseResult>
}

// ⭐ MUST KEEP: 반환 타입 구조
interface ParseResult {
  ast: AST | null                      // 필드명 변경 금지! null 허용 필수
  // ... 기타 필드들은 추가 가능하지만 삭제 금지
}
```

### deps-cli가 의존하는 정확한 동작 방식

#### 1. 필수 유지 동작들
```typescript
// ✅ CRITICAL: 이런 코드가 정확히 작동해야 함
const parser = new TypeScriptParser()                    // 매개변수 없이 생성
const extractor = new EnhancedExportExtractor()          // 매개변수 없이 생성

const parseResult = await parser.parse(filePath, content) // content 옵셔널
if (parseResult.ast) {                                   // ast가 null일 수 있음
  const exportResult = extractor.extractExports(parseResult.ast, filePath)

  if (exportResult.exportMethods) {                      // exportMethods가 null일 수 있음
    exportResult.exportMethods.forEach((exp: any) => {   // any 타입으로 처리됨
      if (exp.name && exp.type) {                        // name, type 필드 필수
        // 정상 처리
      }
    })
  }
}
```

#### 2. 금지된 변경사항
```typescript
// ❌ 절대 금지: 필드명 변경
interface EnhancedExportExtractionResult {
  exports: ExportMethodInfo[]          // ❌ exportMethods → exports 변경 금지
  exportItems: ExportMethodInfo[]      // ❌ 다른 이름으로 변경 금지
}

// ❌ 절대 금지: 필수 매개변수 추가
class TypeScriptParser {
  constructor(requiredParam: string)   // ❌ 필수 매개변수 추가 금지
}

// ❌ 절대 금지: 반환 타입 구조 변경
interface ParseResult {
  syntaxTree: AST | null              // ❌ ast → syntaxTree 변경 금지
}
```

### v2.3.0에서 작동하는 정확한 패턴
```typescript
// ✅ 이 패턴들이 v2.4.0에서도 100% 동일하게 작동해야 함

// 패턴 1: 초기화
const analyzer = new EnhancedDependencyAnalyzer(projectRoot)

// 패턴 2: 파싱 + 캐싱
const parseResult = await this.parser.parse(filePath, content)
this.parseCache.set(filePath, parseResult)

// 패턴 3: Export 추출
if (parseResult.ast) {
  const exportResult = this.extractor.extractExports(parseResult.ast, filePath)
  exportMap.set(filePath, exportResult)
}

// 패턴 4: exportMethods 사용
const validImports = importDecl.importedMembers.filter(member =>
  targetExports.exportMethods.some(exp => exp.name === member)
)

// 패턴 5: 타입 기반 필터링
if (exp.type === 'class_method' || exp.type === 'function') {
  // 처리 로직
}
```

## 📊 deps-cli 코드에서 발견된 실제 사용 통계

### Import 문 분석
```typescript
// src/analyzers/EnhancedDependencyAnalyzer.ts:3
import { EnhancedExportExtractor, TypeScriptParser, type EnhancedExportExtractionResult } from '@context-action/dependency-linker'

// src/types/AnalysisTypes.ts:9
export type { AnalysisResult, BatchResult, BatchSummary } from "@context-action/dependency-linker"
```

### 메서드 호출 빈도 분석
| 메서드/필드 | 사용 위치 | 사용 빈도 | 중요도 |
|-------------|-----------|-----------|--------|
| `new TypeScriptParser()` | EnhancedDependencyAnalyzer:48 | 1회 | 🔴 CRITICAL |
| `new EnhancedExportExtractor()` | EnhancedDependencyAnalyzer:49 | 1회 | 🔴 CRITICAL |
| `parser.parse()` | EnhancedDependencyAnalyzer:242 | 캐시 미스 시마다 | 🔴 CRITICAL |
| `extractor.extractExports()` | EnhancedDependencyAnalyzer:104 | 파일당 1회 | 🔴 CRITICAL |
| `exportMethods` 필드 접근 | EnhancedDependencyAnalyzer:192,400 | 의존성 분석 시마다 | 🔴 CRITICAL |
| `exp.name` 필드 접근 | EnhancedDependencyAnalyzer:192,306 | export 항목당 1회 | 🔴 CRITICAL |
| `exp.type` 필드 접근 | EnhancedDependencyAnalyzer:400,307 | 타입 필터링 시마다 | 🔴 CRITICAL |

### 타입 의존성 맵
```
deps-cli 핵심 기능
    ↓
EnhancedDependencyAnalyzer
    ↓
┌─────────────────────┬──────────────────────┐
│   TypeScriptParser  │  EnhancedExportExtractor  │
│                     │                      │
│   .parse()          │  .extractExports()   │
│   ↓                 │  ↓                   │
│   ParseResult       │  EnhancedExportExtractionResult
│   ├─ ast: AST|null  │  ├─ exportMethods[]  │
│   └─ ...            │  ├─ statistics       │
│                     │  └─ classes          │
└─────────────────────┴──────────────────────┘
                ↓
        ExportMethodInfo[]
        ├─ name: string      (필수)
        ├─ type: string      (필수)
        ├─ className?: string
        └─ ...
```

## 📚 v2.4.0 개발 체크리스트

### ✅ 필수 구현 사항
- [ ] `EnhancedExportExtractor` 클래스: 매개변수 없는 생성자
- [ ] `TypeScriptParser` 클래스: 매개변수 없는 생성자
- [ ] `extractExports(ast, filePath, options?)` 메서드 시그니처 유지
- [ ] `parse(filePath, content?)` 메서드 시그니처 유지
- [ ] `EnhancedExportExtractionResult.exportMethods` 필드명 유지
- [ ] `ParseResult.ast` 필드명 유지 (null 허용)
- [ ] `ExportMethodInfo.name` 필드 유지
- [ ] `ExportMethodInfo.type` 필드 유지 (또는 exportType)

### ✅ 테스트 케이스
```typescript
// v2.4.0에서 이 모든 코드가 오류 없이 작동해야 함
describe('dependency-linker v2.4.0 compatibility', () => {
  it('should maintain constructor signatures', () => {
    const parser = new TypeScriptParser()
    const extractor = new EnhancedExportExtractor()
    expect(parser).toBeDefined()
    expect(extractor).toBeDefined()
  })

  it('should maintain parse method signature', async () => {
    const parser = new TypeScriptParser()
    const result = await parser.parse('test.ts', 'export const x = 1')
    expect(result.ast).toBeDefined()
  })

  it('should maintain extractExports method signature', async () => {
    const parser = new TypeScriptParser()
    const extractor = new EnhancedExportExtractor()
    const parseResult = await parser.parse('test.ts', 'export const x = 1')

    if (parseResult.ast) {
      const exportResult = extractor.extractExports(parseResult.ast, 'test.ts')
      expect(exportResult.exportMethods).toBeDefined()
      expect(Array.isArray(exportResult.exportMethods)).toBe(true)
    }
  })

  it('should maintain ExportMethodInfo structure', async () => {
    // ... exportMethods 배열의 각 항목이 name, type 필드를 가져야 함
  })
})
```

**현재 의존성 버전:** `@context-action/dependency-linker@2.3.0`
**Tree-sitter 버전:** `^0.21.0`
**지원 언어:** TypeScript, JavaScript, Go, Java, Markdown

---

> 🚨 **v2.4.0 개발자에게**: 이 문서의 모든 API 시그니처와 동작 방식을 정확히 구현해야 deps-cli와 호환됩니다. 특히 `exportMethods` 필드명과 생성자 시그니처는 절대 변경하면 안 됩니다.