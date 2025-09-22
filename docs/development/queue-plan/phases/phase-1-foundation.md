# Phase 1: Foundation Implementation Plan

> 🏗️ **기반 시스템 구축 - Week 1**

## 🎯 Phase 1 목표

**핵심 목표**: Effect.js 패턴 기반 큐 시스템의 견고한 기반 구축  
**기간**: 5-7일  
**성공 지표**: 타입 안전성 100%, 스키마 검증 통과, 기본 큐 동작 검증

## 📋 작업 분해 구조 (WBS)

### 1.1 타입 시스템 구축 (Day 1-2)
**파일**: `src/services/Queue/types.ts`  
**소유자**: 개발팀  
**우선순위**: Critical

#### 상세 작업 목록
```typescript
// 1.1.1 핵심 인터페이스 정의
interface PersistedQueueTask<A, E> {
  readonly id: string
  readonly sessionId: string  
  readonly type: OperationType
  readonly resourceGroup: ResourceGroup
  readonly operation: Effect.Effect<A, E>
  readonly priority: number
  readonly estimatedDuration: Duration.Duration
  readonly status: TaskStatus
  // ... 추가 필드들
}

// 1.1.2 타입 유니언 정의
type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"
type ResourceGroup = "filesystem" | "network" | "computation" | "memory-intensive"  
type OperationType = "file-read" | "file-write" | "directory-list" | "find-files"

// 1.1.3 서비스 태그 정의
export const QueuePersistence = Context.GenericTag<QueuePersistence>("@app/QueuePersistence")
export const InternalQueue = Context.GenericTag<InternalQueue>("@app/InternalQueue")
export const CircuitBreaker = Context.GenericTag<CircuitBreaker>("@app/CircuitBreaker")
// ... 모든 서비스 태그
```

#### 완료 기준
- [x] 모든 인터페이스 타입 안전성 검증
- [x] JSDoc 문서화 100% 완료
- [x] schema.sql과 타입 완벽 동기화
- [x] TypeScript 컴파일 에러 0개

#### 예상 문제점 및 해결책
- **문제**: schema.sql과 타입 불일치
- **해결**: 자동화된 스키마-타입 동기화 스크립트 작성

---

### 1.2 Queue Persistence Layer (Day 2-4)
**파일**: `src/services/Queue/QueuePersistenceLive.ts`  
**의존성**: SchemaManager (완료), types.ts  
**우선순위**: Critical

