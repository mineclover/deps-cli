# Namespace 기반 설정 시스템 가이드

## 📋 개요

deps-cli v2.0부터 도입된 Namespace 기반 설정 시스템을 사용하면 여러 환경별 설정을 하나의 파일에서 관리할 수 있습니다.

## 🏗️ 설정 파일 구조

### 기본 구조

```json
{
  "namespaces": {
    "development": {
      "analysis": {
        "maxConcurrency": 8,
        "timeout": 60000,
        "cacheEnabled": true,
        "cacheTtl": 3600
      },
      "logging": {
        "level": "debug",
        "format": "json",
        "enabled": true
      },
      "output": {
        "defaultFormat": "json",
        "defaultDir": "./dev-output",
        "compression": false
      },
      "development": {
        "verbose": true,
        "debugMode": true,
        "mockApiCalls": false
      }
    },
    "production": {
      "analysis": {
        "maxConcurrency": 4,
        "timeout": 30000,
        "cacheEnabled": true,
        "cacheTtl": 7200
      },
      "logging": {
        "level": "warn",
        "format": "text",
        "enabled": true
      },
      "output": {
        "defaultFormat": "summary",
        "defaultDir": "./output",
        "compression": true
      },
      "development": {
        "verbose": false,
        "debugMode": false,
        "mockApiCalls": false
      }
    }
  },
  "default": "development",
  "_metadata": {
    "created": {
      "source": "manual",
      "raw": "2025-09-27",
      "parsed": "Multi-environment configuration",
      "isValid": true,
      "timestamp": "2025-09-27T00:00:00.000Z"
    }
  }
}
```

## 🔧 설정 섹션 상세

### 1. Analysis 설정
분석 엔진 관련 설정

```json
{
  "analysis": {
    "maxConcurrency": 4,        // 최대 동시 처리 파일 수 (1-16)
    "timeout": 30000,           // 분석 타임아웃 (ms)
    "cacheEnabled": true,       // 분석 결과 캐싱 여부
    "cacheTtl": 3600           // 캐시 TTL (초)
  }
}
```

**옵션 설명:**
- `maxConcurrency`: 병렬 처리할 파일 수. 높을수록 빠르지만 메모리 사용량 증가
- `timeout`: 개별 파일 분석 타임아웃. 복잡한 파일은 더 긴 시간 필요
- `cacheEnabled`: 분석 결과 캐싱으로 반복 실행 시 성능 향상
- `cacheTtl`: 캐시 유지 시간. 0이면 세션 동안만 유지

### 2. Logging 설정
로그 출력 관련 설정

```json
{
  "logging": {
    "level": "info",           // 로그 레벨: debug, info, warn, error
    "format": "text",          // 출력 형식: text, json
    "enabled": true            // 로깅 활성화 여부
  }
}
```

**로그 레벨:**
- `debug`: 모든 디버그 정보 포함 (개발용)
- `info`: 일반적인 정보 메시지 (기본값)
- `warn`: 경고 및 오류만 표시 (운영용)
- `error`: 오류만 표시 (최소 로그)

### 3. Output 설정
분석 결과 출력 관련 설정

```json
{
  "output": {
    "defaultFormat": "summary", // 기본 출력 형식: summary, json
    "defaultDir": "./output",   // 기본 출력 디렉토리
    "compression": false        // 출력 압축 여부
  }
}
```

**출력 형식:**
- `summary`: 사람이 읽기 쉬운 요약 형식
- `json`: 기계가 처리하기 쉬운 JSON 형식

### 4. Development 설정
개발 및 디버깅 관련 설정

```json
{
  "development": {
    "verbose": false,          // 상세 출력 여부
    "debugMode": false,        // 디버그 모드 활성화
    "mockApiCalls": false      // API 호출 모킹 여부
  }
}
```

## 🚀 CLI 명령어

### Namespace 목록 확인
```bash
deps-cli list-namespaces [--config <path>]
```

### Namespace 생성
```bash
# 기본 설정으로 새 namespace 생성
deps-cli create-namespace <name> [--config <path>]

# 기존 namespace 복사
deps-cli create-namespace staging --copy-from production

# 기본 namespace로 설정
deps-cli create-namespace staging --set-default
```

### Namespace 삭제
```bash
deps-cli delete-namespace <name> --force [--config <path>]
```

### 특정 Namespace 사용
```bash
# 분석 실행 시 namespace 지정
deps-cli analyze-enhanced . --namespace production

# 모든 명령어에서 namespace 사용 가능
deps-cli find-unused-files-enhanced --namespace testing
```

## 📂 환경별 설정 예시

