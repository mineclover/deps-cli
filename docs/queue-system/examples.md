# Queue System Examples

Practical examples demonstrating real-world usage of the Effect CLI Queue System.

## File Processing Pipeline

Process multiple files with progress tracking and error handling.

```typescript
import * as Effect from "effect/Effect"
import * as Duration from "effect/Duration"
import * as Array from "effect/Array"
import { 
  QueueSystem, 
  StabilityQueueSystemLayer,
  queueFileOperation,
  PerformanceProfiler,
  PerformanceProfilerLive
} from "@template/cli/services/Queue"

// File processing workflow
const fileProcessingPipeline = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  
  console.log("🚀 Starting file processing pipeline...")
  
  // Start profiling the entire pipeline
  const pipelineSession = yield* profiler.startProfiling(
    "file-processing-pipeline",
    "batch-operation",
    "filesystem"
  )
  
  // Files to process
  const filesToProcess = [
    { path: "./documents/report1.pdf", type: "pdf" },
    { path: "./documents/data.csv", type: "csv" },
    { path: "./images/photo1.jpg", type: "image" },
    { path: "./images/photo2.png", type: "image" },
    { path: "./config/settings.json", type: "json" }
  ]
  
  const results = []
  let processed = 0
  
  for (const file of filesToProcess) {
    try {
      console.log(`📁 Processing ${file.path}...`)
      
      // Start file-specific profiling
      const fileSession = yield* profiler.startProfiling(
        `process-${file.type}-${processed}`,
        "file-processing",
        "filesystem"
      )
      
      // Queue file processing based on type
      const taskId = yield* queueFileOperation(
        processFileByType(file.path, file.type),
        {
          type: "file-read",
          filePath: file.path,
          priority: file.type === "json" ? 1 : 2, // Config files get priority
          maxRetries: 3,
          estimatedDuration: Duration.seconds(30)
        }
      )
      
      // Wait for completion
      const result = yield* QueueSystem.waitForTask(taskId, 45000)
      
      // End file profiling
      const fileMetrics = yield* profiler.endProfiling(fileSession, true)
      
      processed++
      results.push({
        file: file.path,
        taskId,
        success: true,
        duration: fileMetrics.duration,
        memoryUsed: fileMetrics.memoryDelta
      })
      
      // Progress update
      console.log(`✅ Processed ${file.path} (${processed}/${filesToProcess.length}) - ${fileMetrics.duration}ms`)
      
    } catch (error) {
      console.error(`❌ Failed to process ${file.path}:`, error)
      results.push({
        file: file.path,
        success: false,
        error: error.message
      })
    }
  }
  
  // End pipeline profiling
  const pipelineMetrics = yield* profiler.endProfiling(pipelineSession, true)
  
  // Summary
  const successful = results.filter(r => r.success).length
  const failed = results.length - successful
  
  console.log("\n📊 Pipeline Summary:")
  console.log(`   Total files: ${filesToProcess.length}`)
  console.log(`   Successful: ${successful}`)
  console.log(`   Failed: ${failed}`)
  console.log(`   Total time: ${pipelineMetrics.duration}ms`)
  console.log(`   Memory used: ${(pipelineMetrics.memoryDelta / 1024 / 1024).toFixed(1)}MB`)
  
  // Get system performance stats
  const stats = yield* profiler.getPerformanceStats()
  console.log(`   Throughput: ${stats.throughput.toFixed(2)} ops/sec`)
  console.log(`   Error rate: ${(stats.errorRate * 100).toFixed(1)}%`)
  
  return results
})

// Helper function to simulate file processing
const processFileByType = (filePath: string, fileType: string) =>
  Effect.gen(function*() {
    // Simulate processing time based on file type
    const processingTime = {
      pdf: 200,
      csv: 150, 
      image: 100,
      json: 50
    }[fileType] || 100
    
    yield* Effect.sleep(Duration.millis(processingTime + Math.random() * 100))
    
    return {
      filePath,
      fileType,
      processedAt: new Date().toISOString(),
      size: Math.floor(Math.random() * 1000000) // Simulate file size
    }
  })

// Create layer with performance monitoring
const fileProcessingLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive)
)

// Run the pipeline
Effect.runPromise(
  fileProcessingPipeline.pipe(Effect.provide(fileProcessingLayer))
)
```

## API Data Aggregation

Fetch data from multiple APIs with rate limiting and caching.

