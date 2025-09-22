# Effect CLI Queue System Documentation

A comprehensive queue system built with Effect.ts that provides efficient task management, resource coordination, and performance optimization for CLI applications.

## Overview

The Effect CLI Queue System is a multi-phase, production-ready queue implementation that handles:
- **File Operations**: Directory listing, file reading/writing, file searching
- **Network Requests**: HTTP calls, API interactions, data fetching  
- **Computational Tasks**: CPU-intensive operations, data processing
- **Memory Management**: Large dataset handling, cache optimization

## Quick Start

### Basic Usage

```typescript
import * as Effect from "effect/Effect"
import { 
  QueueSystem, 
  BasicQueueSystemLayer,
  queueFileOperation,
  queueNetworkOperation,
  queueComputationTask 
} from "@template/cli/services/Queue"

// Initialize the queue system
const program = Effect.gen(function*() {
  // Initialize queue for session
  const sessionId = yield* QueueSystem.initialize()
  console.log(`Queue system ready: ${sessionId}`)
  
  // Queue a file operation
  const fileTaskId = yield* queueFileOperation(
    Effect.succeed(["file1.txt", "file2.txt"]),
    {
      type: "directory-list",
      priority: 1,
      filePath: "./documents"
    }
  )
  
  // Queue a network operation
  const networkTaskId = yield* queueNetworkOperation(
    Effect.succeed({ status: "ok", data: "response" }),
    {
      priority: 2,
      url: "https://api.example.com/data",
      maxRetries: 3
    }
  )
  
  // Queue a computation task
  const computeTaskId = yield* queueComputationTask(
    Effect.succeed(42),
    {
      priority: 1,
      isMemoryIntensive: false
    }
  )
  
  // Check system status
  const status = yield* QueueSystem.getStatus()
  console.log("Queue status:", status)
  
  return { fileTaskId, networkTaskId, computeTaskId }
})

// Run with basic queue system
Effect.runPromise(program.pipe(Effect.provide(BasicQueueSystemLayer)))
```

### Advanced Usage with Performance Monitoring

```typescript
import { 
  StabilityQueueSystemLayer,
  PerformanceProfiler,
  PerformanceProfilerLive
} from "@template/cli/services/Queue"

const advancedProgram = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  
  // Start profiling a batch operation
  const session = yield* profiler.startProfiling(
    "batch-processing",
    "batch-operation", 
    "computation"
  )
  
  // Process multiple tasks
  const taskIds = []
  for (let i = 0; i < 10; i++) {
    const taskId = yield* queueComputationTask(
      Effect.succeed(`Task ${i} completed`),
      { priority: i % 3 + 1 }
    )
    taskIds.push(taskId)
  }
  
  // Wait for processing
  yield* Effect.sleep(Duration.seconds(2))
  
  // End profiling and get metrics
  const metrics = yield* profiler.endProfiling(session, true)
  console.log("Performance metrics:", {
    duration: metrics.duration,
    success: metrics.success,
    memoryUsed: metrics.memoryDelta
  })
  
  // Get detailed performance statistics
  const stats = yield* profiler.getPerformanceStats()
  console.log("System stats:", {
    totalOperations: stats.totalOperations,
    avgDuration: stats.avgDuration,
    throughput: stats.throughput,
    errorRate: stats.errorRate
  })
  
  return taskIds
})

// Create layer with performance profiling
const performanceLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive)
)

Effect.runPromise(advancedProgram.pipe(Effect.provide(performanceLayer)))
```

## System Architecture

### Phase 1: Core Infrastructure
- **InternalQueue**: Core queue processing engine
- **QueueMonitor**: Real-time monitoring and metrics
- **QueuePersistence**: SQLite-based task persistence
- **Resource Groups**: Filesystem, Network, Computation, Memory-intensive

### Phase 2: Stability Features
- **CircuitBreaker**: Prevents cascading failures
- **AdaptiveThrottler**: Dynamic rate limiting
- **StabilityMonitor**: Comprehensive health monitoring