### Development 환경
```json
{
  "development": {
    "analysis": {
      "maxConcurrency": 8,
      "timeout": 60000,
      "cacheEnabled": true,
      "cacheTtl": 3600
    },
    "logging": {
      "level": "debug",
      "format": "json",
      "enabled": true
    },
    "output": {
      "defaultFormat": "json",
      "compression": false
    },
    "development": {
      "verbose": true,
      "debugMode": true,
      "mockApiCalls": false
    }
  }
}
```

### Production 환경
```json
{
  "production": {
    "analysis": {
      "maxConcurrency": 4,
      "timeout": 30000,
      "cacheEnabled": true,
      "cacheTtl": 7200
    },
    "logging": {
      "level": "warn",
      "format": "text",
      "enabled": true
    },
    "output": {
      "defaultFormat": "summary",
      "compression": true
    },
    "development": {
      "verbose": false,
      "debugMode": false,
      "mockApiCalls": false
    }
  }
}
```

### Testing 환경
```json
{
  "testing": {
    "analysis": {
      "maxConcurrency": 2,
      "timeout": 15000,
      "cacheEnabled": false,
      "cacheTtl": 0
    },
    "logging": {
      "level": "info",
      "format": "text",
      "enabled": true
    },
    "output": {
      "defaultFormat": "json",
      "compression": false
    },
    "development": {
      "verbose": true,
      "debugMode": false,
      "mockApiCalls": true
    }
  }
}
```

## 🔄 환경 전환 워크플로우

### 1. 개발 시
```bash
# 상세한 디버그 정보와 함께 분석
deps-cli analyze-enhanced . --namespace development --verbose
```

### 2. CI/CD 파이프라인
```bash
# 빠르고 조용한 분석
deps-cli analyze-enhanced . --namespace production --format json > analysis.json
```

### 3. 테스트 환경
```bash
# 모킹이 활성화된 테스트 분석
deps-cli find-unused-methods-enhanced --namespace testing
```

## 🛠️ 고급 사용법

### Dynamic Namespace 생성
```bash
# CI/CD에서 브랜치별 namespace 생성
BRANCH_NAME=$(git branch --show-current)
deps-cli create-namespace "branch-$BRANCH_NAME" --copy-from development
deps-cli analyze-enhanced . --namespace "branch-$BRANCH_NAME"
```

### 설정 백업 및 복원
```bash
# 현재 설정 백업
cp deps-cli.config.json deps-cli.config.backup.json

# 설정 복원
cp deps-cli.config.backup.json deps-cli.config.json
```

### 설정 검증
```bash
# 설정 파일 구조 확인
deps-cli list-namespaces --config ./deps-cli.config.json
```

## ⚙️ 환경 변수와의 통합

namespace 설정과 환경 변수를 함께 사용할 수 있습니다:

```bash
# 환경 변수로 namespace 지정
export DEPS_CLI_NAMESPACE=production
deps-cli analyze-enhanced .

# namespace 설정을 환경 변수로 오버라이드
export DEPS_CLI_MAX_CONCURRENCY=16
deps-cli analyze-enhanced . --namespace development
```

## 🎯 모범 사례

### 1. Namespace 명명 규칙
- **환경별**: `development`, `staging`, `production`
- **브랜치별**: `feature-auth`, `hotfix-security`
- **팀별**: `frontend-dev`, `backend-dev`

### 2. 설정 상속
```bash
# 기본 설정에서 파생
deps-cli create-namespace staging --copy-from production
# staging에서 필요한 부분만 수정
```

### 3. 보안 고려사항
- 민감한 정보는 환경 변수 사용
- production 설정은 최소 권한으로 구성
- 디버그 모드는 개발 환경에서만 활성화

### 4. 성능 최적화
```json
{
  "production": {
    "analysis": {
      "maxConcurrency": 4,     // CPU 코어 수에 맞게 조정
      "cacheEnabled": true,    // 반복 실행 시 성능 향상
      "cacheTtl": 7200        // 충분한 캐시 유지 시간
    }
  }
}
```

## 🐛 문제 해결

### 일반적인 문제들

1. **Namespace를 찾을 수 없음**
   ```bash
   # 사용 가능한 namespace 확인
   deps-cli list-namespaces
   ```

2. **설정 파일 구문 오류**
   ```bash
   # JSON 구문 검증
   node -e "console.log(JSON.parse(require('fs').readFileSync('deps-cli.config.json')))"
   ```

3. **권한 문제**
   ```bash
   # 설정 파일 권한 확인
   ls -la deps-cli.config.json
   ```

## 📚 추가 리소스

- [전체 옵션 가이드](./OPTIONS_GUIDE.md)
- [환경 변수 설정](./ENVIRONMENT_VARIABLES.md)
- [성능 튜닝 가이드](./PERFORMANCE_TUNING.md)
- [문제 해결 가이드](./TROUBLESHOOTING.md)