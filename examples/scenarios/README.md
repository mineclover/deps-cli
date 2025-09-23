# 의존성 분류 시스템 시뮬레이션 시나리오

이 문서는 파일 타입별 의존성 분류 시스템의 동작을 검증하기 위한 시뮬레이션 시나리오들을 설명합니다.

## 시나리오 개요

### 1. 테스트 의존성 분석 시나리오
- **목적**: 테스트 파일에서 어떤 코드들이 테스트되고 있는지 의존성을 추출
- **분류**:
  - `test-target`: 테스트 대상 코드
  - `test-utility`: 테스트 유틸리티 (Jest, Testing Library 등)
  - `test-setup`: 테스트 설정/모킹 파일

### 2. 문서 링크 분석 시나리오
- **목적**: 문서 내부의 링크들을 파싱하여 문서 간 의존성 분석
- **분류**:
  - `doc-reference`: 다른 문서 참조
  - `doc-link`: 외부 링크
  - `doc-asset`: 이미지/파일 참조

### 3. 코드 모듈 의존성 분석 시나리오
- **목적**: 일반 코드의 모듈화에 의한 내부/외부 의존성 분리
- **분류**:
  - `internal-module`: 프로젝트 내부 모듈
  - `external-library`: 외부 라이브러리
  - `builtin-module`: Node.js 내장 모듈

## 노드 타입 분류

모든 의존성은 같은 데이터 포맷을 가지지만, 대상 파일의 세부 정보에서 다음과 같이 다른 유형의 노드로 분류됩니다:

- **test**: 테스트 파일 노드
- **code**: 일반 코드 파일 노드
- **docs**: 문서 파일 노드
- **library**: 외부 라이브러리 노드

## 시뮬레이션 실행 방법

```bash
# 전체 프로젝트 분석
npm run classify examples/scenarios/ --format json --verbose

# 테스트 파일만 분석
npm run classify examples/scenarios/ --node-type test --verbose

# 문서 파일만 분석
npm run classify examples/scenarios/ --node-type docs --verbose

# 코드 파일만 분석
npm run classify examples/scenarios/ --node-type code --verbose
```

## 예상 결과

분석 결과는 `.deps-analysis/` 디렉토리에 다음과 같은 형태로 저장됩니다:

```
.deps-analysis/
├── dependency-graph.json      # 전체 의존성 그래프
├── analysis-report.json       # 분석 보고서
├── nodes-test.json           # 테스트 노드들
├── nodes-code.json           # 코드 노드들
├── nodes-docs.json           # 문서 노드들
└── nodes-library.json        # 라이브러리 노드들
```

각 노드는 동일한 기본 구조를 가지지만, `nodeType`과 `dependencies` 배열의 의존성 타입이 다르게 분류됩니다.