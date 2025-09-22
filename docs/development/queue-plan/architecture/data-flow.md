# Data Flow Design

> 🌊 **큐 시스템 데이터 흐름 및 상태 전이 설계**

## 📋 개요

Effect CLI 큐 시스템 내에서의 데이터 흐름, 상태 전이, 그리고 이벤트 처리 패턴을 정의합니다.

## 🎯 데이터 흐름 원칙

### Core Flow Principles
- **Immutable State**: 모든 상태 변화는 불변성 보장
- **Event-Driven**: 이벤트 기반 상태 전이
- **Atomic Operations**: 원자적 데이터베이스 연산
- **Observability**: 모든 데이터 변화 추적 가능

### Flow Guarantees
- **Exactly-Once Processing**: 태스크 중복 처리 방지
- **Ordered Processing**: 우선순위 및 FIFO 순서 보장
- **Durability**: 프로세스 재시작 시 상태 복구
- **Consistency**: 분산 상황에서의 데이터 일관성

## 🔄 Primary Data Flows

### 1. Task Lifecycle Flow
```
Task Creation → Validation → Persistence → Queue Assignment → Processing → Completion
     ↓             ↓            ↓              ↓              ↓           ↓
Event: Created → Validated → Persisted → Queued → Started → Completed/Failed
     ↓             ↓            ↓              ↓              ↓           ↓
State: none → pending → pending → pending → running → completed/failed
```

#### Detailed Task Flow
```typescript
// 1. Task Enqueue Flow
interface TaskEnqueueFlow {
  readonly steps: readonly [
    "validate-input",           // Input validation and sanitization
    "assign-id",               // Generate unique task ID
    "determine-resource-group", // Route to appropriate resource group
    "set-priority",            // Calculate task priority
    "persist-task",            // Save to database
    "emit-enqueued-event",     // Notify monitoring systems
    "notify-processor",        // Wake up appropriate processor
    "return-task-id"           // Return acknowledgment
  ]
  
  readonly dataTransformation: {
    readonly input: TaskRequest
    readonly validated: ValidatedTaskRequest
    readonly withId: TaskWithId
    readonly withResourceGroup: TaskWithResourceGroup  
    readonly withPriority: TaskWithPriority
    readonly persisted: PersistedTask
    readonly output: TaskId
  }
}

// Flow Implementation
const enqueueFlow = (request: TaskRequest) =>
  Effect.gen(function* () {
    // 1. Validate input
    const validated = yield* validateTaskRequest(request)
    
    // 2. Assign ID and metadata
    const taskWithId = yield* assignTaskId(validated)
    
    // 3. Determine resource group
    const taskWithRG = yield* determineResourceGroup(taskWithId)
    
    // 4. Set priority
    const taskWithPriority = yield* calculatePriority(taskWithRG)
    
    // 5. Persist to database
    const persisted = yield* persistTask(taskWithPriority)
    
    // 6. Emit events
    yield* emitTaskEnqueuedEvent(persisted)
    
    // 7. Notify processor
    yield* notifyProcessor(persisted.resourceGroup)
    
    return persisted.id
  })
```

### 2. Task Processing Flow
```
Processor Poll → Acquire Task → Update State → Execute → Handle Result → Update State
      ↓              ↓             ↓           ↓          ↓              ↓
DB Query → Row Lock → running → Business Logic → Success/Error → completed/failed
      ↓              ↓             ↓           ↓          ↓              ↓
Monitor → Circuit Check → Throttle Check → Timeout → Retry Logic → Metrics Update
```

