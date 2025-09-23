# @context-action/dependency-linker 분석 결과

## 라이브러리 개요
- **버전**: 2.0.0
- **목적**: Multi-language AST-based 코드 분석 프레임워크
- **기술**: tree-sitter 기반 파서, TypeScript/Go/Java/Markdown 지원
- **성능**: <200ms/파일, 배치 처리 지원

## 주요 API
### Factory Functions (권장)
```typescript
import { analyzeTypeScriptFile, extractDependencies, getBatchAnalysis } from '@context-action/dependency-linker'

// 단일 파일 분석
const result = await analyzeTypeScriptFile('./src/index.ts', {
  format: 'json',
  includeSources: true,
  useIntegrated: true,
  preset: 'balanced'
})

// 배치 처리
const results = await getBatchAnalysis(filePaths, {
  concurrency: 3,
  useIntegrated: true,
  preset: 'fast'
})
```

### Class-based API
```typescript
import { TypeScriptAnalyzer } from '@context-action/dependency-linker'

const analyzer = new TypeScriptAnalyzer({
  enableCache: true,
  cacheSize: 1000
})
```

## 기능 특징
1. **Multi-language 지원**: TypeScript/JavaScript, Go, Java, Markdown
2. **AST 기반**: tree-sitter 사용으로 정확한 파싱
3. **병렬 처리**: BatchAnalyzer로 동시성 제어
4. **성능 최적화**: 캐싱, 메모리 관리, 설정 프리셋
5. **에러 복구**: 부분 파싱으로 강건성 확보

## deps-cli 프로젝트와의 호환성
### ✅ 장점
- 기존 Effect.js + TypeScript 환경과 호환
- 이미 tree-sitter 패키지 설치됨
- AST 기반 정확한 의존성 분석
- 배치 처리 및 병렬화 지원
- 다양한 출력 형식 지원 (JSON, CSV, table 등)

### ⚠️ 고려사항
- Effect.js 패턴으로 래핑 필요
- 기존 CodeParser와 인터페이스 통일 필요
- 성능 비교 검증 필요

## 통합 방향
1. dependency-linker를 Effect Service로 래핑
2. 기존 ICodeParser 인터페이스와 호환되도록 어댑터 구현
3. 병렬화는 Effect.forEach 활용
4. 설정은 Effect Context로 관리