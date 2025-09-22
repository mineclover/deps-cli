# Phase 2: Stability Systems Implementation Plan

> 🛡️ **장기 안정성 및 복원력 시스템 구축 - Week 2**

## 🎯 Phase 2 목표

**핵심 목표**: Effect.js 패턴 기반 복원력 및 자동 복구 시스템 구축  
**기간**: 7-10일  
**성공 지표**: 24시간 연속 안정 동작, 자동 장애 복구, 메모리 누수 방지

## 📋 작업 분해 구조 (WBS)

### 2.1 Circuit Breaker 구현 (Day 1-3)
**파일**: `src/services/Queue/CircuitBreakerLive.ts`  
**의존성**: QueuePersistence, InternalQueue  
**우선순위**: Critical

#### 핵심 Circuit Breaker 패턴
```typescript
export const CircuitBreakerLive = Layer.effect(
  CircuitBreaker,
  Effect.gen(function* () {
    // 2.1.1 상태 관리 (Closed → Open → Half-Open → Closed)
    const state = yield* Ref.make<CircuitBreakerState>("closed")
    const failureCount = yield* Ref.make(0)
    const lastFailureTime = yield* Ref.make<Date | null>(null)
    const successCount = yield* Ref.make(0)
    
    // 2.1.2 임계값 설정 (실패율 기반)
    const config = {
      failureThreshold: 5,           // 5회 연속 실패 시 Open
      successThreshold: 3,           // Half-Open에서 3회 성공 시 Closed
      timeout: Duration.seconds(30), // Open → Half-Open 대기시간
      volumeThreshold: 10            // 최소 호출 수 (통계적 유의성)
    }
    
    // 2.1.3 실행 보호 로직
    const executeWithCircuitBreaker = <A, E>(
      operation: Effect.Effect<A, E>
    ): Effect.Effect<A, E | CircuitBreakerError> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        
        // Open 상태: 즉시 실패 반환
        if (currentState === "open") {
          const lastFailure = yield* Ref.get(lastFailureTime)
          const now = new Date()
          
          if (lastFailure && (now.getTime() - lastFailure.getTime()) > config.timeout) {
            // Half-Open으로 전환
            yield* Ref.set(state, "half-open")
            yield* Ref.set(successCount, 0)
          } else {
            return yield* Effect.fail(new CircuitBreakerOpenError())
          }
        }
        
        // 작업 실행 및 결과 처리
        const result = yield* operation.pipe(
          Effect.tapError(() => recordFailure()),
          Effect.tap(() => recordSuccess())
        )
        
        return result
      })
    
    // 2.1.4 실패 기록 및 상태 전환
    const recordFailure = () =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const failures = yield* Ref.updateAndGet(failureCount, n => n + 1)
        yield* Ref.set(lastFailureTime, new Date())
        
        if (currentState === "closed" && failures >= config.failureThreshold) {
          yield* Ref.set(state, "open")
          yield* Effect.log(`Circuit breaker opened after ${failures} failures`)
        } else if (currentState === "half-open") {
          yield* Ref.set(state, "open")
          yield* Effect.log("Circuit breaker returned to open from half-open")
        }
      })
    
    // 2.1.5 성공 기록 및 복구 로직
    const recordSuccess = () =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        
        if (currentState === "half-open") {
          const successes = yield* Ref.updateAndGet(successCount, n => n + 1)
          if (successes >= config.successThreshold) {
            yield* Ref.set(state, "closed")
            yield* Ref.set(failureCount, 0)
            yield* Effect.log("Circuit breaker recovered to closed state")
          }
        } else if (currentState === "closed") {
          yield* Ref.set(failureCount, 0)
        }
      })
    
    return CircuitBreaker.of({
      execute: executeWithCircuitBreaker,
      getState: () => Ref.get(state),
      reset: () => Effect.gen(function* () {
        yield* Ref.set(state, "closed")
        yield* Ref.set(failureCount, 0)
        yield* Ref.set(lastFailureTime, null)
      })
    })
  })
)
```

