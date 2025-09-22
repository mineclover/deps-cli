# Queue System API Reference

Quick reference for the Effect CLI Queue System API.

## Core Functions

### Initialization
```typescript
QueueSystem.initialize(sessionId?: string): Effect<string>
QueueSystem.shutdown(): Effect<void>
```

### Task Operations
```typescript
queueFileOperation<A, E>(
  operation: Effect<A, E>,
  options: FileOperationOptions
): Effect<string>

queueNetworkOperation<A, E>(
  operation: Effect<A, E>, 
  options: NetworkOperationOptions
): Effect<string>

queueComputationTask<A, E>(
  operation: Effect<A, E>,
  options: ComputationTaskOptions  
): Effect<string>
```

### System Control
```typescript
QueueSystem.getStatus(): Effect<QueueStatus>
QueueSystem.checkHealth(): Effect<HealthStatus>
QueueSystem.getSystemHealth(): Effect<SystemHealthStatus>
QueueSystem.pauseAll(): Effect<void>
QueueSystem.resumeAll(): Effect<void>
QueueSystem.waitForTask(taskId: string, timeout?: number): Effect<Option<QueueTask>>
QueueSystem.exportMetrics(format?: "json" | "csv", sessionId?: string): Effect<string>
```

## Options Interfaces

### FileOperationOptions
```typescript
interface FileOperationOptions {
  type: "file-read" | "file-write" | "directory-list" | "find-files"
  filePath?: string
  priority?: number      // 1-10, default: 5
  maxRetries?: number    // default: 3
  estimatedDuration?: Duration.Duration
}
```

### NetworkOperationOptions
```typescript
interface NetworkOperationOptions {
  priority?: number      // 1-10, default: 5
  maxRetries?: number    // default: 3
  estimatedDuration?: Duration.Duration
  url?: string
}
```

### ComputationTaskOptions
```typescript
interface ComputationTaskOptions {
  priority?: number      // 1-10, default: 5
  maxRetries?: number    // default: 3  
  estimatedDuration?: Duration.Duration
  isMemoryIntensive?: boolean
}
```

## Status Interfaces

### QueueStatus
```typescript
interface QueueStatus {
  queues: Record<ResourceGroup, {
    size: number
    isProcessing: boolean
    lastProcessed: Option<Date>
  }>
  totalPending: number
  totalRunning: number
  processingFibers: Array<Fiber.RuntimeFiber<never, never>>
}
```

### QueueMetrics
```typescript
interface QueueMetrics {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  averageExecutionTime: number
  successRate: number
}
```

## Layers

### Production Layers
```typescript
QueueSystem.Layer              // Full system (recommended)
QueueSystem.CLIIntegratedLayer  // With transparent adapter
QueueSystem.StabilityLayer      // Phase 1 + Phase 2
QueueSystem.BasicLayer          // Phase 1 only
QueueSystem.TestLayer           // For testing
```

## Advanced Services

### PerformanceProfiler
```typescript
interface PerformanceProfiler {
  startProfiling(operationId: string, type: OperationType): Effect<ProfilingSession>
  completeProfile(sessionId: string): Effect<PerformanceMetrics>
  getActiveProfiles(): Effect<ProfilingSession[]>
}
```

### MemoryOptimizer  
```typescript
interface MemoryOptimizer {
  getCurrentMemoryUsage(): Effect<MemoryUsage>
  performMemoryCleanup(): Effect<void>
  detectMemoryLeaks(): Effect<boolean>
  optimizeMemoryUsage(): Effect<MemoryOptimizationResult>
}
```

### AdvancedCache
```typescript
interface AdvancedCache {
  get<T>(key: string, fallback?: () => Effect<T>): Effect<T>
  set<T>(key: string, value: T, ttl?: Duration.Duration): Effect<void>
  invalidate(key: string): Effect<void>
  clear(): Effect<void>
}
```

### CircuitBreaker
```typescript
interface CircuitBreaker {
  getState(resourceGroup: ResourceGroup): Effect<CircuitBreakerState>
  recordSuccess(resourceGroup: ResourceGroup): Effect<void>
  recordFailure(resourceGroup: ResourceGroup): Effect<void>
  forceOpen(resourceGroup: ResourceGroup): Effect<void>
  forceClose(resourceGroup: ResourceGroup): Effect<void>
}
```

### AdaptiveThrottler
```typescript
interface AdaptiveThrottler {
  getCurrentLimits(): Effect<ThrottleLimits>
  adjustLimits(resourceGroup: ResourceGroup, factor: number): Effect<void>
  resetToDefaults(): Effect<void>
}
```

### StabilityMonitor
```typescript
interface StabilityMonitor {
  performHealthCheck(): Effect<HealthCheckResult>
  getHeartbeat(): Effect<HeartbeatState>
  getHealthMetrics(): Effect<HealthMetrics>
}
```

### TransparentQueueAdapter
```typescript
interface TransparentQueueAdapter {
  wrapFileSystem(): QueuedFileSystemOperations
  wrapNetworkOperations(): QueuedNetworkOperations
  wrapComputationOperations(): QueuedComputationOperations
  determineResourceGroup(operationType: string, estimatedDuration: number): ResourceGroup
}
```

## Resource Groups

```typescript
type ResourceGroup = 
  | "filesystem"        // File I/O operations
  | "network"          // HTTP requests, downloads
  | "computation"      // CPU-intensive processing  
  | "memory-intensive" // Large data operations
```

## Quick Examples

### Basic Usage
```typescript
const program = Effect.gen(function*() {
  yield* QueueSystem.initialize()
  const taskId = yield* queueFileOperation(
    Effect.succeed("file content"),
    { type: "file-read", filePath: "/config.json" }
  )
  yield* QueueSystem.shutdown()
}).pipe(Effect.provide(QueueSystem.Layer))
```

### With Error Handling
```typescript
const program = Effect.gen(function*() {
  yield* QueueSystem.initialize()
  const taskId = yield* queueNetworkOperation(
    fetchData.pipe(
      Effect.retry(Schedule.exponentialBackoff(Duration.millis(100))),
      Effect.timeout(Duration.seconds(30))
    ),
    { url: "https://api.example.com", maxRetries: 5 }
  )
  yield* QueueSystem.shutdown()
}).pipe(
  Effect.provide(QueueSystem.Layer),
  Effect.catchAll(error => Effect.log(`Error: ${error}`))
)
```

### Transparent Integration
```typescript
const program = Effect.gen(function*() {
  const adapter = yield* TransparentQueueAdapter
  const fileOps = adapter.wrapFileSystem()
  
  // Automatically queued operations
  const content = yield* fileOps.readFile("/config.json")
  const files = yield* fileOps.listDirectory("/src")
}).pipe(Effect.provide(QueueSystem.CLIIntegratedLayer))
```