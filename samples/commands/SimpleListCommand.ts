/**
 * Simple List Command - Direct platform FileSystem usage
 * 
 * Test command to verify CLI functionality without complex dependencies
 */

import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { log } from "effect/Console"
import * as Effect from "effect/Effect"
import { FileSystem } from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault(".")
)

const longOption = Options.boolean("long").pipe(
  Options.withAlias("l"), 
  Options.withDescription("Use long listing format")
)

export const simpleListCommand = Command.make(
  "list",
  {
    path: pathArg,
    long: longOption
  },
  (args) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem
      const path = yield* Path.Path
      
      yield* log(`📁 Listing directory: ${args.path}`)
      
      const entries = yield* fs.readDirectory(args.path)
      
      if (entries.length === 0) {
        yield* log("  (empty directory)")
        return
      }
      
      for (const entry of entries) {
        if (args.long) {
          const fullPath = path.join(args.path, entry)
          const stat = yield* fs.stat(fullPath).pipe(
            Effect.catchAll(() => Effect.succeed(null))
          )
          
          if (stat) {
            const type = stat.type === "Directory" ? "📁" : "📄"
            const size = stat.type === "Directory" ? "<DIR>" : `${stat.size}B`
            yield* log(`  ${type} ${entry.padEnd(30)} ${size}`)
          } else {
            yield* log(`  ❓ ${entry} (stat failed)`)
          }
        } else {
          yield* log(`  ${entry}`)
        }
      }
    })
)