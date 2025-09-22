import type { PlatformError } from "@effect/platform/Error"
import { Tag } from "effect/Context"
import type * as Effect from "effect/Effect"

export type FileInfo = {
  readonly name: string
  readonly path: string
  readonly isDirectory: boolean
  readonly size: bigint
}

export class FileSystem extends Tag("FileSystem")<
  FileSystem,
  {
    readonly listDirectory: (path: string) => Effect.Effect<ReadonlyArray<FileInfo>, PlatformError>
    readonly readFileContent: (filePath: string) => Effect.Effect<string, PlatformError>
    readonly findFiles: (searchPath: string, pattern: string) => Effect.Effect<ReadonlyArray<FileInfo>, PlatformError>
  }
>() {}
