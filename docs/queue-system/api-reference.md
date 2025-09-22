# Queue System API Reference

Complete API documentation for the Effect CLI Queue System.

## Core Queue System

### QueueSystem

Main queue system interface providing high-level operations.

```typescript
const QueueSystem: {
  Layer: Layer<QueueSystem>
  BasicLayer: Layer<QueueSystem> 
  TestLayer: Layer<QueueSystem>
  
  initialize: (sessionId?: string) => Effect<string>
  shutdown: () => Effect<void>
  
  queueFileOperation: <A, E>(operation: Effect<A, E>, options: FileOperationOptions) => Effect<string>
  queueNetworkOperation: <A, E>(operation: Effect<A, E>, options: NetworkOperationOptions) => Effect<string>
  queueComputationTask: <A, E>(operation: Effect<A, E>, options: ComputationOptions) => Effect<string>
  
  getStatus: () => Effect<QueueStatus>
  checkHealth: () => Effect<HealthStatus>
  getSystemHealth: () => Effect<SystemHealth>
  exportMetrics: (format: "json" | "csv", sessionId?: string) => Effect<string>
  
  pauseAll: () => Effect<void>
  resumeAll: () => Effect<void>  
  waitForTask: (taskId: string, timeoutMs?: number) => Effect<Option<Task>>
}
```

#### Methods

##### `initialize(sessionId?: string): Effect<string>`

Initialize the queue system for a new session.

- **sessionId**: Optional session identifier. If not provided, generates a new one.
- **Returns**: The session identifier for the initialized system.

```typescript
const sessionId = yield* QueueSystem.initialize()
console.log(`Queue system ready: ${sessionId}`)
```

##### `shutdown(): Effect<void>`

Gracefully shutdown the queue system, completing active tasks and closing connections.

```typescript
yield* QueueSystem.shutdown()
```

##### `getStatus(): Effect<QueueStatus>`

Get current queue system status and metrics.

```typescript
const status = yield* QueueSystem.getStatus()
console.log("Active processors:", status.queue.processingFibers.length)
console.log("Queue lengths:", status.queue.queueLengths)
```

##### `checkHealth(): Effect<HealthStatus>`

Perform basic health check of the queue system.

```typescript
const health = yield* QueueSystem.checkHealth()
if (!health.healthy) {
  console.warn("Queue system issues detected")
}
```

### Queue Operation Functions

#### `queueFileOperation<A, E>(operation, options): Effect<string>`

Queue a file system operation.

**Parameters:**
- `operation`: Effect representing the file operation
- `options`: FileOperationOptions

```typescript
interface FileOperationOptions {
  type: "file-read" | "file-write" | "directory-list" | "find-files"
  filePath?: string
  priority?: number        // 1-5, default: 5
  maxRetries?: number      // default: 3
  estimatedDuration?: Duration
}
```

**Example:**
```typescript
const taskId = yield* queueFileOperation(
  fileSystem.readFile("./config.json"),
  {
    type: "file-read",
    filePath: "./config.json",
    priority: 1,
    maxRetries: 3,
    estimatedDuration: Duration.seconds(10)
  }
)
```

#### `queueNetworkOperation<A, E>(operation, options): Effect<string>`

Queue a network operation.

**Parameters:**
- `operation`: Effect representing the network operation  
- `options`: NetworkOperationOptions

```typescript
interface NetworkOperationOptions {
  priority?: number        // 1-5, default: 5
  maxRetries?: number      // default: 3
  estimatedDuration?: Duration
  url?: string
}
```

**Example:**
```typescript
const taskId = yield* queueNetworkOperation(
  fetch("https://api.example.com/data"),
  {
    priority: 2,
    url: "https://api.example.com/data",
    maxRetries: 5,
    estimatedDuration: Duration.seconds(30)
  }
)
```

#### `queueComputationTask<A, E>(operation, options): Effect<string>`

Queue a computational task.

