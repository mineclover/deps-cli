/**
 * Test Helper Utilities
 *
 * Common utilities and mocks for testing the Effect CLI with queue integration.
 * Provides test layers, mock services, and testing utilities for comprehensive
 * E2E testing of Phase 3 components.
 *
 * Phase 3.5: E2E Testing Utilities
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

import { GenericTag } from "effect/Context"
import { millis, seconds, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
import * as Effect from "effect/Effect"
import { effect, mergeAll, provide } from "effect/Layer"
import type { Layer } from "effect/Layer"
import { some } from "effect/Option"

import type { FileInfo } from "../../src/services/Queue/TransparentQueueAdapter.js"
import type { OperationType, QueueMetrics, QueueTask } from "../../src/services/Queue/types.js"

// Import production components for testing
import { BasicQueueSystemLayer } from "../../src/services/Queue/index.js"
import { TransparentQueueAdapterLive } from "../../src/services/Queue/TransparentQueueAdapter.js"
import { UserExperienceEnhancerLive } from "../../src/services/UserExperience/index.js"

// ============================================================================
// MOCK FILE SYSTEM
// ============================================================================

export interface MockFileInfo extends FileInfo {
  readonly name: string
  readonly path: string
  readonly size: number
  readonly isDirectory: boolean
  readonly isFile: boolean
  readonly lastModified: Date
  readonly permissions: string
}

/**
 * Mock file system service for testing
 */
export interface MockFileSystem {
  readonly listDirectory: (path: string) => Effect.Effect<Array<MockFileInfo>, Error>
  readonly readFile: (path: string) => Effect.Effect<string, Error>
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, Error>
  readonly exists: (path: string) => Effect.Effect<boolean, never>
}

export const MockFileSystem = GenericTag<MockFileSystem>("@test/MockFileSystem")

/**
 * Create a mock file system with predefined test data
 */
export const createMockFileSystem = (): Layer<MockFileSystem> =>
  effect(
    MockFileSystem,
    Effect.gen(function*() {
      // In-memory file system state
      const files = new Map<string, { content: string; isDirectory: boolean }>()

      // Initialize test data
      files.set("/test", { content: "", isDirectory: true })
      files.set("/test/example.txt", { content: "Example file content", isDirectory: false })
      files.set("/test/file0.txt", { content: "Test file 0", isDirectory: false })
      files.set("/test/file1.txt", { content: "Test file 1", isDirectory: false })
      files.set("/test/file2.txt", { content: "Test file 2", isDirectory: false })
      files.set("/test/file3.txt", { content: "Test file 3", isDirectory: false })
      files.set("/test/file4.txt", { content: "Test file 4", isDirectory: false })
      files.set("/test/file5.txt", { content: "Test file 5", isDirectory: false })
      files.set("/test/file6.txt", { content: "Test file 6", isDirectory: false })
      files.set("/test/file7.txt", { content: "Test file 7", isDirectory: false })
      files.set("/test/file8.txt", { content: "Test file 8", isDirectory: false })
      files.set("/test/file9.txt", { content: "Test file 9", isDirectory: false })

      // Add some directories
      files.set("/test/dir0", { content: "", isDirectory: true })
      files.set("/test/dir1", { content: "", isDirectory: true })
      files.set("/test/dir2", { content: "", isDirectory: true })
      files.set("/test/dir3", { content: "", isDirectory: true })
      files.set("/test/dir4", { content: "", isDirectory: true })

      yield* Effect.void

      const listDirectory = (path: string): Effect.Effect<Array<MockFileInfo>, Error> =>
        Effect.gen(function*() {
          yield* Effect.sleep(millis(10)) // Simulate I/O delay

          const directoryFiles: Array<MockFileInfo> = []

          // Find all files in this directory
          for (const [filePath, fileData] of files.entries()) {
            if (filePath.startsWith(path + "/") && !filePath.substring(path.length + 1).includes("/")) {
              const name = filePath.substring(path.lastIndexOf("/") + 1)
              directoryFiles.push({
                name,
                path: filePath,
                size: fileData.content.length,
                isDirectory: fileData.isDirectory,
                isFile: !fileData.isDirectory,
                lastModified: new Date(),
                permissions: fileData.isDirectory ? "rwxr-xr-x" : "rw-r--r--"
              })
            }
          }

          if (directoryFiles.length === 0 && !files.has(path)) {
            yield* Effect.fail(new Error(`Directory not found: ${path}`))
          }

          return directoryFiles.sort((a, b) => a.name.localeCompare(b.name))
        })

      const readFile = (path: string): Effect.Effect<string, Error> =>
        Effect.gen(function*() {
          yield* Effect.sleep(millis(5)) // Simulate I/O delay

          const fileData = files.get(path)
          if (!fileData) {
            yield* Effect.fail(new Error(`File not found: ${path}`))
          }

          if (fileData!.isDirectory) {
            yield* Effect.fail(new Error(`Path is a directory: ${path}`))
          }

          return fileData!.content
        })

      const writeFile = (path: string, content: string): Effect.Effect<void, Error> =>
        Effect.gen(function*() {
          yield* Effect.sleep(millis(8)) // Simulate I/O delay

          files.set(path, { content, isDirectory: false })
          return void 0
        })

      const exists = (path: string): Effect.Effect<boolean, never> => Effect.succeed(files.has(path))

      return MockFileSystem.of({
        listDirectory,
        readFile,
        writeFile,
        exists
      })
    })
  )

// ============================================================================
// MOCK QUEUE SYSTEM
// ============================================================================

/**
 * Enhanced mock queue for testing with realistic behavior
 */