#### Detailed Processing Flow
```typescript
interface TaskProcessingFlow {
  readonly preProcessing: readonly [
    "poll-for-tasks",          // Query database for pending tasks
    "circuit-breaker-check",   // Check if circuit is open
    "throttle-check",          // Check if throttling active
    "acquire-task-lock",       // Acquire exclusive lock
    "update-to-running",       // Mark task as running
    "emit-started-event"       // Notify monitoring
  ]
  
  readonly processing: readonly [
    "load-task-data",          // Deserialize task data
    "create-execution-context", // Setup execution environment
    "execute-business-logic",   // Run actual task
    "handle-execution-result",  // Process success/failure
    "cleanup-resources"        // Clean up execution context
  ]
  
  readonly postProcessing: readonly [
    "update-final-state",      // Mark as completed/failed
    "release-task-lock",       // Release database lock
    "update-metrics",          // Record performance metrics
    "emit-completion-event",   // Notify completion
    "handle-retry-logic",      // Schedule retry if needed
    "cleanup-completed-task"   // Archive or clean up
  ]
}

// Processing Implementation
const processTask = (task: QueueTask) =>
  Effect.gen(function* () {
    // Pre-processing checks
    yield* checkCircuitBreaker(task.resourceGroup)
    yield* checkThrottling(task.resourceGroup)
    
    // Acquire exclusive processing rights
    const lockAcquired = yield* acquireTaskLock(task.id)
    if (!lockAcquired) {
      return { skipped: true, reason: "already-processing" }
    }
    
    try {
      // Update state to running
      yield* updateTaskStatus(task.id, "running")
      yield* emitTaskStartedEvent(task)
      
      // Execute business logic
      const startTime = Date.now()
      const result = yield* executeTaskLogic(task)
      const duration = Date.now() - startTime
      
      // Handle successful completion
      yield* updateTaskStatus(task.id, "completed")
      yield* recordTaskResult(task.id, result)
      yield* updateMetrics(task.resourceGroup, { success: true, duration })
      yield* emitTaskCompletedEvent(task, result)
      
      return { success: true, result, duration }
      
    } catch (error) {
      // Handle failure
      yield* handleTaskFailure(task, error)
      return { success: false, error }
      
    } finally {
      // Always release lock
      yield* releaseTaskLock(task.id)
    }
  })
```

### 3. Monitoring Data Flow
```
Task Events → Metrics Collector → Aggregation → Storage → Dashboard/Alerts
     ↓              ↓               ↓          ↓           ↓
Event Bus → Buffer/Batch → Calculate Stats → DB/Memory → UI/Notifications
     ↓              ↓               ↓          ↓           ↓
Real-time → Windowed Aggregation → Historical Data → Reports/Analysis
```

#### Monitoring Flow Implementation
```typescript
interface MonitoringFlow {
  readonly collection: readonly [
    "capture-task-events",     // Listen to task lifecycle events
    "capture-system-metrics",  // Collect system performance metrics
    "capture-resource-usage",  // Monitor CPU, memory, disk usage
    "buffer-metrics",          // Batch metrics for efficiency
    "timestamp-metrics"        // Add timing information
  ]
  
  readonly aggregation: readonly [
    "calculate-throughput",    // Tasks per second calculations
    "calculate-latency-percentiles", // P50, P95, P99 latencies
    "calculate-error-rates",   // Success/failure ratios
    "calculate-queue-depths",  // Current queue sizes
    "calculate-resource-utilization" // Resource usage percentages
  ]
  
  readonly storage: readonly [
    "persist-raw-metrics",     // Store detailed metrics
    "persist-aggregated-stats", // Store calculated statistics
    "maintain-retention-policy", // Clean up old data
    "index-for-queries",       // Optimize for dashboard queries
    "backup-critical-metrics"  // Ensure data durability
  ]
}

// Monitoring Implementation
const monitoringFlow = Effect.gen(function* () {
  // Set up event listeners
  yield* setupTaskEventListeners()
  yield* setupSystemMetricsCollection()
  
  // Start aggregation pipeline
  yield* startMetricsAggregation()
  
  // Set up storage pipeline
  yield* startMetricsStorage()
})

const setupTaskEventListeners = Effect.gen(function* () {
  const eventBus = yield* SystemEventBus
  
  // Listen to all task events
  yield* eventBus.subscribe("task.*", (event) =>
    Effect.gen(function* () {
      const metrics = yield* MetricsCollector
      yield* metrics.recordTaskEvent(event)
    })
  )
})
```

## 🔄 State Transition Diagrams

### Task State Machine
```
                [Created]
                    ↓
              [Validation]
               ↓         ↓
         [Validated]  [Invalid] → [Rejected]
              ↓
          [Pending]
              ↓
         [Acquired] ← (retry loop)
              ↓           ↑
          [Running] → [Failed] 
              ↓           ↓
         [Completed]  [Retry?]
              ↓        ↓    ↓
          [Archived] [Yes] [No] → [Dead Letter]
```