**Parameters:**
- `operation`: Effect representing the computation
- `options`: ComputationOptions

```typescript
interface ComputationOptions {
  priority?: number        // 1-5, default: 5
  maxRetries?: number      // default: 3  
  estimatedDuration?: Duration
  isMemoryIntensive?: boolean
}
```

**Example:**
```typescript
const taskId = yield* queueComputationTask(
  processLargeDataset(data),
  {
    priority: 1,
    isMemoryIntensive: true,
    maxRetries: 2,
    estimatedDuration: Duration.minutes(5)
  }
)
```

## Performance Profiler

### PerformanceProfiler Service

Provides detailed performance profiling and bottleneck analysis.

```typescript
interface PerformanceProfiler {
  startProfiling: (operationId: string, operationType: OperationType, resourceGroup: ResourceGroup) => Effect<ProfilingSession>
  endProfiling: (session: ProfilingSession, success: boolean, errorType?: string) => Effect<OperationMetrics>
  getPerformanceStats: (timeWindow?: Duration) => Effect<PerformanceStats>
  analyzeBottlenecks: () => Effect<ReadonlyArray<BottleneckAnalysis>>
  getResourceUtilization: () => Effect<ReadonlyArray<ResourceUtilization>>
  exportProfilingData: (format: "json" | "csv") => Effect<string>
  clearProfilingData: (olderThan?: Duration) => Effect<number>
}
```

#### Types

##### `ProfilingSession`

```typescript
interface ProfilingSession {
  readonly operationId: string
  readonly operationType: OperationType
  readonly resourceGroup: ResourceGroup
  readonly startTime: number
  readonly startMemory: number
  readonly startCpu: number
  readonly queueEntryTime: number
}
```

##### `OperationMetrics`

```typescript
interface OperationMetrics {
  readonly operationId: string
  readonly operationType: OperationType
  readonly resourceGroup: ResourceGroup
  readonly startTime: number
  readonly endTime: number
  readonly duration: number
  readonly memoryBefore: number
  readonly memoryAfter: number
  readonly memoryDelta: number
  readonly cpuBefore: number
  readonly cpuAfter: number
  readonly cpuDelta: number
  readonly queueWaitTime: number
  readonly success: boolean
  readonly errorType?: string
}
```

##### `PerformanceStats`

```typescript
interface PerformanceStats {
  readonly totalOperations: number
  readonly avgDuration: number
  readonly p50Duration: number
  readonly p95Duration: number
  readonly p99Duration: number
  readonly throughput: number    // operations per second
  readonly errorRate: number
  readonly memoryEfficiency: number
  readonly cpuUtilization: number
  readonly bottleneckPoints: ReadonlyArray<BottleneckAnalysis>
}
```

##### `BottleneckAnalysis`

```typescript
interface BottleneckAnalysis {
  readonly type: "memory" | "cpu" | "io" | "concurrency" | "queue"
  readonly severity: "low" | "medium" | "high" | "critical"
  readonly description: string
  readonly impact: number      // 0-100 scale
  readonly recommendations: ReadonlyArray<string>
  readonly affectedOperations: ReadonlyArray<string>
}
```

##### `ResourceUtilization`

```typescript
interface ResourceUtilization {
  readonly resourceGroup: ResourceGroup
  readonly concurrentOperations: number
  readonly maxConcurrency: number
  readonly utilizationPercentage: number
  readonly avgWaitTime: number
  readonly throughput: number
  readonly bottleneckScore: number
}
```

#### Methods

##### `startProfiling(operationId, operationType, resourceGroup): Effect<ProfilingSession>`

Start profiling an operation.

**Parameters:**
- `operationId`: Unique identifier for the operation
- `operationType`: Type of operation being profiled
- `resourceGroup`: Resource group the operation belongs to

```typescript
const session = yield* profiler.startProfiling(
  "data-processing-batch-1",
  "batch-operation", 
  "computation"
)
```

##### `endProfiling(session, success, errorType?): Effect<OperationMetrics>`

