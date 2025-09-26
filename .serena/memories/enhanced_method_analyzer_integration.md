# EnhancedExportExtractor를 활용한 메서드 분석기 통합 설계

## 1. 현재 상황 분석
- **deps-cli**: 파일 간 의존성 분석 (import/export 레벨)
- **EnhancedExportExtractor**: 메서드/클래스 상세 분석 기능 제공
- **목표**: 두 도구를 통합하여 메서드 레벨 흐름 분석 구현

## 2. EnhancedExportExtractor 주요 기능
- ✅ 메서드/함수 추출 및 분석
- ✅ 클래스 상세 정보 (메서드, 프로퍼티, 상속관계)
- ✅ TypeScript AST 기반 정확한 분석
- ✅ 파라미터, 반환타입, 접근제어자 분석
- ✅ 위치 정보(line, column) 제공

## 3. 통합 아키텍처

### 3.1 의존성 추가
```bash
pnpm add @context-action/dependency-linker
```

### 3.2 새로운 분석기 구조
```
src/analyzers/
├── MethodFlowAnalyzer.ts          # 새로 생성
├── EnhancedCodeAnalyzer.ts        # 기존 CodeDependencyAnalyzer 확장
└── UnifiedDependencyAnalyzer.ts   # 통합 지점
```

### 3.3 타입 시스템 확장
```typescript
// src/types/MethodFlowTypes.ts
interface MethodFlowResult {
  exportData: EnhancedExportExtractionResult  // dependency-linker 결과
  methodCalls: MethodCallRelation[]           // 호출 관계 분석
  methodMetrics: MethodMetrics                // 메서드 복잡도 등
  callGraph: MethodCallGraph                  // 호출 그래프
}

interface MethodCallRelation {
  fromMethod: string
  toMethod: string
  callSite: SourceLocation
  confidence: number
}

interface MethodMetrics {
  totalMethods: number
  publicMethods: number
  privateMethods: number
  staticMethods: number
  asyncMethods: number
  averageComplexity: number
}
```

## 4. 구현 계획

### 4.1 MethodFlowAnalyzer 설계
```typescript
// src/analyzers/MethodFlowAnalyzer.ts
import { 
  EnhancedExportExtractor, 
  TypeScriptParser,
  type EnhancedExportExtractionResult 
} from '@context-action/dependency-linker';

export class MethodFlowAnalyzer {
  private extractor = new EnhancedExportExtractor();
  private parser = new TypeScriptParser();
  
  constructor() {
    // 최적화된 설정
    this.extractor.configure({
      enabled: true,
      timeout: 15000,
      memoryLimit: 100 * 1024 * 1024,
      defaultOptions: {
        includeLocations: true,
        includeComments: false,
        maxDepth: 20
      }
    });
  }
  
  async analyzeMethodFlow(filePath: string): Promise<MethodFlowResult> {
    // 1. EnhancedExportExtractor로 메서드 추출
    const exportData = await this.extractMethods(filePath);
    
    // 2. 메서드 간 호출 관계 분석 (추가 구현 필요)
    const methodCalls = this.analyzeMethodCalls(exportData, filePath);
    
    // 3. 메트릭 계산
    const methodMetrics = this.calculateMethodMetrics(exportData);
    
    // 4. 호출 그래프 구성
    const callGraph = this.buildCallGraph(exportData, methodCalls);
    
    return {
      exportData,
      methodCalls,
      methodMetrics,
      callGraph
    };
  }
  
  private async extractMethods(filePath: string): Promise<EnhancedExportExtractionResult> {
    const parseResult = await this.parser.parse(filePath);
    
    if (!parseResult.ast) {
      throw new Error(`Failed to parse ${filePath}: ${parseResult.errors.join(', ')}`);
    }
    
    return this.extractor.extractExports(parseResult.ast, filePath);
  }
  
  private analyzeMethodCalls(exportData: EnhancedExportExtractionResult, filePath: string): MethodCallRelation[] {
    // TODO: AST를 다시 순회하여 메서드 호출 관계 분석
    // 이 부분은 추가적인 AST 분석이 필요함
    return [];
  }
  
  private calculateMethodMetrics(exportData: EnhancedExportExtractionResult): MethodMetrics {
    const methods = exportData.exportMethods.filter(m => m.exportType === 'function' || m.exportType === 'class_method');
    
    return {
      totalMethods: methods.length,
      publicMethods: methods.filter(m => m.visibility === 'public' || !m.visibility).length,
      privateMethods: methods.filter(m => m.visibility === 'private').length,
      staticMethods: methods.filter(m => m.isStatic).length,
      asyncMethods: methods.filter(m => m.isAsync).length,
      averageComplexity: this.calculateAverageComplexity(methods)
    };
  }
}
```

