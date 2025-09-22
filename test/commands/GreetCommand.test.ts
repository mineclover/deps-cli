import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { greetCommand } from "../../src/commands/GreetCommand.js"

/**
 * Basic GreetCommand Test
 *
 * Tests the simplified greet command template functionality.
 */

describe("GreetCommand", () => {
  describe("Basic Functionality", () => {
    it("should execute without throwing", () => {
      const handler = greetCommand.handler({ name: "Alice" })

      expect(() => Effect.runSync(handler)).not.toThrow()
    })

    it("should handle different names without throwing", () => {
      const handler = greetCommand.handler({ name: "Bob" })

      expect(() => Effect.runSync(handler)).not.toThrow()
    })

    it("should handle empty name without throwing", () => {
      const handler = greetCommand.handler({ name: "" })

      expect(() => Effect.runSync(handler)).not.toThrow()
    })

    it("should handle special characters without throwing", () => {
      const handler = greetCommand.handler({ name: "José María" })

      expect(() => Effect.runSync(handler)).not.toThrow()
    })
  })

  describe("Integration with Effect System", () => {
    it("should work with Effect.runPromise", async () => {
      const handler = greetCommand.handler({ name: "Async" })

      await expect(Effect.runPromise(handler)).resolves.not.toThrow()
    })

    it("should work within Effect composition", () => {
      const composedEffect = Effect.gen(function*() {
        yield* greetCommand.handler({ name: "Composed" })
        return "composition complete"
      })

      const result = Effect.runSync(composedEffect)
      expect(result).toBe("composition complete")
    })
  })
})
