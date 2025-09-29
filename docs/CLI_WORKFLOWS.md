# CLI Workflows Guide

deps-cli의 핵심 명령어들을 워크플로우별로 정리한 가이드입니다.
모든 명령어는 namespace 기반 설정을 통해 일관된 파일 영역 분석을 제공합니다.

## 🔧 Configuration Management (설정 관리)

### Namespace 관리
```bash
# 네임스페이스 목록 조회
deps-cli list-namespaces

# 새 네임스페이스 생성
deps-cli create-namespace <name>

# 네임스페이스 삭제
deps-cli delete-namespace <name>
```

### 설정 예시 (deps-cli.config.json)
```json
{
  "namespaces": {
    "library-structure": {
      "filePatterns": {
        "include": ["src/**/*.ts"],
        "exclude": ["**/*.test.*", "src/commands/**"]
      }
    }
  },
  "default": "library-structure"
}
```

## 🔍 Code Analysis (코드 분석)

### 고급 의존성 분석
```bash
# 포괄적 의존성 분석 (99%+ 정확도)
deps-cli analyze-enhanced [file] --namespace <namespace>

# 미사용 import 감지
deps-cli find-unused-imports --namespace <namespace> --verbose

# 미사용 파일 감지
deps-cli find-unused-files-enhanced --namespace <namespace>

# 미사용 메서드 감지
deps-cli find-unused-methods-enhanced --namespace <namespace>
```

### 사용처 분석
```bash
# 파일 사용처 찾기
deps-cli find-usages-enhanced <file> --namespace <namespace>

# 메서드 사용처 찾기
deps-cli find-method-usages-enhanced <method> --namespace <namespace>
```

### 품질 및 최적화 분석
```bash
# 번들 최적화 기회 분석
deps-cli analyze-bundle-optimization --namespace <namespace> --verbose

# 종합 코드 품질 분석
deps-cli analyze-code-quality --namespace <namespace> --format json
```

## 📊 Data Collection & Documentation (데이터 수집 및 문서화)

### 네임스페이스별 데이터 수집
```bash
# 데이터 수집
deps-cli collect-data --namespace <namespace> --format json --output <file>

# 경로 생성
deps-cli generate-paths --namespace <namespace> --output <file>

# 모든 네임스페이스 일괄 업데이트
deps-cli update-all --verbose --target src --docs-root docs
```

### 수집 규칙 관리
```bash
# 수집 규칙 목록 조회
deps-cli list-collection-rules

# 새 수집 규칙 생성
deps-cli create-collection-rule

# 수집 규칙 수정
deps-cli update-collection-rule
```

### 모듈화된 수집
```bash
# 사용 가능한 모듈 조회
deps-cli list-modules

# 모듈화된 수집 실행
deps-cli collect-modular --namespace <namespace>
```


## 📋 Common Workflow Examples

### 1. 새 프로젝트 분석 시작
```bash
# 1. 네임스페이스 생성
deps-cli create-namespace my-project

# 2. 설정 파일 수정 (deps-cli.config.json)
# 3. 초기 분석
deps-cli analyze-enhanced --namespace my-project

# 4. 데이터 수집 및 문서 생성
deps-cli update-all --namespace my-project
```

### 2. 코드 품질 개선 워크플로우
```bash
# 1. 미사용 코드 정리
deps-cli find-unused-imports --namespace my-project --fix
deps-cli find-unused-files-enhanced --namespace my-project
deps-cli find-unused-methods-enhanced --namespace my-project

# 2. 번들 최적화
deps-cli analyze-bundle-optimization --namespace my-project --verbose

# 3. 품질 점수 확인
deps-cli analyze-code-quality --namespace my-project --format json
```

### 3. 리팩토링 영향 분석
```bash
# 1. 파일/메서드 사용처 확인
deps-cli find-usages-enhanced src/utils/helper.ts --namespace my-project
deps-cli find-method-usages-enhanced calculateTotal --namespace my-project

# 2. 의존성 그래프 분석
deps-cli analyze-enhanced --namespace my-project --format json
```

## 🔧 filePatterns 설정 활용

namespace별로 분석할 파일 영역을 세밀하게 제어할 수 있습니다:

```json
{
  "namespaces": {
    "frontend-only": {
      "filePatterns": {
        "include": ["src/components/**/*.tsx", "src/pages/**/*.tsx"],
        "exclude": ["**/*.test.*", "**/*.stories.*"]
      }
    },
    "backend-api": {
      "filePatterns": {
        "include": ["src/api/**/*.ts", "src/services/**/*.ts"],
        "exclude": ["**/*.test.*", "src/api/deprecated/**"]
      }
    },
    "utilities": {
      "filePatterns": {
        "include": ["src/utils/**/*.ts", "src/lib/**/*.ts"],
        "exclude": ["**/*.test.*", "**/*.spec.*"]
      }
    }
  }
}
```

이 설정을 통해 각 namespace는 서로 다른 파일 영역을 분석하여 일관된 결과를 제공합니다.