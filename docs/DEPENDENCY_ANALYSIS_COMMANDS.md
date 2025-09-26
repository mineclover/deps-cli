# Dependency Analysis Commands

deps-cli는 다양한 의존성 추적과 코드 분석을 위한 **기존 6개 + Enhanced 5개** 총 11개의 독립적인 명령어를 제공합니다.

> **🚀 NEW**: [Enhanced Dependency Analysis System](./ENHANCED_DEPENDENCY_ANALYSIS.md)이 추가되었습니다!
> AST 기반 고정밀도 분석을 통해 **99%+ 정확도**를 달성했습니다.

## 🔄 명령어 비교

| 기능 | 기존 명령어 | Enhanced 명령어 | 권장 |
|------|-------------|-----------------|------|
| 전체 분석 | `analyze` | `analyze-enhanced` | ✅ Enhanced |
| 파일 사용처 | `find-usages` | `find-usages-enhanced` | ✅ Enhanced |
| 메서드 사용처 | `find-method-usages` | `find-method-usages-enhanced` | ✅ Enhanced |
| 미사용 파일 | `find-unused-files` | `find-unused-files-enhanced` | ✅ Enhanced |
| 미사용 메서드 | `find-unused-methods` | `find-unused-methods-enhanced` | ✅ Enhanced |
| Export 분석 | `check-exports` | *(Enhanced에 통합됨)* | - |

## 📋 명령어 목록

| 명령어 | 용도 | 입력 | 출력 |
|--------|------|------|------|
| `analyze` | 전체 의존성 분석 | 파일/디렉토리 | 의존성 그래프 |
| `find-usages` | 파일 사용처 찾기 | 파일 경로 | 해당 파일을 import하는 모든 파일 |
| `find-method-usages` | 메서드 사용처 찾기 | 클래스명, 메서드명 | 해당 메서드를 호출하는 모든 파일 |
| `find-unused-files` | 미사용 파일 탐지 | 없음 | 어디서도 import되지 않는 파일들 |
| `find-unused-methods` | 미사용 메서드 탐지 | 없음 | 어디서도 호출되지 않는 메서드들 |
| `check-exports` | Export 사용 분석 | 파일 경로 | 각 export의 사용 현황 |

## 🎯 1. 파일 사용처 찾기 (`find-usages`)

**용도**: 특정 파일을 import/require하는 모든 파일들을 찾습니다.

### 사용법
```bash
node dist/bin.js find-usages <파일경로> [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화
- `-h, --help`: 도움말 표시

### 예시
```bash
# 기본 사용법
node dist/bin.js find-usages src/utils/IdGenerator.ts

# 상세 정보 출력
node dist/bin.js find-usages src/config/ConfigManager.ts --verbose

# JSON 형식으로 출력
node dist/bin.js find-usages src/types/AnalysisTypes.ts --format json
```

### 출력 예시
```
📄 파일 사용처 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 대상 파일: src/config/ConfigManager.ts
⏱️ 분석 시간: 45ms
📁 총 파일: 55개

✅ 사용하는 파일들 (1개):
  1. src/bin.ts
     라인 8: import { globalConfig } from "./config/ConfigManager.js"