### Phase 3: CLI Integration
- **Transparent Queue Adapter**: Seamless CLI operation queueing
- **Progress Tracking**: Real-time operation progress
- **Context-aware Error Handling**: Meaningful error messages

### Phase 4: Performance Optimization
- **PerformanceProfiler**: Detailed operation profiling
- **MemoryOptimizer**: Memory usage optimization
- **AdvancedCache**: Multi-tier caching system

## Resource Groups

The queue system organizes operations into four resource groups:

### Filesystem (`filesystem`)
- File reading/writing operations
- Directory listings and traversal
- File search and pattern matching
- Concurrent file operations with proper locking

```typescript
const fileTask = yield* queueFileOperation(
  fileSystem.readFile("./config.json"),
  {
    type: "file-read",
    filePath: "./config.json",
    priority: 2,
    maxRetries: 3
  }
)
```

### Network (`network`)
- HTTP/HTTPS requests
- API calls and data fetching
- WebSocket connections
- Rate-limited external service calls

```typescript
const apiTask = yield* queueNetworkOperation(
  fetch("https://api.service.com/endpoint"),
  {
    priority: 1,
    url: "https://api.service.com/endpoint",
    maxRetries: 5,
    estimatedDuration: Duration.seconds(10)
  }
)
```

### Computation (`computation`)
- CPU-intensive calculations
- Data processing and transformation
- Algorithm execution
- Non-memory-intensive operations

```typescript
const computeTask = yield* queueComputationTask(
  processDataSet(largeArray),
  {
    priority: 1,
    maxRetries: 2,
    estimatedDuration: Duration.minutes(5)
  }
)
```

### Memory-Intensive (`memory-intensive`)
- Large dataset processing
- Image/video manipulation
- Database operations
- Cache-heavy operations

```typescript
const memoryTask = yield* queueComputationTask(
  processLargeDataset(hugeArray),
  {
    isMemoryIntensive: true,
    priority: 3,
    maxRetries: 1,
    estimatedDuration: Duration.minutes(10)
  }
)
```

## Configuration

### Queue System Layers

```typescript
// Basic functionality only
import { BasicQueueSystemLayer } from "@template/cli/services/Queue"

// Basic + Stability features (recommended for production)
import { StabilityQueueSystemLayer } from "@template/cli/services/Queue"

// Full system with performance monitoring
const fullLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive),
  Effect.provide(MemoryOptimizerLive),
  Effect.provide(AdvancedCacheLive)
)
```

### Priority System

Tasks are processed based on priority (1 = highest, 5 = lowest):

- **Priority 1**: Critical operations (auth, security)
- **Priority 2**: High-importance user actions  
- **Priority 3**: Normal operations
- **Priority 4**: Background tasks
- **Priority 5**: Low-priority maintenance

### Retry Configuration

```typescript
const robustTask = yield* queueNetworkOperation(
  apiCall(),
  {
    maxRetries: 5,              // Retry up to 5 times
    estimatedDuration: Duration.seconds(30),
    priority: 2
  }
)
```

## Monitoring and Health Checks

### Basic Health Monitoring

```typescript
const healthCheck = Effect.gen(function*() {
  // Quick health check
  const health = yield* QueueSystem.checkHealth()
  console.log("System healthy:", health.healthy)
  console.log("Active processors:", health.status.processingFibers.length)
  
  // Detailed system health (with StabilityMonitor)
  const systemHealth = yield* QueueSystem.getSystemHealth()
  console.log("Stability metrics:", systemHealth.metrics)
  console.log("Heartbeat:", systemHealth.heartbeat)
})
```

### Performance Monitoring

