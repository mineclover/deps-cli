import { FileSystem } from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { sort } from "effect/Array"
import * as Effect from "effect/Effect"
import { succeed } from "effect/Effect"
import { effect } from "effect/Layer"
import { make } from "effect/Order"

import { type FileInfo, FileSystem as AppFileSystem } from "./FileSystem.js"

export const FileSystemLive = effect(
  AppFileSystem,
  Effect.gen(function*() {
    const fs = yield* FileSystem
    const path = yield* Path.Path

    const listDirectory = (dirPath: string) =>
      Effect.gen(function*() {
        const entries = yield* fs.readDirectory(dirPath)

        const fileInfos = yield* Effect.forEach(entries, (entry) =>
          Effect.gen(function*() {
            const fullPath = path.join(dirPath, entry)
            const stat = yield* fs.stat(fullPath)

            return {
              name: entry,
              path: fullPath,
              isDirectory: stat.type === "Directory",
              size: stat.size
            } satisfies FileInfo
          }))

        const fileOrder = make<FileInfo>((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        })

        return sort(fileInfos, fileOrder)
      }).pipe(
        Effect.withSpan("list-directory", {
          attributes: { path: dirPath }
        })
      )

    const readFileContent = (filePath: string) =>
      fs.readFileString(filePath).pipe(
        Effect.withSpan("read-file-content", {
          attributes: { path: filePath }
        })
      )

    const findFiles = (searchPath: string, pattern: string) =>
      Effect.gen(function*() {
        const results: Array<FileInfo> = []

        const searchRecursive = (currentPath: string): Effect.Effect<void> =>
          Effect.gen(function*() {
            const entries = yield* fs.readDirectory(currentPath).pipe(
              Effect.catchAll(() => succeed([]))
            )

            yield* Effect.forEach(entries, (entry) =>
              Effect.gen(function*() {
                const fullPath = path.join(currentPath, entry)
                const stat = yield* fs.stat(fullPath).pipe(
                  Effect.catchAll(() => succeed(null))
                )

                if (!stat) return

                const fileInfo: FileInfo = {
                  name: entry,
                  path: fullPath,
                  isDirectory: stat.type === "Directory",
                  size: stat.size
                }

                if (entry.toLowerCase().includes(pattern.toLowerCase())) {
                  results.push(fileInfo)
                }

                if (stat.type === "Directory") {
                  yield* searchRecursive(fullPath)
                }
              }))
          })

        yield* searchRecursive(searchPath)
        return results
      }).pipe(
        Effect.withSpan("find-files", {
          attributes: { searchPath, pattern }
        })
      )

    return AppFileSystem.of({
      listDirectory,
      readFileContent,
      findFiles
    })
  })
)
