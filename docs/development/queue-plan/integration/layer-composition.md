# Effect Layer Composition Strategy

> 🧩 **Service Layer 조립 및 의존성 관리 전략**

## 📋 개요

Effect.js Layer 시스템을 활용한 큐 시스템 서비스 조립 및 의존성 주입 전략을 정의합니다.

## 🏗️ Layer Architecture

### Core Service Layers
```typescript
// 기본 서비스 레이어들
const CoreLayers = {
  // 데이터 지속성
  Persistence: QueuePersistenceLive,
  
  // 내부 큐 엔진
  InternalQueue: InternalQueueLive,
  
  // 모니터링 시스템
  Monitor: QueueMonitorLive,
  
  // 안정성 시스템 (Phase 2+)
  CircuitBreaker: CircuitBreakerLive,
  AdaptiveThrottler: AdaptiveThrottlerLive,
  StabilityMonitor: StabilityMonitorLive
}
```

### Composition Strategies

#### Phase 1: Foundation Layer
```typescript
// src/services/Queue/layers/FoundationLayer.ts
export const FoundationQueueSystemLayer = Layer.mergeAll(
  QueuePersistenceLive,
  InternalQueueLive,
  QueueMonitorLive
).pipe(
  Layer.provide(QueueConfigLive),
  Layer.annotateLogs({ service: "queue-foundation" })
)
```

#### Phase 2: Stability Layer
```typescript
// src/services/Queue/layers/StabilityLayer.ts
export const StabilityQueueSystemLayer = Layer.mergeAll(
  FoundationQueueSystemLayer,
  CircuitBreakerLive,
  AdaptiveThrottlerLive
).pipe(
  Layer.provide(StabilityConfigLive),
  Layer.annotateLogs({ service: "queue-stability" })
)
```

#### Phase 3: Integration Layer
```typescript
// src/services/Queue/layers/IntegrationLayer.ts
export const IntegrationQueueSystemLayer = Layer.mergeAll(
  StabilityQueueSystemLayer,
  QueueCLICommandsLive,
  QueueMiddlewareLive
).pipe(
  Layer.provide(CLIConfigLive),
  Layer.annotateLogs({ service: "queue-integration" })
)
```

#### Phase 4: Production Layer
```typescript
// src/services/Queue/layers/ProductionLayer.ts
export const ProductionQueueSystemLayer = Layer.mergeAll(
  IntegrationQueueSystemLayer,
  PerformanceProfilerLive,
  BatchProcessorLive,
  MemoryOptimizerLive,
  PredictiveScalerLive
).pipe(
  Layer.provide(ProductionConfigLive),
  Layer.annotateLogs({ service: "queue-production" })
)
```

## 🔗 Dependency Graph

### Service Dependencies
```
QueueConfigLive
├── QueuePersistenceLive
├── InternalQueueLive
│   └── requires: QueuePersistence
├── QueueMonitorLive
│   └── requires: QueuePersistence, InternalQueue
├── CircuitBreakerLive
│   └── requires: QueueMonitor
├── AdaptiveThrottlerLive
│   └── requires: QueueMonitor
└── QueueCLICommandsLive
    └── requires: QueueService (all above)
```

### Resource Group Isolation
```typescript
// ResourceGroup별 독립적인 서비스 인스턴스
type ResourceGroupServices = {
  readonly [K in ResourceGroup]: {
    readonly queue: InternalQueue
    readonly circuitBreaker: CircuitBreaker
    readonly throttler: AdaptiveThrottler
    readonly monitor: QueueMonitor
  }
}
```

## 🎯 Configuration Management

### Layered Configuration
```typescript
// src/services/Queue/config/QueueConfigLive.ts
export interface QueueConfig {
  readonly persistence: {
    readonly dbPath: string
    readonly migrations: boolean
  }
  readonly queues: {
    readonly [K in ResourceGroup]: {
      readonly maxConcurrency: number
      readonly retryPolicy: RetryPolicy
    }
  }
  readonly monitoring: {
    readonly metricsInterval: Duration
    readonly logLevel: LogLevel
  }
  readonly stability: {
    readonly circuitBreaker: CircuitBreakerConfig
    readonly throttling: ThrottlingConfig
  }
}

export const QueueConfigLive = Layer.effect(
  QueueConfig,
  Effect.gen(function* () {
    const env = yield* Effect.service(Environment)
    return {
      persistence: {
        dbPath: env.get("QUEUE_DB_PATH") ?? "./queue.db",
        migrations: env.get("QUEUE_MIGRATIONS") === "true"
      },
      queues: {
        filesystem: { maxConcurrency: 5, retryPolicy: defaultRetry },
        network: { maxConcurrency: 10, retryPolicy: networkRetry },
        computation: { maxConcurrency: 3, retryPolicy: computeRetry },
        memory: { maxConcurrency: 2, retryPolicy: memoryRetry }
      },
      monitoring: {
        metricsInterval: Duration.seconds(10),
        logLevel: LogLevel.Info
      },
      stability: {
        circuitBreaker: defaultCircuitBreakerConfig,
        throttling: defaultThrottlingConfig
      }
    }
  })
)
```

### Environment-Specific Layers
```typescript
// Development Layer
export const DevelopmentQueueLayer = Layer.mergeAll(
  FoundationQueueSystemLayer,
  Layer.succeed(QueueConfig, developmentConfig),
  TestingUtilsLive
).pipe(
  Layer.annotateLogs({ environment: "development" })
)

// Testing Layer
export const TestingQueueLayer = Layer.mergeAll(
  FoundationQueueSystemLayer,
  Layer.succeed(QueueConfig, testingConfig),
  MockServicesLive
).pipe(
  Layer.annotateLogs({ environment: "testing" })
)

// Production Layer
export const ProductionQueueLayer = ProductionQueueSystemLayer.pipe(
  Layer.provide(Layer.succeed(QueueConfig, productionConfig)),
  Layer.annotateLogs({ environment: "production" })
)
```

