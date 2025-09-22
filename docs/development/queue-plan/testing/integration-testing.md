# Integration Testing Strategy

> 🔗 **시스템 통합 테스트 전략 및 구현 가이드**

## 📋 개요

Effect CLI 큐 시스템의 컴포넌트 간 통합 및 외부 시스템과의 상호작용을 검증하는 통합 테스트 전략을 정의합니다.

## 🎯 통합 테스트 목표

### System Integration
- **컴포넌트 간 상호작용**: 각 서비스 간 올바른 데이터 흐름
- **데이터 일관성**: 트랜잭션 경계에서의 데이터 무결성
- **에러 전파**: 에러가 시스템 전반에 올바르게 처리됨
- **성능 특성**: 통합된 시스템의 전체 성능 검증

### External Integration
- **SQLite 데이터베이스**: 실제 DB와의 상호작용
- **파일 시스템**: 실제 파일 I/O 작업
- **네트워크**: 실제 네트워크 요청
- **CLI 인터페이스**: 실제 명령어 실행 환경

## 🏗️ Integration Test Architecture

### Test Categories
```
test/integration/
├── system/                           # 시스템 전체 통합 테스트
│   ├── QueueSystemIntegration.test.ts
│   ├── StabilitySystemIntegration.test.ts
│   └── PerformanceIntegration.test.ts
├── database/                         # 데이터베이스 통합 테스트
│   ├── SQLiteIntegration.test.ts
│   ├── SchemaEvolution.test.ts
│   └── TransactionIntegration.test.ts
├── cli/                              # CLI 통합 테스트
│   ├── CommandIntegration.test.ts
│   ├── QueueMiddleware.test.ts
│   └── BackwardsCompatibility.test.ts
├── workflows/                        # 워크플로우 통합 테스트
│   ├── BuildWorkflow.test.ts
│   ├── TestWorkflow.test.ts
│   └── DeploymentWorkflow.test.ts
└── fixtures/                         # 통합 테스트 데이터
    ├── test-projects/
    ├── sample-configs/
    └── mock-environments/
```

### Test Environment Setup
```typescript
// test/integration/setup/IntegrationSetup.ts
export class IntegrationTestEnvironment {
  private tempDir: string
  private testDB: Database
  private queueSystem: QueueService
  
  async setup(): Promise<void> {
    // 1. 임시 디렉토리 생성
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'queue-integration-'))
    
    // 2. 테스트용 SQLite DB 생성
    this.testDB = new Database(path.join(this.tempDir, 'test-queue.db'))
    
    // 3. 실제 큐 시스템 초기화
    const testConfig: QueueConfig = {
      persistence: {
        dbPath: path.join(this.tempDir, 'test-queue.db'),
        migrations: true
      },
      queues: {
        filesystem: { maxConcurrency: 2, retryPolicy: testRetryPolicy },
        network: { maxConcurrency: 3, retryPolicy: testRetryPolicy },
        computation: { maxConcurrency: 1, retryPolicy: testRetryPolicy },
        memory: { maxConcurrency: 1, retryPolicy: testRetryPolicy }
      },
      monitoring: {
        metricsInterval: Duration.millis(100),
        logLevel: LogLevel.Debug
      }
    }
    
    // 4. 실제 서비스 레이어 구성
    this.queueSystem = await Effect.runPromise(
      QueueService.pipe(
        Effect.provide(StabilityQueueSystemLayer),
        Effect.provide(Layer.succeed(QueueConfig, testConfig))
      )
    )
    
    // 5. 시스템 초기화 대기
    await this.waitForSystemReady()
  }
  
  async cleanup(): Promise<void> {
    if (this.queueSystem) {
      await this.queueSystem.shutdown()
    }
    if (this.testDB) {
      this.testDB.close()
    }
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true })
    }
  }
  
  private async waitForSystemReady(): Promise<void> {
    // 큐 시스템이 완전히 초기화될 때까지 대기
    let retries = 0
    while (retries < 50) {
      try {
        const metrics = await this.queueSystem.getMetrics()
        if (metrics.systemStatus === 'ready') {
          return
        }
      } catch (error) {
        // 아직 초기화 중
      }
      
      await sleep(100)
      retries++
    }
    throw new Error('Queue system failed to initialize within timeout')
  }
}
```

## 🔄 System Integration Tests