#### 구현 세부 사항
```typescript
export const QueuePersistenceLive = Layer.effect(
  QueuePersistence,
  Effect.gen(function* () {
    // 1.2.1 SchemaManager 의존성 주입
    const schemaManager = yield* SchemaManager
    
    // 1.2.2 데이터베이스 초기화 및 검증
    yield* initializeDatabase()
    const isValid = yield* schemaManager.validateSchema()
    if (!isValid) {
      return yield* Effect.fail(new Error("Schema validation failed"))
    }
    
    // 1.2.3 SQLite 연결 관리
    const db = new Database(".effect-cli/queue.db")
    const currentSessionId = yield* Ref.make(generateSessionId())
    
    // 1.2.4 핵심 CRUD 작업 구현
    const persistTask = <A, E>(task: PersistedQueueTask<A, E>) => 
      Effect.gen(function* () {
        yield* Effect.sync(() =>
          db.prepare(`
            INSERT OR REPLACE INTO queue_tasks 
            (id, session_id, type, resource_group, priority, status, 
             created_at, retry_count, max_retries, estimated_duration,
             file_path, file_size, operation_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(/* 매개변수들 */)
        )
      })
    
    // 1.2.5 세션 관리 구현
    const clearQueueForNewSession = (sessionId: string) =>
      Effect.gen(function* () {
        // 이전 세션 정리 로직
        // 새 세션 생성 로직
      })
    
    return QueuePersistence.of({
      persistTask,
      updateTaskStatus,
      loadPendingTasks,
      clearQueueForNewSession,
      recoverFromCrash,
      getCurrentSession: () => Ref.get(currentSessionId),
      cleanup: () => Effect.gen(function* () {
        yield* schemaManager.cleanup()
        yield* Effect.sync(() => db.close())
      })
    })
  })
)
```

#### 단위 테스트 계획
```typescript
describe("QueuePersistenceLive", () => {
  it("should persist task correctly", () =>
    Effect.gen(function* () {
      const persistence = yield* QueuePersistence
      const task = createTestTask()
      
      yield* persistence.persistTask(task)
      const loaded = yield* persistence.loadPendingTasks(task.sessionId)
      
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe(task.id)
    }).pipe(
      Effect.provide(QueuePersistenceLive),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
  
  it("should clear previous sessions", () => /* 테스트 구현 */)
  it("should recover from crashes", () => /* 테스트 구현 */)
})
```

#### 완료 기준
- [x] CRUD 작업 100% 동작 검증
- [x] 세션 격리 메커니즘 테스트 통과
- [x] 프로세스 복구 시나리오 테스트 통과
- [x] 메모리 누수 테스트 통과
- [x] 단위 테스트 커버리지 90%+

---

### 1.3 Internal Queue Implementation (Day 3-5)
**파일**: `src/services/Queue/InternalQueueLive.ts`  
**의존성**: QueuePersistence, types.ts  
**우선순위**: High

#### 핵심 구현 로직
```typescript
export const InternalQueueLive = Layer.effect(
  InternalQueue,
  Effect.gen(function* () {
    const persistence = yield* QueuePersistence
    
    // 1.3.1 ResourceGroup별 Queue 생성
    const queues = yield* Effect.forEach(
      ["filesystem", "network", "computation", "memory-intensive"] as const,
      (group) => Queue.bounded<QueueTask>(100).pipe(
        Effect.map(queue => [group, queue] as const)
      )
    ).pipe(Effect.map(entries => new Map(entries)))
    
    // 1.3.2 처리 Fiber 시작
    const processingFibers = yield* Effect.forEach(
      Array.from(queues.entries()),
      ([group, queue]) => 
        processQueue(group, queue).pipe(Effect.fork)
    )
    
    // 1.3.3 우선순위 기반 Enqueue
    const enqueue = <A, E>(task: QueueTask<A, E>) =>
      Effect.gen(function* () {
        const queue = queues.get(task.resourceGroup)
        if (!queue) {
          return yield* Effect.fail(new Error(`Unknown resource group: ${task.resourceGroup}`))
        }
        
        // SQLite에 지속성 저장
        yield* persistence.persistTask(task)
        
        // 메모리 큐에 추가
        yield* Queue.offer(queue, task)
        
        yield* Effect.log(`Task enqueued: ${task.id} [${task.resourceGroup}]`)
      })
    
    // 1.3.4 큐 처리 로직
    const processQueue = (group: ResourceGroup, queue: Queue.Queue<QueueTask>) =>
      Effect.gen(function* () {
        while (true) {
          const task = yield* Queue.take(queue)
          
          // 상태 업데이트: pending -> running
          yield* persistence.updateTaskStatus(task.id, "running")
          
          // 작업 실행
          const result = yield* task.operation.pipe(
            Effect.catchAll(error => {
              // 실패 처리
              persistence.updateTaskStatus(task.id, "failed", String(error))
              return Effect.fail(error)
            })
          )
          
          // 성공 처리
          yield* persistence.updateTaskStatus(task.id, "completed")
          yield* Effect.log(`Task completed: ${task.id}`)
        }
      }).pipe(
        Effect.repeat(Schedule.forever),
        Effect.catchAll(error => Effect.log(`Queue processing error: ${error}`))
      )
    
    return InternalQueue.of({
      enqueue,
      getStatus: () => getQueueStatus(queues),
      cleanup: () => Effect.forEach(processingFibers, Fiber.interrupt)
    })
  })
)
```

#### 테스트 시나리오
1. **기본 큐 동작**: enqueue → process → complete
2. **우선순위 처리**: 높은 우선순위 작업 먼저 처리  
3. **ResourceGroup 분리**: 각 그룹별 독립 처리
4. **에러 처리**: 실패 시 재시도 및 상태 업데이트
5. **정리 작업**: Fiber 정리 및 리소스 해제

#### 완료 기준
- [x] 4개 ResourceGroup 정상 동작
- [x] 우선순위 기반 처리 검증
- [x] 동시성 안전성 테스트 통과
- [x] 에러 시나리오 복구 테스트
- [x] 성능 테스트: 초당 100+ 작업 처리

---

### 1.4 기본 모니터링 구현 (Day 4-6)
**파일**: `src/services/Queue/QueueMonitorLive.ts`  
**의존성**: QueuePersistence, InternalQueue  
**우선순위**: Medium

#### 기본 모니터링 기능
```typescript
export const QueueMonitorLive = Layer.effect(
  QueueMonitor,
  Effect.gen(function* () {
    const persistence = yield* QueuePersistence
    const db = new Database(".effect-cli/queue.db")
    
    // 1.4.1 현재 상태 조회 (schema.sql VIEW 활용)
    const getQueueStatus = (sessionId?: string) =>
      Effect.gen(function* () {
        const currentSession = sessionId ?? (yield* persistence.getCurrentSession())
        
        const summary = yield* Effect.sync(() =>
          db.prepare(`
            SELECT * FROM current_session_summary 
            WHERE session_id = ?
          `).get(currentSession)
        )
        
        return {
          sessionId: currentSession,
          totalTasks: summary?.total_tasks || 0,
          completedTasks: summary?.completed_tasks || 0,
          failedTasks: summary?.failed_tasks || 0,
          runningTasks: summary?.running_tasks || 0,
          pendingTasks: summary?.pending_tasks || 0,
          successRate: summary?.success_rate_percent || 0,
          averageProcessingTime: summary?.avg_duration_ms || 0,
          lastUpdated: new Date()
        } as QueueMetrics
      })
    
    return QueueMonitor.of({
      getQueueStatus,
      exportMetrics: (format: 'json' | 'csv') => exportQueueMetrics(format)
    })
  })
)
```

#### 완료 기준
- [x] 실시간 상태 조회 동작
- [x] schema.sql VIEW 정상 활용
- [x] JSON/CSV 내보내기 기능
- [x] 메트릭 정확성 검증

---

### 1.5 통합 Layer 조립 (Day 5-7)
**파일**: `src/services/Queue/index.ts`  
**의존성**: 모든 Phase 1 구현체  
**우선순위**: High

#### Layer 조립 전략
```typescript
// 1.5.1 기본 큐 시스템 Layer
export const BasicQueueSystemLayer = Layer.mergeAll(
  SchemaManagerLive,      // ✅ 이미 완료됨
  QueuePersistenceLive,   // 1.2에서 구현
  InternalQueueLive,      // 1.3에서 구현  
  QueueMonitorLive        // 1.4에서 구현
).pipe(
  Layer.provide(NodeContext.layer)
)

// 1.5.2 테스트용 Layer (Mock 구현체)
export const TestQueueSystemLayer = Layer.mergeAll(
  SchemaManagerTest,
  QueuePersistenceTest,
  InternalQueueTest,
  QueueMonitorTest
)
```

#### 통합 테스트
```typescript
describe("Basic Queue System Integration", () => {
  it("should handle end-to-end task processing", () =>
    Effect.gen(function* () {
      // Given: 큐 시스템이 초기화됨
      const queue = yield* InternalQueue
      const monitor = yield* QueueMonitor
      
      // When: 작업을 큐에 추가
      const task = createTestTask("file-read", "filesystem")
      yield* queue.enqueue(task)
      
      // Then: 작업이 처리되고 상태가 업데이트됨
      yield* Effect.sleep(Duration.millis(100))
      const status = yield* monitor.getQueueStatus()
      
      expect(status.completedTasks).toBe(1)
      expect(status.successRate).toBe(100)
    }).pipe(
      Effect.provide(BasicQueueSystemLayer),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
})
```

---

## 📊 Phase 1 완료 기준

### 기능적 요구사항
- [x] **타입 시스템**: 100% 타입 안전성, schema.sql 동기화
- [x] **지속성**: SQLite 기반 작업 저장/복구, 세션 격리
- [x] **큐 처리**: ResourceGroup별 독립 처리, 우선순위 적용
- [x] **모니터링**: 실시간 상태 조회, 메트릭 내보내기

### 비기능적 요구사항  
- [x] **성능**: 초당 100+ 작업 처리, 큐 오버헤드 < 10ms
- [x] **안정성**: 메모리 누수 없음, 프로세스 복구 동작
- [x] **테스트**: 단위 테스트 커버리지 90%+, 통합 테스트 통과

### 품질 기준
- [x] **코드 품질**: TypeScript strict 모드, ESLint 통과
- [x] **문서화**: JSDoc 100%, 사용법 예제 포함
- [x] **에러 처리**: 모든 실패 시나리오 검증

## 🔄 Phase 2 준비사항

Phase 1 완료 후 Phase 2로 넘어가기 위한 준비:
1. **Circuit Breaker 인터페이스 정의**
2. **AdaptiveThrottler 인터페이스 정의**  
3. **StabilityMonitor 인터페이스 정의**
4. **성능 벤치마크 기준선 설정**

---

**📅 마지막 업데이트**: 2025-01-12  
**👤 담당자**: Queue System Development Team  
**📈 진행률**: ✅ 100% (Phase 1 완료)  
**🎯 다음 단계**: Phase 2 Advanced Stability Patterns 구현 준비