#### State Transition Rules
```typescript
interface TaskStateRules {
  readonly transitions: {
    readonly none: readonly ["pending"]
    readonly pending: readonly ["running", "cancelled"]
    readonly running: readonly ["completed", "failed"]  
    readonly completed: readonly ["archived"]
    readonly failed: readonly ["pending", "dead-letter"] // retry or give up
    readonly cancelled: readonly ["archived"]
    readonly archived: readonly [] // terminal state
    readonly "dead-letter": readonly [] // terminal state
  }
  
  readonly guards: {
    readonly "pending → running": "circuit-open-check & throttle-check & lock-acquired"
    readonly "failed → pending": "retry-attempts < max-attempts & retry-delay-elapsed"
    readonly "failed → dead-letter": "retry-attempts >= max-attempts"
  }
}
```

### Circuit Breaker State Machine
```
    [Closed] ←─────────── success ←─────────── [Half-Open]
       ↓                                         ↑
    failure                                   timeout
   threshold                                    ↓
   exceeded                              [Open] ─────→ wait
       ↓                                  ↑
    [Open] ─────────→ timeout ─────────→ [Half-Open]
```

#### Circuit Breaker Flow
```typescript
const circuitBreakerFlow = (resourceGroup: ResourceGroup) =>
  Effect.gen(function* () {
    const cb = yield* CircuitBreaker
    const state = yield* cb.getState(resourceGroup)
    
    switch (state) {
      case "CLOSED":
        // Normal processing - monitor for failures
        return yield* normalProcessing(resourceGroup)
        
      case "OPEN":
        // Reject immediately - check if recovery time elapsed
        const shouldTransition = yield* cb.shouldTransitionToHalfOpen(resourceGroup)
        if (shouldTransition) {
          yield* cb.transitionTo(resourceGroup, "HALF_OPEN")
        }
        return yield* Effect.fail(new CircuitOpenError(resourceGroup))
        
      case "HALF_OPEN":
        // Allow limited requests - transition based on results
        const result = yield* limitedProcessing(resourceGroup)
        if (result.success) {
          yield* cb.transitionTo(resourceGroup, "CLOSED")
        } else {
          yield* cb.transitionTo(resourceGroup, "OPEN")
        }
        return result
    }
  })
```

## 📊 Data Storage Patterns

### Database Schema Flow
```typescript
interface DatabaseSchemaEvolution {
  readonly tables: {
    readonly tasks: {
      readonly version: 1
      readonly columns: readonly [
        "id", "type", "resource_group", "data", "status",
        "created_at", "updated_at", "attempts", "priority"
      ]
    }
    
    readonly task_results: {
      readonly version: 1
      readonly columns: readonly [
        "task_id", "result_data", "execution_time", "created_at"
      ]
    }
    
    readonly metrics: {
      readonly version: 1
      readonly columns: readonly [
        "id", "timestamp", "resource_group", "metric_type", 
        "value", "metadata"
      ]
    }
    
    readonly circuit_breaker_state: {
      readonly version: 1
      readonly columns: readonly [
        "resource_group", "state", "failure_count", "last_failure",
        "next_attempt", "updated_at"
      ]
    }
  }
  
  readonly indexes: readonly [
    "idx_tasks_status_priority", // For queue queries
    "idx_tasks_resource_group_status", // For processor queries
    "idx_metrics_timestamp", // For time-series queries
    "idx_circuit_breaker_resource_group" // For circuit breaker lookups
  ]
}
```

### Query Patterns
```typescript
interface OptimizedQueries {
  // High-frequency queries (optimized for performance)
  readonly getNextTask: (resourceGroup: ResourceGroup) => Effect.Effect<QueueTask | null>
  readonly updateTaskStatus: (taskId: TaskId, status: TaskStatus) => Effect.Effect<void>
  readonly getQueueDepth: (resourceGroup: ResourceGroup) => Effect.Effect<number>
  
  // Medium-frequency queries (balanced performance/flexibility)
  readonly getTasksByStatus: (status: TaskStatus, limit: number) => Effect.Effect<QueueTask[]>
  readonly getTaskHistory: (taskId: TaskId) => Effect.Effect<TaskHistoryEntry[]>
  readonly getMetricsSummary: (timeRange: TimeRange) => Effect.Effect<MetricsSummary>
  
  // Low-frequency queries (optimized for data completeness)
  readonly getDetailedReport: (filters: ReportFilters) => Effect.Effect<DetailedReport>
  readonly exportTaskData: (criteria: ExportCriteria) => Stream.Stream<TaskExportData>
  readonly getSystemHealthReport: Effect.Effect<SystemHealthReport>
}
```

## 🌊 Stream Processing Patterns

