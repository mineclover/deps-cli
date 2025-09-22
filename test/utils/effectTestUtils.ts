/**
 * Effect Test Utilities
 *
 * Specialized testing utilities for Effect ecosystem with consistent patterns
 * and best practices for TDD in Effect CLI projects.
 *
 * @version 1.0.0
 * @created 2025-09-13
 */

import type * as Context from "effect/Context"
import { millis, toMillis } from "effect/Duration"
import type { Duration } from "effect/Duration"
import * as Effect from "effect/Effect"
import type { Either } from "effect/Either"
import { isFailure, isSuccess } from "effect/Exit"
import { succeed } from "effect/Layer"
import type { Layer } from "effect/Layer"
import type { Schedule } from "effect/Schedule"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ============================================================================
// EFFECT TEST PATTERNS
// ============================================================================

/**
 * Test Pattern: Effect with Layer Provider
 * Standard pattern for testing Effects that require services
 */
export const testWithLayer = <R, E, A>(
  name: string,
  effect: Effect.Effect<A, E, R>,
  layer: Layer<R>,
  expectations?: (result: A) => void | Promise<void>
) =>
  it(name, () =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(layer),
        Effect.tap((result) => Effect.sync(() => expectations?.(result)))
      )
    ))

/**
 * Test Pattern: Effect Success Case
 * Verify Effect completes successfully with expected result
 */
export const expectSuccess = <A, E>(
  effect: Effect.Effect<A, E>,
  expectedValue?: A
): Effect.Effect<A, never> =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(effect)

    if (isFailure(exit)) {
      throw new Error(`Expected success but got failure: ${exit.cause}`)
    }

    const result = exit.value

    if (expectedValue !== undefined) {
      expect(result).toEqual(expectedValue)
    }

    return result
  })

/**
 * Test Pattern: Effect Failure Case
 * Verify Effect fails with expected error
 */
export const expectFailure = <A, E>(
  effect: Effect.Effect<A, E>,
  errorMatcher?: (error: E) => boolean
): Effect.Effect<E, never> =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(effect)

    if (isSuccess(exit)) {
      throw new Error(`Expected failure but got success: ${exit.value}`)
    }

    const error = exit.cause._tag === "Fail" ? exit.cause.error : exit.cause

    if (errorMatcher && !errorMatcher(error as E)) {
      throw new Error(`Failure didn't match expected pattern: ${error}`)
    }

    return error as E
  })

/**
 * Test Pattern: Effect Timing
 * Verify Effect completes within expected time bounds
 */
export const expectTimingWithin = <A, E>(
  effect: Effect.Effect<A, E>,
  maxDurationMs: number,
  minDurationMs: number = 0
): Effect.Effect<{ result: A; duration: Duration }, E> =>
  Effect.gen(function*() {
    const startTime = yield* Effect.sync(() => Date.now())
    const result = yield* effect
    const endTime = yield* Effect.sync(() => Date.now())

    const duration = millis(endTime - startTime)
    const durationMs = toMillis(duration)

    if (durationMs > maxDurationMs) {
      yield* Effect.fail(
        new Error(
          `Effect took ${durationMs}ms, expected max ${maxDurationMs}ms`
        ) as E
      )
    }

    if (durationMs < minDurationMs) {
      yield* Effect.fail(
        new Error(
          `Effect took ${durationMs}ms, expected min ${minDurationMs}ms`
        ) as E
      )
    }

    return { result, duration }
  })

// ============================================================================
// COMMAND TESTING UTILITIES
// ============================================================================

/**
 * Mock Console for CLI Testing
 * Captures console output for verification
 */
export interface MockConsole {
  readonly log: (...args: Array<any>) => void
  readonly error: (...args: Array<any>) => void
  readonly warn: (...args: Array<any>) => void
  readonly info: (...args: Array<any>) => void
  readonly getOutput: () => Array<string>
  readonly getErrors: () => Array<string>
  readonly clear: () => void
}

