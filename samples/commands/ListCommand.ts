import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { filter } from "effect/Array"
import { log } from "effect/Console"
import * as Effect from "effect/Effect"
import { FileSystem } from "../services/FileSystem.js"

const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault(".")
)

const longOption = Options.boolean("long").pipe(
  Options.withAlias("l"),
  Options.withDescription("Use long listing format")
)

const allOption = Options.boolean("all").pipe(
  Options.withAlias("a"),
  Options.withDescription("Show hidden files")
)

const formatFileSize = (bytes: bigint): string => {
  const units = ["B", "KB", "MB", "GB"]
  let size = Number(bytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)}${units[unitIndex]}`
}

const formatFileInfo = (file: { name: string; isDirectory: boolean; size: bigint }, long: boolean) => {
  const prefix = file.isDirectory ? "📁" : "📄"
  const name = file.isDirectory ? `${file.name}/` : file.name

  if (long) {
    const size = formatFileSize(file.size)
    const type = file.isDirectory ? "DIR" : "FILE"
    return `${prefix} ${type.padEnd(4)} ${size.padStart(8)} ${name}`
  }

  return `${prefix} ${name}`
}

export const listCommand = Command.make("ls", {
  path: pathArg,
  long: longOption,
  all: allOption
}).pipe(
  Command.withDescription("List directory contents"),
  Command.withHandler(({ all, long, path }) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem
      yield* Effect.log(`Listing directory: ${path}`)

      const files = yield* fs.listDirectory(path)

      const filteredFiles = all
        ? files
        : filter(files, (file) => !file.name.startsWith("."))

      if (filteredFiles.length === 0) {
        yield* log("Empty directory")
        return
      }

      if (long) {
        yield* log("Type Size     Name")
        yield* log("---- -------- ----")
      }

      yield* Effect.forEach(filteredFiles, (file) => log(formatFileInfo(file, long)))

      const dirCount = filter(filteredFiles, (f) => f.isDirectory).length
      const fileCount = filteredFiles.length - dirCount

      yield* log(`\nTotal: ${fileCount} files, ${dirCount} directories`)

      yield* Effect.log("Directory listing completed")
    })
  )
)