```typescript
import { 
  queueNetworkOperation,
  AdvancedCache,
  AdvancedCacheLive
} from "@template/cli/services/Queue"

const apiDataAggregation = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  const cache = yield* AdvancedCache
  
  console.log("🌐 Starting API data aggregation...")
  
  // APIs to call
  const apiEndpoints = [
    { url: "https://api.github.com/users/octocat", name: "GitHub User" },
    { url: "https://jsonplaceholder.typicode.com/posts/1", name: "Sample Post" },
    { url: "https://httpbin.org/delay/1", name: "Delayed Response" },
    { url: "https://api.github.com/repos/microsoft/vscode", name: "VSCode Repo" },
    { url: "https://httpbin.org/json", name: "JSON Response" }
  ]
  
  // Start aggregation profiling
  const aggregationSession = yield* profiler.startProfiling(
    "api-aggregation",
    "batch-operation", 
    "network"
  )
  
  const results = []
  
  // Process APIs with different priorities and retry strategies
  for (const [index, api] of apiEndpoints.entries()) {
    try {
      console.log(`🔄 Fetching ${api.name}...`)
      
      const apiSession = yield* profiler.startProfiling(
        `api-call-${index}`,
        "network-request",
        "network"
      )
      
      const taskId = yield* queueNetworkOperation(
        fetchApiData(api.url),
        {
          priority: api.name.includes("GitHub") ? 1 : 2, // GitHub gets priority
          url: api.url,
          maxRetries: api.url.includes("delay") ? 1 : 3,  // Fewer retries for slow endpoints
          estimatedDuration: Duration.seconds(api.url.includes("delay") ? 5 : 2)
        }
      )
      
      // Wait for result
      const result = yield* QueueSystem.waitForTask(taskId, 10000)
      const apiMetrics = yield* profiler.endProfiling(apiSession, true)
      
      results.push({
        api: api.name,
        url: api.url,
        success: true,
        duration: apiMetrics.duration,
        data: result // This would contain the actual API response
      })
      
      console.log(`✅ ${api.name} completed - ${apiMetrics.duration}ms`)
      
    } catch (error) {
      console.error(`❌ ${api.name} failed:`, error.message)
      
      results.push({
        api: api.name,
        url: api.url,
        success: false,
        error: error.message
      })
    }
  }
  
  const aggregationMetrics = yield* profiler.endProfiling(aggregationSession, true)
  
  // Results summary
  const successful = results.filter(r => r.success).length
  const avgDuration = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration, 0) / successful
  
  console.log("\n📊 API Aggregation Summary:")
  console.log(`   APIs called: ${apiEndpoints.length}`)
  console.log(`   Successful: ${successful}`)
  console.log(`   Failed: ${results.length - successful}`)
  console.log(`   Total time: ${aggregationMetrics.duration}ms`)
  console.log(`   Avg response time: ${avgDuration.toFixed(0)}ms`)
  
  return results
})

const fetchApiData = (url: string) =>
  Effect.gen(function*() {
    // Simulate API call
    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (error) => new Error(`API call failed: ${error}`)
    })
    
    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new Error("Failed to parse JSON response")
    })
    
    return { url, status: response.status, data }
  })

// Layer with caching
const apiLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive),
  Effect.provide(AdvancedCacheLive)
)

Effect.runPromise(
  apiDataAggregation.pipe(Effect.provide(apiLayer))
)
```

## Batch Data Processing

Process large datasets with memory optimization and progress tracking.

