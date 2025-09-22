# Testing Guide

## 개요

이 문서는 Effect CLI 프로젝트의 테스트 구성과 실행 방법에 대해 설명합니다. 기존의 상세한 테스트 규칙은 `docs/testing/` 디렉토리에 있습니다.

## 테스트 구조

### 디렉토리 구조

```
test/
├── commands/              # 커맨드 테스트
│   ├── GreetCommand.test.ts
│   ├── QueueCommand.test.ts
│   ├── QueueStatusCommand.test.ts
│   └── SimpleQueueCommand.test.ts
├── queue/                 # 큐 시스템 테스트
│   ├── QueueSystem.test.ts
│   ├── InternalQueue.test.ts
│   ├── QueuePersistence.test.ts
│   └── StabilityMonitor.test.ts
├── utils/                 # 테스트 유틸리티
│   └── effectTestUtils.ts
└── templates/            # 테스트 템플릿
    └── CommandTemplate.test.ts
```

### 현재 테스트 현황

- **총 테스트**: 31개 테스트 파일
- **커버리지**: 80%+ (line/branch/function/statement)
- **테스트 프레임워크**: Vitest + @effect/vitest
- **모든 테스트 통과**: ✅

## 테스트 실행

### 기본 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 파일 테스트
npm test GreetCommand.test.ts

# 워치 모드로 테스트
npm test -- --watch

# 커버리지 포함 테스트
npm run test:coverage
```

### 테스트 + 빌드 검증

```bash
# 타입 체크
npm run check

# 빌드
npm run build

# 테스트 + 타입 체크 + 빌드 전체
npm run validate
```

## 테스트 작성 가이드

### 1. 커맨드 테스트

커맨드 테스트는 `test/commands/` 디렉토리에 작성합니다.

```typescript
// test/commands/MyCommand.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import * as Effect from "effect/Effect"
import { myCommand } from "../../src/commands/MyCommand.js"

describe("MyCommand", () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it("should execute successfully", () => {
    const handler = myCommand.handler({ param: "value" })

    Effect.runSync(handler)

    expect(logSpy).toHaveBeenCalledWith("Expected output")
  })
})
```

### 2. 서비스 테스트

서비스나 큐 시스템 테스트는 비동기 패턴을 사용합니다.

```typescript
// test/queue/MyService.test.ts
import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import { runTestEffect } from "../utils/effectTestUtils.js"
import { MyService } from "../../src/services/MyService.js"

describe("MyService", () => {
  it("should handle service operations", async () => {
    await runTestEffect(
      Effect.gen(function*() {
        const service = yield* MyService
        const result = yield* service.performOperation()

        expect(result).toBeDefined()
      })
    )
  })
})
```

## 테스트 패턴

### 기본 패턴들

참고 문서:
- **자세한 테스트 규칙**: `docs/testing/TEST_CONVENTIONS.md`
- **TDD 가이드라인**: `docs/testing/TDD_GUIDELINES.md`
- **테스트 참조**: `docs/testing/TESTING_REFERENCE.md`

### 검증된 패턴

1. **Simple Command Testing**: 기본 커맨드 테스트 (100% 성공률)
2. **Service-Dependent Testing**: 서비스 의존성이 있는 테스트
3. **Queue System Testing**: 큐 시스템 통합 테스트 (25+ 테스트 통과)

### 피해야 할 안티패턴

- TestContext와 Effect.gen 중첩 사용
- 서비스 프로바이더 없이 서비스 의존 테스트 실행
- Platform 의존성을 직접 import

## Effect 테스트 유틸리티

### 테스트 실행 헬퍼

```typescript
// test/utils/effectTestUtils.ts에서 제공
import { runTestEffect } from "../utils/effectTestUtils.js"

// 기본 Effect 테스트 실행
await runTestEffect(
  Effect.gen(function*() {
    // 테스트 로직
    yield* Effect.log("Test message")
  })
)
```

### 에러 테스트

```typescript
it("should handle errors gracefully", async () => {
  await runTestEffect(
    Effect.gen(function*() {
      const result = yield* Effect.fail("Test error").pipe(
        Effect.catchAll(() => Effect.succeed("recovered"))
      )

      expect(result).toBe("recovered")
    })
  )
})
```

## 테스트 설정

### Vitest 설정

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

### 주요 의존성

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@effect/vitest": "^0.25.1",
    "@vitest/coverage-v8": "^3.2.4"
  }
}
```

## 품질 기준

### 커버리지 요구사항

- **최소**: 80% (line/branch/function/statement)
- **목표**: 90%+ (중요 경로)
- **현재 상태**: 모든 테스트 통과 ✅

### 성능 기준

- **단위 테스트**: < 10ms per test
- **통합 테스트**: < 100ms per test
- **큐 테스트**: < 500ms per test

## 디버깅

### 테스트 실패 시

```bash
# 특정 테스트만 실행
npm test -- --run MyCommand.test.ts

# 자세한 출력
npm test -- --reporter=verbose

# 테스트 디버깅
npm test -- --inspect-brk
```

### 일반적인 문제들

1. **"Service not found" 에러**: 필요한 레이어 제공 확인
2. **타입 에러**: TypeScript 컴파일 확인 (`npm run check`)
3. **비동기 타임아웃**: `runTestEffect` 대신 `Effect.runSync` 사용 검토

## 추가 리소스

- **Effect 공식 문서**: [effect.website](https://effect.website)
- **Vitest 문서**: [vitest.dev](https://vitest.dev)
- **프로젝트별 테스트 예시**: `test/` 디렉토리의 기존 테스트들