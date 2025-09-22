# Command Development Guide

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Development > Command Development

새로운 CLI 명령어를 개발하는 완전한 가이드입니다.

## 🏗️ 명령어 구조

### 기본 패턴
```typescript
import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"

const myCommand = Command.make("command-name", {
  // 인수와 옵션 정의
}).pipe(
  Command.withDescription("명령어 설명"),
  Command.withHandler((args) => Effect.gen(function* () {
    // 명령어 로직
  }))
)
```

## 📝 단계별 개발

### 1단계: 인수 정의

**필수 인수**:
```typescript
const fileArg = Args.file("file").pipe(
  Args.withDescription("파일 경로")
)
```

**선택적 인수**:
```typescript
const pathArg = Args.directory("path").pipe(
  Args.withDefault("."),
  Args.withDescription("디렉토리 경로")
)
```

### 2단계: 옵션 정의

**Boolean 옵션**:
```typescript
const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("상세 출력")
)
```

**Choice 옵션**:
```typescript
const formatOption = Options.choice("format", ["json", "table"]).pipe(
  Options.withDefault("table" as const)
)
```

### 3단계: 명령어 조합
```typescript
const myCommand = Command.make("my-cmd", {
  file: fileArg,
  path: pathArg,
  verbose: verboseOption,
  format: formatOption
})
```

### 4단계: 핸들러 구현
```typescript
.pipe(
  Command.withHandler(({ file, path, verbose, format }) =>
    Effect.gen(function* () {
      // 타입 안전한 핸들러 구현
      if (verbose) {
        yield* Console.log(`Processing ${file} in ${path}`)
      }
      
      // 비즈니스 로직
      const result = yield* processFile(file, format)
      
      return result
    })
  )
)
```

## 🧪 Effect 패턴

### 서비스 주입
```typescript
Effect.gen(function* () {
  const fs = yield* FileSystem
  const files = yield* fs.listDirectory(path)
  return files
})
```

### 에러 처리
```typescript
Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => readFile(path),
    catch: (error) => new FileNotFoundError({ path, error })
  })
  return result
})
```

## 📁 파일 구조

### 명령어 파일: `src/commands/MyCommand.ts`
```typescript
export const myCommand = Command.make(...)
```

### 등록: `src/commands/index.ts`
```typescript
import { myCommand } from "./MyCommand.js"

export const productionCommands = [
  myCommand,
  // 다른 명령어들...
]
```

### CLI 통합: `src/Cli.ts`  
```typescript
import { productionCommands } from "./commands/index.js"

Command.withSubcommands([...productionCommands])
```

## ✅ 체크리스트

- [ ] 명령어 이름은 kebab-case
- [ ] 모든 인수/옵션에 설명 추가
- [ ] 타입 안전한 핸들러 구현
- [ ] Effect.gen 패턴 사용
- [ ] 에러 처리 구현
- [ ] 테스트 작성
- [ ] 문서 업데이트

---
**📚 관련 문서**:
- [Type Safety](TYPE_SAFETY.md) - 타입 안전성 패턴
- [Testing](TESTING.md) - 명령어 테스트
- [CLI API](../api/CLI_API.md) - API 레퍼런스