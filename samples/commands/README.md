# Effect CLI Examples

이 폴더에는 Effect CLI의 다양한 패턴을 보여주는 예제 명령어들이 포함되어 있습니다.

## 포함된 예제

### 기본 명령어
- **ls** - 디렉토리 목록 조회
- **cat** - 파일 내용 읽기
- **find** - 파일 검색

### 고급 예제
- **sample** - 모든 패턴을 시연하는 종합 예제
- **advanced** - 서브커맨드 패턴 예제

## 예제 사용 방법

### 1. 모든 예제 포함하기 (기본값)

```typescript
// src/Cli.ts
import { exampleCommands } from "./examples/index.js"

const allCommands = [
  ...exampleCommands,
  ...yourCommands
]
```

### 2. 선택적으로 예제 포함하기

```typescript
// src/Cli.ts
import { listCommand, catCommand } from "./examples/index.js"

const allCommands = [
  listCommand,  // 원하는 예제만 선택
  catCommand,
  ...yourCommands
]
```

### 3. 예제 완전히 제거하기

```typescript
// src/Cli.ts
// import { exampleCommands } from "./examples/index.js"  // 주석 처리

const allCommands = [
  // ...exampleCommands,  // 제거
  ...yourCommands
]
```

## 예제 실행하기

```bash
# 빌드
pnpm build

# ls 명령어
node dist/bin.cjs ls
node dist/bin.cjs ls --long
node dist/bin.cjs ls --all

# cat 명령어
node dist/bin.cjs cat package.json
node dist/bin.cjs cat README.md --number

# find 명령어
node dist/bin.cjs find . "test"
node dist/bin.cjs find . "*.ts" --type f

# sample 명령어 (모든 패턴 시연)
node dist/bin.cjs sample --help
node dist/bin.cjs sample --format json package.json . "json"
node dist/bin.cjs sample --verbose package.json . "test"

# advanced 명령어 (서브커맨드)
node dist/bin.cjs advanced info "target"
node dist/bin.cjs advanced process input.txt output.txt
```

## 예제에서 배울 수 있는 패턴

### 1. Arguments (인수)
- 필수 인수
- 선택적 인수 (기본값)
- 다양한 타입 (file, directory, text)

### 2. Options (옵션)
- Boolean 옵션 (`--verbose`, `--all`)
- Choice 옵션 (`--format json|text|table`)
- Integer 옵션 (`--limit 10`)
- 반복 가능한 옵션 (`--exclude pattern1 --exclude pattern2`)

### 3. 핸들러 패턴
- Effect.gen 사용
- 서비스 의존성 주입
- 에러 처리
- 로깅 및 트레이싱

### 4. 출력 포맷
- JSON 출력
- 테이블 형식
- 아이콘 및 색상
- 요약 정보

### 5. 서브커맨드
- 중첩된 명령어 구조
- 명령어별 독립적인 인수/옵션

## 프로덕션 준비

프로덕션 배포 시:

1. `src/examples` 폴더 전체 삭제 가능
2. `src/Cli.ts`에서 예제 import 제거
3. 실제 비즈니스 로직 명령어만 포함

```bash
# 예제 폴더 제거
rm -rf src/examples
```