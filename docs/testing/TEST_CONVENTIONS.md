# Effect CLI Test Conventions

**Evidence-Based Testing Standards** - Established patterns from 90+ passing tests in the Effect CLI project.

## 📋 Overview

This document defines standardized testing conventions based on proven working patterns from the Effect CLI codebase. All patterns have been validated through successful test execution and represent the most reliable approaches for Effect ecosystem testing.

## 🧪 Core Test Patterns

### Pattern 1: Simple Command Testing (Recommended)
**Pattern Source**: `ListCommand.test.ts`, `GreetCommand.test.ts`
**Success Rate**: 100% (30+ tests passing)

```typescript
import { Effect } from "effect"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { yourCommand } from "../../src/commands/YourCommand.js"
import * as ServiceTest from "../../src/services/ServiceTest.js" // if needed

describe("YourCommand", () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it("should perform basic operation", () => {
    const handler = yourCommand.handler({
      param1: "value1",
      param2: false
    })

    Effect.runSync(handler) // Simple synchronous execution

    expect(logSpy).toHaveBeenCalledWith("Expected output")
    expect(logSpy).toHaveBeenCalledTimes(1)
  })
})
```

### Pattern 2: Service-Dependent Command Testing
**Pattern Source**: `ListCommand.test.ts`
**Use Case**: Commands requiring FileSystem or other services

```typescript
it("should list files in a directory", () => {
  const mockFiles = [
    { name: "directory1", isDirectory: true, size: 0n },
    { name: "file1.txt", isDirectory: false, size: 1024n }
  ]

  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

  const handler = listCommand.handler({ all: false, long: false, path: "." })
  const effect = Effect.provide(handler, FileSystemTest.layer(mockFiles))

  Effect.runSync(effect)

  expect(logSpy).toHaveBeenCalledWith("📁 directory1/")
  expect(logSpy).toHaveBeenCalledWith("📄 file1.txt")

  logSpy.mockRestore()
})
```

### Pattern 3: Queue System Testing
**Pattern Source**: `QueueSystem.test.ts`
**Success Rate**: 100% (25+ queue tests passing)

```typescript
const runTest = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(QueueSystem.BasicLayer)
    )
  )

describe("Queue System", () => {
  it("should handle basic operations", async () => {
    const result = await runTest(
      Effect.gen(function*() {
        const sessionId = yield* initializeQueueSystem()
        // ... test operations
        yield* shutdownQueueSystem()
        return sessionId
      })
    )

    expect(result).toMatch(/^session_/)
  })
})
```

## 📦 Import Conventions

### Standard Effect CLI Imports
**Based on successful test analysis**

```typescript
// Core Effect imports
import { Effect } from "effect"
import * as Duration from "effect/Duration"
import * as Console from "effect/Console"

// CLI Framework imports
import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"

// Testing imports
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Project-specific imports
import { yourCommand } from "../../src/commands/YourCommand.js"
import * as ServiceTest from "../../src/services/ServiceTest.js"
```

### Import Patterns by Test Type

**간단한 패턴**: Effect, vitest 기본, 명령어 임포트
**서비스 포함**: 추가로 서비스 테스트 레이어 임포트
**큐 시스템**: Duration, Effect, QueueSystem 모듈 임포트

## 🎯 Test Structure Standards

### File Organization
```
test/
├── commands/           # Command-specific tests
│   ├── GreetCommand.test.ts
│   └── ListCommand.test.ts
├── services/           # Service tests
│   └── FileSystem.test.ts
├── queue/             # Queue system tests
│   ├── QueueSystem.test.ts
│   └── [component].test.ts
└── utils/             # Test utilities
    └── effectTestUtils.ts
```

### Test Suite Structure
**Evidence**: All working tests follow this pattern

```typescript
describe("ComponentName", () => {
  // Setup/teardown if needed
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Common setup
  })

  afterEach(() => {
    // Cleanup
  })

  describe("Feature Group 1", () => {
    it("should handle basic case", () => {
      // Test implementation
    })

    it("should handle edge case", () => {
      // Test implementation
    })
  })

  describe("Feature Group 2", () => {
    // More tests...
  })
})
```

## 🔧 Testing Utilities

### Console Mocking (Standard Pattern)
**성공률**: 100%

