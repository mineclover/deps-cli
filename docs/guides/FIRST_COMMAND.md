# 첫 번째 명령어 만들기

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Guides > First Command
> 🟢 **난이도**: 초급

단계별로 따라하며 첫 번째 CLI 명령어를 만들어보겠습니다.

## 🎯 목표

`hello` 명령어를 만들어서 사용자에게 인사하는 CLI를 구현합니다.

```bash
pnpm dev hello "World"        # Hello, World!
pnpm dev hello "Effect" --shout  # HELLO, EFFECT!
```

## 📝 단계별 구현

### 1단계: 명령어 파일 생성

**src/commands/HelloCommand.ts** 생성:
```typescript
import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args" 
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// 인수: 인사할 이름
const nameArg = Args.text("name").pipe(
  Args.withDescription("인사할 이름")
)

// 옵션: 대문자로 외치기
const shoutOption = Options.boolean("shout").pipe(
  Options.withDescription("대문자로 외치기")
)

// 명령어 정의
export const helloCommand = Command.make("hello", {
  name: nameArg,
  shout: shoutOption
}).pipe(
  Command.withDescription("사용자에게 인사합니다"),
  Command.withHandler(({ name, shout }) =>
    Effect.gen(function* () {
      const greeting = `Hello, ${name}!`
      const output = shout ? greeting.toUpperCase() : greeting
      
      yield* Console.log(output)
    })
  )
)
```

### 2단계: 명령어 등록

**src/commands/index.ts** 수정:
```typescript
import { helloCommand } from "./HelloCommand.js"

export const productionCommands = [
  helloCommand,
  // 다른 명령어들...
]
```

### 3단계: CLI에 통합

**src/Cli.ts** 확인:
```typescript
import { productionCommands } from "./commands/index.js"

const command = mainCommand.pipe(
  Command.withSubcommands([
    ...productionCommands,  // helloCommand 포함됨
    // 예제 명령어들...
  ])
)
```

### 4단계: 테스트

```bash
# 도움말 확인
pnpm dev hello --help

# 기본 사용
pnpm dev hello "World"

# 옵션 사용  
pnpm dev hello "Effect" --shout
```

## ✅ 완료!

축하합니다! 첫 번째 Effect CLI 명령어를 성공적으로 만들었습니다.

## 🔄 다음 단계

- 📖 [고급 명령어 구현](ADVANCED_COMMANDS.md)
- 📖 [테스트 작성](../development/TESTING.md)
- 📖 [타입 안전성](../development/TYPE_SAFETY.md)

---
**📚 관련 문서**:
- [Command Development](../development/COMMAND_DEVELOPMENT.md)
- [Effect Patterns](../api/EFFECT_PATTERNS.md)