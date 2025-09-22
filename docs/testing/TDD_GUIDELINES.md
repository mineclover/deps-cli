# TDD Guidelines for Effect CLI

**Version**: 1.0.0
**Created**: 2025-09-13
**Target**: Effect 생태계 최적화 TDD 체계

## 📋 Overview

Effect CLI 프로젝트를 위한 종합적인 Test-Driven Development 가이드라인입니다. Effect 생태계의 특성을 고려한 일관성 있는 테스트 패턴과 모범 사례를 제시합니다.

## 🏗️ Test Architecture

### Core Libraries Stack
```typescript
{
  "test-runner": "vitest@3.2.4",           // Fast, modern test runner
  "effect-testing": "@effect/vitest@0.25.1", // Effect-specific test utilities
  "coverage": "@vitest/coverage-v8@3.2.4",  // Comprehensive coverage analysis
  "mocking": "vitest/vi",                   // Built-in mocking capabilities
}
```

### Project Structure
```
test/
├── commands/           # CLI command tests
├── services/          # Service layer tests
├── queue/            # Queue system tests
├── utils/            # Test utilities and helpers
│   ├── testHelpers.ts      # Legacy test helpers
│   └── effectTestUtils.ts  # New Effect-optimized utilities
└── integration/      # End-to-end integration tests
```

## 🎯 TDD Principles

### 1. Red-Green-Refactor Cycle

**Red Phase**: 실패하는 테스트 작성
```typescript
import { testWithLayer } from "../utils/effectTestUtils.js"

describe("GreetCommand", () => {
  it("should greet user with proper message",
    testWithLayer(
      "basic greeting",
      pipe(
        greetCommand.handler({ name: "Alice", formal: false }),
        Effect.flatMap(() => Effect.fail("Not implemented yet"))
      ),
      TestLayer,
      (result) => {
        expect(result).toContain("Hello Alice")
      }
    )
  )
})
```

**Green Phase**: 최소한의 구현으로 테스트 통과
```typescript
export const greetCommand = Command.make("greet", { name: Args.text() },
  ({ name }) => Console.log(`Hello ${name}`)
)
```

**Refactor Phase**: 코드 품질 개선
```typescript
export const greetCommand = Command.make(
  "greet",
  {
    name: Args.text({ name: "name" }),
    formal: Options.boolean("formal").pipe(Options.withDefault(false))
  },
  ({ name, formal }) =>
    Console.log(formal ? `Good day, ${name}.` : `Hello ${name}!`)
)
```

### 2. Test Structure Patterns

**AAA Pattern (Arrange-Act-Assert)**:
```typescript
it("should handle multiple greetings", () =>
  Effect.gen(function* () {
    // Arrange
    const mockConsole = createMockConsole()
    const names = ["Alice", "Bob", "Charlie"]

    // Act
    for (const name of names) {
      yield* greetCommand.handler({ name, formal: false })
    }

    // Assert
    const output = mockConsole.getOutput()
    expect(output).toHaveLength(3)
    expect(output[0]).toContain("Hello Alice")
    expect(output[1]).toContain("Hello Bob")
    expect(output[2]).toContain("Hello Charlie")
  }).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

### 3. Effect-Specific Test Patterns

**Effect Success Testing**:
```typescript
import { expectSuccess } from "../utils/effectTestUtils.js"

