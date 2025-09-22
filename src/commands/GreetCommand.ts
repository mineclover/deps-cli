import { log } from "effect/Console"
/**
 * Basic Greet Command Template
 *
 * This is a minimal command template showing the basic CLI structure.
 * Replace this with your actual production commands.
 */

import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"

import * as Effect from "effect/Effect"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("The name to greet")
)

export const greetCommand = Command.make("greet", { name: nameArg }).pipe(
  Command.withDescription("A simple greeting command template"),
  Command.withHandler(({ name }) =>
    Effect.gen(function*() {
      yield* log(`Hello, ${name}!`)
    })
  )
)
