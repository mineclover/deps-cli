import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { log } from "effect/Console"
import * as Effect from "effect/Effect"

// TODO: Refactor to use FileSystem service

const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault(".")
)

const patternOption = Options.text("pattern").pipe(
  Options.withAlias("p"),
  Options.withDescription("Search pattern (e.g., *.txt, *.js)")
)

const caseSensitiveOption = Options.boolean("case-sensitive").pipe(
  Options.withAlias("c"),
  Options.withDescription("Perform case-sensitive search")
)

const formatFileSize = (bytes: bigint): string => {
  if (bytes === 0n) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Number(Math.log(Number(bytes)) / Math.log(1024)))
  return `${(Number(bytes) / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

export const findCommand = Command.make("find", {
  path: pathArg,
  pattern: patternOption,
  caseSensitive: caseSensitiveOption
}).pipe(
  Command.withDescription("Find files by name"),
  Command.withHandler(({ caseSensitive, path, pattern }) =>
    Effect.gen(function*() {
      const searchType = caseSensitive ? "case-sensitive" : "case-insensitive"
      yield* Effect.log(`Searching in ${path} for files matching ${pattern} (${searchType})`)

      // const files = yield* findFiles(path, pattern)
      const files: Array<any> = []

      if (files.length === 0) {
        yield* log("No files found.")
        return
      }

      yield* log("Found files:")
      for (const file of files) {
        const size = formatFileSize(file.size)
        yield* log(`${file.path} (${size})`)
      }

      const totalSize = files.reduce((sum, file) => sum + file.size, 0n)
      yield* log(`\nTotal size: ${formatFileSize(totalSize)}`)

      const largestFile = files.reduce((largest, file) => file.size > largest.size ? file : largest)
      yield* log(`Largest file: ${largestFile.path} (${formatFileSize(largestFile.size)})`)

      const smallestFile = files.reduce((smallest, file) => file.size < smallest.size ? file : smallest)

      yield* log(`Smallest file: ${smallestFile.path} (${formatFileSize(smallestFile.size)})`)
    })
  )
)