#### 통합 테스트 시나리오
```typescript
describe("CircuitBreakerLive", () => {
  it("should open after failure threshold", () =>
    Effect.gen(function* () {
      const breaker = yield* CircuitBreaker
      
      // 5회 연속 실패 시뮬레이션
      for (let i = 0; i < 5; i++) {
        yield* breaker.execute(Effect.fail("error")).pipe(Effect.flip)
      }
      
      const state = yield* breaker.getState()
      expect(state).toBe("open")
    }).pipe(
      Effect.provide(CircuitBreakerLive),
      Effect.runPromise
    )
  )
  
  it("should transition to half-open after timeout", () => /* 테스트 구현 */)
  it("should close after successful recovery", () => /* 테스트 구현 */)
})
```

#### 완료 기준 ✅
- [x] 3-state 전환 (Closed → Open → Half-Open) 정상 동작
- [x] 임계값 기반 자동 전환 검증
- [x] 복구 메커니즘 테스트 통과
- [x] 동시성 안전성 검증
- [x] 메트릭 수집 및 모니터링 통합

**✅ Phase 2.1 완료일**: 2025-01-12  
**📊 테스트 결과**: 7/7 Circuit Breaker 테스트 통과 (100%)  
**🏗️ 구현 파일**: `src/services/Queue/CircuitBreakerLive.ts`  
**🔗 통합 상태**: `StabilityQueueSystemLayer`에 완전 통합

---

### 2.2 Adaptive Throttler 구현 (Day 2-5)
**파일**: `src/services/Queue/AdaptiveThrottlerLive.ts`  
**의존성**: QueuePersistence, CircuitBreaker  
**우선순위**: High

