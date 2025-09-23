# Effect CLI - 코드 의존성 분석 도구 매뉴얼

## 개요

Effect CLI는 TypeScript, JavaScript 코드베이스의 의존성과 구조를 분석하는 강력한 도구입니다. AST 기반 분석을 통해 정확하고 상세한 코드 메트릭을 제공합니다.

## 기본 사용법

```bash
effect-cli analyze <파일_또는_디렉토리_경로> [옵션]
```

## 주요 기능

### 1. 의존성 분석
- **외부 의존성**: npm 패키지, 라이브러리 imports
- **내부 의존성**: 프로젝트 내 상대/절대 경로 imports
- **타입 전용 imports**: TypeScript type-only imports 구분
- **동적 imports**: dynamic import() 구문 감지

### 2. 코드 구조 분석
- **식별자 추출**: 함수, 클래스, 인터페이스, 타입 등
- **네이밍 컨벤션**: camelCase, PascalCase 등 분석
- **복잡도 메트릭**: 함수 매개변수, 클래스 크기 등
- **설계 패턴**: 코드 패턴 및 안티패턴 감지

### 3. 성능 메트릭
- **파싱 시간**: AST 파싱 소요 시간
- **메모리 사용량**: 분석 중 메모리 소비
- **CPU 사용률**: 프로세서 사용량
- **GC 메트릭**: 가비지 컬렉션 통계

## 명령어 옵션

### 기본 옵션

#### `<filePath>` (필수)
분석할 파일 또는 디렉토리 경로

```bash
# 단일 파일 분석
effect-cli analyze src/index.ts

# 디렉토리 분석
effect-cli analyze src/
```

#### `--format` (선택적)
출력 형식 지정

- `json`: 상세한 JSON 형태 (기본값)
- `summary`: 요약된 텍스트 형태
- `table`: 테이블 형태
- `csv`: CSV 형태

```bash
effect-cli analyze src/ --format summary
effect-cli analyze src/ --format table
effect-cli analyze src/ --format csv
```

#### `--verbose` (선택적)
상세한 출력 활성화

```bash
effect-cli analyze src/ --verbose
```

#### `--enhanced` (선택적)
향상된 분석 활성화 (경로 해석, 의존성 해석, 코드 구조 분석 포함)

```bash
# 향상된 분석으로 더 자세한 인사이트 제공
effect-cli analyze src/ --enhanced --format summary

# 향상된 테이블 형식 (경로 해석 정보 포함)
effect-cli analyze src/index.ts --enhanced --format table --verbose
```

**향상된 분석 기능:**
- 🔍 **경로 해석 분석**: 의존성 경로 해석 상태, 타입별 분류
- 📊 **의존성 분석**: 순환 의존성, 미사용 imports, 위험 요소 감지
- 🏗️ **코드 구조 분석**: 복잡도 메트릭, 클래스 크기, 상속 깊이
- 📈 **해석 요약**: 전체적인 코드베이스 건강도 평가

### 범위 지정 옵션

#### `--include` (선택적)
포함할 파일의 glob 패턴

```bash
# TypeScript 파일만 분석
effect-cli analyze src/ --include "**/*.{ts,tsx}"

# 특정 디렉토리만 포함
effect-cli analyze . --include "src/**/*"
```

#### `--exclude` (선택적)
제외할 파일의 glob 패턴

```bash
# 테스트 파일 제외
effect-cli analyze src/ --exclude "**/*.test.*"

# 특정 디렉토리 제외
effect-cli analyze . --exclude "node_modules/**"
```

#### `--extensions` (선택적)
분석할 파일 확장자 (기본값: ts,tsx,js,jsx,md)

```bash
# TypeScript 파일만
effect-cli analyze src/ --extensions "ts,tsx"

# 모든 JavaScript 관련 파일
effect-cli analyze src/ --extensions "ts,tsx,js,jsx,mts,cts"

# 마크다운 파일만
effect-cli analyze docs/ --extensions "md"

# TypeScript와 마크다운만
effect-cli analyze . --extensions "ts,tsx,md"
```

#### `--max-depth` (선택적)
최대 디렉토리 탐색 깊이

```bash
# 최대 2레벨까지만 탐색
effect-cli analyze src/ --max-depth 2
```

### 성능 옵션

#### `--parallel` (선택적)
병렬 처리 활성화

```bash
effect-cli analyze src/ --parallel
```

#### `--concurrency` (선택적)
병렬 처리 시 동시 실행 파일 수 (기본값: 3)

```bash
effect-cli analyze src/ --parallel --concurrency 5
```

#### `--preset` (선택적)
분석 강도 프리셋

- `fast`: 빠른 분석 (기본 메트릭만)
- `balanced`: 균형잡힌 분석 (권장)
- `comprehensive`: 종합적인 분석 (모든 메트릭)

```bash
effect-cli analyze src/ --preset comprehensive
```

### 출력 옵션

#### `--output-dir` (선택적)
개별 파일 결과를 저장할 디렉토리

```bash
effect-cli analyze src/ --output-dir ./analysis-results
```

이 옵션을 사용하면 다음과 같은 구조로 결과가 저장됩니다:

```
analysis-results/
├── file-index.json           # 파일 인덱스
├── results/                  # 개별 분석 결과
│   ├── Component_abc123.json
│   └── utils_def456.json
└── summary/                  # 요약 정보
    └── batch-summary.json
```

## 사용 예시

### 1. 기본 프로젝트 분석

```bash
# 전체 src 디렉토리 분석
effect-cli analyze src/

# 요약 형태로 출력
effect-cli analyze src/ --format summary --verbose
```

### 2. 특정 범위 분석

```bash
# TypeScript 파일만, 테스트 파일 제외
effect-cli analyze src/ --include "**/*.{ts,tsx}" --exclude "**/*.test.*"

# 최대 깊이 3레벨, 특정 확장자만
effect-cli analyze . --max-depth 3 --extensions "ts,tsx"
```

### 3. 성능 최적화된 분석

```bash
# 병렬 처리로 빠른 분석
effect-cli analyze src/ --parallel --concurrency 8 --preset fast

# 종합적인 분석 (시간이 더 걸림)
effect-cli analyze src/ --preset comprehensive --verbose
```

### 4. 결과 저장 및 내보내기

```bash
# 개별 파일 결과 저장
effect-cli analyze src/ --output-dir ./reports

# CSV 형태로 내보내기
effect-cli analyze src/ --format csv > analysis.csv

# 상세 JSON 저장
effect-cli analyze src/ > detailed-analysis.json
```

### 5. 향상된 분석 사용

```bash
# 기본 분석 대비 향상된 인사이트
effect-cli analyze src/components/Button.tsx --enhanced --format summary

# 경로 해석 정보가 포함된 테이블
effect-cli analyze src/ --enhanced --format table --verbose

# 의존성 문제 진단
effect-cli analyze src/ --enhanced --verbose --include "**/*.ts"

# JSON 형식으로 모든 해석 데이터 저장
effect-cli analyze src/ --enhanced --format json --output-dir ./enhanced-reports
```

## 출력 형식 상세

### JSON 형식 (기본값)
```json
{
  "filePath": "src/index.ts",
  "pathInfo": { ... },
  "language": "typescript",
  "extractedData": {
    "dependency": {
      "dependencies": [...]
    },
    "identifier": {
      "identifiers": [...]
    }
  },
  "performanceMetrics": { ... },
  "errors": [],
  "metadata": { ... }
}
```

### Summary 형식
```
📄 Analysis Summary
File: src/index.ts
Status: ✅ Success
Dependencies: 12 total (8 external, 4 internal)
Analysis time: 15ms
```

### Table 형식
```
┌─────────────────────┬────────┬──────────────┐
│ Dependency          │ Type   │ Location     │
├─────────────────────┼────────┼──────────────┤
│ react               │ import │ line 1       │
│ ./utils             │ import │ line 3       │
└─────────────────────┴────────┴──────────────┘
```

### CSV 형식
```csv
File,Status,Dependencies,External,Internal,AnalysisTime
src/index.ts,success,12,8,4,15
```

## 범위 지정 고급 기법

### Glob 패턴 예시

```bash
# 모든 TypeScript 파일
--include "**/*.{ts,tsx}"

# src 디렉토리의 components만
--include "src/components/**/*"

# 테스트와 스토리북 파일 제외
--exclude "**/*.{test,spec,stories}.*"

# node_modules와 build 디렉토리 제외
--exclude "{node_modules,build,dist}/**"
```

### 복합 조건 예시

```bash
# 복잡한 필터링
effect-cli analyze . \
  --include "src/**/*.{ts,tsx}" \
  --exclude "**/*.{test,spec}.{ts,tsx}" \
  --exclude "**/__tests__/**" \
  --max-depth 5 \
  --extensions "ts,tsx"
```

## 의존성 분석 결과 해석

### 의존성 타입
- **import**: 일반적인 ES6 import
- **export**: re-export 구문
- **require**: CommonJS require
- **dynamic**: 동적 import()

### 의존성 분류
- **외부 의존성**: npm 패키지 (node_modules)
- **내부 의존성**: 프로젝트 내부 파일 (./, ../, /)
- **타입 전용**: TypeScript type-only imports

### 성능 지표
- **parseTime**: AST 파싱 시간
- **extractionTime**: 데이터 추출 시간
- **interpretationTime**: 분석 시간
- **memoryUsage**: 메모리 사용량 (바이트)

## 문제 해결

### 일반적인 문제

1. **파일을 찾을 수 없음**
   ```bash
   # 절대 경로 사용
   effect-cli analyze /full/path/to/src
   ```

2. **메모리 부족**
   ```bash
   # 동시 실행 수 줄이기
   effect-cli analyze src/ --concurrency 1
   ```

3. **분석 시간이 너무 길 때**
   ```bash
   # fast 프리셋 사용
   effect-cli analyze src/ --preset fast
   ```

### 최적화 팁

1. **큰 프로젝트**: `--parallel --concurrency 4 --preset fast`
2. **정확한 분석**: `--preset comprehensive --verbose`
3. **특정 파일만**: `--include` 옵션으로 범위 제한
4. **CI/CD**: `--format json` 또는 `--format csv`로 자동화

## 다음 단계

이 매뉴얼을 바탕으로 마크다운 파일 분석과 실제 테스트를 진행하겠습니다.