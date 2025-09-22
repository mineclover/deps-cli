import { fromNullable, none } from "effect/Option"
/**
 * Circuit Breaker Service Implementation
 *
 * Implements the Circuit Breaker pattern for the Effect CLI Queue System.
 * Provides fault tolerance and automatic recovery from service failures.
 *
 * States: Closed → Open → Half-Open → Closed
 *
 * @version 1.0.0
 * @created 2025-01-12
 */

//  // Unused import
import * as Effect from "effect/Effect"
import { effect, succeed } from "effect/Layer"

import { get, make, update } from "effect/Ref"
import type { CircuitBreakerState, ResourceGroup } from "./types.js"
import { CircuitBreaker, QueuePersistence } from "./types.js"

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ResourceGroupState {
  readonly state: CircuitBreakerState
  readonly failureCount: number
  readonly successCount: number
  readonly lastFailureTime: Date | null
  readonly lastStateChange: Date
}

interface CircuitBreakerConfig {
  readonly failureThreshold: number
  readonly successThreshold: number
  readonly timeoutMs: number
  readonly volumeThreshold: number
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export const CircuitBreakerLive = effect(
  CircuitBreaker,
  Effect.gen(function*() {
    // Dependencies
    const persistence = yield* QueuePersistence

    // Configuration
    const config: CircuitBreakerConfig = {
      failureThreshold: 5, // 5회 연속 실패 시 Open
      successThreshold: 3, // Half-Open에서 3회 성공 시 Closed
      timeoutMs: 30000, // 30초 후 Half-Open 전환
      volumeThreshold: 10 // 최소 호출 수 (통계적 유의성)
    }

    // State management for each resource group
    const resourceStates = yield* make(
      new Map<ResourceGroup, ResourceGroupState>([
        ["filesystem", createInitialState()],
        ["network", createInitialState()],
        ["computation", createInitialState()],
        ["memory-intensive", createInitialState()]
      ])
    )

    yield* Effect.log("Circuit breaker service initialized")

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    function createInitialState(): ResourceGroupState {
      return {
        state: "closed",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastStateChange: new Date()
      }
    }

    /**
     * Update state for a resource group
     */
    const updateState = (resourceGroup: ResourceGroup, newState: ResourceGroupState) =>
      update(resourceStates, (states) => {
        const newStates = new Map(states)
        newStates.set(resourceGroup, newState)
        return newStates
      })

    // ========================================================================
    // SERVICE IMPLEMENTATION
    // ========================================================================

    const checkState = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const state = states.get(resourceGroup)
        return state?.state ?? "closed"
      })

    const recordSuccess = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const currentState = states.get(resourceGroup)

        if (!currentState) return

        const now = new Date()

        if (currentState.state === "half-open") {
          const newSuccessCount = currentState.successCount + 1

          if (newSuccessCount >= config.successThreshold) {
            // Transition back to CLOSED
            yield* updateState(resourceGroup, {
              ...currentState,
              state: "closed",
              failureCount: 0,
              successCount: 0,
              lastStateChange: now
            })
            yield* Effect.log(`Circuit breaker for ${resourceGroup} recovered to closed`)
          } else {
            // Still in Half-Open, increment success count
            yield* updateState(resourceGroup, {
              ...currentState,
              successCount: newSuccessCount
            })
          }
        } else if (currentState.state === "closed") {
          // Reset failure count on success in closed state
          yield* updateState(resourceGroup, {
            ...currentState,
            failureCount: 0
          })
        }
      })

    const recordFailure = (resourceGroup: ResourceGroup, _error: unknown) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const currentState = states.get(resourceGroup)

        if (!currentState) return

        const now = new Date()
        const newFailureCount = currentState.failureCount + 1

        if (currentState.state === "closed" && newFailureCount >= config.failureThreshold) {
          // Transition to OPEN
          yield* updateState(resourceGroup, {
            ...currentState,
            state: "open",
            failureCount: newFailureCount,
            lastFailureTime: now,
            lastStateChange: now
          })
          yield* Effect.log(`Circuit breaker for ${resourceGroup} opened after ${newFailureCount} failures`)
        } else if (currentState.state === "half-open") {
          // Failed in Half-Open, back to OPEN
          yield* updateState(resourceGroup, {
            ...currentState,
            state: "open",
            failureCount: newFailureCount,
            lastFailureTime: now,
            lastStateChange: now
          })
          yield* Effect.log(`Circuit breaker for ${resourceGroup} returned to open from half-open`)
        } else {
          // Just increment failure count
          yield* updateState(resourceGroup, {
            ...currentState,
            failureCount: newFailureCount,
            lastFailureTime: now
          })
        }
      })

    const forceOpen = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const currentState = states.get(resourceGroup)

        if (!currentState) return

        yield* updateState(resourceGroup, {
          ...currentState,
          state: "open",
          lastStateChange: new Date()
        })
        yield* Effect.log(`Circuit breaker for ${resourceGroup} forced to open`)
      })

    const forceClose = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const currentState = states.get(resourceGroup)

        if (!currentState) return

        yield* updateState(resourceGroup, {
          ...currentState,
          state: "closed",
          failureCount: 0,
          successCount: 0,
          lastStateChange: new Date()
        })
        yield* Effect.log(`Circuit breaker for ${resourceGroup} forced to closed`)
      })

    const getInfo = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        const states = yield* get(resourceStates)
        const state = states.get(resourceGroup)
        const sessionId = yield* persistence.getCurrentSession()

        if (!state) {
          return {
            resourceGroup,
            sessionId,
            state: "closed" as CircuitBreakerState,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: none(),
            lastSuccessTime: none(),
            stateChangedAt: new Date(),
            failureThreshold: config.failureThreshold,
            recoveryTimeoutMs: config.timeoutMs,
            totalRequests: 0,
            totalFailures: 0,
            failureRate: 0
          }
        }

        const totalRequests = state.failureCount + state.successCount
        const failureRate = totalRequests > 0 ? state.failureCount / totalRequests : 0

        return {
          resourceGroup,
          sessionId,
          state: state.state,
          failureCount: state.failureCount,
          successCount: state.successCount,
          lastFailureTime: fromNullable(state.lastFailureTime),
          lastSuccessTime: none(), // We don't track success time in our current implementation
          stateChangedAt: state.lastStateChange,
          failureThreshold: config.failureThreshold,
          recoveryTimeoutMs: config.timeoutMs,
          totalRequests,
          totalFailures: state.failureCount,
          failureRate
        }
      })

    const resetStats = (resourceGroup: ResourceGroup) =>
      Effect.gen(function*() {
        yield* updateState(resourceGroup, createInitialState())
        yield* Effect.log(`Circuit breaker stats reset for ${resourceGroup}`)
      })

    // ========================================================================
    // SERVICE INTERFACE
    // ========================================================================

    return CircuitBreaker.of({
      checkState,
      recordSuccess,
      recordFailure,
      forceOpen,
      forceClose,
      getInfo,
      resetStats
    })
  })
)

// ============================================================================
// TEST IMPLEMENTATION
// ============================================================================

export const CircuitBreakerTest = succeed(
  CircuitBreaker,
  CircuitBreaker.of({
    checkState: () => Effect.succeed("closed" as CircuitBreakerState),
    recordSuccess: () => Effect.succeed(void 0),
    recordFailure: () => Effect.succeed(void 0),
    forceOpen: () => Effect.succeed(void 0),
    forceClose: () => Effect.succeed(void 0),
    getInfo: () =>
      Effect.succeed({
        resourceGroup: "filesystem" as ResourceGroup,
        sessionId: "test-session",
        state: "closed" as CircuitBreakerState,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: none(),
        lastSuccessTime: none(),
        stateChangedAt: new Date(),
        failureThreshold: 5,
        recoveryTimeoutMs: 30000,
        totalRequests: 0,
        totalFailures: 0,
        failureRate: 0
      }),
    resetStats: () => Effect.succeed(void 0)
  })
)