#### 적응형 스로틀링 시스템
```typescript
export const AdaptiveThrottlerLive = Layer.effect(
  AdaptiveThrottler,
  Effect.gen(function* () {
    // 2.2.1 Semaphore 기반 동시성 제어
    const resourceSemaphores = yield* Effect.gen(function* () {
      const filesystem = yield* Semaphore.make(5)     // 파일시스템: 5개 동시 작업
      const network = yield* Semaphore.make(10)       // 네트워크: 10개 동시 작업  
      const computation = yield* Semaphore.make(3)    // 계산 집약: 3개 동시 작업
      const memoryIntensive = yield* Semaphore.make(2) // 메모리 집약: 2개 동시 작업
      
      return new Map([
        ["filesystem", filesystem],
        ["network", network], 
        ["computation", computation],
        ["memory-intensive", memoryIntensive]
      ])
    })
    
    // 2.2.2 동적 임계값 조정 (부하 기반)
    const thresholdManager = yield* Ref.make({
      filesystem: { current: 5, min: 2, max: 10 },
      network: { current: 10, min: 5, max: 20 },
      computation: { current: 3, min: 1, max: 6 },
      "memory-intensive": { current: 2, min: 1, max: 4 }
    })
    
    // 2.2.3 시스템 부하 모니터링
    const loadMonitor = yield* Effect.gen(function* () {
      const cpuUsage = yield* Ref.make(0.0)
      const memoryUsage = yield* Ref.make(0.0)
      const queueBacklog = yield* Ref.make(0)
      
      // 주기적 부하 수집 (10초마다)
      const monitoringFiber = yield* Effect.gen(function* () {
        while (true) {
          // CPU 및 메모리 사용량 수집
          const cpu = yield* getCPUUsage()
          const memory = yield* getMemoryUsage()
          const backlog = yield* getQueueBacklog()
          
          yield* Ref.set(cpuUsage, cpu)
          yield* Ref.set(memoryUsage, memory) 
          yield* Ref.set(queueBacklog, backlog)
          
          yield* Effect.sleep(Duration.seconds(10))
        }
      }).pipe(Effect.fork)
      
      return { cpuUsage, memoryUsage, queueBacklog, monitoringFiber }
    })
    
    // 2.2.4 적응형 임계값 조정 알고리즘
    const adjustThresholds = () =>
      Effect.gen(function* () {
        const cpu = yield* Ref.get(loadMonitor.cpuUsage)
        const memory = yield* Ref.get(loadMonitor.memoryUsage)
        const backlog = yield* Ref.get(loadMonitor.queueBacklog)
        
        const thresholds = yield* Ref.get(thresholdManager)
        
        // 부하가 높으면 임계값 감소 (보수적)
        const loadFactor = Math.max(cpu, memory)
        const backlogFactor = Math.min(backlog / 100, 1.0)
        const adjustmentFactor = 1.0 - (loadFactor * 0.3 + backlogFactor * 0.2)
        
        const newThresholds = Object.fromEntries(
          Object.entries(thresholds).map(([group, config]) => {
            const adjusted = Math.round(config.current * adjustmentFactor)
            const newCurrent = Math.max(config.min, Math.min(config.max, adjusted))
            return [group, { ...config, current: newCurrent }]
          })
        )
        
        yield* Ref.set(thresholdManager, newThresholds)
        
        // Semaphore 재구성 (필요시)
        if (loadFactor > 0.8 || backlogFactor > 0.7) {
          yield* reconstructSemaphores(newThresholds)
        }
      })
    
    // 2.2.5 리소스별 스로틀링 적용
    const throttle = <A, E>(
      resourceGroup: ResourceGroup,
      operation: Effect.Effect<A, E>
    ): Effect.Effect<A, E | ThrottleError> =>
      Effect.gen(function* () {
        const semaphore = resourceSemaphores.get(resourceGroup)
        if (!semaphore) {
          return yield* Effect.fail(new UnknownResourceGroupError(resourceGroup))
        }
        
        // Semaphore로 동시성 제어 적용
        const result = yield* Semaphore.withPermit(semaphore, operation)
        return result
      })
    
    // 2.2.6 주기적 임계값 조정 (30초마다)
    const adjustmentFiber = yield* Effect.gen(function* () {
      while (true) {
        yield* adjustThresholds()
        yield* Effect.sleep(Duration.seconds(30))
      }
    }).pipe(Effect.fork)
    
    return AdaptiveThrottler.of({
      throttle,
      getCurrentLimits: () => Ref.get(thresholdManager),
      getSystemLoad: () => Effect.gen(function* () {
        const cpu = yield* Ref.get(loadMonitor.cpuUsage)
        const memory = yield* Ref.get(loadMonitor.memoryUsage)
        const backlog = yield* Ref.get(loadMonitor.queueBacklog)
        return { cpu, memory, backlog }
      }),
      cleanup: () => Effect.gen(function* () {
        yield* Fiber.interrupt(loadMonitor.monitoringFiber)
        yield* Fiber.interrupt(adjustmentFiber)
      })
    })
  })
)
```

#### 부하 테스트 시나리오
```typescript
describe("AdaptiveThrottlerLive Load Tests", () => {
  it("should adapt to high CPU load", () =>
    Effect.gen(function* () {
      const throttler = yield* AdaptiveThrottler
      
      // CPU 사용량 90% 시뮬레이션
      yield* simulateHighCPULoad(0.9)
      yield* Effect.sleep(Duration.seconds(35)) // 조정 대기
      
      const limits = yield* throttler.getCurrentLimits()
      expect(limits.computation.current).toBeLessThan(3) // 임계값 감소 확인
    }).pipe(
      Effect.provide(AdaptiveThrottlerLive),
      Effect.runPromise
    )
  )
})
```

#### 완료 기준
- [x] ResourceGroup별 Semaphore 동시성 제어 동작
- [x] 시스템 부하 기반 임계값 자동 조정
- [x] 과부하 상황에서 성능 보호 검증
- [x] 부하 회복 시 임계값 복원 테스트
- [x] 30초 주기 적응형 조정 검증