```typescript
import { 
  queueComputationTask,
  MemoryOptimizer,
  MemoryOptimizerLive
} from "@template/cli/services/Queue"

const batchDataProcessing = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  const memoryOpt = yield* MemoryOptimizer
  
  console.log("🔢 Starting batch data processing...")
  
  // Simulate large dataset
  const datasetSize = 10000
  const batchSize = 1000
  const batches = Math.ceil(datasetSize / batchSize)
  
  const batchSession = yield* profiler.startProfiling(
    "batch-data-processing",
    "batch-operation",
    "computation"
  )
  
  const results = []
  let processedRecords = 0
  
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const startRecord = batchIndex * batchSize
    const endRecord = Math.min(startRecord + batchSize, datasetSize)
    const currentBatchSize = endRecord - startRecord
    
    console.log(`📦 Processing batch ${batchIndex + 1}/${batches} (records ${startRecord}-${endRecord})`)
    
    const batchTaskSession = yield* profiler.startProfiling(
      `batch-${batchIndex}`,
      "data-processing",
      "computation"
    )
    
    try {
      // Queue batch processing - use memory-intensive for large batches
      const isMemoryIntensive = currentBatchSize > 500
      
      const taskId = yield* queueComputationTask(
        processBatchData(startRecord, endRecord),
        {
          priority: batchIndex < 3 ? 1 : 2, // First few batches get priority
          isMemoryIntensive,
          maxRetries: 2,
          estimatedDuration: Duration.seconds(isMemoryIntensive ? 30 : 10)
        }
      )
      
      const result = yield* QueueSystem.waitForTask(taskId, 45000)
      const batchMetrics = yield* profiler.endProfiling(batchTaskSession, true)
      
      processedRecords += currentBatchSize
      const progressPercent = ((processedRecords / datasetSize) * 100).toFixed(1)
      
      results.push({
        batchIndex,
        recordsProcessed: currentBatchSize,
        duration: batchMetrics.duration,
        memoryUsed: batchMetrics.memoryDelta,
        success: true
      })
      
      console.log(`✅ Batch ${batchIndex + 1} completed - ${batchMetrics.duration}ms (${progressPercent}% done)`)
      
      // Memory management - trigger cleanup if needed
      if (batchMetrics.memoryDelta > 100 * 1024 * 1024) { // 100MB
        console.log("🧹 High memory usage detected, triggering cleanup...")
        // Memory optimizer would handle this automatically
      }
      
    } catch (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      results.push({
        batchIndex,
        recordsProcessed: 0,
        error: error.message,
        success: false
      })
    }
    
    // Small delay between batches to prevent overwhelming
    yield* Effect.sleep(Duration.millis(100))
  }
  
  const batchMetrics = yield* profiler.endProfiling(batchSession, true)
  
  // Final summary
  const successfulBatches = results.filter(r => r.success).length
  const totalProcessed = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.recordsProcessed, 0)
  const avgBatchTime = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration, 0) / successfulBatches
  
  console.log("\n📊 Batch Processing Summary:")
  console.log(`   Total records: ${datasetSize}`)
  console.log(`   Processed: ${totalProcessed}`)
  console.log(`   Batches completed: ${successfulBatches}/${batches}`)
  console.log(`   Total time: ${(batchMetrics.duration / 1000).toFixed(1)}s`)
  console.log(`   Avg batch time: ${avgBatchTime.toFixed(0)}ms`)
  console.log(`   Throughput: ${((totalProcessed / batchMetrics.duration) * 1000).toFixed(0)} records/sec`)
  console.log(`   Memory efficiency: ${(batchMetrics.memoryDelta / 1024 / 1024).toFixed(1)}MB total`)
  
  return results
})

const processBatchData = (startRecord: number, endRecord: number) =>
  Effect.gen(function*() {
    const batchSize = endRecord - startRecord
    
    // Simulate CPU-intensive data processing
    const processingTime = batchSize * 2 + Math.random() * 100
    yield* Effect.sleep(Duration.millis(processingTime))
    
    // Simulate processing result
    const result = {
      startRecord,
      endRecord,
      recordsProcessed: batchSize,
      processedAt: new Date().toISOString(),
      // Simulate varying result sizes
      resultSize: batchSize * (Math.random() * 50 + 10), // 10-60 bytes per record
      summary: {
        validRecords: Math.floor(batchSize * 0.95),
        invalidRecords: Math.ceil(batchSize * 0.05),
        avgProcessingTimePerRecord: processingTime / batchSize
      }
    }
    
    return result
  })

// Full system layer with memory optimization
const batchProcessingLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive),
  Effect.provide(MemoryOptimizerLive)
)

Effect.runPromise(
  batchDataProcessing.pipe(Effect.provide(batchProcessingLayer))
)
```

## System Health Monitoring

Continuous monitoring with alerts and automated recovery.