### 4.2 기존 시스템 통합
```typescript
// src/analyzers/UnifiedDependencyAnalyzer.ts - 확장
export class UnifiedDependencyAnalyzer {
  private methodFlowAnalyzer: MethodFlowAnalyzer;
  
  constructor(projectRoot: string) {
    // 기존 초기화...
    this.methodFlowAnalyzer = new MethodFlowAnalyzer();
  }
  
  private async createCodeNode(filePath: string, result: CodeAnalysisResult): Promise<DependencyNode> {
    // 기존 노드 생성...
    
    // 🆕 메서드 흐름 분석 추가
    let methodFlow: MethodFlowResult | undefined;
    try {
      methodFlow = await this.methodFlowAnalyzer.analyzeMethodFlow(filePath);
    } catch (error) {
      // 메서드 분석 실패시 경고만 출력하고 계속 진행
      this.warnings.push(`메서드 분석 실패: ${filePath} - ${error.message}`);
    }
    
    return {
      // 기존 필드들...
      methodFlow,  // 새로운 필드 추가
      metadata: {
        // 기존 메타데이터...
        ...(methodFlow && {
          methodCount: methodFlow.methodMetrics.totalMethods,
          publicMethodCount: methodFlow.methodMetrics.publicMethods,
          averageMethodComplexity: methodFlow.methodMetrics.averageComplexity
        })
      }
    };
  }
}
```

## 5. CLI 확장

### 5.1 새로운 명령어 옵션
```bash
# 메서드 레벨 분석 활성화
deps-cli analyze src --method-flow

# 메서드 상세 정보 포함
deps-cli analyze src --method-details

# 특정 클래스의 메서드만 분석
deps-cli analyze src --class=UserService

# 메서드 호출 깊이 제한
deps-cli analyze src --method-depth=3
```

### 5.2 보고서 확장
```json
{
  "methodAnalysis": {
    "totalMethods": 45,
    "publicMethods": 32,
    "privateMethods": 13,
    "staticMethods": 8,
    "asyncMethods": 12,
    "methodsByFile": {
      "src/UserService.ts": {
        "methods": [
          {
            "name": "login",
            "exportType": "class_method",
            "parentClass": "UserService",
            "isAsync": true,
            "visibility": "public",
            "parameters": [
              {"name": "email", "type": "string"},
              {"name": "password", "type": "string"}
            ],
            "returnType": "Promise<User>",
            "location": {"line": 15, "column": 2}
          }
        ]
      }
    },
    "methodCallGraph": {
      "UserService.login": ["AuthService.verify", "Database.findUser"],
      "AuthService.verify": ["TokenService.validate"]
    }
  }
}
```

## 6. 구현 우선순위

### Phase 1: 기본 메서드 추출 (1주)
1. dependency-linker 패키지 추가
2. MethodFlowAnalyzer 기본 구조 구현
3. EnhancedExportExtractor 통합

### Phase 2: 시스템 통합 (1주)  
4. UnifiedDependencyAnalyzer 확장
5. DependencyNode 타입 확장
6. 기본 메서드 정보 수집 및 보고서 생성

### Phase 3: 고급 분석 (2주)
7. 메서드 호출 관계 분석 구현
8. 호출 그래프 생성
9. 메서드 복잡도 및 메트릭 계산

### Phase 4: CLI 및 UI (1주)
10. CLI 옵션 추가
11. 보고서 포맷 확장
12. 에러 핸들링 및 최적화

## 7. 기대 효과

### 7.1 분석 능력 향상
- 파일 레벨 → 메서드 레벨 분석으로 정밀도 증가
- 실제 사용되지 않는 메서드(dead code) 식별
- 메서드 간 결합도 분석으로 리팩토링 가이드 제공

### 7.2 개발자 경험 개선
- 코드베이스 이해도 향상
- 리팩토링 시 영향 범위 파악 용이
- 코드 품질 메트릭 제공

### 7.3 유지보수성 향상
- 기존 아키텍처 유지하면서 점진적 확장
- dependency-linker의 검증된 기능 활용
- 모듈화된 설계로 확장성 확보