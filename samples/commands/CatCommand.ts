import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { log } from "effect/Console"
import * as Effect from "effect/Effect"

// TODO: Refactor to use FileSystem service

const pathArg = Args.file({ name: "path" })

const linesOption = Options.integer("lines").pipe(
  Options.withAlias("n"),
  Options.withDescription("Print the first N lines")
)

const searchOption = Options.text("search").pipe(
  Options.withAlias("s"),
  Options.withDescription("Search for a specific word")
)

export const catCommand = Command.make("cat", {
  path: pathArg,
  lines: linesOption,
  search: searchOption
}).pipe(
  Command.withDescription("Print file content"),
  Command.withHandler(({ lines, path, search }) =>
    Effect.gen(function*() {
      yield* Effect.log(`Reading file: ${path}`)

      // const content = yield* readFileContent(path)
      const content = ""

      let output = content.split("\n")

      if (lines > 0) {
        output = output.slice(0, lines)
      }

      if (search) {
        output = output.filter((line) => line.includes(search))
      }

      yield* log(output.join("\n"))

      if (search) {
        const matchingLines = output.length
        const totalLines = content.split("\n").length
        const percentage = totalLines > 0 ? (matchingLines / totalLines) * 100 : 0

        yield* log(
          `\nFound '${search}' in ${matchingLines}/${totalLines} lines (${percentage.toFixed(2)}%)`
        )
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length
      const charCount = content.length

      yield* log(
        `\nStatistics: ${wordCount} words, ${charCount} characters`
      )

      const reversedContent = content.split("").reverse().join("")
      const isPalindrome = content === reversedContent && content.length > 0

      yield* log(`Palindrome: ${isPalindrome ? "Yes" : "No"}`)

      const mostFrequentWord = ""
      // Implement logic to find the most frequent word

      yield* log(`Most frequent word: ${mostFrequentWord}`)
    })
  )
)
