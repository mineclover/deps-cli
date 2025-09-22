# CLI Development Guide

Complete guide for developing commands and features in the Effect CLI framework with intelligent performance optimization.

## 🎯 CLI Development Philosophy

### Core Principles

1. **Performance First**: Every command should be optimized for its use case
2. **Layer Intelligence**: Use conditional loading based on command requirements
3. **Effect Patterns**: Leverage Effect.js for type safety and composability
4. **Clean Architecture**: Separate concerns through service layers
5. **Developer Experience**: Commands should be intuitive and well-documented

## 🚀 Command Development Workflow

### Step 1: Planning Your Command

**Ask These Questions:**
- Does this command need the queue system? (Heavy operations)
- What services does this command require?
- Should this be fast execution or full-featured?
- What are the input parameters and validation rules?

**Command Classification:**
```typescript
// Simple Commands (Fast execution, minimal dependencies)
// Examples: greet, help, version, list
// Uses: SimpleAppLayer

// Complex Commands (Full system, queue integration)
// Examples: queue operations, data processing, file operations
// Uses: FullAppLayer
```

### Step 2: Create Command Structure

**Basic Command Template:**
```typescript
// src/commands/ExampleCommand.ts
import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// Define arguments
const nameArg = Args.text("name").pipe(
  Args.withDescription("Name parameter")
)

// Define options
const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output"),
  Options.withDefault(false)
)

// Create command
export const exampleCommand = Command.make("example", {
  name: nameArg,
  verbose: verboseOption
}).pipe(
  Command.withDescription("Example command demonstrating patterns"),
  Command.withHandler(({ name, verbose }) =>
    Effect.gen(function* () {
      if (verbose) {
        yield* Console.log(`Processing request for: ${name}`)
      }

      yield* Console.log(`Hello, ${name}!`)
    })
  )
)
```

**Command with Service Dependencies:**
```typescript
// src/commands/ServiceCommand.ts
import { FileSystem } from "../services/FileSystem.js"

export const fileCommand = Command.make("file", {
  path: Args.file("path")
}).pipe(
  Command.withDescription("File operation command"),
  Command.withHandler(({ path }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const exists = yield* fs.exists(path)

      if (exists) {
        yield* Console.log(`File exists: ${path}`)
      } else {
        yield* Console.log(`File not found: ${path}`)
      }
    })
  )
)
```

### Step 3: Register Your Command

**Update CLI Configuration:**
```typescript
// src/Cli.ts
import { exampleCommand } from "./commands/ExampleCommand.js"

const command = mainCommand.pipe(
  Command.withSubcommands([
    greetCommand,
    queueCommand,
    queueStatusCommand,
    simpleQueueCommand,
    exampleCommand  // Add your command here
  ])
)
```

**Update Layer Loading (if needed):**
```typescript
// src/bin.ts - Only if command needs queue system
const needsQueueSystem = (argv: Array<string>) => {
  const commandKeywords = [
    "queue",
    "queue-status",
    "queue-demo",
    "file"  // Add if your command needs full system
  ]
  return commandKeywords.some((keyword) => argv.includes(keyword))
}
```

### Step 4: Test Your Command

**Development Testing:**
```bash
# Test basic functionality
pnpm dev example "test-name"

# Test with options
pnpm dev example "test-name" --verbose

# Test error cases
pnpm dev example ""  # Test validation
```

**Quality Gates:**
```bash
# Type checking
pnpm check

# Linting
pnpm lint

# Build verification
pnpm build

# Full test suite
pnpm test
```

## 🛠️ Advanced Command Patterns

### Commands with Complex Arguments

```typescript
// Multiple argument types
const complexArgs = {
  file: Args.file("file"),
  directory: Args.directory("dir"),
  count: Args.integer("count").pipe(Args.withDefault(10)),
  pattern: Args.text("pattern").pipe(Args.optional)
}

export const complexCommand = Command.make("complex", complexArgs).pipe(
  Command.withHandler(({ file, directory, count, pattern }) =>
    Effect.gen(function* () {
      yield* Console.log(`Processing ${count} items`)
      if (pattern._tag === "Some") {
        yield* Console.log(`Using pattern: ${pattern.value}`)
      }
    })
  )
)
```

### Commands with Validation

```typescript
// Custom validation
const validateEmail = (email: string) =>
  email.includes("@")
    ? Effect.succeed(email)
    : Effect.fail(new Error("Invalid email format"))

export const emailCommand = Command.make("email", {
  email: Args.text("email")
}).pipe(
  Command.withHandler(({ email }) =>
    Effect.gen(function* () {
      const validEmail = yield* validateEmail(email)
      yield* Console.log(`Valid email: ${validEmail}`)
    })
  )
)
```

### Commands with Progress Tracking