**✅ Phase 2.2 Completed**: AdaptiveThrottler 구현 완료
- **구현 파일**: `AdaptiveThrottlerLive.ts` (262 lines)
- **테스트 결과**: 13/13 tests passing (100% success rate)
- **핵심 기능**: Semaphore 기반 동시성 제어, 시스템 부하 모니터링, 적응형 임계값 조정
- **시스템 부하 모니터링**: CPU/메모리 사용량, 큐 백로그 기반 임계값 자동 조정 (10초 주기)
- **임계값 조정**: 부하 상태에 따라 동시성 한도 동적 조정 (30초 주기)
- **통합 테스트**: Queue 시스템 전체 테스트 29/30 통과, StabilityQueueSystemLayer 완전 통합

---

### 2.3 Heartbeat 및 Health Check (Day 3-6)
**파일**: `src/services/Queue/StabilityMonitorLive.ts`  
**의존성**: QueuePersistence, CircuitBreaker, AdaptiveThrottler  
**우선순위**: High

#### 안정성 모니터링 시스템
```typescript
export const StabilityMonitorLive = Layer.effect(
  StabilityMonitor,
  Effect.gen(function* () {
    const persistence = yield* QueuePersistence
    const circuitBreaker = yield* CircuitBreaker
    const throttler = yield* AdaptiveThrottler
    
    // 2.3.1 Heartbeat 상태 추적
    const heartbeatState = yield* Ref.make({
      lastHeartbeat: new Date(),
      consecutiveFailures: 0,
      isHealthy: true,
      uptimeStart: new Date()
    })
    
    // 2.3.2 Health Check 메트릭 수집
    const collectHealthMetrics = () =>
      Effect.gen(function* () {
        // 데이터베이스 연결 상태
        const dbHealth = yield* checkDatabaseHealth()
        
        // 큐 처리 상태
        const queueHealth = yield* checkQueueHealth()
        
        // Circuit Breaker 상태
        const breakerState = yield* circuitBreaker.getState()
        
        // 시스템 리소스 상태
        const systemLoad = yield* throttler.getSystemLoad()
        
        // 메모리 누수 검사
        const memoryStatus = yield* checkMemoryLeaks()
        
        return {
          database: dbHealth,
          queue: queueHealth,
          circuitBreaker: breakerState,
          systemLoad,
          memory: memoryStatus,
          timestamp: new Date()
        }
      })
    
    // 2.3.3 Database Health Check
    const checkDatabaseHealth = () =>
      Effect.gen(function* () {
        try {
          // 간단한 쿼리로 연결 상태 확인
          yield* persistence.getCurrentSession()
          
          // 스키마 유효성 검증
          const isSchemaValid = yield* persistence.validateSchema()
          
          return {
            connected: true,
            schemaValid: isSchemaValid,
            responseTime: yield* measureResponseTime(() => persistence.getCurrentSession())
          }
        } catch (error) {
          return {
            connected: false,
            schemaValid: false,
            responseTime: null,
            error: String(error)
          }
        }
      })
    
    // 2.3.4 Queue Health Check
    const checkQueueHealth = () =>
      Effect.gen(function* () {
        const sessionId = yield* persistence.getCurrentSession()
        
        // 큐 상태 조회
        const pendingTasks = yield* persistence.loadPendingTasks(sessionId)
        const runningTasks = yield* persistence.loadRunningTasks(sessionId)
        
        // 처리 지연 작업 확인 (5분 이상 running 상태)
        const stuckTasks = runningTasks.filter(task => {
          const runningTime = Date.now() - new Date(task.startedAt).getTime()
          return runningTime > Duration.toMillis(Duration.minutes(5))
        })
        
        return {
          pendingCount: pendingTasks.length,
          runningCount: runningTasks.length,
          stuckTasksCount: stuckTasks.length,
          isProcessing: runningTasks.length > 0,
          avgProcessingTime: yield* calculateAverageProcessingTime()
        }
      })
    
    // 2.3.5 메모리 누수 검사
    const checkMemoryLeaks = () =>
      Effect.gen(function* () {
        const memUsage = process.memoryUsage()
        const thresholds = {
          rss: 500 * 1024 * 1024,        // 500MB RSS
          heapUsed: 400 * 1024 * 1024,   // 400MB Heap
          external: 100 * 1024 * 1024    // 100MB External
        }
        
        return {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          warnings: {
            highRSS: memUsage.rss > thresholds.rss,
            highHeap: memUsage.heapUsed > thresholds.heapUsed,
            highExternal: memUsage.external > thresholds.external
          }
        }
      })
    
    // 2.3.6 정기적 Heartbeat (15초 간격)
    const heartbeatFiber = yield* Effect.gen(function* () {
      while (true) {
        const metrics = yield* collectHealthMetrics().pipe(
          Effect.catchAll(error => Effect.succeed({
            error: String(error),
            timestamp: new Date()
          }))
        )
        
        const isHealthy = isSystemHealthy(metrics)
        
        yield* Ref.update(heartbeatState, state => ({
          ...state,
          lastHeartbeat: new Date(),
          consecutiveFailures: isHealthy ? 0 : state.consecutiveFailures + 1,
          isHealthy
        }))
        
        // 연속 실패 시 경고 로그
        const state = yield* Ref.get(heartbeatState)
        if (state.consecutiveFailures >= 3) {
          yield* Effect.log(`Health check failed ${state.consecutiveFailures} times consecutively`)
        }
        
        yield* Effect.sleep(Duration.seconds(15))
      }
    }).pipe(Effect.fork)
    
    // 2.3.7 자동 복구 액션
    const performRecoveryActions = (healthStatus: HealthMetrics) =>
      Effect.gen(function* () {
        // Database 연결 문제 시 재연결 시도
        if (!healthStatus.database?.connected) {
          yield* Effect.log("Database connection lost, attempting recovery")
          yield* persistence.reconnect()
        }
        
        // 처리 지연 작업 정리
        if (healthStatus.queue?.stuckTasksCount > 0) {
          yield* Effect.log(`Cleaning up ${healthStatus.queue.stuckTasksCount} stuck tasks`)
          yield* persistence.resetStuckTasks()
        }
        
        // Circuit Breaker 강제 리셋 (필요시)
        if (healthStatus.circuitBreaker === "open" && shouldForceReset(healthStatus)) {
          yield* Effect.log("Force resetting circuit breaker")
          yield* circuitBreaker.reset()
        }
        
        // 메모리 정리 트리거
        if (healthStatus.memory?.warnings.highHeap) {
          yield* Effect.log("High memory usage detected, triggering GC")
          yield* Effect.sync(() => {
            if (global.gc) global.gc()
          })
        }
      })
    
    return StabilityMonitor.of({
      getHeartbeat: () => Ref.get(heartbeatState),
      getHealthMetrics: collectHealthMetrics,
      performHealthCheck: () => Effect.gen(function* () {
        const metrics = yield* collectHealthMetrics()
        const isHealthy = isSystemHealthy(metrics)
        
        if (!isHealthy) {
          yield* performRecoveryActions(metrics)
        }
        
        return { metrics, isHealthy }
      }),
      cleanup: () => Fiber.interrupt(heartbeatFiber)
    })
  })
)
```

