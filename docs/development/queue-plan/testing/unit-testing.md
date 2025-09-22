# Unit Testing Strategy

> 🧪 **단위 테스트 전략 및 구현 가이드**

## 📋 개요

Effect CLI 큐 시스템의 각 컴포넌트에 대한 체계적인 단위 테스트 전략을 정의합니다.

## 🎯 테스트 목표

### Coverage Targets
- **코드 커버리지**: 최소 90% (핵심 로직 100%)
- **브랜치 커버리지**: 최소 85% (에러 처리 경로 포함)
- **함수 커버리지**: 100% (모든 public 메서드)
- **타입 커버리지**: 100% (TypeScript strict mode)

### Quality Targets
- **테스트 실행 속도**: 전체 < 10초
- **테스트 신뢰성**: Flaky test 0%
- **테스트 가독성**: 명확한 AAA 패턴 적용
- **유지보수성**: 코드 변경 시 테스트 수정 최소화

## 🏗️ Test Architecture

### Test Structure
```
test/
├── unit/
│   ├── queue/
│   │   ├── QueuePersistence.test.ts      # 데이터 지속성 테스트
│   │   ├── InternalQueue.test.ts         # 큐 엔진 테스트
│   │   ├── QueueMonitor.test.ts          # 모니터링 테스트
│   │   ├── CircuitBreaker.test.ts        # Circuit Breaker 테스트
│   │   ├── AdaptiveThrottler.test.ts     # Throttling 테스트
│   │   └── QueueService.test.ts          # 통합 서비스 테스트
│   ├── types/
│   │   └── QueueTypes.test.ts            # 타입 시스템 테스트
│   └── utils/
│       ├── TestUtils.ts                  # 테스트 유틸리티
│       └── MockServices.ts               # Mock 서비스들
└── fixtures/
    ├── test-data.json                    # 테스트 데이터
    └── mock-configs/                     # Mock 설정들
```

### Testing Framework Setup
```typescript
// test/setup/TestSetup.ts
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Effect, Layer, Ref } from "effect"

// 전역 테스트 설정
export const TestRuntime = Layer.mergeAll(
  TestEnvironmentLayer,
  MockServicesLayer
)

// 각 테스트마다 깨끗한 상태 보장
export const withCleanState = <A, E>(
  testEffect: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    // 테스트 전 상태 초기화
    yield* initializeTestState()
    
    try {
      return yield* testEffect
    } finally {
      // 테스트 후 정리
      yield* cleanupTestState()
    }
  })
```

## 🧪 Component-wise Testing

### 1. QueuePersistence Unit Tests
```typescript
// test/unit/queue/QueuePersistence.test.ts
describe("QueuePersistence", () => {
  let persistence: QueuePersistence
  let testDB: TestDatabase
  
  beforeEach(async () => {
    testDB = await createTestDatabase()
    persistence = new QueuePersistenceLive(testDB)
  })
  
  afterEach(async () => {
    await testDB.cleanup()
  })
  
  describe("Task Management", () => {
    test("should save and retrieve task correctly", async () => {
      // Arrange
      const task: QueueTask<string> = {
        id: "test-task-1",
        type: "test",
        resourceGroup: "filesystem",
        data: "test data",
        status: "pending",
        createdAt: new Date(),
        attempts: 0
      }
      
      // Act
      await persistence.saveTask(task)
      const retrieved = await persistence.getTask(task.id)
      
      // Assert
      expect(retrieved).toEqual(task)
    })
    
    test("should handle duplicate task IDs gracefully", async () => {
      // Arrange
      const task1 = createTestTask({ id: "duplicate" })
      const task2 = createTestTask({ id: "duplicate" })
      
      // Act & Assert
      await persistence.saveTask(task1)
      await expect(persistence.saveTask(task2))
        .rejects.toThrow("Task with ID 'duplicate' already exists")
    })
    
    test("should update task status atomically", async () => {
      // Arrange
      const task = await saveTestTask({ status: "pending" })
      
      // Act
      await persistence.updateTaskStatus(task.id, "running")
      
      // Assert
      const updated = await persistence.getTask(task.id)
      expect(updated.status).toBe("running")
      expect(updated.updatedAt).toBeDefined()
    })
  })
  
  describe("Queue Operations", () => {
    test("should maintain FIFO order for same priority", async () => {
      // Arrange
      const tasks = [
        createTestTask({ priority: 1, createdAt: new Date("2024-01-01") }),
        createTestTask({ priority: 1, createdAt: new Date("2024-01-02") }),
        createTestTask({ priority: 1, createdAt: new Date("2024-01-03") })
      ]
      
      // Act
      for (const task of tasks) {
        await persistence.saveTask(task)
      }
      
      const retrieved = await persistence.getTasksByResourceGroup("filesystem", 10)
      
      // Assert
      expect(retrieved).toHaveLength(3)
      expect(retrieved[0].createdAt).toEqual(new Date("2024-01-01"))
      expect(retrieved[1].createdAt).toEqual(new Date("2024-01-02"))
      expect(retrieved[2].createdAt).toEqual(new Date("2024-01-03"))
    })
    
    test("should respect priority ordering", async () => {
      // Arrange
      const lowPriority = createTestTask({ priority: 3 })
      const highPriority = createTestTask({ priority: 1 })
      const mediumPriority = createTestTask({ priority: 2 })
      
      // Act
      await persistence.saveTask(lowPriority)
      await persistence.saveTask(highPriority)
      await persistence.saveTask(mediumPriority)
      
      const retrieved = await persistence.getTasksByResourceGroup("filesystem", 10)
      
      // Assert
      expect(retrieved[0]).toEqual(highPriority)
      expect(retrieved[1]).toEqual(mediumPriority)
      expect(retrieved[2]).toEqual(lowPriority)
    })
  })
})
```

