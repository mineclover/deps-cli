# CLI 커맨드 추가 트러블슈팅 가이드

Effect CLI에서 새로운 커맨드 추가 시 발생할 수 있는 문제들과 해결 방법을 정리합니다.

## 🚨 일반적인 문제들

### 1. "Service not found" 에러

**증상:**
```
Error: Service not found: FileSystem (defined at ...)
Error: Service not found: @effect/platform/FileSystem
```

**원인 & 해결:**

#### A. FileSystemLive 서비스 누락
```typescript
// ❌ 문제: bin.ts에서 FileSystemLive 제공 안함
const AppLayer = Layer.mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer
  // FileSystemLive 누락!
)

// ✅ 해결: FileSystemLive 추가
import { FileSystemLive } from "./services/FileSystemLive.js"

const AppLayer = Layer.mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  FileSystemLive // 추가
)
```

#### B. 잘못된 FileSystem import
```typescript
// ❌ 문제: 잘못된 서비스 import
import { FileSystem } from "./services/FileSystem.js" // App FileSystem
const fs = yield* FileSystem

// ✅ 해결: Platform FileSystem 사용
import { FileSystem } from "@effect/platform/FileSystem" // Platform FileSystem  
const fs = yield* FileSystem
```

### 2. 순환 의존성 에러

**증상:**
```
TypeError: Cannot read properties of undefined
Module loading issues
Unexpected behavior in service injection
```

**해결 방법:**
참조: [순환 의존성 해결 가이드](./CIRCULAR_DEPENDENCIES.md)

### 3. 커맨드가 CLI에 나타나지 않음

**원인 & 해결:**

#### A. CLI 등록 누락
```typescript
// ❌ 문제: Cli.ts에서 커맨드 누락
const command = mainCommand.pipe(
  Command.withSubcommands([
    simpleListCommand,
    // myNewCommand 누락!
  ])
)

// ✅ 해결: 새 커맨드 추가
import { myNewCommand } from "./examples/MyNewCommand.js"

const command = mainCommand.pipe(
  Command.withSubcommands([
    simpleListCommand,
    myNewCommand // 추가
  ])
)
```

#### B. Example Config 비활성화
```typescript
// ❌ 문제: config.ts에서 비활성화됨
export const ExampleConfig = {
  MY_COMMAND: false // 비활성화!
}

// ✅ 해결: 활성화
export const ExampleConfig = {
  MY_COMMAND: true // 활성화
}
```

### 4. TypeScript 컴파일 에러

**증상:**
```
TS2307: Cannot find module './MyCommand.js'
TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**해결 방법:**

#### A. Import 경로 확인
```typescript
// ❌ 문제: 잘못된 확장자
import { myCommand } from "./MyCommand.ts"

// ✅ 해결: .js 확장자 사용 (TypeScript에서 ES module)
import { myCommand } from "./MyCommand.js"
```

#### B. 타입 정의 확인
```typescript
// ❌ 문제: 잘못된 인수 타입
const nameArg = Args.text("name") // 타입 불일치

// ✅ 해결: 올바른 Args 사용
const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("User name")
)
```

## 🛠️ 디버깅 도구

### 1. 서비스 의존성 확인
```typescript
// 디버깅용 프로그램
const debugProgram = Effect.gen(function*() {
  console.log("Available services:")
  
  try {
    const fs = yield* FileSystem
    console.log("✅ FileSystem available")
  } catch (e) {
    console.log("❌ FileSystem not available:", e.message)
  }
  
  // 다른 서비스들도 확인...
})
```

### 2. 레이어 구성 검증
```typescript
// 레이어 디버깅
const debugLayer = Layer.effectDiscard(
  Effect.gen(function*() {
    console.log("Layer initialization started")
    
    // 각 서비스 초기화 확인
    yield* Effect.log("Checking FileSystem...")
    const fs = yield* FileSystem
    yield* Effect.log("FileSystem OK")
    
    yield* Effect.log("Layer initialization completed")
  })
)

const AppLayerWithDebug = Layer.mergeAll(
  AppLayer,
  debugLayer
)
```

### 3. CLI 커맨드 목록 확인
```bash
# 등록된 모든 커맨드 확인
pnpm dev --help