```typescript
const systemHealthMonitoring = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  
  console.log("🔍 Starting system health monitoring...")
  
  // Monitoring configuration
  const monitoringConfig = {
    checkInterval: Duration.seconds(10),
    performanceThresholds: {
      maxAvgDuration: 5000, // 5 seconds
      maxErrorRate: 0.1,    // 10%
      minThroughput: 0.5    // 0.5 operations per second
    },
    resourceThresholds: {
      maxUtilization: 80,   // 80%
      maxWaitTime: 10000    // 10 seconds
    }
  }
  
  // Simulate some background load
  const backgroundLoad = Effect.gen(function*() {
    for (let i = 0; i < 20; i++) {
      // Mix of different operation types
      const operations = [
        queueComputationTask(
          Effect.succeed(`computation-${i}`),
          { priority: Math.ceil(Math.random() * 3) }
        ),
        queueFileOperation(
          Effect.succeed(`file-op-${i}`),
          { type: "file-read", priority: Math.ceil(Math.random() * 3) }
        ),
        queueNetworkOperation(
          Effect.succeed(`network-op-${i}`),
          { priority: Math.ceil(Math.random() * 3) }
        )
      ]
      
      // Queue random operation
      const operation = operations[Math.floor(Math.random() * operations.length)]
      yield* operation
      
      // Random delay
      yield* Effect.sleep(Duration.millis(Math.random() * 1000))
    }
  })
  
  // Start background load
  const backgroundFiber = yield* Effect.fork(backgroundLoad)
  
  // Health monitoring loop
  const monitoring = Effect.gen(function*() {
    let monitoringRounds = 0
    const maxRounds = 30 // Monitor for ~5 minutes
    
    while (monitoringRounds < maxRounds) {
      monitoringRounds++
      
      console.log(`\n🔍 Health Check Round ${monitoringRounds}/${maxRounds}`)
      
      // Basic health check
      const health = yield* QueueSystem.checkHealth()
      console.log(`   System Healthy: ${health.healthy ? '✅' : '❌'}`)
      console.log(`   Active Processors: ${health.status.processingFibers.length}`)
      
      // Detailed system health (with StabilityMonitor)
      const systemHealth = yield* QueueSystem.getSystemHealth()
      console.log(`   Stability Health: ${systemHealth.isHealthy ? '✅' : '❌'}`)
      
      // Performance statistics
      const stats = yield* profiler.getPerformanceStats(Duration.minutes(1))
      console.log(`   Total Operations: ${stats.totalOperations}`)
      console.log(`   Avg Duration: ${stats.avgDuration.toFixed(0)}ms`)
      console.log(`   Throughput: ${stats.throughput.toFixed(2)} ops/sec`)
      console.log(`   Error Rate: ${(stats.errorRate * 100).toFixed(1)}%`)
      
      // Performance alerts
      if (stats.avgDuration > monitoringConfig.performanceThresholds.maxAvgDuration) {
        console.log(`⚠️  ALERT: High average duration (${stats.avgDuration}ms)`)
      }
      
      if (stats.errorRate > monitoringConfig.performanceThresholds.maxErrorRate) {
        console.log(`⚠️  ALERT: High error rate (${(stats.errorRate * 100).toFixed(1)}%)`)
      }
      
      if (stats.throughput < monitoringConfig.performanceThresholds.minThroughput) {
        console.log(`⚠️  ALERT: Low throughput (${stats.throughput.toFixed(2)} ops/sec)`)
      }
      
      // Resource utilization
      const utilization = yield* profiler.getResourceUtilization()
      let resourceAlerts = false
      
      utilization.forEach(resource => {
        console.log(`   ${resource.resourceGroup}: ${resource.utilizationPercentage.toFixed(1)}% utilized`)
        
        if (resource.utilizationPercentage > monitoringConfig.resourceThresholds.maxUtilization) {
          console.log(`⚠️  ALERT: High utilization for ${resource.resourceGroup}`)
          resourceAlerts = true
        }
        
        if (resource.avgWaitTime > monitoringConfig.resourceThresholds.maxWaitTime) {
          console.log(`⚠️  ALERT: High wait time for ${resource.resourceGroup}: ${resource.avgWaitTime}ms`)
          resourceAlerts = true
        }
      })
      
      // Bottleneck analysis
      const bottlenecks = yield* profiler.analyzeBottlenecks()
      if (bottlenecks.length > 0) {
        console.log(`⚠️  PERFORMANCE ISSUES DETECTED:`)
        bottlenecks.forEach(issue => {
          console.log(`     ${issue.type}: ${issue.description} (${issue.severity})`)
        })
      }
      
      // Auto-recovery actions
      if (!health.healthy || resourceAlerts) {
        console.log("🔧 Triggering auto-recovery actions...")
        
        // Pause and resume to reset any stuck processors
        yield* QueueSystem.pauseAll()
        yield* Effect.sleep(Duration.seconds(2))
        yield* QueueSystem.resumeAll()
        
        console.log("✅ Auto-recovery completed")
      }
      
      // Wait for next check
      yield* Effect.sleep(monitoringConfig.checkInterval)
    }
    
    console.log("\n📊 Monitoring Session Complete")
  })
  
  // Run monitoring
  yield* monitoring
  
  // Wait for background load to complete
  yield* Effect.join(backgroundFiber)
  
  // Final system report
  const finalStats = yield* profiler.getPerformanceStats()
  const finalUtilization = yield* profiler.getResourceUtilization()
  
  console.log("\n📈 Final System Report:")
  console.log(`   Operations Completed: ${finalStats.totalOperations}`)
  console.log(`   Overall Throughput: ${finalStats.throughput.toFixed(2)} ops/sec`)
  console.log(`   Final Error Rate: ${(finalStats.errorRate * 100).toFixed(1)}%`)
  console.log(`   System Health: ${(yield* QueueSystem.checkHealth()).healthy ? '✅ Healthy' : '❌ Issues Detected'}`)
  
  return {
    stats: finalStats,
    utilization: finalUtilization,
    monitoringRounds
  }
})

const monitoringLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive)
)

Effect.runPromise(
  systemHealthMonitoring.pipe(Effect.provide(monitoringLayer))
)
```

