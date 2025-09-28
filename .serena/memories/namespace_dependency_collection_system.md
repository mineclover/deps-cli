# 네임스페이스 기반 의존성 데이터 수집 시스템 설계 문서

## 1. 시스템 개요

의존성 분석 데이터를 기반으로 네임스페이스별 키워드/파일 경로를 수집하여 문서 경로를 생성하는 단일 관리 시스템

### 핵심 원칙
- **공유 의존성 데이터**: EnhancedDependencyAnalyzer의 ProjectDependencyGraph를 공통 데이터 소스로 활용
- **네임스페이스 기반 분류**: 각 네임스페이스별로 독립적인 데이터 수집 규칙 적용
- **키워드/경로 단위 수집**: 특정 키워드나 파일 경로를 데이터 단위로 설정
- **문서 경로 생성**: 수집된 데이터를 기반으로 네임스페이스별 문서 경로 자동 생성

## 2. 데이터 수집 구조

### 2.1 공유 의존성 데이터 구조
```typescript
interface ProjectDependencyGraph {
  nodes: Map<string, DependencyNode>
  edges: Map<string, DependencyEdge[]>
  metadata: AnalysisMetadata
}

interface DependencyNode {
  id: string
  type: 'file' | 'package' | 'module'
  path: string
  imports: string[]
  exports: string[]
}
```

### 2.2 네임스페이스별 수집 규칙
```typescript
interface NamespaceCollectionRule {
  namespace: string
  keywords: string[]           // 수집할 키워드 패턴
  filePaths: string[]         // 수집할 파일 경로 패턴
  excludePatterns: string[]   // 제외할 패턴
  documentPathTemplate: string // 문서 경로 생성 템플릿
}
```

## 3. 구현 컴포넌트

### 3.1 DependencyDataCollector
- 역할: 공유 의존성 데이터에서 네임스페이스별 데이터 추출
- 입력: ProjectDependencyGraph + NamespaceCollectionRule
- 출력: 네임스페이스별 수집된 데이터 목록

### 3.2 NamespaceDataFilter
- 역할: 키워드/파일경로 패턴 매칭 및 필터링
- 기능: 정규식 기반 패턴 매칭, 제외 규칙 적용

### 3.3 DocumentPathGenerator
- 역할: 수집된 데이터를 기반으로 문서 경로 생성
- 템플릿: `{namespace}/{category}/{filename}.md`
- 변수 치환: 동적 경로 생성 지원

## 4. 데이터 플로우

```
EnhancedDependencyAnalyzer → ProjectDependencyGraph (공유 데이터)
                                      ↓
NamespaceCollectionRule → DependencyDataCollector → 네임스페이스별 데이터
                                      ↓
NamespaceDataFilter → 필터링된 키워드/파일경로 목록
                                      ↓
DocumentPathGenerator → 네임스페이스별 문서 경로 목록
```

## 5. CLI 명령어 구조

### 5.1 수집 규칙 관리
- `deps-cli namespace-collection list` - 네임스페이스별 수집 규칙 조회
- `deps-cli namespace-collection create <namespace>` - 새 수집 규칙 생성
- `deps-cli namespace-collection update <namespace>` - 기존 규칙 수정

### 5.2 데이터 수집 실행
- `deps-cli collect-data --namespace <name>` - 특정 네임스페이스 데이터 수집
- `deps-cli collect-data --all` - 모든 네임스페이스 데이터 수집
- `deps-cli generate-paths --namespace <name>` - 문서 경로 생성

## 6. 설정 파일 구조

### 6.1 네임스페이스 수집 설정
```json
{
  "namespaces": {
    "api": {
      "keywords": ["Controller", "Service", "Repository"],
      "filePaths": ["src/api/**/*.ts", "src/controllers/**/*.ts"],
      "excludePatterns": ["**/*.test.ts", "**/*.spec.ts"],
      "documentPathTemplate": "api/{category}/{name}.md"
    },
    "components": {
      "keywords": ["Component", "Hook", "Context"],
      "filePaths": ["src/components/**/*.tsx", "src/hooks/**/*.ts"],
      "excludePatterns": ["**/*.stories.tsx"],
      "documentPathTemplate": "components/{type}/{name}.md"
    }
  }
}
```

## 7. 구현 우선순위

### Phase 1: 핵심 수집 엔진
1. DependencyDataCollector 구현
2. NamespaceDataFilter 구현
3. 기본 CLI 명령어 구현

### Phase 2: 문서 경로 생성
1. DocumentPathGenerator 구현
2. 템플릿 시스템 구현
3. 동적 변수 치환 지원

### Phase 3: 고급 기능
1. 수집 규칙 검증 및 최적화
2. 증분 수집 지원
3. 수집 결과 캐싱

## 8. 기대 효과

- **중앙화된 데이터 관리**: 단일 의존성 분석 결과를 여러 네임스페이스에서 활용
- **유연한 수집 규칙**: 네임스페이스별 독립적인 데이터 수집 정책
- **자동화된 문서 구조**: 수집된 데이터 기반 문서 경로 자동 생성
- **확장 가능한 구조**: 새로운 네임스페이스 및 수집 규칙 쉽게 추가