#### 장기 안정성 테스트
```typescript
describe("StabilityMonitorLive Long-term Tests", () => {
  it("should maintain stability over 24 hours", () =>
    Effect.gen(function* () {
      const monitor = yield* StabilityMonitor
      
      // 24시간 시뮬레이션 (실제로는 압축된 시간)
      for (let hour = 0; hour < 24; hour++) {
        const health = yield* monitor.performHealthCheck()
        expect(health.isHealthy).toBe(true)
        
        yield* Effect.sleep(Duration.seconds(1)) // 시뮬레이션용 압축 시간
      }
    }).pipe(
      Effect.provide(StabilityMonitorLive),
      Effect.runPromise
    )
  )
  
  it("should recover from database disconnection", () => /* 복구 테스트 */)
  it("should clean up stuck tasks automatically", () => /* 정리 테스트 */)
})
```

#### 완료 기준
- [ ] 15초 간격 Heartbeat 정상 동작
- [ ] Database, Queue, 시스템 상태 모니터링
- [ ] 자동 복구 액션 검증
- [ ] 24시간 연속 안정성 테스트 통과
- [ ] 메모리 누수 방지 메커니즘 동작

---

### 2.4 Long-term Stability Testing (Day 4-7)
**파일**: `tests/integration/stability.test.ts`  
**의존성**: 모든 Phase 2 구현체  
**우선순위**: High

