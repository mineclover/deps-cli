# Effect CLI Development Guide

Complete guide for developing and extending the Effect CLI application with intelligent performance optimization.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm package manager
- TypeScript knowledge
- Basic understanding of Effect.js

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd effect-cli

# Install dependencies
pnpm install

# Verify setup
pnpm test
pnpm check
pnpm build
```

### Development Workflow

```bash
# Development with intelligent layer loading (optimized)
pnpm dev greet "Test"         # Fast execution, minimal logging
pnpm dev queue status         # Full system initialization when needed

# Type checking
pnpm check

# Run tests
pnpm test

# Format code
pnpm format

# Lint code
pnpm lint

# Build for production (optimized bundle)
pnpm build
```

## Adding New Commands

### 1. Create Command File

Create a new command file in `src/commands/`:

```typescript
// src/commands/MyCommand.ts
import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// Define arguments
const nameArg = Args.text("name").pipe(
  Args.withDescription("Name to greet")
)

// Define options
const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output")
)

// Create command
export const myCommand = Command.make("my-command", {
  name: nameArg,
  verbose: verboseOption
}).pipe(
  Command.withDescription("My custom command"),
  Command.withHandler(({ name, verbose }) =>
    Effect.gen(function* () {
      if (verbose) {
        yield* Console.log(`Processing command for: ${name}`)
      }
      yield* Console.log(`Hello, ${name}!`)
    })
  )
)
```

### 2. Register Command

Add your command to the CLI configuration:

```typescript
// src/Cli.ts
import { myCommand } from "./commands/MyCommand.js"

export const cli = Command.make("effect-cli", {}, {
  // ... existing commands
  myCommand,
}).pipe(
  // ... rest of configuration
)
```

### 3. Add Tests

Create tests for your command:

```typescript
// test/commands/MyCommand.test.ts
import { describe, expect, it } from "vitest"
import { Effect, TestContext } from "effect"
import { myCommand } from "../../src/commands/MyCommand.js"

describe("MyCommand", () => {
  it("should greet with name", () =>
    Effect.gen(function* () {
      const result = yield* myCommand.handler({
        name: "World",
        verbose: false
      })
      // Add assertions
    }).pipe(Effect.provide(TestContext.TestContext))
  )
})
```

## Project Architecture

### Core Structure

```
src/
├── commands/              # CLI command implementations
│   ├── GreetCommand.ts       # Basic greeting (optimized execution)
│   ├── QueueCommand.ts       # Queue management (full system)
│   └── QueueStatusCommand.ts # Queue monitoring (full system)
├── services/              # Business logic services
│   ├── Queue/                # Queue system (conditional loading)
│   ├── UserExperience/       # UX enhancements
│   ├── FileSystem.ts         # File operations interface
│   └── FileSystemLive.ts     # File operations implementation
├── examples/              # Example commands (toggleable)
│   ├── ListCommand.ts        # File listing example
│   ├── SampleCommand.ts      # Comprehensive example
│   └── config.ts            # Example configuration
├── Cli.ts                # Main CLI configuration (clean routing)
└── bin.ts                # Application entry point (intelligent layer loading)
```

### Service Layer Pattern

The CLI uses Effect's service layer pattern for dependency injection:

```typescript
// Define service interface
export interface MyService {
  readonly doSomething: (input: string) => Effect.Effect<string, MyError>
}

// Create service tag
export const MyService = Context.GenericTag<MyService>("MyService")

// Implement service
export const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    return {
      doSomething: (input: string) =>
        Effect.gen(function* () {
          // Implementation
          return `Processed: ${input}`
        })
    }
  })
)

// Use in command
export const myCommand = Command.make("my-command", { input: Args.text("input") }).pipe(
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      const service = yield* MyService
      const result = yield* service.doSomething(input)
      yield* Console.log(result)
    })
  )
)
```

## Queue System Integration

### Using the Queue System

The CLI includes a sophisticated queue system for task management:

```typescript
import { InternalQueue } from "../services/Queue/index.js"