## 🔄 Dynamic Layer Composition

### Runtime Layer Selection
```typescript
// src/services/Queue/layers/LayerSelector.ts
export const selectQueueLayer = (phase: "foundation" | "stability" | "integration" | "production") =>
  Effect.gen(function* () {
    switch (phase) {
      case "foundation":
        return FoundationQueueSystemLayer
      case "stability":
        return StabilityQueueSystemLayer
      case "integration":
        return IntegrationQueueSystemLayer
      case "production":
        return ProductionQueueSystemLayer
      default:
        return FoundationQueueSystemLayer
    }
  })
```

### Graceful Degradation Layers
```typescript
// 서비스 실패 시 대체 레이어
export const FallbackQueueLayer = Layer.fallback(
  ProductionQueueSystemLayer,
  StabilityQueueSystemLayer
).pipe(
  Layer.fallback(FoundationQueueSystemLayer),
  Layer.annotateLogs({ mode: "fallback" })
)
```

## 🧪 Testing Layer Composition

### Unit Test Layers
```typescript
// test/layers/UnitTestLayers.ts
export const UnitTestQueueLayer = Layer.mergeAll(
  MockQueuePersistenceLive,
  MockInternalQueueLive,
  MockQueueMonitorLive
).pipe(
  Layer.provide(Layer.succeed(QueueConfig, unitTestConfig))
)
```

### Integration Test Layers
```typescript
// test/layers/IntegrationTestLayers.ts
export const IntegrationTestQueueLayer = Layer.mergeAll(
  MemoryQueuePersistenceLive,  // 메모리 DB 사용
  InternalQueueLive,           // 실제 큐 엔진
  QueueMonitorLive            // 실제 모니터링
).pipe(
  Layer.provide(Layer.succeed(QueueConfig, integrationTestConfig))
)
```

### End-to-End Test Layers
```typescript
// test/layers/E2ETestLayers.ts
export const E2ETestQueueLayer = StabilityQueueSystemLayer.pipe(
  Layer.provide(Layer.succeed(QueueConfig, e2eTestConfig)),
  Layer.annotateLogs({ testing: "e2e" })
)
```

## 🎨 Layer Best Practices

### 1. Composition Principles
```typescript
// ✅ 좋은 예: 명확한 의존성과 계층화
const WellComposedLayer = Layer.mergeAll(
  // 하위 레벨 서비스
  PersistenceLayer,
  // 중간 레벨 서비스
  CoreLogicLayer.pipe(Layer.provide(PersistenceLayer)),
  // 상위 레벨 서비스
  APILayer.pipe(Layer.provide(CoreLogicLayer))
)

// ❌ 나쁜 예: 순환 의존성
const PoorlyComposedLayer = Layer.mergeAll(
  ServiceALayer.pipe(Layer.provide(ServiceBLayer)),
  ServiceBLayer.pipe(Layer.provide(ServiceALayer))  // 순환!
)
```

### 2. Resource Management
```typescript
// 리소스 정리를 위한 Scoped Layer
export const ScopedQueueLayer = Layer.scoped(
  QueueService,
  Effect.gen(function* () {
    const persistence = yield* QueuePersistence
    const queue = yield* Effect.acquireRelease(
      persistence.initialize,
      () => persistence.cleanup
    )
    return new QueueServiceLive(queue)
  })
)
```

### 3. Error Handling
```typescript
// 에러 처리가 포함된 안전한 레이어
export const SafeQueueLayer = Layer.catchAll(
  ProductionQueueSystemLayer,
  (error) => {
    console.error("Queue system initialization failed:", error)
    return FallbackQueueLayer
  }
)
```

## 📊 Layer Composition Metrics

### Initialization Performance
- **Cold Start Time**: < 100ms for Foundation Layer
- **Dependency Resolution**: < 50ms per service
- **Memory Overhead**: < 10MB for complete layer stack

### Runtime Performance
- **Service Resolution**: < 1ms per lookup
- **Configuration Updates**: Hot reload within 5s
- **Layer Switching**: < 500ms for graceful migration

## 🔧 CLI Integration

### Command Layer Injection
```typescript
// src/commands/queue/QueueCommand.ts
export const QueueCommand = Command.make("queue", {
  // 명령어별 필요한 레이어만 주입
  layer: IntegrationQueueSystemLayer,
  
  subcommands: [
    StatusCommand.pipe(Command.withLayer(MonitoringLayer)),
    StartCommand.pipe(Command.withLayer(StabilityQueueSystemLayer)),
    StopCommand.pipe(Command.withLayer(FoundationQueueSystemLayer))
  ]
})
```

### Middleware Layer Composition
```typescript
// CLI 미들웨어에 큐 시스템 투명하게 통합
export const QueueMiddleware = <R, E, A>(
  command: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | QueueService> =>
  Effect.gen(function* () {
    const queueService = yield* QueueService
    
    // 명령어를 큐를 통해 실행
    return yield* queueService.enqueue({
      type: "cli-command",
      execute: () => command
    })
  })
```

---

**📅 생성일**: 2025-01-12  
**👤 작성자**: Claude Code Task Manager  
**🔄 버전**: v1.0.0 - Layer Composition Strategy  
**📋 상태**: Phase 2+ 구현 가이드