```typescript
const monitorPerformance = Effect.gen(function*() {
  const profiler = yield* PerformanceProfiler
  
  // Get current performance statistics
  const stats = yield* profiler.getPerformanceStats()
  console.log("Performance Summary:", {
    totalOperations: stats.totalOperations,
    avgDuration: stats.avgDuration + "ms",
    p95Duration: stats.p95Duration + "ms", 
    throughput: stats.throughput + " ops/sec",
    errorRate: (stats.errorRate * 100).toFixed(2) + "%"
  })
  
  // Identify performance bottlenecks
  const bottlenecks = yield* profiler.analyzeBottlenecks()
  if (bottlenecks.length > 0) {
    console.log("Performance Issues Detected:")
    bottlenecks.forEach(issue => {
      console.log(`- ${issue.type}: ${issue.description}`)
      console.log(`  Severity: ${issue.severity}`)
      console.log(`  Impact: ${issue.impact}%`)
      console.log(`  Recommendations:`)
      issue.recommendations.forEach(rec => console.log(`    • ${rec}`))
    })
  }
  
  // Resource utilization
  const utilization = yield* profiler.getResourceUtilization()
  utilization.forEach(resource => {
    console.log(`${resource.resourceGroup}: ${resource.utilizationPercentage}% utilized`)
    console.log(`  Concurrent: ${resource.concurrentOperations}/${resource.maxConcurrency}`)
    console.log(`  Avg Wait: ${resource.avgWaitTime}ms`)
  })
})
```

## Error Handling

### Graceful Error Recovery

```typescript
const robustOperation = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  
  try {
    // Attempt risky operation
    const taskId = yield* queueNetworkOperation(
      riskyApiCall(),
      {
        maxRetries: 3,
        priority: 2,
        url: "https://unreliable-api.com/data"
      }
    )
    
    // Wait for completion with timeout
    const result = yield* QueueSystem.waitForTask(taskId, 60000)
    
    return result
  } catch (error) {
    // Handle errors with context
    console.error("Operation failed:", error)
    
    // Check if system is still healthy
    const health = yield* QueueSystem.checkHealth()
    if (!health.healthy) {
      console.log("System issues detected - triggering recovery")
      
      // Pause processing temporarily
      yield* QueueSystem.pauseAll()
      yield* Effect.sleep(Duration.seconds(5))
      yield* QueueSystem.resumeAll()
    }
    
    throw error
  }
})
```

### Circuit Breaker Integration

The StabilityQueueSystemLayer automatically includes circuit breaker protection:

```typescript
// Circuit breaker activates automatically on high failure rates
const protectedOperation = Effect.gen(function*() {
  // This operation is automatically protected by circuit breaker
  const taskId = yield* queueNetworkOperation(
    flakeyExternalService(),
    { maxRetries: 2, priority: 1 }
  )
  
  return taskId
}).pipe(Effect.provide(StabilityQueueSystemLayer))

// Circuit breaker will:
// 1. Monitor failure rates
// 2. Open circuit if failures exceed threshold  
// 3. Automatically attempt recovery
// 4. Close circuit when service is healthy
```

## Data Export and Analysis

### Export Performance Data

```typescript
const exportMetrics = Effect.gen(function*() {
  const profiler = yield* PerformanceProfiler
  
  // Export as JSON for analysis
  const jsonData = yield* profiler.exportProfilingData("json")
  yield* fileSystem.writeFile("./metrics.json", jsonData)
  
  // Export as CSV for spreadsheets
  const csvData = yield* profiler.exportProfilingData("csv") 
  yield* fileSystem.writeFile("./metrics.csv", csvData)
  
  // Export queue metrics
  const queueMetrics = yield* QueueSystem.exportMetrics("json")
  yield* fileSystem.writeFile("./queue-metrics.json", queueMetrics)
  
  console.log("Metrics exported successfully")
})
```

### Clean Up Old Data

```typescript
const maintenance = Effect.gen(function*() {
  const profiler = yield* PerformanceProfiler
  
  // Clear profiling data older than 24 hours
  const cleanedCount = yield* profiler.clearProfilingData(Duration.hours(24))
  console.log(`Cleaned ${cleanedCount} old profiling records`)
  
  // Shutdown system gracefully
  yield* QueueSystem.shutdown()
})
```

## Best Practices

### 1. Choose Appropriate Resource Groups
- Use `filesystem` for file operations
- Use `network` for external API calls  
- Use `computation` for CPU work
- Use `memory-intensive` for large data processing

### 2. Set Realistic Priorities
- Reserve priority 1 for truly critical operations
- Use priority 2-3 for normal user operations
- Use priority 4-5 for background tasks