End profiling session and get metrics.

**Parameters:**
- `session`: ProfilingSession from startProfiling
- `success`: Whether the operation succeeded
- `errorType`: Optional error type if operation failed

```typescript
const metrics = yield* profiler.endProfiling(session, true)
console.log(`Operation took ${metrics.duration}ms`)
```

##### `getPerformanceStats(timeWindow?): Effect<PerformanceStats>`

Get aggregated performance statistics.

**Parameters:**
- `timeWindow`: Optional time window to analyze (defaults to all data)

```typescript
const stats = yield* profiler.getPerformanceStats(Duration.hours(1))
console.log(`Throughput: ${stats.throughput} ops/sec`)
console.log(`Error rate: ${(stats.errorRate * 100).toFixed(1)}%`)
```

##### `analyzeBottlenecks(): Effect<ReadonlyArray<BottleneckAnalysis>>`

Analyze performance bottlenecks and get recommendations.

```typescript
const bottlenecks = yield* profiler.analyzeBottlenecks()
bottlenecks.forEach(issue => {
  console.log(`${issue.type}: ${issue.description}`)
  console.log(`Recommendations:`, issue.recommendations)
})
```

##### `getResourceUtilization(): Effect<ReadonlyArray<ResourceUtilization>>`

Get resource utilization metrics for all resource groups.

```typescript
const utilization = yield* profiler.getResourceUtilization()
utilization.forEach(resource => {
  console.log(`${resource.resourceGroup}: ${resource.utilizationPercentage}% utilized`)
})
```

##### `exportProfilingData(format): Effect<string>`

Export profiling data in specified format.

**Parameters:**
- `format`: "json" | "csv"

```typescript
const jsonData = yield* profiler.exportProfilingData("json")
yield* fileSystem.writeFile("./metrics.json", jsonData)

const csvData = yield* profiler.exportProfilingData("csv") 
yield* fileSystem.writeFile("./metrics.csv", csvData)
```

##### `clearProfilingData(olderThan?): Effect<number>`

Clear old profiling data.

**Parameters:**
- `olderThan`: Optional duration to keep data (defaults to clearing all)
- **Returns**: Number of records cleared

```typescript
// Clear data older than 24 hours
const cleared = yield* profiler.clearProfilingData(Duration.hours(24))
console.log(`Cleared ${cleared} old profiling records`)
```

## Memory Optimizer

### MemoryOptimizer Service

Provides memory optimization and garbage collection management.

```typescript
interface MemoryOptimizer {
  // Memory optimization methods would be defined here
  // This service provides automatic memory management
}
```

The MemoryOptimizer service works automatically in the background when provided as a layer. It monitors memory usage and triggers optimization when needed.

**Usage:**
```typescript
const memoryLayer = BasicQueueSystemLayer.pipe(
  Effect.provide(MemoryOptimizerLive)
)
```

## Advanced Cache

### AdvancedCache Service

Provides multi-tier caching for queue operations.

```typescript
interface AdvancedCache {
  // Advanced caching methods would be defined here
  // This service provides automatic caching optimization
}
```

The AdvancedCache service works automatically in the background when provided as a layer. It caches frequently accessed data and optimizes cache hit rates.

**Usage:**
```typescript
const cacheLayer = BasicQueueSystemLayer.pipe(
  Effect.provide(AdvancedCacheLive)
)
```

## Types and Enums

### OperationType

```typescript
type OperationType = 
  | "file-read"
  | "file-write" 
  | "directory-list"
  | "find-files"
  | "network-request"
  | "computation"
  | "data-processing"
  | "batch-operation"
  | "file-processing"
```

### ResourceGroup

```typescript
type ResourceGroup = 
  | "filesystem"
  | "network"
  | "computation" 
  | "memory-intensive"
```

### QueueStatus