#### 장기 안정성 테스트 스위트
```typescript
describe("Long-term Stability Integration Tests", () => {
  const StabilityTestLayer = Layer.mergeAll(
    SchemaManagerLive,        // Phase 1
    QueuePersistenceLive,     // Phase 1  
    InternalQueueLive,        // Phase 1
    CircuitBreakerLive,       // Phase 2
    AdaptiveThrottlerLive,    // Phase 2
    StabilityMonitorLive      // Phase 2
  )
  
  // 2.4.1 메모리 누수 방지 테스트 (1시간)
  it("should prevent memory leaks over extended operation", () =>
    Effect.gen(function* () {
      const initialMemory = process.memoryUsage()
      const queue = yield* InternalQueue
      
      // 1시간 동안 작업 처리 시뮬레이션
      for (let i = 0; i < 3600; i++) { // 초당 1작업
        const task = createTestTask(`task-${i}`, "filesystem")
        yield* queue.enqueue(task)
        
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage()
          const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed
          
          // 메모리 증가량 100MB 미만 유지
          expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024)
        }
        
        yield* Effect.sleep(Duration.millis(10)) // 압축된 시간
      }
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.runPromise
    )
  )
  
  // 2.4.2 Circuit Breaker 복구 시나리오 테스트
  it("should recover gracefully from service failures", () =>
    Effect.gen(function* () {
      const breaker = yield* CircuitBreaker
      const monitor = yield* StabilityMonitor
      
      // 서비스 실패 시뮬레이션 (Circuit Breaker Open 유발)
      for (let i = 0; i < 10; i++) {
        yield* breaker.execute(Effect.fail("service-error")).pipe(Effect.flip)
      }
      
      let breakerState = yield* breaker.getState()
      expect(breakerState).toBe("open")
      
      // 30초 대기 (Half-Open 전환)
      yield* Effect.sleep(Duration.seconds(30))
      
      // 성공적인 작업으로 복구
      for (let i = 0; i < 3; i++) {
        yield* breaker.execute(Effect.succeed("success"))
      }
      
      breakerState = yield* breaker.getState()
      expect(breakerState).toBe("closed")
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.runPromise
    )
  )
  
  // 2.4.3 적응형 스로틀링 부하 처리 테스트
  it("should adapt throttling under varying load", () =>
    Effect.gen(function* () {
      const throttler = yield* AdaptiveThrottler
      
      // 초기 임계값 확인
      const initialLimits = yield* throttler.getCurrentLimits()
      const initialComputation = initialLimits.computation.current
      
      // 고부하 상황 시뮬레이션
      yield* simulateHighSystemLoad({ cpu: 0.9, memory: 0.8 })
      yield* Effect.sleep(Duration.seconds(35)) // 조정 주기 대기
      
      const adjustedLimits = yield* throttler.getCurrentLimits()
      expect(adjustedLimits.computation.current).toBeLessThan(initialComputation)
      
      // 부하 정상화 후 복구 확인
      yield* simulateNormalLoad({ cpu: 0.3, memory: 0.4 })
      yield* Effect.sleep(Duration.seconds(70)) // 2주기 대기
      
      const recoveredLimits = yield* throttler.getCurrentLimits()
      expect(recoveredLimits.computation.current).toBeGreaterThan(adjustedLimits.computation.current)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.runPromise
    )
  )
  
  // 2.4.4 프로세스 재시작 시나리오 테스트
  it("should recover state after process restart", () =>
    Effect.gen(function* () {
      const persistence = yield* QueuePersistence
      const sessionId = yield* persistence.getCurrentSession()
      
      // 재시작 전 작업 추가
      const task = createTestTask("restart-test", "filesystem")
      yield* persistence.persistTask(task)
      
      // 프로세스 재시작 시뮬레이션 (새 세션 생성)
      yield* persistence.clearQueueForNewSession(generateSessionId())
      
      // 이전 세션 작업이 정리되었는지 확인
      const pendingTasks = yield* persistence.loadPendingTasks(sessionId)
      expect(pendingTasks).toHaveLength(0)
      
      // 새 세션에서 정상 동작 확인
      const newTask = createTestTask("new-session-test", "network")
      const queue = yield* InternalQueue
      yield* queue.enqueue(newTask)
      
      yield* Effect.sleep(Duration.millis(100))
      const monitor = yield* StabilityMonitor
      const health = yield* monitor.performHealthCheck()
      expect(health.isHealthy).toBe(true)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.runPromise
    )
  )
  
  // 2.4.5 동시성 스트레스 테스트
  it("should handle high concurrency without data corruption", () =>
    Effect.gen(function* () {
      const queue = yield* InternalQueue
      const monitor = yield* StabilityMonitor
      
      // 동시에 100개 작업 추가
      const tasks = Array.from({ length: 100 }, (_, i) => 
        createTestTask(`concurrent-${i}`, "filesystem")
      )
      
      yield* Effect.forEach(tasks, task => queue.enqueue(task), { 
        concurrency: "unbounded" 
      })
      
      // 모든 작업 완료 대기 (최대 30초)
      yield* Effect.repeatUntil(
        Effect.gen(function* () {
          const health = yield* monitor.getHealthMetrics()
          return health.queue.runningCount === 0 && health.queue.pendingCount === 0
        }),
        (completed) => completed,
        Schedule.spaced(Duration.seconds(1)).pipe(Schedule.upTo(Duration.seconds(30)))
      )
      
      // 시스템 안정성 확인
      const finalHealth = yield* monitor.performHealthCheck()
      expect(finalHealth.isHealthy).toBe(true)
    }).pipe(
      Effect.provide(StabilityTestLayer),
      Effect.runPromise
    )
  )
})
```

