# 메서드 사용 흐름 분석 아키텍처 설계

## 1. 현재 시스템 분석
- **강점**: 파일 간 의존성 추적, 병렬 처리, 다양한 분석기
- **한계**: 파일 레벨에서만 분석, 메서드/함수 레벨 흐름 불가

## 2. 메서드 흐름 분석 요구사항
- 함수/메서드 호출 추적
- 호출 체인 분석 (A → B → C)
- 메서드 간 데이터 흐름
- 호출 깊이 및 순환 호출 감지

## 3. 확장 설계

### 3.1 새로운 인터페이스 (src/types/)
```typescript
// MethodFlowTypes.ts
interface MethodNode {
  methodId: string
  methodName: string
  filePath: string
  className?: string
  signature: string
  location: CodeLocation
  visibility: 'public' | 'private' | 'protected'
  isStatic: boolean
  complexity: number
}

interface MethodCall {
  from: MethodNode
  to: MethodNode
  callSite: CodeLocation
  callType: 'direct' | 'indirect' | 'dynamic'
  parameters: ParameterFlow[]
  confidence: number
}

interface MethodFlowGraph {
  methods: Map<string, MethodNode>
  calls: Array<MethodCall>
  callChains: Array<MethodChain>
  circularCalls: Array<MethodLoop>
}
```

### 3.2 새로운 분석기 (src/analyzers/)
```typescript
// MethodFlowAnalyzer.ts - 새로운 분석기
class MethodFlowAnalyzer {
  analyzeMethodFlow(filePath: string): Promise<MethodFlowResult>
  extractMethods(ast: AST): Array<MethodNode>
  findMethodCalls(ast: AST): Array<MethodCall>
  buildCallGraph(methods: Array<MethodNode>, calls: Array<MethodCall>): MethodFlowGraph
}
```

### 3.3 기존 시스템 확장
```typescript
// UnifiedDependencyAnalyzer.ts - 확장
class UnifiedDependencyAnalyzer {
  // 기존 코드...
  
  private methodFlowAnalyzer: MethodFlowAnalyzer
  
  private createCodeNode(filePath: string, result: CodeAnalysisResult): DependencyNode {
    // 기존 코드...
    
    // 새로 추가: 메서드 흐름 정보
    const methodFlow = await this.methodFlowAnalyzer.analyzeMethodFlow(filePath)
    
    return {
      // 기존 필드들...
      methodFlow: methodFlow,  // 새로운 필드
      metadata: {
        // 기존 메타데이터...
        methodCount: methodFlow.methods.size,
        averageMethodComplexity: this.calculateAverageComplexity(methodFlow)
      }
    }
  }
}
```

## 4. 구현 전략

### 4.1 단계별 구현
1. **Phase 1**: 기본 메서드 추출 (AST 파싱)
2. **Phase 2**: 메서드 호출 관계 분석
3. **Phase 3**: 호출 체인 및 흐름 분석
4. **Phase 4**: 시각화 및 보고서

### 4.2 기술 스택
- **AST 파싱**: TypeScript Compiler API, @babel/parser
- **호출 분석**: Static analysis + Symbol resolution
- **그래프 구조**: 기존 DependencyGraph 확장

### 4.3 통합 포인트
- `UnifiedDependencyAnalyzer.analyzeCodeFiles()`에서 추가 분석 실행
- `CodeDependencyAnalyzer`와 협력하여 기존 구조 활용
- `DependencyNode` 인터페이스 확장으로 호환성 유지

## 5. 예상 결과

### 5.1 새로운 분석 능력
- 메서드 A에서 메서드 B를 몇 번 호출하는지
- 호출 경로: UserService.login() → AuthService.verify() → Database.findUser()
- 사용되지 않는 메서드 (dead code) 감지
- 높은 결합도를 가진 메서드 그룹 식별

### 5.2 CLI 명령어 확장
```bash
# 새로운 분석 옵션
deps-cli analyze src --method-flow
deps-cli analyze src --call-depth 5
deps-cli analyze src --find-unused-methods
```

### 5.3 보고서 확장
- 메서드 호출 매트릭스
- 호출 체인 다이어그램
- 메서드 복잡도 히트맵