```typescript
interface QueueStatus {
  queue: {
    processingFibers: ReadonlyArray<unknown>
    queueLengths: Record<ResourceGroup, number>
  }
  metrics: {
    isHealthy: boolean
    // Additional metrics fields
  }
}
```

### HealthStatus

```typescript
interface HealthStatus {
  healthy: boolean
  status: {
    processingFibers: ReadonlyArray<unknown>
    database?: {
      connected: boolean
    }
  }
  metrics: unknown
  heartbeat: Option<{
    memoryLeakDetected: boolean
    circuitBreakerOpen: boolean
  }>
}
```

### SystemHealth

```typescript
interface SystemHealth {
  isHealthy: boolean
  metrics: unknown
  heartbeat: unknown
  timestamp: Date
}
```

## Layer Composition

### Available Layers

#### `BasicQueueSystemLayer`

Provides core queue functionality without advanced features.

```typescript
const program = Effect.gen(function*() {
  // Basic queue operations
}).pipe(Effect.provide(BasicQueueSystemLayer))
```

#### `StabilityQueueSystemLayer`

Includes basic functionality plus stability features (circuit breaker, throttling, monitoring).

```typescript
const program = Effect.gen(function*() {
  // Queue operations with stability features
}).pipe(Effect.provide(StabilityQueueSystemLayer))
```

#### Custom Layer Composition

```typescript
// Full system with all optimizations
const fullSystemLayer = Layer.mergeAll(
  StabilityQueueSystemLayer,
  PerformanceProfilerLive,
  MemoryOptimizerLive,
  AdvancedCacheLive
)

// Performance monitoring only
const performanceLayer = BasicQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive)
)

// Memory optimization only  
const memoryLayer = BasicQueueSystemLayer.pipe(
  Effect.provide(MemoryOptimizerLive)
)
```

## Error Handling

### Common Error Types

Operations may fail with various error types:

- **NetworkError**: Network-related failures
- **FileSystemError**: File operation failures  
- **TimeoutError**: Operation timeout
- **CircuitBreakerError**: Circuit breaker open
- **QueueOverloadError**: Queue capacity exceeded

### Error Recovery

```typescript
const robustOperation = Effect.gen(function*() {
  try {
    const taskId = yield* queueNetworkOperation(riskyOperation(), {
      maxRetries: 3,
      priority: 2
    })
    
    return yield* QueueSystem.waitForTask(taskId, 30000)
  } catch (error) {
    if (error instanceof TimeoutError) {
      // Handle timeout specifically
      console.log("Operation timed out, retrying with higher priority")
      return yield* queueNetworkOperation(riskyOperation(), {
        priority: 1,
        maxRetries: 1
      })
    }
    
    throw error
  }
})
```

## Testing

### Test Utilities

```typescript
// Use test layer for unit tests
const testProgram = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  // Test operations
}).pipe(Effect.provide(QueueSystem.TestLayer))

// Run test
await Effect.runPromise(testProgram)
```

### Mock Operations

```typescript
const mockFileOperation = Effect.succeed(["file1.txt", "file2.txt"])
const mockNetworkOperation = Effect.succeed({ status: "ok", data: "test" })
const mockComputationResult = Effect.succeed(42)
```

## Configuration

### Environment Variables

The queue system can be configured via environment variables:

- `QUEUE_MAX_CONCURRENCY`: Maximum concurrent operations per resource group
- `QUEUE_DEFAULT_TIMEOUT`: Default operation timeout in milliseconds  
- `QUEUE_RETRY_DELAY`: Delay between retry attempts in milliseconds
- `QUEUE_DATABASE_PATH`: Path to SQLite database file

### Runtime Configuration

```typescript
// Custom concurrency limits
const customConfig = {
  filesystem: { maxConcurrency: 5 },
  network: { maxConcurrency: 10 },
  computation: { maxConcurrency: 4 },
  "memory-intensive": { maxConcurrency: 2 }
}
```

This API reference provides complete documentation for all public interfaces and methods in the queue system. For practical examples, see the [examples documentation](./examples.md).