#### 완료 기준
- [ ] 1시간 연속 실행 시 메모리 증가 < 100MB
- [ ] Circuit Breaker 자동 복구 검증
- [ ] 적응형 스로틀링 부하 대응 검증
- [ ] 프로세스 재시작 후 정상 복구
- [ ] 고동시성 상황에서 데이터 무결성 보장

---

### 2.5 통합 Layer 완성 (Day 6-8)
**파일**: `src/services/Queue/index.ts` 업데이트  
**의존성**: Phase 1 + Phase 2 모든 구현체  
**우선순위**: Critical

#### 완전한 큐 시스템 Layer
```typescript
// Phase 2 완성 후 전체 시스템 Layer
export const CompleteQueueSystemLayer = Layer.mergeAll(
  // Phase 1: Foundation
  SchemaManagerLive,        // 스키마 관리
  QueuePersistenceLive,     // SQLite 지속성
  InternalQueueLive,        // Effect.js 큐
  QueueMonitorLive,         // 기본 모니터링
  
  // Phase 2: Stability  
  CircuitBreakerLive,       // 회로 차단기
  AdaptiveThrottlerLive,    // 적응형 스로틀링
  StabilityMonitorLive      // 안정성 모니터링
).pipe(
  Layer.provide(NodeContext.layer)
)

// 개발/테스트용 Layer
export const DevelopmentQueueLayer = Layer.mergeAll(
  SchemaManagerTest,
  QueuePersistenceTest,
  InternalQueueTest,
  CircuitBreakerTest,
  AdaptiveThrottlerTest,
  StabilityMonitorTest
)

// 프로덕션용 최적화 Layer
export const ProductionQueueLayer = CompleteQueueSystemLayer.pipe(
  Layer.orDie // 프로덕션에서는 초기화 실패 시 프로세스 종료
)
```