```typescript
import { InternalQueue } from "../services/Queue/index.js"

export const processCommand = Command.make("process", {
  input: Args.text("input")
}).pipe(
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      const queue = yield* InternalQueue

      // Add task to queue with progress tracking
      yield* queue.enqueue({
        id: `process-${Date.now()}`,
        name: `Processing ${input}`,
        resourceGroup: "computation",
        priority: 1,
        task: Effect.gen(function* () {
          yield* Console.log("Step 1: Initializing...")
          yield* Effect.sleep("1 second")

          yield* Console.log("Step 2: Processing...")
          yield* Effect.sleep("2 seconds")

          yield* Console.log("Step 3: Finalizing...")
          yield* Effect.sleep("1 second")

          return `Processed: ${input}`
        })
      })

      // Process the task
      yield* queue.processNext("computation")
    })
  )
)
```

## 🔧 Service Integration Patterns

### Creating Custom Services

```typescript
// src/services/CustomService.ts
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

// 1. Define service interface
export interface CustomService {
  readonly process: (input: string) => Effect.Effect<string, CustomError>
  readonly validate: (input: string) => Effect.Effect<boolean>
}

// 2. Create service tag
export const CustomService = Context.GenericTag<CustomService>("CustomService")

// 3. Define errors
export class CustomError extends Data.TaggedError("CustomError")<{
  readonly reason: string
}> {}

// 4. Implement service
export const CustomServiceLive = Layer.effect(
  CustomService,
  Effect.gen(function* () {
    // Get dependencies
    const fileSystem = yield* FileSystem

    return {
      process: (input: string) =>
        Effect.gen(function* () {
          if (!input.trim()) {
            return yield* new CustomError({ reason: "Empty input" })
          }

          // Process with dependencies
          const processed = `Processed: ${input.toUpperCase()}`
          return processed
        }),

      validate: (input: string) =>
        Effect.succeed(input.length > 0)
    }
  })
)

// 5. Create test implementation
export const CustomServiceTest = Layer.succeed(
  CustomService,
  {
    process: (input: string) => Effect.succeed(`Test: ${input}`),
    validate: () => Effect.succeed(true)
  }
)
```

### Using Services in Commands

```typescript
// src/commands/CustomCommand.ts
import { CustomService } from "../services/CustomService.js"

export const customCommand = Command.make("custom", {
  input: Args.text("input")
}).pipe(
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      const service = yield* CustomService

      // Validate first
      const isValid = yield* service.validate(input)
      if (!isValid) {
        yield* Console.error("Invalid input provided")
        return
      }

      // Process with error handling
      const result = yield* service.process(input).pipe(
        Effect.catchTag("CustomError", error =>
          Effect.gen(function* () {
            yield* Console.error(`Processing failed: ${error.reason}`)
            return "Failed to process"
          })
        )
      )

      yield* Console.log(result)
    })
  )
)
```

## 📊 Performance Optimization

### Command Performance Patterns

**Fast Execution Commands:**
```typescript
// Commands that should start instantly
// - Use minimal dependencies
// - Avoid heavy imports
// - Use SimpleAppLayer

export const quickCommand = Command.make("quick", {}).pipe(
  Command.withHandler(() =>
    Effect.gen(function* () {
      // Minimal processing, fast response
      yield* Console.log("Quick response!")
    })
  )
)
```

**Heavy Processing Commands:**
```typescript
// Commands that need full system capabilities
// - Use queue system for task management
// - Load services conditionally
// - Use FullAppLayer

export const heavyCommand = Command.make("heavy", {
  data: Args.file("data")
}).pipe(
  Command.withHandler(({ data }) =>
    Effect.gen(function* () {
      const queue = yield* InternalQueue

      // Queue heavy processing
      yield* queue.enqueue({
        id: `heavy-${Date.now()}`,
        name: "Heavy processing task",
        resourceGroup: "computation",
        priority: 1,
        task: Effect.gen(function* () {
          // Heavy processing logic
          yield* Effect.sleep("5 seconds")
          return "Heavy processing complete"
        })
      })

      yield* queue.processNext("computation")
    })
  )
)
```

**Conditional Feature Loading:**
```typescript
// Load features based on command arguments
export const adaptiveCommand = Command.make("adaptive", {
  feature: Args.choice("feature", ["basic", "advanced"])
}).pipe(
  Command.withHandler(({ feature }) =>
    Effect.gen(function* () {
      if (feature === "advanced") {
        // Dynamically load advanced features
        const advanced = yield* Effect.suspend(() =>
          import("../features/advanced.js")
        )
        yield* advanced.process()
      } else {
        // Simple processing
        yield* Console.log("Basic processing")
      }
    })
  )
)
```

## 🧪 Testing Patterns

### Command Testing

```typescript
// test/commands/ExampleCommand.test.ts
import { describe, expect, it } from "vitest"
import { Effect, TestContext } from "effect"
import { exampleCommand } from "../../src/commands/ExampleCommand.js"

describe("ExampleCommand", () => {
  it("should greet with name", () =>
    Effect.gen(function* () {
      // Test command handler directly
      const result = yield* exampleCommand.handler({
        name: "World",
        verbose: false
      })

      // Verify behavior
      expect(result).toBeDefined()
    }).pipe(
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )

  it("should handle verbose mode", () =>
    Effect.gen(function* () {
      const result = yield* exampleCommand.handler({
        name: "Test",
        verbose: true
      })

      expect(result).toBeDefined()
    }).pipe(
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
})
```