export const queueCommand = Command.make("queue-demo", {}).pipe(
  Command.withHandler(() =>
    Effect.gen(function* () {
      const queue = yield* InternalQueue

      // Add task to queue
      yield* queue.enqueue({
        id: "task-1",
        name: "Sample Task",
        resourceGroup: "computation",
        priority: 1,
        task: Effect.succeed("Task completed")
      })

      // Process tasks
      yield* queue.processNext("computation")
    })
  )
)
```

### Queue Resource Groups

The queue system supports four resource groups:

1. **filesystem**: File I/O operations
2. **network**: Network requests
3. **computation**: CPU-intensive tasks
4. **memory-intensive**: High memory usage tasks

## Testing

### Test Structure

```
test/
├── commands/              # Command tests
├── services/              # Service tests
└── integration/           # Integration tests
```

### Writing Tests

Use Vitest with Effect's testing utilities:

```typescript
import { describe, expect, it } from "vitest"
import { Effect, TestContext } from "effect"

describe("MyCommand", () => {
  it("should handle success case", () =>
    Effect.gen(function* () {
      // Test implementation
      const result = yield* myCommand.handler({ input: "test" })
      expect(result).toBe("expected")
    }).pipe(
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )

  it("should handle error case", () =>
    Effect.gen(function* () {
      // Test error scenarios
      const result = yield* Effect.either(
        myCommand.handler({ input: "invalid" })
      )
      expect(result._tag).toBe("Left")
    }).pipe(
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    )
  )
})
```

### Test Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test MyCommand.test.ts

# Run tests with coverage
pnpm coverage

# Watch mode for development
pnpm test --watch
```

## Build and Distribution

### Build Process

```bash
# Build TypeScript to CommonJS
pnpm build

# Check build output
ls -la dist/
```

The build process:
1. Compiles TypeScript to CommonJS (`dist/bin.cjs`)
2. Copies `package.json` with correct configuration
3. Copies SQL schema files for queue system

### Global Installation

```bash
# Build and install globally
pnpm build
cd dist
npm link

# Verify installation
effect-cli --help
```

### Distribution

```bash
# Prepare for publishing
pnpm changeset

# Version bump
pnpm changeset-version

# Publish
pnpm changeset-publish
```

## Configuration

### Example Commands

Control example command visibility:

```typescript
// src/examples/config.ts
export const ENABLE_EXAMPLES = true

export const ExampleConfig = {
  LIST_COMMAND: true,
  SAMPLE_COMMAND: true,
  // ... other examples
}
```

### Environment Variables

The CLI respects these environment variables:

- `LOG_LEVEL`: Set logging level (debug, info, warning, error)
- `QUEUE_DB_PATH`: Custom path for queue database
- `MAX_QUEUE_SIZE`: Maximum queue size

## Debugging

### Development Debugging

```bash
# Enable debug logging
effect-cli --log-level debug greet "Test"

# Use TypeScript directly
tsx src/bin.ts greet "Test"
```

### VS Code Integration

Use the included VS Code configuration:

1. Install Effect VS Code extension
2. Set breakpoints in TypeScript files
3. Run debugger with F5

### Queue System Debugging

```bash
# Monitor queue status
effect-cli queue status --watch

# Export queue metrics
effect-cli queue export --format json -o debug-metrics.json

# View detailed queue information
effect-cli queue status --detailed
```

## Performance Optimization

### Intelligent Layer Loading

The CLI implements intelligent layer loading for optimal performance:

```typescript
// bin.ts - Key optimization patterns
const needsQueueSystem = (argv: string[]) => {
  const commandKeywords = ['queue', 'queue-status', 'queue-demo']
  return commandKeywords.some(keyword => argv.includes(keyword))
}

// Simple layer for basic commands (greet, help)
const SimpleAppLayer = mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  LoggerLayer
)

// Full layer for queue commands
const FullAppLayer = mergeAll(
  AppLayer,
  BasicQueueSystemLayer,
  DevToolsLive
)

// Dynamic layer selection
const selectedLayer = needsQueueSystem(process.argv) ? FullAppLayer : SimpleAppLayer
```

### Code Splitting

Commands are automatically code-split. Heavy operations should be lazy-loaded:

```typescript
const heavyOperation = Effect.suspend(() => import("./heavy-module.js"))
```

### Memory Management

- Use streaming for large files
- Implement proper cleanup in Effect cleanup functions
- Monitor queue size and implement backpressure
- Conditional service initialization saves 40-60% startup time

### Bundle Analysis

```bash
# Analyze bundle size
npx tsup --analyze

# Check dependencies
pnpm why <package-name>

# Performance testing
effect-cli greet "Test"     # Should be fast, minimal output
effect-cli queue status     # Full initialization when needed
```

## Development Best Practices

### Code Change Methodology

**🎯 Always Follow This Process:**

1. **Understand Before Changing**
   - Read existing code patterns and conventions
   - Check how similar features are implemented
   - Review related tests and documentation

2. **Test-Driven Development**
   - Write tests first when adding new features
   - Run existing tests before making changes
   - Ensure all tests pass after changes

3. **Incremental Changes**
   - Make small, focused commits
   - Test each change independently
   - Document the reasoning behind changes

4. **Quality Gates (MANDATORY)**
   ```bash
   # Before every commit
   pnpm check    # TypeScript type checking
   pnpm lint     # ESLint code quality
   pnpm build    # Production build verification
   pnpm test     # All tests must pass
   ```

### Code Modification Guidelines

#### ✅ **Appropriate Code Changes**

**Adding New Commands:**
```typescript
// 1. Create command file following existing patterns
// src/commands/NewCommand.ts
import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

const inputArg = Args.text("input").pipe(
  Args.withDescription("Input parameter")
)

export const newCommand = Command.make("new-command", { input: inputArg }).pipe(
  Command.withDescription("New command description"),
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      yield* Console.log(`Processing: ${input}`)
    })
  )
)

// 2. Register in src/Cli.ts
import { newCommand } from "./commands/NewCommand.js"

const command = mainCommand.pipe(
  Command.withSubcommands([
    greetCommand,
    queueCommand,
    queueStatusCommand,
    simpleQueueCommand,
    newCommand  // Add here
  ])
)

// 3. Update bin.ts if needed (for layer requirements)
const needsQueueSystem = (argv: Array<string>) => {
  const commandKeywords = ["queue", "queue-status", "queue-demo", "new-command"]
  return commandKeywords.some((keyword) => argv.includes(keyword))
}
```

**Modifying Existing Features:**
```typescript
// ✅ Good: Extend existing patterns
export const enhancedGreetCommand = greetCommand.pipe(
  Command.withOptions({ verbose: Options.boolean("verbose") }),
  Command.withHandler(({ name, verbose }) =>
    Effect.gen(function* () {
      if (verbose) {
        yield* Console.log(`Preparing to greet: ${name}`)
      }
      yield* Console.log(`Hello, ${name}!`)
    })
  )
)

// ✅ Good: Use Effect service pattern for complex logic
export const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          // Implementation with proper error handling
        })
    }
  })
)
```

**Performance-Conscious Changes:**
```typescript
// ✅ Good: Conditional loading for heavy dependencies
const needsAdvancedFeatures = (argv: Array<string>) => {
  return argv.some(arg => ["advanced", "complex"].includes(arg))
}

// ✅ Good: Lazy loading for optional features
const OptionalServiceLive = Layer.effect(
  OptionalService,
  Effect.suspend(() => import("./heavy-service.js")).pipe(
    Effect.map(mod => mod.createService())
  )
)
```

#### ❌ **Avoid These Patterns**

**Don't Break Layer Architecture:**
```typescript
// ❌ Bad: Direct imports without service pattern
import * as fs from "fs"  // Use FileSystem service instead

// ❌ Bad: Ignoring intelligent layer loading
// Always consider if new command needs queue system

// ❌ Bad: Hardcoded dependencies
const result = database.query("SELECT * FROM users")  // Use service injection
```

**Don't Ignore Performance:**
```typescript
// ❌ Bad: Always loading heavy dependencies
import { HeavyAnalytics } from "./heavy-analytics.js"  // Load conditionally

// ❌ Bad: Synchronous operations without Effect
const data = fs.readFileSync("file.txt")  // Use Effect and FileSystem service
```

### Feature Addition Methodology

#### 🚀 **Step-by-Step Feature Addition**

**Phase 1: Planning & Design**
```bash
# 1. Analyze requirements
# - Does this need queue system integration?
# - Should this be a simple or complex command?
# - What services does this require?

# 2. Check existing patterns
grep -r "similar-feature" src/
```

**Phase 2: Implementation**
```typescript
// 1. Create feature interface (if needed)
export interface NewFeatureService {
  readonly processData: (input: string) => Effect.Effect<string, FeatureError>
}

// 2. Implement service
export const NewFeatureServiceLive = Layer.effect(
  NewFeatureService,
  Effect.gen(function* () {
    // Service implementation with dependencies
    const fileSystem = yield* FileSystem

    return {
      processData: (input: string) =>
        Effect.gen(function* () {
          // Feature logic with proper error handling
          return `Processed: ${input}`
        })
    }
  })
)

// 3. Create command
export const newFeatureCommand = Command.make("feature", { input: inputArg }).pipe(
  Command.withDescription("New feature command"),
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      const service = yield* NewFeatureService
      const result = yield* service.processData(input)
      yield* Console.log(result)
    })
  )
)
```

**Phase 3: Integration**
```typescript
// 1. Update CLI configuration
// 2. Add to layer loading logic if needed
// 3. Update documentation
// 4. Add tests
```

**Phase 4: Testing & Validation**
```bash
# 1. Unit tests
pnpm test

# 2. Integration testing
pnpm dev feature "test-input"

# 3. Build verification
pnpm build

# 4. Type and lint checking
pnpm check && pnpm lint
```

### Service Development Patterns

#### **Creating New Services**

```typescript
// 1. Define service interface
export interface EmailService {
  readonly send: (to: string, message: string) => Effect.Effect<void, EmailError>
  readonly validate: (email: string) => Effect.Effect<boolean, ValidationError>
}

// 2. Create service tag
export const EmailService = Context.GenericTag<EmailService>("EmailService")

// 3. Implement live service
export const EmailServiceLive = Layer.effect(
  EmailService,
  Effect.gen(function* () {
    // Dependencies
    const config = yield* Config.string("EMAIL_PROVIDER")

    return {
      send: (to: string, message: string) =>
        Effect.gen(function* () {
          // Implementation with proper error handling
          yield* Effect.logInfo(`Sending email to ${to}`)
        }),

      validate: (email: string) =>
        Effect.succeed(email.includes("@"))
    }
  })
)

// 4. Create test implementation
export const EmailServiceTest = Layer.succeed(
  EmailService,
  {
    send: () => Effect.succeed(void 0),
    validate: () => Effect.succeed(true)
  }
)
```

#### **Service Composition**

```typescript
// Compose multiple services
export const AppServiceLayer = Layer.mergeAll(
  FileSystemLive,
  EmailServiceLive,
  DatabaseServiceLive
)

// Conditional service loading
const getServiceLayer = (features: Array<string>) => {
  let layer = CoreServiceLayer

  if (features.includes("email")) {
    layer = Layer.merge(layer, EmailServiceLive)
  }

  if (features.includes("analytics")) {
    layer = Layer.merge(layer, AnalyticsServiceLive)
  }

  return layer
}
```

### Error Handling Standards

#### **Proper Error Management**

```typescript
// 1. Define domain errors
export class FeatureError extends Data.TaggedError("FeatureError")<{
  readonly reason: string
  readonly context?: Record<string, unknown>
}> {}

// 2. Use in service implementation
export const processWithErrorHandling = (input: string) =>
  Effect.gen(function* () {
    // Validate input
    if (!input.trim()) {
      return yield* new FeatureError({
        reason: "Input cannot be empty",
        context: { providedInput: input }
      })
    }

    // Process with error recovery
    const result = yield* dangerousOperation(input).pipe(
      Effect.catchAll(error =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`Operation failed: ${error}`)
          return defaultValue
        })
      )
    )

    return result
  })

// 3. Handle in command
export const safeCommand = Command.make("safe", { input: inputArg }).pipe(
  Command.withHandler(({ input }) =>
    Effect.gen(function* () {
      const result = yield* processWithErrorHandling(input).pipe(
        Effect.catchTag("FeatureError", error =>
          Effect.gen(function* () {
            yield* Console.error(`Error: ${error.reason}`)
            yield* Effect.fail(new Error("Command failed"))
          })
        )
      )

      yield* Console.log(`Success: ${result}`)
    })
  )
)
```

## Contributing

### Code Style

- Follow TypeScript strict mode
- Use Effect.js patterns consistently
- Write comprehensive tests
- Document public APIs with JSDoc
- Always run quality gates before committing

### Commit Messages

Use conventional commits:

```
feat: add new queue export command
fix: resolve memory leak in file processing
docs: update CLI usage guide
test: add integration tests for queue system
```

### Pull Requests

1. Create feature branch
2. Write tests
3. Update documentation
4. Ensure all checks pass
5. Request review

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Run `pnpm check` to identify issues
2. **Test Failures**: Check Effect service dependencies
3. **Build Issues**: Clear dist folder and rebuild
4. **Queue Database**: Delete queue database to reset state

### Getting Help

- Check documentation in `docs/` directory
- Review test files for usage examples
- Examine existing commands for patterns
- Use Effect.js documentation for framework questions