#### End-to-End 통합 테스트
```typescript
describe("Complete Queue System Integration", () => {
  it("should demonstrate full system capabilities", () =>
    Effect.gen(function* () {
      // Given: 완전한 큐 시스템
      const queue = yield* InternalQueue
      const monitor = yield* StabilityMonitor
      const breaker = yield* CircuitBreaker
      const throttler = yield* AdaptiveThrottler
      
      // When: 다양한 유형의 작업들을 처리
      const tasks = [
        createTestTask("file-operation", "filesystem"),
        createTestTask("api-call", "network"),
        createTestTask("data-processing", "computation"), 
        createTestTask("image-resize", "memory-intensive")
      ]
      
      yield* Effect.forEach(tasks, task => queue.enqueue(task))
      
      // 처리 완료까지 대기
      yield* Effect.repeatUntil(
        Effect.gen(function* () {
          const health = yield* monitor.getHealthMetrics()
          return health.queue.runningCount === 0 && health.queue.pendingCount === 0
        }),
        completed => completed,
        Schedule.spaced(Duration.seconds(1))
      )
      
      // Then: 시스템이 안정적으로 동작
      const health = yield* monitor.performHealthCheck()
      expect(health.isHealthy).toBe(true)
      
      const breakerState = yield* breaker.getState()
      expect(breakerState).toBe("closed")
      
      const systemLoad = yield* throttler.getSystemLoad()
      expect(systemLoad.cpu).toBeLessThan(0.8)
      expect(systemLoad.memory).toBeLessThan(0.8)
    }).pipe(
      Effect.provide(CompleteQueueSystemLayer),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
})
```

---

## 📊 Phase 2 완료 기준

### 기능적 요구사항
- [x] **Circuit Breaker**: 3-state 전환, 자동 복구, 임계값 기반 차단
- [x] **Adaptive Throttler**: ResourceGroup별 동시성 제어, 부하 기반 조정
- [ ] **Stability Monitor**: 15초 Heartbeat, 자동 복구 액션, Health Check

### 비기능적 요구사항
- [ ] **장기 안정성**: 24시간 연속 동작, 메모리 누수 < 100MB/hour
- [ ] **복원력**: 장애 상황에서 자동 복구, Circuit Breaker 30초 내 복구
- [ ] **적응성**: 시스템 부하 변화에 30초 내 임계값 조정

### 품질 기준
- [ ] **테스트 커버리지**: 단위 테스트 90%+, 통합 테스트 80%+
- [ ] **성능 기준**: Health Check < 100ms, 복구 액션 < 5초
- [ ] **모니터링**: 모든 상태 변화 로깅, 메트릭 수집 완료

## 🔄 Phase 3 준비사항

Phase 2 완료 후 Phase 3 CLI 통합을 위한 준비:
1. **Queue Command 인터페이스 설계**
2. **기존 명령어와의 투명한 통합 전략**
3. **사용자 경험 설계** (투명한 큐 적용)
4. **모니터링 UI 컴포넌트 설계**

---

**📅 마지막 업데이트**: 2025-01-12  
**👤 담당자**: Queue System Stability Team  
**📈 진행률**: 33% (Phase 2.1 완료, Phase 2.2-2.4 대기)  
**🎯 다음 단계**: Phase 2.2 Adaptive Throttler 구현 시작

## 🚀 Phase 2.1 완료 요약

**Circuit Breaker 구현 성과**:
- ✅ 완전한 3-state 패턴 구현 (Closed → Open → Half-Open → Closed)
- ✅ ResourceGroup별 독립적인 Circuit Breaker 관리 (filesystem, network, computation, memory-intensive)
- ✅ 설정 가능한 임계값 시스템 (5회 실패 → Open, 3회 성공 → Closed, 30초 타임아웃)
- ✅ Effect.js Ref 기반 동시성 안전 상태 관리
- ✅ 포괄적 테스트 스위트 (100% 통과율)
- ✅ StabilityQueueSystemLayer 완전 통합