### Service Testing

```typescript
// test/services/CustomService.test.ts
import { CustomService, CustomServiceLive } from "../../src/services/CustomService.js"

describe("CustomService", () => {
  it("should process valid input", () =>
    Effect.gen(function* () {
      const service = yield* CustomService
      const result = yield* service.process("test")

      expect(result).toBe("Processed: TEST")
    }).pipe(
      Effect.provide(CustomServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )

  it("should handle empty input", () =>
    Effect.gen(function* () {
      const service = yield* CustomService
      const result = yield* Effect.either(service.process(""))

      expect(result._tag).toBe("Left")
    }).pipe(
      Effect.provide(CustomServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
})
```

## 📚 Documentation Standards

### Command Documentation

```typescript
export const documentedCommand = Command.make("example", {
  input: Args.text("input").pipe(
    Args.withDescription("Input text to process")
  ),
  format: Options.choice("format", ["json", "text"]).pipe(
    Options.withDescription("Output format"),
    Options.withDefault("text")
  )
}).pipe(
  Command.withDescription("Example command showing documentation patterns"),
  Command.withHandler(({ input, format }) =>
    Effect.gen(function* () {
      // Implementation with clear intent
      const processed = `Processed: ${input}`

      if (format === "json") {
        yield* Console.log(JSON.stringify({ result: processed }))
      } else {
        yield* Console.log(processed)
      }
    })
  )
)
```

### JSDoc Standards

```typescript
/**
 * Process input data using the specified algorithm
 *
 * @param input - The input data to process
 * @param algorithm - Processing algorithm to use
 * @returns Effect that resolves to processed result
 *
 * @example
 * ```typescript
 * const result = yield* processData("hello", "uppercase")
 * // Result: "HELLO"
 * ```
 */
export const processData = (
  input: string,
  algorithm: "uppercase" | "lowercase"
): Effect.Effect<string, ProcessingError> =>
  Effect.gen(function* () {
    // Implementation
  })
```

## 🔄 Migration and Updates

### Updating Existing Commands

```typescript
// Before: Simple command
export const oldCommand = Command.make("old", { name: nameArg })

// After: Enhanced with options and better error handling
export const newCommand = Command.make("old", {
  name: nameArg,
  format: formatOption
}).pipe(
  Command.withDescription("Enhanced command with better functionality"),
  Command.withHandler(({ name, format }) =>
    Effect.gen(function* () {
      // Enhanced logic with backward compatibility
      const result = yield* processName(name).pipe(
        Effect.catchAll(error =>
          Effect.gen(function* () {
            yield* Console.error(`Error: ${error}`)
            return `Hello, ${name}!`  // Fallback to simple behavior
          })
        )
      )

      if (format === "json") {
        yield* Console.log(JSON.stringify({ greeting: result }))
      } else {
        yield* Console.log(result)
      }
    })
  )
)
```

### Layer Migration

```typescript
// When adding new commands that need different layers
const needsQueueSystem = (argv: Array<string>) => {
  const queueCommands = ["queue", "queue-status", "process", "heavy"]
  const advancedCommands = ["advanced", "analytics"]

  // Check for queue system requirements
  if (queueCommands.some(cmd => argv.includes(cmd))) {
    return "full"
  }

  // Check for advanced features
  if (advancedCommands.some(cmd => argv.includes(cmd))) {
    return "advanced"
  }

  return "simple"
}

// Dynamic layer selection
const getAppLayer = (type: string) => {
  switch (type) {
    case "full":
      return FullAppLayer
    case "advanced":
      return AdvancedAppLayer
    default:
      return SimpleAppLayer
  }
}

const layerType = needsQueueSystem(process.argv)
const selectedLayer = getAppLayer(layerType)
```

## 🏆 Best Practices Summary

### ✅ Do

- **Follow naming conventions**: Use clear, descriptive command names
- **Implement proper error handling**: Use Effect error management patterns
- **Write comprehensive tests**: Test both success and failure cases
- **Document thoroughly**: Include JSDoc and usage examples
- **Consider performance**: Choose appropriate layer loading strategy
- **Use TypeScript strict mode**: Leverage full type safety
- **Follow Effect patterns**: Use Effect.gen and proper service injection

### ❌ Don't

- **Break layer architecture**: Always use service injection over direct imports
- **Ignore performance implications**: Consider startup time and resource usage
- **Skip error handling**: Always handle potential failures gracefully
- **Use synchronous operations**: Prefer Effect-based async patterns
- **Hardcode dependencies**: Use dependency injection through services
- **Skip validation**: Validate all user inputs appropriately
- **Forget backward compatibility**: Consider existing users when updating commands

This guide provides a comprehensive foundation for developing high-quality CLI commands that leverage the full power of the Effect.js ecosystem while maintaining excellent performance and developer experience.