### Event Streaming Architecture
```typescript
interface EventStreamArchitecture {
  readonly producers: {
    readonly taskEvents: Stream.Stream<TaskEvent>
    readonly systemMetrics: Stream.Stream<SystemMetric>
    readonly circuitBreakerEvents: Stream.Stream<CircuitBreakerEvent>
    readonly userCommands: Stream.Stream<UserCommand>
  }
  
  readonly processors: {
    readonly metricsAggregator: Stream.Stream<MetricsBatch>
    readonly alertProcessor: Stream.Stream<Alert>
    readonly performanceAnalyzer: Stream.Stream<PerformanceInsight>
    readonly anomalyDetector: Stream.Stream<Anomaly>
  }
  
  readonly consumers: {
    readonly dashboard: Stream.Stream<DashboardUpdate>
    readonly notifications: Stream.Stream<Notification>
    readonly storage: Stream.Stream<StorageOperation>
    readonly externalSystems: Stream.Stream<ExternalEvent>
  }
}

// Stream Processing Implementation
const metricsProcessingPipeline = 
  taskEventStream
    .pipe(
      Stream.buffer({ size: 100, duration: Duration.seconds(1) }), // Batch events
      Stream.map(calculateMetrics), // Aggregate metrics
      Stream.filter(metricsFilter), // Filter relevant metrics
      Stream.mapEffect(persistMetrics), // Store in database
      Stream.mapEffect(emitDashboardUpdate), // Update real-time dashboard
      Stream.drain // Consume the stream
    )
```

## 🔧 Error Handling Flow

### Error Propagation Patterns
```typescript
interface ErrorHandlingFlow {
  readonly errorTypes: {
    readonly ValidationError: "fail-fast" // Immediate rejection
    readonly NetworkError: "retry-with-backoff" // Exponential backoff
    readonly DatabaseError: "circuit-breaker" // Circuit breaker protection
    readonly BusinessLogicError: "custom-handling" // Domain-specific handling
    readonly SystemError: "escalate" // Alert and escalate
  }
  
  readonly errorRecovery: {
    readonly taskLevel: "retry-with-limits"
    readonly resourceGroupLevel: "circuit-breaker"
    readonly systemLevel: "graceful-degradation"
    readonly dataLevel: "consistency-checks"
  }
}

// Error handling implementation
const handleTaskError = (task: QueueTask, error: TaskError) =>
  Effect.gen(function* () {
    // Classify error
    const errorType = yield* classifyError(error)
    
    switch (errorType) {
      case "ValidationError":
        yield* markTaskAsFailed(task.id, error)
        yield* emitTaskFailedEvent(task, error)
        break
        
      case "NetworkError":
        if (task.attempts < task.maxAttempts) {
          yield* scheduleTaskRetry(task, calculateBackoffDelay(task.attempts))
        } else {
          yield* moveToDeadLetter(task, error)
        }
        break
        
      case "DatabaseError":
        yield* recordCircuitBreakerFailure(task.resourceGroup)
        yield* scheduleTaskRetry(task, Duration.seconds(60))
        break
        
      default:
        yield* escalateError(task, error)
    }
    
    // Always update metrics
    yield* updateErrorMetrics(task.resourceGroup, errorType)
  })
```

## 📈 Performance Optimization Flows

### Batch Processing Flow
```typescript
interface BatchProcessingFlow {
  readonly collection: readonly [
    "gather-similar-tasks",    // Group by resource group and type
    "validate-batch-size",     // Ensure optimal batch size
    "prepare-batch-context",   // Set up shared execution context
    "execute-batch",           // Process all tasks together
    "distribute-results",      // Map results back to individual tasks
    "update-batch-metrics"     // Record batch performance
  ]
}

const batchProcessingPipeline = (resourceGroup: ResourceGroup) =>
  Effect.gen(function* () {
    // Collect tasks for batching
    const tasks = yield* gatherBatchableTasks(resourceGroup, 50)
    
    if (tasks.length === 0) {
      return []
    }
    
    // Execute as batch
    const batchResult = yield* executeBatch(tasks)
    
    // Distribute results
    const individualResults = yield* distributeBatchResults(tasks, batchResult)
    
    // Update metrics
    yield* updateBatchMetrics(resourceGroup, {
      batchSize: tasks.length,
      processingTime: batchResult.duration,
      successRate: batchResult.successRate
    })
    
    return individualResults
  })
```

---

**📅 생성일**: 2025-01-12  
**👤 작성자**: Claude Code Task Manager  
**🔄 버전**: v1.0.0 - Data Flow Design  
**📋 상태**: 전체 Phase 데이터 흐름 가이드