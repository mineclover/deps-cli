# Effect CLI Testing Reference

**Version**: 1.0.0
**Created**: 2025-09-13
**Purpose**: Complete reference for Effect CLI testing infrastructure

## 📚 Quick Reference

### Test Commands
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm coverage

# Run tests in watch mode
pnpm vitest --watch

# Run specific test file
pnpm vitest test/commands/GreetCommand.test.ts

# Run tests with coverage threshold enforcement
pnpm vitest run --coverage --reporter=verbose
```

### Coverage Thresholds
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## 🏗️ Infrastructure Overview

### Core Stack
```typescript
{
  "test-runner": "vitest@3.2.4",
  "effect-testing": "@effect/vitest@0.25.1",
  "coverage": "@vitest/coverage-v8@3.2.4",
  "mocking": "vitest built-in (vi)"
}
```

### Test Structure
```
test/
├── commands/           # CLI command tests
│   ├── ListCommand.test.ts
│   └── templates/
├── services/          # Service layer tests
├── queue/            # Queue system tests (8 files)
├── utils/            # Test utilities
│   ├── testHelpers.ts       # Legacy helpers
│   └── effectTestUtils.ts   # New Effect utilities
└── templates/        # Test templates
    ├── CommandTestTemplate.ts
    └── ServiceTestTemplate.ts
```

## 🧪 Test Utilities Reference

### effectTestUtils.js
Effect 테스트 패턴 및 유틸리티:
- **Effect 테스팅**: `expectSuccess`, `expectFailure`, `expectTimingWithin`
- **CLI 테스팅**: `testCliCommand`, `createMockConsole`
- **서비스 모킹**: `createMockService`, `createSpyService`
- **동시성 테스팅**: `testConcurrentEffects`

## 📋 Testing Templates

### 템플릿 사용법
- **Command 테스트**: `test/templates/CommandTestTemplate.ts` 복사 후 커스터마이징
- **Service 테스트**: `test/templates/ServiceTestTemplate.ts` 복사 후 커스터마이징
- **커스터마이징 단계**: 이름 변경 → 임포트 업데이트 → TestLayer 설정 → 테스트 케이스 추가

## 🎯 Testing Patterns

### Basic Effect Test
```typescript
describe("MyFeature", () => {
  it("should work correctly", () =>
    Effect.gen(function* () {
      const result = yield* myOperation()
      expect(result).toBe("expected")
    }).pipe(
      Effect.provide(TestLayer),
      TestContext.it
    )
  )
})
```

### CLI Command Test
```typescript
testCliCommand(
  "greet command",
  greetCommand.handler,
  { name: "Alice", formal: false },
  TestLayer,
  {
    output: ["Hello Alice!"],
    errors: [],
    exitCode: 0
  }
)
```

### Service Integration Test
```typescript
it("should integrate with dependencies", () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const result = yield* service.operation()

    // Verify result
    expect(result.success).toBe(true)

    // Verify dependency interactions
    const dep = yield* MyDependency
    expect(dep.method).toHaveBeenCalled()
  }).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

### Error Handling Test
```typescript
it("should handle errors gracefully", () =>
  expectFailure(
    myRiskyOperation(),
    (error) => error.message.includes("expected error")
  ).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

### Performance Test
```typescript
it("should complete within time budget", () =>
  expectTimingWithin(
    heavyOperation(),
    1000, // max 1 second
    100   // min 100ms
  ).pipe(
    Effect.provide(TestLayer),
    TestContext.it
  )
)
```

## 🔧 Configuration Reference

### vitest.config.ts
```typescript
{
  test: {
    include: ["./test/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    globals: true,
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts", "src/bin.ts", "src/examples/**"],
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      thresholds: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } }
    }
  }
}
```

## 📊 Coverage Analysis

### Generate Coverage Report
```bash
# Generate comprehensive coverage
pnpm coverage

# View HTML report
open coverage/index.html

# View JSON report for CI
cat coverage/coverage-final.json
```

### 커버리지 해석
- **Lines/Functions/Branches/Statements**: 각각 실행/호출/분기/명령문 비율
- **제외 대상**: Entry points, 예제 코드, 타입 정의, 테스트 파일

## 🚀 Development Workflow

### TDD Cycle
```bash
# 1. Write failing test
pnpm vitest NewFeature.test.ts

# 2. Implement minimal solution
# Edit source file

# 3. Make test pass
pnpm vitest NewFeature.test.ts

# 4. Refactor
# Improve implementation

# 5. Verify coverage
pnpm coverage
```

### Watch Mode Development
```bash
# Watch specific test
pnpm vitest NewFeature.test.ts --watch

# Watch all tests
pnpm vitest --watch

# Watch with coverage
pnpm vitest --coverage --watch
```

### Pre-commit Validation
```bash
# Full validation suite
pnpm test && pnpm coverage && pnpm lint

# Quick validation
pnpm test --run
```

## 🎨 Best Practices

### Test Organization
1. **Group by functionality** - Use `describe` blocks for logical grouping
2. **One assertion per test** - Keep tests focused and specific
3. **Descriptive names** - Test names should explain the expected behavior
4. **Arrange-Act-Assert** - Structure tests clearly

### Effect-Specific Patterns
1. **Use Effect.gen** - Leverage generator syntax for readability
2. **Provide layers** - Always use `Effect.provide(TestLayer)`
3. **Use TestContext.it** - Ensure proper Effect test execution
4. **Mock dependencies** - Isolate units under test

### 모범 사례 요약
- **성능**: 무거운 작업 모킹, 적절한 타임아웃, 병렬 실행, 아티팩트 캐싱
- **에러 테스팅**: 실패 경로, 의미있는 에러 메시지, 리소스 정리, 경계 조건

## 📈 Current Test Status

### Test Coverage Overview
```
- Queue System: 8 test files (comprehensive)
- Commands: 1 test file (needs expansion)
- Services: Utilities available (templates ready)
- Integration: Framework established
- Templates: Available for quick start
```

### Quality Metrics
- **Test Framework**: ✅ Configured and working
- **Coverage Tooling**: ✅ Installed and configured
- **Effect Integration**: ✅ Optimized utilities available
- **Templates**: ✅ Ready for use
- **Documentation**: ✅ Comprehensive guidelines

## 🔗 Related Documentation

- [TDD Guidelines](./TDD_GUIDELINES.md) - Comprehensive TDD methodology
- [Test Templates](../test/templates/) - Ready-to-use test templates
- [Effect Documentation](https://effect.website/docs/testing/vitest) - Official Effect testing guide
- [Vitest Documentation](https://vitest.dev/) - Test runner documentation

## 🛠️ Troubleshooting

### Common Issues

**Coverage not working**:
```bash
# Ensure coverage package is installed
pnpm add -D @vitest/coverage-v8

# Check vitest.config.ts coverage settings
```

**Tests timing out**:
```bash
# Increase timeout in vitest.config.ts
testTimeout: 30000  // 30 seconds
```

**Effect tests not running**:
```bash
# Ensure TestContext.it is used
Effect.provide(TestLayer).pipe(TestContext.it)
```

**Mock not working**:
```bash
# Use createMockService utility
const MockService = createMockService(ServiceTag, implementation)
```

### Performance Issues

**Slow test execution**:
- Check for real I/O operations (use mocks)
- Reduce test timeout values
- Use `--reporter=verbose` to identify slow tests

**Memory leaks in tests**:
- Ensure proper cleanup in `afterEach`
- Check for unresolved promises
- Use `global.gc()` for memory testing

---

**Last Updated**: 2025-09-13
**Next Review**: 2025-10-13