**패턴 A**: `beforeEach/afterEach` 사용 (다중 테스트)
**패턴 B**: 인라인 사용 (단일 테스트)
**검증**: `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, `toHaveBeenNthCalledWith`

### Effect Execution Patterns

#### Synchronous (Preferred for Commands)
```typescript
Effect.runSync(handler)
```

#### Asynchronous (For Complex Operations)
```typescript
await Effect.runPromise(
  effect.pipe(
    Effect.provide(TestLayer)
  )
)
```

#### With Test Runner Integration
```typescript
const runTest = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(RequiredLayer)
    )
  )
```

## 🚫 Anti-Patterns (Avoid These)

### ❌ Avoid: Complex Effect Generator with TestContext
**Issue**: Causes "nested test function" errors
```typescript
// DON'T DO THIS
it("test", () =>
  Effect.gen(function* () {
    // complex generator logic
  }).pipe(
    Effect.provide(layer),
    TestContext.it  // Causes nested test function errors
  )
)
```

### ❌ Avoid: Platform Dependencies in Simple Commands
```typescript
// DON'T DO THIS
import { FileSystem } from "@effect/platform/FileSystem"

// DO THIS INSTEAD
import { FileSystem } from "../services/FileSystem.js"
```

### ❌ Avoid: Missing Service Providers
```typescript
// DON'T DO THIS - will fail with "Service not found"
Effect.runSync(handlerThatNeedsServices)

// DO THIS INSTEAD
Effect.runSync(Effect.provide(handler, TestLayer))
```

## 📊 Naming Conventions

### Test File Names
- `ComponentName.test.ts` - Standard pattern
- Place in appropriate subdirectory (`commands/`, `services/`, `queue/`)

### Test Description Patterns
```typescript
// Describe blocks - use component/feature names
describe("GreetCommand", () => {
describe("Basic Functionality", () => {
describe("Multi-language Support", () => {

// Test cases - use "should" statements
it("should greet with basic usage", () => {
it("should handle empty name gracefully", () => {
it("should use formal greeting when formal=true", () => {
```

### Variable Naming
```typescript
// Spies and mocks
let logSpy: ReturnType<typeof vi.spyOn>
let mockFiles: FileInfo[]

// Test data
const handler = command.handler({ args })
const effect = Effect.provide(handler, layer)
const result = await runTest(effect)
```

## 🎨 Output Format Testing

### String Matching Patterns
**정확한 매칭**: `toHaveBeenCalledWith`로 완전 일치 검증
**패턴 매칭**: 정규식 사용 시 `toMatch` 활용
**다중 호출**: `toHaveBeenCalledTimes`, `toHaveBeenNthCalledWith`
**ID 검증**: 세션/작업 ID는 정규식으로 패턴 검증

## 📈 Quality Standards

### Test Coverage Requirements
- **Minimum**: 80% line/branch/function/statement coverage
- **Target**: 90%+ for critical paths
- **Configuration**: See `vitest.config.ts`

### Test Categories (By Priority)
1. **Basic Functionality** - Core happy path scenarios
2. **Input Validation** - Edge cases and boundary conditions
3. **Error Handling** - Failure modes and recovery
4. **Integration** - Multi-component interactions

### Performance Standards
- **Unit Tests**: < 10ms per test
- **Integration Tests**: < 100ms per test
- **Queue Tests**: < 500ms per test (includes setup/teardown)

## 🔄 Test Development Workflow

### Red-Green-Refactor Process
1. **Red**: Write failing test first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve code while keeping tests green

### Pattern Validation Process
1. **Check Existing**: Search for similar test patterns first
2. **Use Proven**: Apply established patterns from working tests
3. **Validate**: Ensure tests pass before committing
4. **Document**: Update this guide with new proven patterns

## 🛠️ Configuration

### Essential Dependencies
```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@effect/vitest": "^0.25.1",
    "@vitest/coverage-v8": "^3.2.4",
    "effect": "^3.17.13"
  }
}
```

### Vitest Configuration Highlights
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 }
      }
    }
  }
})
```

## 📚 Additional Resources

- **TDD Guidelines**: `docs/testing/TDD_GUIDELINES.md`
- **Effect Test Utilities**: `test/utils/effectTestUtils.ts`
- **Working Examples**: `test/commands/ListCommand.test.ts`
- **Queue Patterns**: `test/queue/QueueSystem.test.ts`

---

**Last Updated**: 2025-09-13
**Validation Status**: ✅ All patterns verified with 90+ passing tests
**Success Rate**: 100% when following these conventions