### 2. InternalQueue Unit Tests
```typescript
// test/unit/queue/InternalQueue.test.ts
describe("InternalQueue", () => {
  let queue: InternalQueue
  let mockPersistence: MockQueuePersistence
  
  beforeEach(() => {
    mockPersistence = new MockQueuePersistence()
    queue = new InternalQueueLive(mockPersistence)
  })
  
  describe("Task Enqueueing", () => {
    test("should enqueue task with correct metadata", async () => {
      // Arrange
      const taskData = { message: "test task" }
      
      // Act
      const taskId = await queue.enqueue({
        type: "test-task",
        resourceGroup: "filesystem",
        data: taskData
      })
      
      // Assert
      expect(taskId).toMatch(/^task-[a-z0-9-]+$/)
      
      const savedTask = await mockPersistence.getTask(taskId)
      expect(savedTask).toMatchObject({
        id: taskId,
        type: "test-task",
        resourceGroup: "filesystem",
        data: taskData,
        status: "pending",
        attempts: 0
      })
      expect(savedTask.createdAt).toBeInstanceOf(Date)
    })
    
    test("should validate resource group", async () => {
      // Act & Assert
      await expect(queue.enqueue({
        type: "test",
        resourceGroup: "invalid" as any,
        data: {}
      })).rejects.toThrow("Invalid resource group: invalid")
    })
    
    test("should generate unique task IDs", async () => {
      // Act
      const taskIds = await Promise.all([
        queue.enqueue({ type: "test", resourceGroup: "filesystem", data: {} }),
        queue.enqueue({ type: "test", resourceGroup: "filesystem", data: {} }),
        queue.enqueue({ type: "test", resourceGroup: "filesystem", data: {} })
      ])
      
      // Assert
      const uniqueIds = new Set(taskIds)
      expect(uniqueIds.size).toBe(3)
    })
  })
  
  describe("Task Processing", () => {
    test("should process tasks in correct order", async () => {
      // Arrange
      const processedTasks: string[] = []
      queue.startProcessor("filesystem", async (task) => {
        processedTasks.push(task.id)
        return { success: true }
      })
      
      // Act
      const task1 = await queue.enqueue({ type: "test", resourceGroup: "filesystem", data: { order: 1 } })
      const task2 = await queue.enqueue({ type: "test", resourceGroup: "filesystem", data: { order: 2 } })
      const task3 = await queue.enqueue({ type: "test", resourceGroup: "filesystem", data: { order: 3 } })
      
      // Wait for processing
      await waitForProcessing()
      
      // Assert
      expect(processedTasks).toEqual([task1, task2, task3])
    })
    
    test("should handle task execution errors", async () => {
      // Arrange
      const errorTask = await queue.enqueue({ 
        type: "error-task", 
        resourceGroup: "filesystem", 
        data: {} 
      })
      
      queue.startProcessor("filesystem", async (task) => {
        if (task.type === "error-task") {
          throw new Error("Simulated task failure")
        }
        return { success: true }
      })
      
      // Act
      await waitForProcessing()
      
      // Assert
      const updatedTask = await mockPersistence.getTask(errorTask)
      expect(updatedTask.status).toBe("failed")
      expect(updatedTask.error).toContain("Simulated task failure")
      expect(updatedTask.attempts).toBe(1)
    })
  })
  
  describe("Concurrency Control", () => {
    test("should respect max concurrency limits", async () => {
      // Arrange
      const maxConcurrency = 2
      let currentlyRunning = 0
      let maxObserved = 0
      
      queue.startProcessor("filesystem", async (task) => {
        currentlyRunning++
        maxObserved = Math.max(maxObserved, currentlyRunning)
        
        await sleep(50) // Simulate work
        
        currentlyRunning--
        return { success: true }
      }, { maxConcurrency })
      
      // Act
      const tasks = Array.from({ length: 10 }, (_, i) =>
        queue.enqueue({ type: "test", resourceGroup: "filesystem", data: { index: i } })
      )
      
      await Promise.all(tasks)
      await waitForProcessing()
      
      // Assert
      expect(maxObserved).toBeLessThanOrEqual(maxConcurrency)
    })
  })
})
```