```

## 🔧 2. 메서드 사용처 찾기 (`find-method-usages`)

**용도**: 특정 클래스의 메서드를 호출하는 모든 파일들과 위치를 찾습니다.

### 사용법
```bash
node dist/bin.js find-method-usages <클래스명> <메서드명> [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화

### 예시
```bash
# UserService의 addUser 메서드 사용처 찾기
node dist/bin.js find-method-usages UserService addUser

# 상세 정보 포함
node dist/bin.js find-method-usages IdGenerator generateFileId --verbose
```

### 출력 예시
```
🔧 메서드 사용처 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 대상 메서드: UserService.addUser
⏱️ 분석 시간: 34ms
📁 총 파일: 55개

📍 메서드 정의: /path/to/UserService.ts
   접근 제어: public
   정적 메서드: No
   비동기: Yes

✅ 사용하는 파일들 (2개):
  1. test-method-analysis.ts:75
     컨텍스트: return userService.addUser({
```

## 🗑️ 3. 미사용 파일 탐지 (`find-unused-files`)

**용도**: 프로젝트에서 어디서도 import되지 않는 파일들을 찾습니다.

### 사용법
```bash
node dist/bin.js find-unused-files [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화
- `--include-tests`: 테스트 파일을 엔트리 포인트에 포함 (기본값: `true`)

### 예시
```bash
# 기본 미사용 파일 탐지
node dist/bin.js find-unused-files

# 상세 정보 포함
node dist/bin.js find-unused-files --verbose

# 테스트 파일 제외하고 분석
node dist/bin.js find-unused-files --include-tests=false
```

### 분류 기준
- **Generated file**: 빌드 결과물, coverage 파일 등 - 안전하게 무시 가능
- **Standalone test script**: 독립 실행 스크립트 - import되지 않아도 정상
- **Unused utility**: 실제 정리 대상인 유틸리티 파일
- **Unused type definitions**: TypeScript 타입 파일 - 런타임에서 사용되지 않음
- **Specification/contract file**: 인터페이스 정의 파일

### 출력 예시
```
🗑️ 미사용 파일 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ 분석 시간: 157ms
📁 총 파일: 55개
🗑️ 미사용 파일: 18개

📋 미사용 파일 목록:
  1. src/utils/StreamingAnalyzer.ts
     크기: 1.0KB
     마지막 수정: 2025. 9. 23.
     이유: Unused utility - exports 4 items but not imported

💡 총 112.6KB의 미사용 코드가 발견되었습니다.
```

## 🔍 4. 미사용 메서드 탐지 (`find-unused-methods`)

**용도**: 어디서도 호출되지 않는 메서드들을 찾습니다.

### 사용법
```bash
node dist/bin.js find-unused-methods [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화
- `--include-private`: private 메서드 포함 (기본값: `false`)

### 예시
```bash
# public 메서드만 분석 (기본)
node dist/bin.js find-unused-methods

# private 메서드도 포함하여 분석
node dist/bin.js find-unused-methods --include-private

# 상세 정보 포함
node dist/bin.js find-unused-methods --verbose
```

### 출력 예시
```
🔧 미사용 메서드 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ 분석 시간: 877ms
📁 총 파일: 55개
🔧 총 메서드: 92개
🗑️ 미사용 메서드: 4개

📋 미사용 메서드 목록:

  🔴 HIGH IMPACT (4개):
    1. UserService.constructor
       위치: examples/scenarios/UserService.ts:24
       접근: public instance
       이유: No usages found
```

## 📊 5. Export 사용 분석 (`check-exports`)

**용도**: 특정 파일의 각 export가 실제로 사용되는지 상세 분석합니다.

### 사용법
```bash
node dist/bin.js check-exports <파일경로> [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화

### 예시
```bash
# 기본 export 분석
node dist/bin.js check-exports src/utils/IdGenerator.ts

# 상세 사용처 정보 포함
node dist/bin.js check-exports src/utils/ProjectRootDetector.ts --verbose
```

### 출력 예시
```
📊 Export 사용 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 대상 파일: src/utils/ProjectRootDetector.ts
📦 총 Export: 6개
✅ 사용됨: 3개
❌ 미사용: 3개

🗑️ 미사용 Export 목록:
  1. getProjectRelativePath (function)
  2. isWithinProject (function)
  3. findCommonBasePath (function)

✅ 사용되는 Export 목록:
  1. ProjectRootInfo (type)
     사용 횟수: 1회
     사용 파일: 1개
     • src/utils/EnhancedAnalyzer.ts:13
```

## 🎯 6. 전체 의존성 분석 (`analyze`)

**용도**: 파일/디렉토리의 전체적인 의존성 구조를 분석합니다.

### 사용법
```bash
node dist/bin.js analyze <파일또는디렉토리> [옵션]
```

### 옵션
- `--format <format>`: 출력 형식 (`json`, `summary`) 기본값: `summary`
- `-v, --verbose`: 상세 출력 활성화
- `--method-flow`: 메서드 수준 분석 활성화 (상세한 메서드 분석)

### 예시
```bash
# 디렉토리 전체 분석
node dist/bin.js analyze src/

# 메서드 수준 상세 분석
node dist/bin.js analyze test-method-analysis.ts --method-flow --verbose

# JSON 형식으로 전체 결과 출력
node dist/bin.js analyze . --format json
```

## 📈 성능 및 사용 팁

### 실행 시간 비교 (55개 파일 기준)
- `find-usages`: ~30ms (단일 파일 추적)
- `find-method-usages`: ~35ms (메서드 패턴 매칭)
- `find-unused-files`: ~150ms (전체 의존성 그래프 구축)
- `find-unused-methods`: ~900ms (모든 메서드 사용 패턴 분석)
- `check-exports`: ~100ms (단일 파일의 모든 export 분석)
- `analyze`: ~200ms (전체 구조 분석)

### 권장 사용 패턴

1. **코드 정리 워크플로우**:
   ```bash
   # 1. 미사용 파일 찾기
   node dist/bin.js find-unused-files --verbose

   # 2. 의심스러운 파일의 export 상세 분석
   node dist/bin.js check-exports src/utils/SomeFile.ts --verbose

   # 3. 특정 파일/메서드 사용처 확인
   node dist/bin.js find-usages src/utils/SomeFile.ts
   node dist/bin.js find-method-usages SomeClass someMethod
   ```

2. **리팩토링 전 영향도 분석**:
   ```bash
   # 변경하려는 파일의 사용처 파악
   node dist/bin.js find-usages src/components/Button.tsx

   # 메서드 시그니처 변경 시 영향 파악
   node dist/bin.js find-method-usages Button onClick
   ```

3. **프로젝트 건강도 체크**:
   ```bash
   # 전체적인 미사용 코드 현황
   node dist/bin.js find-unused-files
   node dist/bin.js find-unused-methods

   # 전체 의존성 구조 파악
   node dist/bin.js analyze . --format json > dependency-report.json
   ```

## ⚠️ 주의사항

1. **동적 import는 감지되지 않음**: `import()` 구문이나 문자열 기반 require는 추적되지 않습니다.

2. **테스트 파일 처리**: 테스트 파일들은 독립적인 엔트리 포인트로 간주되어 "미사용"으로 분류되지 않습니다.

3. **타입 전용 import**: TypeScript의 타입만 사용하는 경우 런타임에서는 사용되지 않는 것으로 분석될 수 있습니다.

4. **메서드 오버라이드**: 상속 관계에서 메서드 오버라이드는 복잡한 패턴 매칭이 필요할 수 있습니다.

## 🔧 문제 해결

### 일반적인 문제들

**Q: "미사용"으로 표시된 파일이 실제로는 사용되는 것 같습니다.**
A: `find-usages` 명령어로 구체적인 사용처를 확인해보세요. 동적 import나 문자열 기반 참조는 감지되지 않을 수 있습니다.

**Q: export 분석에서 실제 사용되는 메서드가 미사용으로 나옵니다.**
A: 복잡한 호출 패턴(체이닝, 구조분해할당 등)은 감지되지 않을 수 있습니다. `--verbose` 옵션으로 상세 정보를 확인해보세요.

**Q: 분석 속도가 너무 느립니다.**
A: 큰 프로젝트의 경우 특정 디렉토리나 파일만 분석하는 것을 권장합니다. 전체 분석은 필요한 경우에만 수행하세요.