## Mixed Workload Stress Test

Test system under various load conditions with different operation types.

```typescript
const stressTest = Effect.gen(function*() {
  const sessionId = yield* QueueSystem.initialize()
  const profiler = yield* PerformanceProfiler
  
  console.log("⚡ Starting mixed workload stress test...")
  
  const testSession = yield* profiler.startProfiling(
    "stress-test",
    "batch-operation",
    "computation"
  )
  
  // Stress test configuration
  const config = {
    duration: Duration.minutes(2),
    concurrentOperations: 50,
    operationTypes: [
      { type: "file", weight: 30, avgDuration: 200 },
      { type: "network", weight: 25, avgDuration: 1000 },
      { type: "computation", weight: 25, avgDuration: 500 },
      { type: "memory-intensive", weight: 20, avgDuration: 800 }
    ]
  }
  
  let totalOperations = 0
  let completedOperations = 0
  let failedOperations = 0
  
  // Create operation generator
  const generateOperation = (index: number) => {
    // Select operation type based on weights
    const random = Math.random() * 100
    let cumulative = 0
    let selectedType = config.operationTypes[0]
    
    for (const opType of config.operationTypes) {
      cumulative += opType.weight
      if (random <= cumulative) {
        selectedType = opType
        break
      }
    }
    
    const variance = 0.5 // ±50% duration variance
    const duration = selectedType.avgDuration * (1 + (Math.random() - 0.5) * variance)
    
    return {
      type: selectedType.type,
      index,
      duration: Math.max(50, Math.floor(duration)) // Minimum 50ms
    }
  }
  
  // Stress test worker
  const worker = (workerId: number) =>
    Effect.gen(function*() {
      let workerOperations = 0
      const startTime = Date.now()
      
      while (Date.now() - startTime < Duration.toMillis(config.duration)) {
        try {
          const operation = generateOperation(totalOperations++)
          workerOperations++
          
          // Create appropriate operation
          let taskId: string
          
          switch (operation.type) {
            case "file":
              taskId = yield* queueFileOperation(
                simulateWork(operation.duration),
                { 
                  type: "file-read", 
                  priority: Math.ceil(Math.random() * 3),
                  maxRetries: 2
                }
              )
              break
              
            case "network":
              taskId = yield* queueNetworkOperation(
                simulateWork(operation.duration),
                { 
                  priority: Math.ceil(Math.random() * 3),
                  maxRetries: 3
                }
              )
              break
              
            case "computation":
              taskId = yield* queueComputationTask(
                simulateWork(operation.duration),
                { 
                  priority: Math.ceil(Math.random() * 3),
                  isMemoryIntensive: false,
                  maxRetries: 2
                }
              )
              break
              
            case "memory-intensive":
              taskId = yield* queueComputationTask(
                simulateWork(operation.duration),
                { 
                  priority: Math.ceil(Math.random() * 4),
                  isMemoryIntensive: true,
                  maxRetries: 1
                }
              )
              break
              
            default:
              throw new Error(`Unknown operation type: ${operation.type}`)
          }
          
          completedOperations++
          
          // Brief pause between operations
          yield* Effect.sleep(Duration.millis(Math.random() * 100))
          
        } catch (error) {
          failedOperations++
          console.error(`Worker ${workerId} operation failed:`, error.message)
        }
      }
      
      console.log(`👷 Worker ${workerId} completed ${workerOperations} operations`)
      return workerOperations
    })
  
  // Start concurrent workers
  console.log(`🚀 Starting ${config.concurrentOperations} concurrent workers...`)
  
  const workers = Array.from({ length: config.concurrentOperations }, (_, i) =>
    Effect.fork(worker(i + 1))
  )
  
  const startedWorkers = yield* Effect.all(workers)
  
  // Monitor progress
  const monitor = Effect.gen(function*() {
    const monitorStart = Date.now()
    
    while (Date.now() - monitorStart < Duration.toMillis(config.duration)) {
      yield* Effect.sleep(Duration.seconds(10))
      
      const currentStats = yield* profiler.getPerformanceStats(Duration.minutes(1))
      const utilization = yield* profiler.getResourceUtilization()
      const health = yield* QueueSystem.checkHealth()
      
      console.log(`\n📊 Progress Update:`)
      console.log(`   Operations queued: ${totalOperations}`)
      console.log(`   Operations completed: ${completedOperations}`)
      console.log(`   Operations failed: ${failedOperations}`)
      console.log(`   Current throughput: ${currentStats.throughput.toFixed(2)} ops/sec`)
      console.log(`   Error rate: ${(currentStats.errorRate * 100).toFixed(1)}%`)
      console.log(`   System healthy: ${health.healthy ? '✅' : '❌'}`)
      
      // Resource utilization summary
      const avgUtilization = utilization.reduce((sum, r) => sum + r.utilizationPercentage, 0) / utilization.length
      console.log(`   Avg resource utilization: ${avgUtilization.toFixed(1)}%`)
    }
  })
  
  // Start monitoring
  const monitorFiber = yield* Effect.fork(monitor)
  
  // Wait for all workers to complete
  const workerResults = yield* Effect.all(startedWorkers.map(Effect.join))
  
  // Stop monitoring
  yield* Effect.interrupt(monitorFiber)
  
  const testMetrics = yield* profiler.endProfiling(testSession, true)
  
  // Final results
  const totalWorkerOperations = workerResults.reduce((sum, count) => sum + count, 0)
  const finalStats = yield* profiler.getPerformanceStats()
  const finalUtilization = yield* profiler.getResourceUtilization()
  const finalHealth = yield* QueueSystem.checkHealth()
  
  console.log("\n🎯 Stress Test Results:")
  console.log(`   Test Duration: ${(testMetrics.duration / 1000).toFixed(1)}s`)
  console.log(`   Total Operations Queued: ${totalOperations}`)
  console.log(`   Worker Operations: ${totalWorkerOperations}`)
  console.log(`   System Operations: ${finalStats.totalOperations}`)
  console.log(`   Completed: ${completedOperations}`)
  console.log(`   Failed: ${failedOperations}`)
  console.log(`   Success Rate: ${((completedOperations / totalOperations) * 100).toFixed(1)}%`)
  console.log(`   Overall Throughput: ${finalStats.throughput.toFixed(2)} ops/sec`)
  console.log(`   P95 Duration: ${finalStats.p95Duration.toFixed(0)}ms`)
  console.log(`   Final System Health: ${finalHealth.healthy ? '✅ Healthy' : '❌ Issues'}`)
  
  // Resource utilization summary
  console.log(`\n📈 Resource Utilization:`)
  finalUtilization.forEach(resource => {
    console.log(`   ${resource.resourceGroup}: ${resource.utilizationPercentage.toFixed(1)}% (${resource.concurrentOperations}/${resource.maxConcurrency})`)
  })
  
  return {
    totalOperations,
    completedOperations,
    failedOperations,
    finalStats,
    testDuration: testMetrics.duration,
    systemHealthy: finalHealth.healthy
  }
})

const simulateWork = (duration: number) =>
  Effect.gen(function*() {
    yield* Effect.sleep(Duration.millis(duration))
    return { 
      completed: true, 
      duration,
      result: Math.random() 
    }
  })

// Full system layer for stress testing
const stressTestLayer = StabilityQueueSystemLayer.pipe(
  Effect.provide(PerformanceProfilerLive),
  Effect.provide(MemoryOptimizerLive),
  Effect.provide(AdvancedCacheLive)
)

Effect.runPromise(
  stressTest.pipe(Effect.provide(stressTestLayer))
)
```

These examples demonstrate real-world usage patterns of the queue system including:

- File processing pipelines with progress tracking
- API aggregation with caching and error handling
- Batch data processing with memory optimization
- System health monitoring with automated recovery
- Stress testing under mixed workloads

Each example includes proper error handling, performance monitoring, and demonstrates different aspects of the queue system's capabilities.