### 3. Configure Proper Timeouts
```typescript
const taskId = yield* queueNetworkOperation(
  longRunningApiCall(),
  {
    estimatedDuration: Duration.minutes(5), // Set realistic estimate
    maxRetries: 2,                          // Don't retry indefinitely
    priority: 2
  }
)
```

### 4. Monitor System Health
```typescript
// Regular health checks
const healthCheck = Schedule.fixed(Duration.seconds(30))

const monitoring = Effect.gen(function*() {
  const health = yield* QueueSystem.checkHealth()
  
  if (!health.healthy) {
    // Alert or take corrective action
    console.warn("Queue system unhealthy:", health)
  }
}).pipe(
  Effect.repeat(healthCheck),
  Effect.provide(StabilityQueueSystemLayer)
)
```

### 5. Use Performance Profiling

```typescript
// Profile critical operations
const criticalOperation = Effect.gen(function*() {
  const profiler = yield* PerformanceProfiler
  
  const session = yield* profiler.startProfiling(
    "critical-batch-job",
    "batch-operation",
    "computation"  
  )
  
  // Your critical operation here
  const result = yield* performCriticalTask()
  
  const metrics = yield* profiler.endProfiling(session, true)
  
  // Alert if operation takes too long
  if (metrics.duration > 30000) { // 30 seconds
    console.warn("Critical operation slow:", metrics.duration + "ms")
  }
  
  return result
})
```

## Troubleshooting

### Common Issues

#### High Memory Usage
```typescript
// Check memory optimization is enabled
const memoryLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(MemoryOptimizerLive)
)

// Use memory-intensive resource group for large operations
const taskId = yield* queueComputationTask(
  processLargeDataset(data),
  { isMemoryIntensive: true, priority: 3 }
)
```

#### Slow Performance
```typescript
// Enable performance profiling to identify bottlenecks
const profiler = yield* PerformanceProfiler
const bottlenecks = yield* profiler.analyzeBottlenecks()

bottlenecks.forEach(issue => {
  console.log(`${issue.type}: ${issue.description}`)
  console.log("Recommendations:", issue.recommendations)
})
```

#### Queue Backlog
```typescript
// Check queue status
const status = yield* QueueSystem.getStatus()
console.log("Queue lengths:", status.queue.queueLengths)

// Temporarily increase processing capacity
yield* QueueSystem.resumeAll() // Ensure not paused

// Consider splitting large tasks
const largeTask = splitIntoSmallerChunks(hugeOperation)
for (const chunk of largeTask) {
  yield* queueComputationTask(chunk, { priority: 2 })
}
```

#### Database Issues
```typescript
// Check persistence layer health
const health = yield* QueueSystem.checkHealth() 
if (health.status.database?.connected === false) {
  console.error("Database connection issues")
  
  // Restart system if needed
  yield* QueueSystem.shutdown()
  yield* QueueSystem.initialize()
}
```

## Testing

See `test/integration/BasicIntegration.test.ts` for comprehensive examples of testing queue system integration.

```typescript
// Example test setup
import { BasicQueueSystemLayer } from "@template/cli/services/Queue"

const testProgram = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  
  // Test your queue operations
  const taskId = yield* queueComputationTask(
    Effect.succeed("test result"),
    { priority: 1 }
  )
  
  const status = yield* QueueSystem.getStatus()
  expect(status).toBeDefined()
})

// Run test
await Effect.runPromise(testProgram.pipe(Effect.provide(BasicQueueSystemLayer)))
```

## Migration Guide

### From Basic to Stability Layer
```typescript
// Before
Effect.provide(BasicQueueSystemLayer)

// After (recommended for production)
Effect.provide(StabilityQueueSystemLayer)
```

### Adding Performance Monitoring
```typescript
// Add performance profiling
const performanceLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive)
)

Effect.provide(performanceLayer)
```

### Full Feature Layer
```typescript
// All features enabled
const fullLayer = Layer.mergeAll(
  StabilityQueueSystemLayer,
  PerformanceProfilerLive,
  MemoryOptimizerLive, 
  AdvancedCacheLive
)

Effect.provide(fullLayer)
```