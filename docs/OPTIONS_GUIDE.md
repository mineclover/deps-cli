# deps-cli 옵션 가이드

> 📋 **버전**: 2.0.0
> 📅 **업데이트**: 2025-09-27
> 🎯 **상태**: 완전 검증됨

deps-cli의 모든 설정 옵션과 사용법을 상세히 설명합니다.

## 📖 목차

1. [CLI 명령어 옵션](#cli-명령어-옵션)
2. [설정 파일 옵션](#설정-파일-옵션)
3. [환경 변수 옵션](#환경-변수-옵션)
4. [우선순위 및 적용 규칙](#우선순위-및-적용-규칙)
5. [실사용 예제](#실사용-예제)

## 🚀 CLI 명령어 옵션

### 전역 옵션

```bash
deps-cli [전역옵션] [명령어] [명령어옵션] [인수]
```

| 옵션 | 축약형 | 설명 | 기본값 |
|------|--------|------|--------|
| `--version` | `-V` | 버전 정보 출력 | - |
| `--help` | `-h` | 도움말 표시 | - |

### 1. analyze-enhanced

전체 프로젝트 의존성 분석을 수행합니다.

```bash
deps-cli analyze-enhanced [옵션] <filePath>
```

#### 인수
- `<filePath>`: 분석할 파일 또는 디렉토리 경로 (필수)

#### 옵션
| 옵션 | 타입 | 설명 | 기본값 | 가능한 값 |
|------|------|------|--------|----------|
| `--format <format>` | string | 출력 형식 지정 | `summary` | `json`, `summary` |
| `--verbose` | boolean | 상세 출력 활성화 | `false` | `true`, `false` |

#### 사용 예제
```bash
# 기본 분석
deps-cli analyze-enhanced .

# JSON 형식으로 출력
deps-cli analyze-enhanced . --format json

# 상세 정보 포함
deps-cli analyze-enhanced . --verbose

# 특정 디렉토리 분석
deps-cli analyze-enhanced src/ --format json --verbose
```

### 2. find-unused-files-enhanced

프로젝트에서 사용되지 않는 파일을 찾습니다.

```bash
deps-cli find-unused-files-enhanced [옵션]
```

#### 옵션
| 옵션 | 타입 | 설명 | 기본값 | 가능한 값 |
|------|------|------|--------|----------|
| `--format <format>` | string | 출력 형식 지정 | `summary` | `json`, `summary` |
| `--verbose` | boolean | 상세 출력 활성화 | `false` | `true`, `false` |
| `--include-tests` | boolean | 테스트 파일을 엔트리 포인트로 포함 | `true` | `true`, `false` |

#### 사용 예제
```bash
# 기본 미사용 파일 찾기
deps-cli find-unused-files-enhanced

# 테스트 파일 제외하고 찾기
deps-cli find-unused-files-enhanced --include-tests=false

# JSON 형식 출력
deps-cli find-unused-files-enhanced --format json --verbose
```

### 3. find-unused-methods-enhanced

프로젝트에서 호출되지 않는 메서드를 찾습니다.

```bash
deps-cli find-unused-methods-enhanced [옵션]
```

#### 옵션
| 옵션 | 타입 | 설명 | 기본값 | 가능한 값 |
|------|------|------|--------|----------|
| `--format <format>` | string | 출력 형식 지정 | `summary` | `json`, `summary` |
| `--verbose` | boolean | 상세 출력 활성화 | `false` | `true`, `false` |
| `--include-private` | boolean | private 메서드 포함 분석 | `false` | `true`, `false` |

#### 사용 예제
```bash
# 기본 미사용 메서드 찾기
deps-cli find-unused-methods-enhanced

# private 메서드도 포함하여 분석
deps-cli find-unused-methods-enhanced --include-private

# 상세 정보와 JSON 출력
deps-cli find-unused-methods-enhanced --include-private --verbose --format json
```

### 4. find-usages-enhanced

특정 파일을 사용하는 모든 파일을 찾습니다.

```bash
deps-cli find-usages-enhanced [옵션] <filePath>
```

#### 인수
- `<filePath>`: 사용처를 찾을 대상 파일 경로 (필수)

#### 옵션
| 옵션 | 타입 | 설명 | 기본값 | 가능한 값 |
|------|------|------|--------|----------|
| `--format <format>` | string | 출력 형식 지정 | `summary` | `json`, `summary` |
| `--verbose` | boolean | 상세 출력 활성화 | `false` | `true`, `false` |

#### 사용 예제
```bash
# 특정 파일 사용처 찾기
deps-cli find-usages-enhanced src/utils/helper.ts

# JSON 형식 상세 출력
deps-cli find-usages-enhanced src/config/ConfigManager.ts --format json --verbose
```

### 5. find-method-usages-enhanced

특정 메서드를 호출하는 모든 파일을 찾습니다.

```bash
deps-cli find-method-usages-enhanced [옵션] <className> <methodName>
```

#### 인수
- `<className>`: 클래스명 (독립 함수의 경우 `null` 사용)
- `<methodName>`: 메서드 또는 함수명

#### 옵션
| 옵션 | 타입 | 설명 | 기본값 | 가능한 값 |
|------|------|------|--------|----------|
| `--format <format>` | string | 출력 형식 지정 | `summary` | `json`, `summary` |
| `--verbose` | boolean | 상세 출력 활성화 | `false` | `true`, `false` |

#### 사용 예제
```bash
# 클래스 메서드 사용처 찾기
deps-cli find-method-usages-enhanced UserService getUserById

# 독립 함수 사용처 찾기
deps-cli find-method-usages-enhanced null calculateTotal

# JSON 상세 출력
deps-cli find-method-usages-enhanced ConfigManager load --format json --verbose
```

## ⚙️ 설정 파일 옵션

설정 파일은 `deps-cli.config.json` 파일로 프로젝트 루트에 배치됩니다.

### 전체 설정 구조

```json
{
  "analysis": {
    "maxConcurrency": 4,
    "timeout": 30000,
    "enableUnusedFileDetection": true,
    "enableUnusedMethodDetection": true,
    "cacheEnabled": true,
    "cacheTtl": 3600000
  },
  "logging": {
    "level": "info",
    "format": "text",
    "enabled": true
  },
  "output": {
    "defaultFormat": "summary",
    "defaultDir": "./output",
    "compression": false
  },
  "development": {
    "verbose": false,
    "debugMode": false,
    "mockApiCalls": false
  },
  "notion": {
    "apiKey": "secret_xxxxxxxxxxxxx",
    "databaseId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "pageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "version": "2022-06-28"
  }
}
```

### analysis 섹션

코드 분석 관련 설정을 제어합니다.

| 키 | 타입 | 설명 | 기본값 | 범위/제약 |
|----|------|------|--------|-----------|
| `maxConcurrency` | number | 동시 처리할 최대 파일 수 | `4` | 1-100 |
| `timeout` | number | 분석 타임아웃 (밀리초) | `30000` | 1000-300000 |
| `enableUnusedFileDetection` | boolean | 미사용 파일 탐지 활성화 | `true` | - |
| `enableUnusedMethodDetection` | boolean | 미사용 메서드 탐지 활성화 | `true` | - |
| `cacheEnabled` | boolean | 캐시 시스템 활성화 | `true` | - |
| `cacheTtl` | number | 캐시 유지 시간 (밀리초) | `3600000` | 60000-86400000 |

### logging 섹션

로깅 시스템 설정을 제어합니다.

| 키 | 타입 | 설명 | 기본값 | 가능한 값 |
|----|------|------|--------|----------|
| `level` | string | 로그 레벨 | `info` | `debug`, `info`, `warn`, `error` |
| `format` | string | 로그 형식 | `text` | `json`, `text` |
| `enabled` | boolean | 로깅 활성화/비활성화 | `true` | - |

### output 섹션

출력 형식 및 위치 설정을 제어합니다.

| 키 | 타입 | 설명 | 기본값 | 가능한 값 |
|----|------|------|--------|----------|
| `defaultFormat` | string | 기본 출력 형식 | `summary` | `json`, `summary` |
| `defaultDir` | string | 기본 출력 디렉토리 | `undefined` | 유효한 경로 |
| `compression` | boolean | 출력 압축 활성화 | `false` | - |

### development 섹션

개발 환경 관련 설정을 제어합니다.

| 키 | 타입 | 설명 | 기본값 | 조건 |
|----|------|------|--------|------|
| `verbose` | boolean | 상세 출력 모드 | `NODE_ENV=development ? true : false` | - |
| `debugMode` | boolean | 디버그 모드 | `NODE_ENV=development ? true : false` | - |
| `mockApiCalls` | boolean | API 호출 모킹 | `false` | - |

### notion 섹션 (향후 기능)

Notion 연동 관련 설정입니다.

| 키 | 타입 | 설명 | 기본값 | 제약 |
|----|------|------|--------|------|
| `apiKey` | string | Notion API 키 | `undefined` | `secret_`로 시작, 50자 |
| `databaseId` | string | 데이터베이스 ID | `undefined` | 32자 hexadecimal |
| `pageId` | string | 페이지 ID | `undefined` | 32자 hexadecimal |
| `version` | string | API 버전 | `2022-06-28` | - |

## 🌍 환경 변수 옵션

환경 변수를 통해 런타임에 설정을 오버라이드할 수 있습니다.

### 분석 관련 환경 변수

| 환경 변수 | 타입 | 설명 | 기본값 | 제약 |
|----------|------|------|--------|------|
| `DEPS_CLI_MAX_CONCURRENCY` | number | 최대 동시 처리 수 | `4` | 1-100 |
| `DEPS_CLI_TIMEOUT` | number | 타임아웃 (ms) | `30000` | 1000-300000 |
| `DEPS_CLI_CACHE_ENABLED` | boolean | 캐시 활성화 | `true` | - |
| `DEPS_CLI_CACHE_TTL` | number | 캐시 TTL (ms) | `3600000` | 60000-86400000 |

### 로깅 관련 환경 변수

| 환경 변수 | 타입 | 설명 | 기본값 | 가능한 값 |
|----------|------|------|--------|----------|
| `DEPS_CLI_LOG_LEVEL` | string | 로그 레벨 | `info` | `debug`, `info`, `warn`, `error` |
| `DEPS_CLI_LOG_FORMAT` | string | 로그 형식 | `text` | `json`, `text` |
| `DEPS_CLI_LOG_ENABLED` | boolean | 로깅 활성화 | `true` | - |

### 출력 관련 환경 변수

| 환경 변수 | 타입 | 설명 | 기본값 | 가능한 값 |
|----------|------|------|--------|----------|
| `DEPS_CLI_DEFAULT_FORMAT` | string | 기본 출력 형식 | `summary` | `json`, `summary` |
| `DEPS_CLI_DEFAULT_OUTPUT_DIR` | string | 기본 출력 디렉토리 | `undefined` | 유효한 경로 |
| `DEPS_CLI_COMPRESSION` | boolean | 압축 활성화 | `false` | - |

### 개발 관련 환경 변수

| 환경 변수 | 타입 | 설명 | 기본값 | 특이사항 |
|----------|------|------|--------|----------|
| `DEPS_CLI_VERBOSE` | boolean | 상세 출력 | `NODE_ENV=development` | `NODE_ENV`에 따라 기본값 변경 |
| `DEPS_CLI_DEBUG` | boolean | 디버그 모드 | `NODE_ENV=development` | `DEBUG` 환경 변수도 인식 |
| `DEPS_CLI_MOCK_API` | boolean | API 모킹 | `false` | - |
| `NODE_ENV` | string | 환경 구분 | `production` | `development`/`production` |

### Notion 관련 환경 변수 (향후 기능)

| 환경 변수 | 타입 | 설명 | 제약 |
|----------|------|------|------|
| `NOTION_API_KEY` | string | Notion API 키 | `secret_`로 시작, 50자 정확히 |
| `NOTION_DATABASE_ID` | string | 데이터베이스 ID | 32자 hexadecimal |
| `NOTION_PAGE_ID` | string | 페이지 ID | 32자 hexadecimal |
| `NOTION_API_VERSION` | string | API 버전 | 기본값: `2022-06-28` |

### Boolean 값 형식

환경 변수에서 boolean 값은 다음과 같이 해석됩니다:

**True 값**: `true`, `1`, `yes`, `on`, `enabled`
**False 값**: `false`, `0`, `no`, `off`, `disabled`, `undefined`

## 📋 우선순위 및 적용 규칙

설정 값의 적용 우선순위는 다음과 같습니다 (높은 순서대로):

1. **CLI 옵션** (최우선)
2. **환경 변수**
3. **설정 파일** (`deps-cli.config.json`)
4. **기본값** (최후순위)

### 설정 병합 규칙

```
최종 설정 = 기본값 ← 설정파일 ← 환경변수 ← CLI옵션
```

### 오류 복구 시스템

1. **설정 파일 오류**: JSON 파싱 실패 시 환경 변수 + 기본값 사용
2. **환경 변수 오류**: 잘못된 값 시 기본값으로 fallback
3. **하드코딩 fallback**: 모든 설정 로드 실패 시 안전한 기본값 사용

## 🔧 실사용 예제

### 1. 개발 환경 설정

```bash
# 환경 변수로 개발 모드 설정
export NODE_ENV=development
export DEPS_CLI_VERBOSE=true
export DEPS_CLI_DEBUG=true
export DEPS_CLI_LOG_LEVEL=debug

# 상세 분석 실행
deps-cli analyze-enhanced . --verbose
```

### 2. CI/CD 파이프라인에서 사용

```bash
# 환경 변수로 CI 최적화 설정
export DEPS_CLI_MAX_CONCURRENCY=8
export DEPS_CLI_TIMEOUT=60000
export DEPS_CLI_LOG_FORMAT=json

# JSON 출력으로 미사용 파일 찾기
deps-cli find-unused-files-enhanced --format json > unused-files.json
```

### 3. 설정 파일 + 환경 변수 조합

**deps-cli.config.json**:
```json
{
  "analysis": {
    "maxConcurrency": 4,
    "timeout": 30000
  },
  "output": {
    "defaultFormat": "summary"
  }
}
```

**런타임 오버라이드**:
```bash
# 설정 파일의 maxConcurrency는 무시하고 환경 변수 값 사용
export DEPS_CLI_MAX_CONCURRENCY=8

# CLI 옵션이 설정 파일의 defaultFormat을 오버라이드
deps-cli analyze-enhanced . --format json
```

### 4. 배치 처리 스크립트

```bash
#!/bin/bash

# 설정
export DEPS_CLI_VERBOSE=false
export DEPS_CLI_LOG_FORMAT=json
export DEPS_CLI_DEFAULT_OUTPUT_DIR=./analysis-results

# 순차적으로 모든 분석 실행
echo "Starting comprehensive analysis..."

deps-cli analyze-enhanced . --format json > analysis-results/dependency-graph.json
deps-cli find-unused-files-enhanced --format json > analysis-results/unused-files.json
deps-cli find-unused-methods-enhanced --format json > analysis-results/unused-methods.json

echo "Analysis complete! Results saved to ./analysis-results/"
```

### 5. 프로덕션 환경 설정

```bash
# 프로덕션 최적화 설정
export NODE_ENV=production
export DEPS_CLI_VERBOSE=false
export DEPS_CLI_DEBUG=false
export DEPS_CLI_LOG_LEVEL=warn
export DEPS_CLI_MAX_CONCURRENCY=6
export DEPS_CLI_CACHE_ENABLED=true

# 효율적인 분석 실행
deps-cli analyze-enhanced .
```

## ⚠️ 주의사항

### 성능 고려사항

1. **maxConcurrency**: CPU 코어 수의 2배를 초과하지 않는 것을 권장
2. **timeout**: 대규모 프로젝트에서는 60초 이상 설정 권장
3. **cacheEnabled**: 반복 분석 시 성능 향상을 위해 활성화 권장

### 보안 고려사항

1. **Notion API 키**: 환경 변수 사용, 소스 코드에 하드코딩 금지
2. **설정 파일**: `.gitignore`에 민감한 설정 파일 추가
3. **로그 출력**: 프로덕션에서는 `debug` 레벨 비활성화

### 호환성

- **Node.js**: 16.0.0 이상 필요
- **TypeScript**: 4.0.0 이상 지원
- **운영체제**: Windows, macOS, Linux 모두 지원

---

📚 **관련 문서**:
- [설치 가이드](../README.md#installation)
- [현재 기능 목록](./CURRENT_FEATURES.md)
- [CLI 사용법](./CLI_USAGE.md)