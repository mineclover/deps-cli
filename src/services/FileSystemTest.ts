import * as Effect from "effect/Effect"
import { effect } from "effect/Layer"
import { get, make as makeRef } from "effect/Ref"
import { type FileInfo, FileSystem } from "./FileSystem.js"

export const make = (mockFiles: ReadonlyArray<FileInfo>) =>
  Effect.gen(function*() {
    const files = yield* makeRef(mockFiles)

    return FileSystem.of({
      listDirectory: (_path: string) => get(files),
      readFileContent: (_filePath: string) => Effect.succeed("mock file content"),
      findFiles: (_searchPath: string, _pattern: string) => Effect.succeed([])
    })
  })

export const layer = (mockFiles: ReadonlyArray<FileInfo>) => effect(FileSystem, make(mockFiles))