### 3. Circuit Breaker Unit Tests
```typescript
// test/unit/queue/CircuitBreaker.test.ts
describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker
  let mockMonitor: MockQueueMonitor
  
  beforeEach(() => {
    mockMonitor = new MockQueueMonitor()
    circuitBreaker = new CircuitBreakerLive({
      failureThreshold: 3,
      recoveryTimeout: Duration.seconds(1),
      monitor: mockMonitor
    })
  })
  
  describe("State Transitions", () => {
    test("should start in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe("CLOSED")
    })
    
    test("should transition to OPEN after failure threshold", async () => {
      // Arrange - simulate failures
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure("filesystem")
      }
      
      // Assert
      expect(circuitBreaker.getState("filesystem")).toBe("OPEN")
    })
    
    test("should transition to HALF_OPEN after timeout", async () => {
      // Arrange - open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure("filesystem")
      }
      expect(circuitBreaker.getState("filesystem")).toBe("OPEN")
      
      // Act - wait for recovery timeout
      await sleep(1100) // Slightly more than 1 second
      
      // Assert
      expect(circuitBreaker.getState("filesystem")).toBe("HALF_OPEN")
    })
    
    test("should transition back to CLOSED on success in HALF_OPEN", async () => {
      // Arrange - get to HALF_OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure("filesystem")
      }
      await sleep(1100)
      expect(circuitBreaker.getState("filesystem")).toBe("HALF_OPEN")
      
      // Act
      await circuitBreaker.recordSuccess("filesystem")
      
      // Assert
      expect(circuitBreaker.getState("filesystem")).toBe("CLOSED")
    })
  })
  
  describe("Task Execution", () => {
    test("should execute task when circuit is CLOSED", async () => {
      // Arrange
      const task = createTestTask()
      let executed = false
      
      const executor = () => {
        executed = true
        return Promise.resolve({ success: true })
      }
      
      // Act
      const result = await circuitBreaker.execute(task, executor)
      
      // Assert
      expect(executed).toBe(true)
      expect(result.success).toBe(true)
    })
    
    test("should reject task when circuit is OPEN", async () => {
      // Arrange - open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure("filesystem")
      }
      
      const task = createTestTask({ resourceGroup: "filesystem" })
      
      // Act & Assert
      await expect(
        circuitBreaker.execute(task, () => Promise.resolve({ success: true }))
      ).rejects.toThrow("Circuit breaker is OPEN for filesystem")
    })
  })
})
```

## 🔧 Test Utilities