export const createTestQueueLayer = () =>
  mergeAll(
    // Use the basic queue system for testing (lighter than full production)
    BasicQueueSystemLayer
  )

// ============================================================================
// TEST LAYER COMPOSITION
// ============================================================================

/**
 * Create a complete test layer with all necessary services
 */
export const createTestLayer = () =>
  mergeAll(
    // Mock file system
    createMockFileSystem(),
    // Queue system (basic version for testing)
    createTestQueueLayer(),
    // Transparent queue adapter
    TransparentQueueAdapterLive.pipe(
      provide(createTestQueueLayer())
    ),
    // User experience enhancer
    UserExperienceEnhancerLive.pipe(
      provide(createTestQueueLayer())
    )
  )

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a test file info object
 */
export const createTestFileInfo = (
  name: string,
  isDirectory: boolean = false,
  size: number = 1024
): MockFileInfo => ({
  name,
  path: `/test/${name}`,
  size,
  isDirectory,
  isFile: !isDirectory,
  lastModified: new Date(),
  permissions: isDirectory ? "rwxr-xr-x" : "rw-r--r--"
})

/**
 * Create mock queue metrics for testing
 */
export const createMockQueueMetrics = (overrides: Partial<QueueMetrics> = {}): QueueMetrics => ({
  sessionId: "test-session",
  timestamp: new Date(),
  totalTasks: 0,
  pendingTasks: 0,
  runningTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  cancelledTasks: 0,
  successRate: 1.0,
  averageProcessingTime: 50,
  throughputPerMinute: 10,
  resourceGroupStats: {
    filesystem: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      averageProcessingTime: 50,
      circuitBreakerState: "closed" as const,
      lastActivity: new Date()
    },
    network: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      averageProcessingTime: 50,
      circuitBreakerState: "closed" as const,
      lastActivity: new Date()
    },
    computation: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      averageProcessingTime: 50,
      circuitBreakerState: "closed" as const,
      lastActivity: new Date()
    },
    "memory-intensive": {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      averageProcessingTime: 50,
      circuitBreakerState: "closed" as const,
      lastActivity: new Date()
    }
  },
  memoryUsageMb: 128,
  queueDepth: 0,
  ...overrides
})

/**
 * Create a mock queue task for testing
 */
export const createMockQueueTask = (
  type: OperationType,
  resourceGroup: string = "computation"
): QueueTask<any> => ({
  id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  sessionId: "test-session",
  type,
  resourceGroup: resourceGroup as any,
  priority: 5,
  maxRetries: 3,
  estimatedDuration: seconds(1),
  operationData: some({ test: true }),
  operation: Effect.succeed("Mock task result")
})

/**
 * Measure execution time of an effect
 */
export const measureTime = <A, E>(
  effect: Effect.Effect<A, E>
): Effect.Effect<{ result: A; duration: Duration }, E> =>
  Effect.gen(function*() {
    const startTime = Date.now()
    const result = yield* effect
    const endTime = Date.now()
    const duration = millis(endTime - startTime)

    return { result, duration }
  })

/**
 * Run an effect with timeout for testing
 */
export const withTimeout = <A, E>(
  effect: Effect.Effect<A, E>,
  timeoutMs: number
): Effect.Effect<A, E | Error> =>
  Effect.race(
    effect,
    Effect.sleep(millis(timeoutMs)).pipe(
      Effect.flatMap(() => Effect.fail(new Error(`Operation timed out after ${timeoutMs}ms`)))
    )
  )

/**
 * Assert that an effect completes within a time limit
 */
export const assertCompletesWithin = <A, E>(
  effect: Effect.Effect<A, E>,
  maxTimeMs: number
) =>
  Effect.gen(function*() {
    const measured = yield* measureTime(effect)
    const actualTimeMs = toMillis(measured.duration)

    if (actualTimeMs > maxTimeMs) {
      yield* Effect.fail(
        new Error(`Expected operation to complete within ${maxTimeMs}ms, but took ${actualTimeMs}ms`)
      )
    }

    return measured.result
  })

/**
 * Create a delayed effect for testing timing
 */
export const delayedEffect = <A>(
  value: A,
  delayMs: number
): Effect.Effect<A, never> =>
  Effect.gen(function*() {
    yield* Effect.sleep(millis(delayMs))
    return value
  })

/**
 * Simulate concurrent load for testing
 */
export const simulateConcurrentLoad = <A, E>(
  effect: Effect.Effect<A, E>,
  concurrency: number,
  iterations: number
): Effect.Effect<Array<A>, E> =>
  Effect.all(
    Array.from({ length: iterations }, () => effect),
    { concurrency }
  )

/**
 * Verify queue health during operations
 */
export const verifyQueueHealth = Effect.sync(() => {
  // This would access the queue in a real test
  // For now, just ensure we can import the function
  return true
})

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate test file paths
 */
export const generateTestFilePaths = (count: number): Array<string> =>
  Array.from({ length: count }, (_, i) => `/test/generated-file-${i}.txt`)

/**
 * Generate test directory structure
 */
export const generateTestDirectoryStructure = (depth: number = 2, width: number = 3): Array<string> => {
  const paths: Array<string> = []

  const generateLevel = (currentPath: string, currentDepth: number) => {
    if (currentDepth >= depth) return

    for (let i = 0; i < width; i++) {
      const dirPath = `${currentPath}/dir${i}`
      const filePath = `${currentPath}/file${i}.txt`

      paths.push(dirPath)
      paths.push(filePath)

      generateLevel(dirPath, currentDepth + 1)
    }
  }

  generateLevel("/test", 0)
  return paths
}