it("should succeed with expected result", () =>
  expectSuccess(
    greetCommand.handler({ name: "Test" }),
    undefined // void return
  ).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

**Effect Failure Testing**:
```typescript
import { expectFailure } from "../utils/effectTestUtils.js"

it("should fail with validation error", () =>
  expectFailure(
    greetCommand.handler({ name: "" }),
    (error) => error.message.includes("name cannot be empty")
  ).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

**Effect Timing Testing**:
```typescript
import { expectTimingWithin } from "../utils/effectTestUtils.js"

it("should complete within performance budget", () =>
  expectTimingWithin(
    greetCommand.handler({ name: "Performance Test" }),
    100, // max 100ms
    0    // min 0ms
  ).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

## 📝 Command Testing Standards

### Basic Command Test Template
```typescript
import { testCliCommand } from "../utils/effectTestUtils.js"

describe("MyCommand", () => {
  const TestLayer = Layer.mergeAll(
    // Add required services
    MockConsoleLayer,
    MockFileSystemLayer
  )

  testCliCommand(
    "my-command",
    myCommand.handler,
    { arg1: "value1", option1: true },
    TestLayer,
    {
      output: ["Expected output line 1", "Expected output line 2"],
      errors: [],
      exitCode: 0
    }
  )

  // Additional specific tests
  it("should handle edge cases", () =>
    Effect.gen(function* () {
      // Test edge case logic
    }).pipe(
      Effect.provide(TestLayer),
      TestContext.it
    )
  )
})
```

### Service Integration Testing
```typescript
import { createMockService } from "../utils/effectTestUtils.js"

describe("CommandWithServices", () => {
  const MockQueueService = createMockService(QueueSystem, {
    initialize: () => Effect.succeed("session-123"),
    shutdown: () => Effect.succeed(void 0),
    getMetrics: () => Effect.succeed({
      isHealthy: true,
      activeTasks: 0
    })
  })

  const TestLayer = Layer.mergeAll(
    MockQueueService,
    MockFileSystemLayer
  )

  // Tests using the mock services
})
```

## 🧪 Testing Strategies

### 1. Unit Tests (60% of test suite)
- **Scope**: Individual functions and command handlers
- **Focus**: Business logic, validation, error handling
- **Pattern**: Isolated testing with minimal dependencies

```typescript
describe("Unit: GreetCommand", () => {
  it("should format greeting message correctly", () => {
    const result = formatGreeting("Alice", { formal: true, language: "en" })
    expect(result).toBe("Good day, Alice.")
  })
})
```

### 2. Integration Tests (30% of test suite)
- **Scope**: Service interactions, command pipelines
- **Focus**: Component collaboration, data flow
- **Pattern**: Multiple services with realistic mocks

```typescript
describe("Integration: File Operations", () => {
  const IntegrationLayer = Layer.mergeAll(
    QueueSystemLayer,
    FileSystemTestLayer,
    ConsoleTestLayer
  )

  it("should queue and process file operations", () =>
    Effect.gen(function* () {
      const queue = yield* QueueSystem
      const fileOps = yield* FileOperations

      const taskId = yield* fileOps.readFile("/test/file.txt")
      const metrics = yield* queue.getMetrics()

      expect(metrics.activeTasks).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(IntegrationLayer),
      TestContext.it
    )
  )
})
```

### 3. End-to-End Tests (10% of test suite)
- **Scope**: Complete user workflows
- **Focus**: System behavior, performance, reliability
- **Pattern**: Full system with realistic data

```typescript
describe("E2E: Complete Workflow", () => {
  it("should handle complete file processing workflow", () =>
    Effect.gen(function* () {
      // Start with empty state
      yield* initializeCleanState()

      // Execute complete workflow
      yield* runCommand("process-files", {
        input: "/test/input",
        output: "/test/output"
      })

      // Verify final state
      const files = yield* listFiles("/test/output")
      expect(files.length).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(FullSystemLayer),
      TestContext.it
    )
  )
})
```

## 📊 Coverage Standards

### Coverage Targets
```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    global: {
      branches: 80,    // 80% branch coverage
      functions: 80,   // 80% function coverage
      lines: 80,       // 80% line coverage
      statements: 80   // 80% statement coverage
    }
  }
}
```

### Coverage Exclusions
- `src/bin.ts` - Entry point script
- `src/examples/**` - Example code
- Test files themselves
- Type definition files

### Coverage Commands
```bash
# Run tests with coverage
pnpm coverage

# Coverage with watch mode
pnpm vitest --coverage --watch

# Coverage for specific files
pnpm vitest run --coverage src/commands/
```

## 🔄 Development Workflow

### 1. TDD Development Cycle

**Step 1**: Write Failing Test
```bash
# Create test file first
touch test/commands/NewCommand.test.ts

# Write failing test
pnpm test NewCommand.test.ts  # Should fail
```

**Step 2**: Implement Minimal Solution
```bash
# Create implementation file
touch src/commands/NewCommand.ts

# Implement minimal code to pass test
pnpm test NewCommand.test.ts  # Should pass
```

**Step 3**: Refactor and Improve
```bash
# Refactor implementation
# Add more tests
# Verify coverage

pnpm coverage  # Check coverage metrics
pnpm lint      # Check code quality
```

### 2. Continuous Testing

**Watch Mode for Development**:
```bash
# Test specific file during development
pnpm vitest NewCommand.test.ts --watch

# Test related files
pnpm vitest test/commands/ --watch

# All tests with coverage
pnpm vitest --coverage --watch
```

**Pre-commit Validation**:
```bash
# Run full test suite
pnpm test

# Check coverage thresholds
pnpm coverage

# Validate code quality
pnpm lint
```

## 🛠️ Mock and Test Double Strategies

**서비스 모킹**: `createMockService`로 특정 동작 구현
**스파이 서비스**: `createSpyService`로 호출 검증
**시간 모킹**: `vi.setSystemTime`으로 시간 기반 동작 테스트

## 🚀 Performance Testing

### Timing Assertions
```typescript
import { expectTimingWithin } from "../utils/effectTestUtils.js"

it("should complete within performance budget", () =>
  expectTimingWithin(
    heavyOperation(),
    1000,  // max 1 second
    100    // min 100ms (sanity check)
  ).pipe(Effect.provide(TestLayer), TestContext.it)
)
```

### Concurrent Load Testing
```typescript
import { testConcurrentEffects } from "../utils/effectTestUtils.js"

testConcurrentEffects(
  "should handle concurrent operations",
  Array(10).fill(myOperation()),
  TestLayer,
  {
    concurrency: 5,
    timing: { min: 100, max: 2000 },
    expectations: (results) => {
      expect(results).toHaveLength(10)
      expect(results.every(r => r.success)).toBe(true)
    }
  }
)
```

### Memory Testing
```typescript
it("should not leak memory", () =>
  Effect.gen(function* () {
    const initialMemory = process.memoryUsage().heapUsed

    // Perform memory-intensive operations
    for (let i = 0; i < 100; i++) {
      yield* memoryIntensiveOperation()
    }

    // Force garbage collection if available
    if (global.gc) global.gc()

    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory

    // Should not increase by more than 10MB
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
  }).pipe(Effect.provide(TestLayer), TestContext.it)
)
```

## 🐛 Error Testing Patterns

### Expected Errors
```typescript
it("should validate input parameters", () =>
  expectFailure(
    greetCommand.handler({ name: "" }),
    (error) => error.message.includes("Name cannot be empty")
  ).pipe(Effect.provide(TestLayer), TestContext.it)
)
```

### Error Recovery
```typescript
it("should recover from transient failures", () =>
  Effect.gen(function* () {
    let attempts = 0

    const unreliableOperation = Effect.gen(function* () {
      attempts++
      if (attempts < 3) {
        yield* Effect.fail(new Error("Transient failure"))
      }
      return "success"
    })

    const result = yield* unreliableOperation.pipe(
      Effect.retry(Schedule.recurs(5))
    )

    expect(result).toBe("success")
    expect(attempts).toBe(3)
  }).pipe(Effect.provide(TestLayer), TestContext.it)
)
```

## 📏 Quality Metrics

### Code Quality Checks
```bash
# TypeScript compilation
pnpm check

# ESLint rules
pnpm lint

# Test coverage
pnpm coverage

# Full quality check
pnpm test && pnpm lint && pnpm coverage
```

### Continuous Integration Integration
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test
      - run: pnpm coverage
      - run: pnpm lint
```

## 🎯 Best Practices

### 모범 사례 요약

**DO's**: TDD 원칙, Effect 패턴, 동작 테스트, 외부 의존성 모킹, 에러 케이스, 성능 검증, 명확한 이름, 테스트 독립성

**DON'Ts**: 에러 테스트 생략, 구현 세부사항 테스트, 타이밍 무시, 실제 외부 서비스, 불안정한 테스트, 로직 중복, 커버리지 무시, 관심사 혼합

## 🔧 Migration Strategy

### From Legacy Tests
```typescript
// Old pattern (avoid)
describe("Old Style", () => {
  it("should work", async () => {
    const result = await someAsyncFunction()
    expect(result).toBe("expected")
  })
})

// New Effect pattern (preferred)
describe("New Effect Style", () => {
  it("should work", () =>
    Effect.gen(function* () {
      const result = yield* someEffectOperation()
      expect(result).toBe("expected")
    }).pipe(
      Effect.provide(TestLayer),
      TestContext.it
    )
  )
})
```

### Gradual Adoption
1. New tests use Effect patterns
2. Refactor critical test suites
3. Update test utilities progressively
4. Maintain compatibility during transition

## 📚 References

- [Effect Documentation](https://effect.website/)
- [@effect/vitest Documentation](https://effect.website/docs/testing/vitest)
- [Vitest Documentation](https://vitest.dev/)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

**Last Updated**: 2025-09-13
**Version**: 1.0.0
**Next Review**: 2025-10-13