### Mock Services
```typescript
// test/utils/MockServices.ts
export class MockQueuePersistence implements QueuePersistence {
  private tasks = new Map<string, QueueTask<any>>()
  private metrics = new Map<string, any>()
  
  async saveTask<T>(task: QueueTask<T>): Promise<void> {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with ID '${task.id}' already exists`)
    }
    this.tasks.set(task.id, { ...task })
  }
  
  async getTask<T>(id: string): Promise<QueueTask<T> | null> {
    return this.tasks.get(id) || null
  }
  
  async getTasksByResourceGroup<T>(
    resourceGroup: ResourceGroup,
    limit: number
  ): Promise<Array<QueueTask<T>>> {
    return Array.from(this.tasks.values())
      .filter(task => task.resourceGroup === resourceGroup)
      .sort((a, b) => {
        // Priority first, then creation time
        if (a.priority !== b.priority) {
          return (a.priority || 5) - (b.priority || 5)
        }
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
      .slice(0, limit)
  }
  
  // ... other methods
}

export class MockQueueMonitor implements QueueMonitor {
  private metrics: QueueMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageProcessingTime: 0,
    queueDepth: { filesystem: 0, network: 0, computation: 0, memory: 0 }
  }
  
  async recordTaskStart(taskId: string): Promise<void> {
    // Mock implementation
  }
  
  async recordTaskComplete(taskId: string, duration: number): Promise<void> {
    this.metrics.completedTasks++
  }
  
  async getMetrics(): Promise<QueueMetrics> {
    return { ...this.metrics }
  }
  
  // ... other methods
}
```

### Test Helpers
```typescript
// test/utils/TestHelpers.ts
export const createTestTask = <T = any>(overrides: Partial<QueueTask<T>> = {}): QueueTask<T> => ({
  id: `test-task-${Math.random().toString(36).substr(2, 9)}`,
  type: "test-task",
  resourceGroup: "filesystem",
  data: {} as T,
  status: "pending",
  createdAt: new Date(),
  attempts: 0,
  ...overrides
})

export const waitForProcessing = (timeout = 1000): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, timeout))

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

export const expectEventually = async <T>(
  getter: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeout = 5000
): Promise<T> => {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    const value = await getter()
    if (predicate(value)) {
      return value
    }
    await sleep(100)
  }
  
  throw new Error(`Expectation not met within ${timeout}ms`)
}
```

## 📊 Test Metrics and Reporting

### Coverage Analysis
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 85,
          functions: 100,
          lines: 90,
          statements: 90
        },
        'src/services/Queue/': {
          branches: 90,
          functions: 100,
          lines: 95,
          statements: 95
        }
      }
    }
  }
})
```

### Performance Testing
```typescript
// test/unit/performance/UnitPerformance.test.ts
describe("Unit Performance Tests", () => {
  test("task enqueueing should be fast", async () => {
    const queue = createTestQueue()
    const start = Date.now()
    
    // Enqueue 1000 tasks
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      queue.enqueue({
        type: "perf-test",
        resourceGroup: "filesystem",
        data: { index: i }
      })
    )
    
    await Promise.all(tasks)
    const duration = Date.now() - start
    
    // Should complete within 100ms
    expect(duration).toBeLessThan(100)
  })
  
  test("memory usage should remain stable", async () => {
    const queue = createTestQueue()
    const initialMemory = process.memoryUsage()
    
    // Process many tasks
    for (let batch = 0; batch < 10; batch++) {
      const tasks = Array.from({ length: 100 }, () =>
        queue.enqueue({
          type: "memory-test",
          resourceGroup: "memory",
          data: new Array(1000).fill("test")
        })
      )
      
      await Promise.all(tasks)
      await waitForProcessing()
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
    }
    
    const finalMemory = process.memoryUsage()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    
    // Memory increase should be minimal (< 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
  })
})
```

## 🎯 Test Execution

### NPM Scripts
```json
{
  "scripts": {
    "test:unit": "vitest run test/unit",
    "test:unit:watch": "vitest test/unit",
    "test:unit:coverage": "vitest run test/unit --coverage",
    "test:unit:perf": "vitest run test/unit/performance",
    "test:types": "tsc --noEmit"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/unit-tests.yml
name: Unit Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run test:types
      - run: npm run test:unit:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

---

**📅 생성일**: 2025-01-12  
**👤 작성자**: Claude Code Task Manager  
**🔄 버전**: v1.0.0 - Unit Testing Strategy  
**📋 상태**: Phase 1+ 적용