export const createMockConsole = (): MockConsole => {
  const outputs: Array<string> = []
  const errors: Array<string> = []

  const log = (...args: Array<any>) => {
    outputs.push(args.map(String).join(" "))
  }

  const error = (...args: Array<any>) => {
    errors.push(args.map(String).join(" "))
  }

  const warn = (...args: Array<any>) => {
    errors.push(`WARN: ${args.map(String).join(" ")}`)
  }

  const info = (...args: Array<any>) => {
    outputs.push(`INFO: ${args.map(String).join(" ")}`)
  }

  return {
    log,
    error,
    warn,
    info,
    getOutput: () => [...outputs],
    getErrors: () => [...errors],
    clear: () => {
      outputs.length = 0
      errors.length = 0
    }
  }
}

/**
 * Test CLI Command Pattern
 * Standard pattern for testing CLI commands with mocked console
 * Returns an Effect that can be used with TestContext.it
 */
export const testCliCommand = <Args, R>(
  commandHandler: (args: Args) => Effect.Effect<void, any, R>,
  args: Args,
  layer: Layer<R>,
  expectations: {
    output?: Array<string> | ((output: Array<string>) => void)
    errors?: Array<string> | ((errors: Array<string>) => void)
    exitCode?: number
  }
): Effect.Effect<void, any, R> =>
  Effect.gen(function*() {
    const mockConsole = createMockConsole()

    // Mock console methods
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    const originalInfo = console.info

    console.log = mockConsole.log
    console.error = mockConsole.error
    console.warn = mockConsole.warn
    console.info = mockConsole.info

    try {
      yield* commandHandler(args)

      // Verify output
      if (expectations.output) {
        const output = mockConsole.getOutput()
        if (Array.isArray(expectations.output)) {
          expect(output).toEqual(expectations.output)
        } else {
          expectations.output(output)
        }
      }

      // Verify errors
      if (expectations.errors) {
        const errors = mockConsole.getErrors()
        if (Array.isArray(expectations.errors)) {
          expect(errors).toEqual(expectations.errors)
        } else {
          expectations.errors(errors)
        }
      }
    } finally {
      // Restore console
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      console.info = originalInfo
    }
  })

// ============================================================================
// SERVICE MOCKING UTILITIES
// ============================================================================

/**
 * Create Mock Service
 * Helper for creating mock implementations of Effect services
 */
export const createMockService = <T>(
  tag: Context.Tag<T, any>,
  implementation: Partial<T>
): Layer<T> => succeed(tag, implementation as T)

/**
 * Mock Service with Spies
 * Create mock service with all methods as spies for verification
 */
export const createSpyService = <T extends Record<string, any>>(
  tag: Context.Tag<T, any>,
  methods: Array<keyof T>
): Layer<T> => {
  const spies = {} as T

  for (const method of methods) {
    ;(spies as any)[method] = vi.fn()
  }

  return succeed(tag, spies)
}

// ============================================================================
// EFFECT GENERATOR TESTING
// ============================================================================

/**
 * Test Effect Generator Steps
 * Verify each step of an Effect generator function
 */
export const testEffectSteps = <R, _E, A>(
  name: string,
  effectGen: () => Generator<Effect.Effect<any, any, any>, A, any>,
  layer: Layer<R>,
  stepVerifications?: Array<(stepResult: unknown, stepIndex: number) => void>
) =>
  it(name, () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const generator = effectGen()
        let stepIndex = 0
        let result = generator.next()

        while (!result.done) {
          const stepResult = yield* result.value

          if (stepVerifications?.[stepIndex]) {
            stepVerifications[stepIndex](stepResult, stepIndex)
          }

          result = generator.next(stepResult)
          stepIndex++
        }

        return result.value
      }).pipe(Effect.provide(layer)) as Effect.Effect<A, any, never>
    ))

// ============================================================================
// PARALLEL TESTING UTILITIES
// ============================================================================

/**
 * Test Concurrent Effects
 * Verify Effects work correctly when run concurrently
 */