### End-to-End Queue Flow
```typescript
// test/integration/system/QueueSystemIntegration.test.ts
describe("Queue System Integration", () => {
  let testEnv: IntegrationTestEnvironment
  let queueSystem: QueueService
  
  beforeEach(async () => {
    testEnv = new IntegrationTestEnvironment()
    await testEnv.setup()
    queueSystem = testEnv.getQueueSystem()
  })
  
  afterEach(async () => {
    await testEnv.cleanup()
  })
  
  describe("Full Task Lifecycle", () => {
    test("should complete full task lifecycle from enqueue to completion", async () => {
      // Arrange
      const taskData = { message: "integration test task" }
      const results: Array<{ taskId: string, result: any }> = []
      
      // Set up task processor
      await queueSystem.startProcessor("filesystem", async (task) => {
        // Simulate real work
        await sleep(50)
        const result = { processed: true, taskId: task.id, data: task.data }
        results.push({ taskId: task.id, result })
        return result
      })
      
      // Act
      const taskId = await queueSystem.enqueue({
        type: "integration-test",
        resourceGroup: "filesystem",
        data: taskData
      })
      
      // Wait for processing
      await expectEventually(
        () => queueSystem.getTaskStatus(taskId),
        status => status === "completed",
        5000
      )
      
      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].taskId).toBe(taskId)
      expect(results[0].result.data).toEqual(taskData)
      
      const finalStatus = await queueSystem.getTaskStatus(taskId)
      expect(finalStatus).toBe("completed")
    })
    
    test("should handle task failures with proper retry logic", async () => {
      // Arrange
      let attemptCount = 0
      await queueSystem.startProcessor("filesystem", async (task) => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`)
        }
        return { success: true, attemptCount }
      })
      
      // Act
      const taskId = await queueSystem.enqueue({
        type: "retry-test",
        resourceGroup: "filesystem",
        data: {},
        retryPolicy: {
          maxAttempts: 3,
          baseDelay: Duration.millis(100)
        }
      })
      
      // Wait for final completion
      await expectEventually(
        () => queueSystem.getTaskStatus(taskId),
        status => status === "completed",
        5000
      )
      
      // Assert
      expect(attemptCount).toBe(3)
      const task = await queueSystem.getTask(taskId)
      expect(task.attempts).toBe(3)
    })
  })
  
  describe("Multi-Resource Group Coordination", () => {
    test("should process tasks across different resource groups concurrently", async () => {
      // Arrange
      const processingOrder: Array<{ taskId: string, resourceGroup: ResourceGroup, timestamp: number }> = []
      
      const resourceGroups: ResourceGroup[] = ["filesystem", "network", "computation", "memory"]
      
      // Set up processors for all resource groups
      for (const rg of resourceGroups) {
        await queueSystem.startProcessor(rg, async (task) => {
          const timestamp = Date.now()
          processingOrder.push({ taskId: task.id, resourceGroup: rg, timestamp })
          
          // Simulate different processing times
          const processingTime = rg === "computation" ? 200 : 50
          await sleep(processingTime)
          
          return { resourceGroup: rg, timestamp }
        })
      }
      
      // Act - enqueue tasks to different resource groups
      const taskIds: string[] = []
      for (const rg of resourceGroups) {
        const taskId = await queueSystem.enqueue({
          type: `${rg}-task`,
          resourceGroup: rg,
          data: { resourceGroup: rg }
        })
        taskIds.push(taskId)
      }
      
      // Wait for all to complete
      await Promise.all(
        taskIds.map(id => 
          expectEventually(
            () => queueSystem.getTaskStatus(id),
            status => status === "completed",
            5000
          )
        )
      )
      
      // Assert - verify concurrent processing
      expect(processingOrder).toHaveLength(4)
      
      // Tasks should start processing within a reasonable window (concurrent)
      const timestamps = processingOrder.map(p => p.timestamp)
      const maxTimeDiff = Math.max(...timestamps) - Math.min(...timestamps)
      expect(maxTimeDiff).toBeLessThan(100) // Should start within 100ms of each other
    })
  })
  
  describe("Circuit Breaker Integration", () => {
    test("should open circuit breaker after threshold failures and recover", async () => {
      // Arrange
      let callCount = 0
      await queueSystem.startProcessor("filesystem", async (task) => {
        callCount++
        if (callCount <= 5) {
          throw new Error(`Failure ${callCount}`)
        }
        return { success: true, callCount }
      })
      
      // Act - enqueue tasks that will fail
      const failingTaskIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const taskId = await queueSystem.enqueue({
          type: "failing-task",
          resourceGroup: "filesystem",
          data: { attempt: i + 1 }
        })
        failingTaskIds.push(taskId)
      }
      
      // Wait for failures
      await Promise.all(
        failingTaskIds.map(id =>
          expectEventually(
            () => queueSystem.getTaskStatus(id),
            status => status === "failed",
            5000
          )
        )
      )
      
      // Verify circuit is open
      const circuitState = await queueSystem.getCircuitBreakerState("filesystem")
      expect(circuitState).toBe("OPEN")
      
      // Act - enqueue a task that should be rejected immediately
      const rejectedTaskId = await queueSystem.enqueue({
        type: "rejected-task",
        resourceGroup: "filesystem",
        data: {}
      })
      
      await expectEventually(
        () => queueSystem.getTaskStatus(rejectedTaskId),
        status => status === "failed",
        1000
      )
      
      const rejectedTask = await queueSystem.getTask(rejectedTaskId)
      expect(rejectedTask.error).toContain("Circuit breaker is OPEN")
      
      // Act - wait for recovery and enqueue successful task
      await sleep(1100) // Wait for circuit breaker recovery timeout
      
      const recoveryTaskId = await queueSystem.enqueue({
        type: "recovery-task",
        resourceGroup: "filesystem",
        data: {}
      })
      
      await expectEventually(
        () => queueSystem.getTaskStatus(recoveryTaskId),
        status => status === "completed",
        5000
      )
      
      // Assert - circuit should be closed again
      const finalCircuitState = await queueSystem.getCircuitBreakerState("filesystem")
      expect(finalCircuitState).toBe("CLOSED")
    })
  })
})
```

## 🗄️ Database Integration Tests

### SQLite Operations
```typescript
// test/integration/database/SQLiteIntegration.test.ts
describe("SQLite Database Integration", () => {
  let testEnv: IntegrationTestEnvironment
  let persistence: QueuePersistence
  
  beforeEach(async () => {
    testEnv = new IntegrationTestEnvironment()
    await testEnv.setup()
    persistence = testEnv.getPersistence()
  })
  
  afterEach(async () => {
    await testEnv.cleanup()
  })
  
  describe("Concurrent Access", () => {
    test("should handle concurrent task operations safely", async () => {
      // Arrange
      const concurrentOperations = 50
      const tasks: QueueTask<any>[] = []
      
      // Act - concurrent inserts
      const insertPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const task = createTestTask({
          id: `concurrent-task-${i}`,
          type: "concurrent-test",
          data: { index: i }
        })
        tasks.push(task)
        return persistence.saveTask(task)
      })
      
      await Promise.all(insertPromises)
      
      // Act - concurrent reads
      const readPromises = tasks.map(task =>
        persistence.getTask(task.id)
      )
      
      const retrievedTasks = await Promise.all(readPromises)
      
      // Assert
      expect(retrievedTasks).toHaveLength(concurrentOperations)
      retrievedTasks.forEach((task, index) => {
        expect(task).toBeDefined()
        expect(task!.id).toBe(`concurrent-task-${index}`)
        expect(task!.data.index).toBe(index)
      })
    })
    
    test("should maintain data consistency during concurrent updates", async () => {
      // Arrange
      const task = createTestTask({ id: "update-test-task" })
      await persistence.saveTask(task)
      
      // Act - concurrent status updates
      const updatePromises = [
        persistence.updateTaskStatus(task.id, "running"),
        persistence.updateTaskStatus(task.id, "completed"),
        persistence.incrementTaskAttempts(task.id),
        persistence.incrementTaskAttempts(task.id)
      ]
      
      await Promise.all(updatePromises)
      
      // Assert
      const finalTask = await persistence.getTask(task.id)
      expect(finalTask).toBeDefined()
      expect(finalTask!.attempts).toBe(2) // Both increments should have applied
      // Final status should be one of the updated values
      expect(["running", "completed"]).toContain(finalTask!.status)
    })
  })
  
  describe("Large Data Handling", () => {
    test("should handle large task payloads", async () => {
      // Arrange - create a task with large data
      const largeData = {
        bigArray: new Array(10000).fill("large data item"),
        nestedObject: {
          level1: {
            level2: {
              level3: new Array(1000).fill({ key: "value", number: 42 })
            }
          }
        }
      }
      
      const task = createTestTask({
        type: "large-data-test",
        data: largeData
      })
      
      // Act
      await persistence.saveTask(task)
      const retrievedTask = await persistence.getTask(task.id)
      
      // Assert
      expect(retrievedTask).toBeDefined()
      expect(retrievedTask!.data.bigArray).toHaveLength(10000)
      expect(retrievedTask!.data.nestedObject.level1.level2.level3).toHaveLength(1000)
      expect(retrievedTask!.data.bigArray[0]).toBe("large data item")
    })
    
    test("should perform well with large number of tasks", async () => {
      const taskCount = 10000
      const startTime = Date.now()
      
      // Arrange & Act - insert many tasks
      const insertPromises = Array.from({ length: taskCount }, async (_, i) => {
        const task = createTestTask({
          id: `bulk-task-${i}`,
          resourceGroup: i % 2 === 0 ? "filesystem" : "network",
          priority: Math.floor(i / 1000) + 1
        })
        return persistence.saveTask(task)
      })
      
      await Promise.all(insertPromises)
      const insertTime = Date.now() - startTime
      
      // Act - query tasks
      const queryStartTime = Date.now()
      const filesystemTasks = await persistence.getTasksByResourceGroup("filesystem", 5000)
      const networkTasks = await persistence.getTasksByResourceGroup("network", 5000)
      const queryTime = Date.now() - queryStartTime
      
      // Assert
      expect(filesystemTasks.length + networkTasks.length).toBe(taskCount)
      expect(insertTime).toBeLessThan(5000) // Should insert 10k tasks in under 5s
      expect(queryTime).toBeLessThan(1000) // Should query in under 1s
      
      // Verify ordering
      expect(filesystemTasks[0].priority).toBeLessThanOrEqual(filesystemTasks[filesystemTasks.length - 1].priority)
      expect(networkTasks[0].priority).toBeLessThanOrEqual(networkTasks[networkTasks.length - 1].priority)
    })
  })
})
```

## 🖥️ CLI Integration Tests

### Command Integration
```typescript
// test/integration/cli/CommandIntegration.test.ts
describe("CLI Command Integration", () => {
  let testEnv: IntegrationTestEnvironment
  
  beforeEach(async () => {
    testEnv = new IntegrationTestEnvironment()
    await testEnv.setup()
  })
  
  afterEach(async () => {
    await testEnv.cleanup()
  })
  
  describe("Queue-Enabled Commands", () => {
    test("should execute build command through queue system", async () => {
      // Arrange
      const projectDir = await createTestProject()
      process.chdir(projectDir)
      
      // Act
      const result = await executeCommand(['build'])
      
      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Build completed successfully")
      
      // Verify task was processed through queue
      const metrics = await testEnv.getQueueSystem().getMetrics()
      expect(metrics.completedTasks).toBeGreaterThan(0)
    })
    
    test("should handle command failures gracefully", async () => {
      // Arrange
      const projectDir = await createInvalidProject()
      process.chdir(projectDir)
      
      // Act
      const result = await executeCommand(['build'])
      
      // Assert
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("Build failed")
      
      // Verify failure was recorded
      const metrics = await testEnv.getQueueSystem().getMetrics()
      expect(metrics.failedTasks).toBeGreaterThan(0)
    })
  })
  
  describe("Queue Management Commands", () => {
    test("should provide queue status information", async () => {
      // Arrange - enqueue some tasks
      const queueSystem = testEnv.getQueueSystem()
      await queueSystem.enqueue({
        type: "test-task",
        resourceGroup: "filesystem",
        data: {}
      })
      
      // Act
      const result = await executeCommand(['queue', 'status'])
      
      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Queue Status")
      expect(result.stdout).toContain("filesystem")
      expect(result.stdout).toContain("1") // One pending task
    })
    
    test("should clear completed tasks", async () => {
      // Arrange - enqueue and complete a task
      const queueSystem = testEnv.getQueueSystem()
      await queueSystem.startProcessor("filesystem", async () => ({ success: true }))
      
      const taskId = await queueSystem.enqueue({
        type: "test-task",
        resourceGroup: "filesystem",
        data: {}
      })
      
      await expectEventually(
        () => queueSystem.getTaskStatus(taskId),
        status => status === "completed",
        5000
      )
      
      // Act
      const result = await executeCommand(['queue', 'clear', '--completed'])
      
      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Cleared 1 completed task")
    })
  })
})
```

## 🔄 Workflow Integration Tests

### Build Workflow
```typescript
// test/integration/workflows/BuildWorkflow.test.ts
describe("Build Workflow Integration", () => {
  let testEnv: IntegrationTestEnvironment
  
  beforeEach(async () => {
    testEnv = new IntegrationTestEnvironment()
    await testEnv.setup()
  })
  
  afterEach(async () => {
    await testEnv.cleanup()
  })
  
  test("should execute complete build workflow through queue", async () => {
    // Arrange
    const projectDir = await createTypeScriptProject({
      files: {
        'src/index.ts': 'export const greeting = "Hello, World!";',
        'src/utils.ts': 'export const add = (a: number, b: number) => a + b;',
        'package.json': JSON.stringify({
          name: "test-project",
          version: "1.0.0",
          scripts: {
            build: "tsc",
            test: "jest",
            lint: "eslint src"
          }
        })
      }
    })
    
    process.chdir(projectDir)
    
    // Act - execute build workflow
    const result = await executeCommand(['workflow', 'build'])
    
    // Assert
    expect(result.exitCode).toBe(0)
    
    // Verify build artifacts
    expect(fs.existsSync(path.join(projectDir, 'dist/index.js'))).toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'dist/utils.js'))).toBe(true)
    
    // Verify workflow was processed through queue system
    const queueSystem = testEnv.getQueueSystem()
    const metrics = await queueSystem.getMetrics()
    
    expect(metrics.completedTasks).toBeGreaterThan(0)
    
    // Verify different resource groups were used appropriately
    expect(metrics.queueDepth.filesystem).toBe(0) // All file operations completed
    expect(metrics.queueDepth.computation).toBe(0) // All TypeScript compilation completed
  })
})
```

## 📊 Integration Test Metrics

### Test Performance Tracking
```typescript
// test/integration/performance/IntegrationPerformance.test.ts
describe("Integration Performance", () => {
  test("should meet performance benchmarks under load", async () => {
    const testEnv = new IntegrationTestEnvironment()
    await testEnv.setup()
    
    try {
      const queueSystem = testEnv.getQueueSystem()
      
      // Start processors
      await queueSystem.startProcessor("filesystem", async (task) => {
        await sleep(10) // Simulate I/O work
        return { success: true }
      })
      
      // Enqueue many tasks concurrently
      const startTime = Date.now()
      const taskCount = 1000
      
      const taskPromises = Array.from({ length: taskCount }, (_, i) =>
        queueSystem.enqueue({
          type: "performance-test",
          resourceGroup: "filesystem",
          data: { index: i }
        })
      )
      
      const taskIds = await Promise.all(taskPromises)
      const enqueueTime = Date.now() - startTime
      
      // Wait for all tasks to complete
      const processingStartTime = Date.now()
      
      await Promise.all(
        taskIds.map(id =>
          expectEventually(
            () => queueSystem.getTaskStatus(id),
            status => status === "completed",
            30000
          )
        )
      )
      
      const totalTime = Date.now() - startTime
      const processingTime = Date.now() - processingStartTime
      
      // Assert performance benchmarks
      expect(enqueueTime).toBeLessThan(1000) // 1000 tasks enqueued in < 1s
      expect(totalTime).toBeLessThan(15000) // All tasks completed in < 15s
      
      const throughput = taskCount / (processingTime / 1000)
      expect(throughput).toBeGreaterThan(100) // > 100 tasks/second
      
    } finally {
      await testEnv.cleanup()
    }
  })
})
```

### Memory and Resource Monitoring
```typescript
// 리소스 사용량 모니터링
export const monitorIntegrationTestResources = async (testFn: () => Promise<void>) => {
  const initialMemory = process.memoryUsage()
  const startTime = Date.now()
  
  try {
    await testFn()
  } finally {
    const finalMemory = process.memoryUsage()
    const duration = Date.now() - startTime
    
    const memoryDelta = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external
    }
    
    console.log('Integration Test Resource Usage:', {
      duration: `${duration}ms`,
      memoryDelta: {
        heapUsed: `${Math.round(memoryDelta.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryDelta.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryDelta.external / 1024 / 1024)}MB`
      }
    })
  }
}
```

## 🎯 Test Execution

### NPM Scripts
```json
{
  "scripts": {
    "test:integration": "vitest run test/integration",
    "test:integration:watch": "vitest test/integration",
    "test:integration:system": "vitest run test/integration/system",
    "test:integration:database": "vitest run test/integration/database",
    "test:integration:cli": "vitest run test/integration/cli",
    "test:integration:workflows": "vitest run test/integration/workflows"
  }
}
```

### CI/CD Pipeline
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Run Integration Tests
        run: npm run test:integration
        timeout-minutes: 10
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: test-results/
```

---

**📅 생성일**: 2025-01-12  
**👤 작성자**: Claude Code Task Manager  
**🔄 버전**: v1.0.0 - Integration Testing Strategy  
**📋 상태**: Phase 2+ 적용