# 특정 커맨드 도움말
pnpm dev mycommand --help
```

## 📋 단계별 문제 해결

### Step 1: 기본 검증
```bash
# 1. TypeScript 컴파일 확인
pnpm build

# 2. 테스트 실행
pnpm test

# 3. CLI 도움말 확인
pnpm dev --help
```

### Step 2: 서비스 의존성 확인
```typescript
// 최소 테스트 커맨드 생성
export const testCommand = Command.make("test", {}, () =>
  Effect.gen(function*() {
    yield* Console.log("Test command works!")
    
    // 서비스 접근 테스트
    const fs = yield* FileSystem  
    yield* Console.log("FileSystem service available")
  })
)
```

### Step 3: 레이어 제공 확인
```typescript
// bin.ts에서 레이어 구성 확인
console.log("Layer configuration:")
console.log("- NodeContext:", !!NodeContext.layer)
console.log("- NodeFileSystem:", !!NodeFileSystem.layer) 
console.log("- NodePath:", !!NodePath.layer)
console.log("- FileSystemLive:", !!FileSystemLive)
```

## 🎯 예방 체크리스트

새 커맨드 추가 전 확인사항:

### 개발 단계
- [ ] **Service Dependencies**: 필요한 모든 서비스가 정의되었는가?
- [ ] **Import Paths**: 모든 import 경로가 정확한가? (`.js` 확장자 포함)
- [ ] **Type Safety**: TypeScript 컴파일이 성공하는가?
- [ ] **Effect Patterns**: Effect.gen, pipe 패턴을 올바르게 사용했는가?

### 통합 단계  
- [ ] **Layer Configuration**: bin.ts에서 필요한 레이어를 모두 제공했는가?
- [ ] **CLI Registration**: Cli.ts에서 커맨드를 등록했는가?
- [ ] **Config Settings**: Example config에서 활성화했는가?
- [ ] **Circular Dependencies**: 순환 의존성이 없는가?

### 테스트 단계
- [ ] **Build Success**: `pnpm build`가 성공하는가?
- [ ] **Help Display**: `pnpm dev --help`에서 커맨드가 보이는가?
- [ ] **Command Execution**: `pnpm dev mycommand`가 실행되는가?
- [ ] **Error Handling**: 에러 상황에서 적절히 처리되는가?

## 🔍 자주 발생하는 실수

### 1. Effect.js 패턴 실수
```typescript
// ❌ 잘못된 패턴
export const badCommand = Command.make("bad", {}, async ({ }) => {
  const result = await someAsyncOperation() // Promise 사용
  console.log(result) // 직접 side effect
  return result
})

// ✅ 올바른 패턴
export const goodCommand = Command.make("good", {}, ({ }) =>
  Effect.gen(function*() {
    const result = yield* Effect.fromPromise(() => someAsyncOperation())
    yield* Console.log(result) // Effect를 통한 side effect  
    return result
  })
)
```

### 2. Layer 제공 순서 실수
```typescript
// ❌ 의존성 순서 무시
const AppLayer = Layer.mergeAll(
  FileSystemLive,      // FileSystem에 의존
  NodeFileSystem.layer // 나중에 제공됨 - 에러!
)

// ✅ 의존성 순서 고려
const AppLayer = Layer.mergeAll(
  NodeFileSystem.layer, // 먼저 제공
  FileSystemLive        // 의존성 해결됨
)
```

### 3. Arguments/Options 타입 실수
```typescript
// ❌ 잘못된 타입
const fileArg = Args.file("file") // string 반환

// ✅ 올바른 타입  
const fileArg = Args.file({ name: "file" }) // 적절한 타입 반환
```

## 📞 추가 지원

문제가 지속될 경우:

1. **로그 분석**: `Effect.log`를 사용하여 실행 흐름 추적
2. **단계별 테스트**: 최소 단위부터 점진적으로 기능 추가
3. **기존 예제 참조**: `src/examples/SimpleSampleCommand.ts` 참조
4. **문서 확인**: [순환 의존성 가이드](./CIRCULAR_DEPENDENCIES.md) 참조

---

이 가이드를 통해 Effect CLI에서 안정적으로 새로운 커맨드를 추가할 수 있습니다.