export const testConcurrentEffects = <A, E, R>(
  name: string,
  effects: Array<Effect.Effect<A, E, R>>,
  layer: Layer<R>,
  options: {
    concurrency?: number
    expectations?: (results: Array<A>) => void
    timing?: { min: number; max: number }
  } = {}
) =>
  it(name, () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const startTime = yield* Effect.sync(() => Date.now())

        const results = yield* Effect.all(effects, {
          concurrency: options.concurrency ?? "unbounded"
        })

        const endTime = yield* Effect.sync(() => Date.now())
        const duration = endTime - startTime

        // Verify timing if specified
        if (options.timing) {
          expect(duration).toBeGreaterThanOrEqual(options.timing.min)
          expect(duration).toBeLessThanOrEqual(options.timing.max)
        }

        // Verify results
        options.expectations?.(results)

        return results
      }).pipe(Effect.provide(layer))
    ))

// ============================================================================
// RETRY AND RESILIENCE TESTING
// ============================================================================

/**
 * Test Effect Retry Behavior
 * Verify retry logic works correctly
 */
export const testRetryBehavior = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>,
  retrySchedule: Schedule<unknown, E, unknown>,
  layer: Layer<R>,
  expectations: {
    maxAttempts: number
    shouldSucceed?: boolean
    finalResult?: A
  }
) =>
  it(name, () =>
    Effect.runPromise(
      Effect.gen(function*() {
        let attempts = 0

        const instrumentedEffect = effect.pipe(
          Effect.tap(() => Effect.sync(() => attempts++))
        )

        const result = yield* Effect.either(
          instrumentedEffect.pipe(Effect.retry(retrySchedule))
        )

        expect(attempts).toBeLessThanOrEqual(expectations.maxAttempts)

        if (expectations.shouldSucceed) {
          expect(result._tag).toBe("Right")
          if (expectations.finalResult !== undefined) {
            expect(result).toEqual({ _tag: "Right", right: expectations.finalResult })
          }
        } else {
          expect(result._tag).toBe("Left")
        }

        return result
      }).pipe(Effect.provide(layer)) as Effect.Effect<Either<A, unknown>, never, never>
    ))

// ============================================================================
// TEST SUITE HELPERS
// ============================================================================

/**
 * Create Test Suite
 * Helper for creating well-structured test suites
 */
export const createTestSuite = (
  suiteName: string,
  setup: {
    layer?: Layer<any>
    beforeEach?: () => void | Promise<void>
    afterEach?: () => void | Promise<void>
  },
  tests: () => void
) =>
  describe(suiteName, () => {
    if (setup.beforeEach) {
      beforeEach(setup.beforeEach)
    }

    if (setup.afterEach) {
      afterEach(setup.afterEach)
    }

    tests()
  })

/**
 * Effect Test Assertion Helpers
 */
export const assertions = {
  /**
   * Assert Effect succeeds with specific value
   */
  succeeds: <A>(expected: A) => (actual: A) => {
    expect(actual).toEqual(expected)
  },

  /**
   * Assert Effect result matches predicate
   */
  satisfies: <A>(predicate: (value: A) => boolean, message?: string) => (actual: A) => {
    expect(predicate(actual)).toBe(true)
    if (message) {
      expect(actual).toBeDefined() // Additional context in message
    }
  },

  /**
   * Assert Effect result has specific structure
   */
  hasStructure: <A>(structure: Partial<A>) => (actual: A) => {
    expect(actual).toMatchObject(structure)
  },

  /**
   * Assert array results
   */
  arrayLength: (expectedLength: number) => <A>(actual: Array<A>) => {
    expect(actual).toHaveLength(expectedLength)
  },

  /**
   * Assert string results
   */
  stringContains: (substring: string) => (actual: string) => {
    expect(actual).toContain(substring)
  },

  /**
   * Assert number results
   */
  numberInRange: (min: number, max: number) => (actual: number) => {
    expect(actual).toBeGreaterThanOrEqual(min)
    expect(actual).toBeLessThanOrEqual(max)
  }
}
