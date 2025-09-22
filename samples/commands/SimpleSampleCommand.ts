/**
 * Simple Sample Command - Platform FileSystem 직접 사용
 * 
 * Effect CLI의 다양한 패턴을 보여주는 간단한 예제 커맨드
 */

import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { log, error } from "effect/Console"
import * as Effect from "effect/Effect"
import { isSome } from "effect/Option"
import { FileSystem } from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

// ============================================
// 1. Arguments (인수) 패턴
// ============================================

// 필수 파일 인수
const fileArg = Args.file({ name: "file" }).pipe(
  Args.withDescription("File to read")
)

// 선택적 디렉토리 인수 (기본값: 현재 디렉토리)
const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault("."),
  Args.withDescription("Directory to search")
)

// 텍스트 패턴 인수
const patternArg = Args.text({ name: "pattern" }).pipe(
  Args.withDescription("Search pattern")
)

// ============================================
// 2. Options (옵션) 패턴
// ============================================

// Boolean 옵션 (별칭 포함)
const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output")
)

// Choice 옵션
const formatOption = Options.choice("format", ["json", "text", "table"]).pipe(
  Options.withDescription("Output format"),
  Options.withDefault("text")
)

// Integer 옵션 (선택적)
const limitOption = Options.integer("limit").pipe(
  Options.withDescription("Maximum number of results"),
  Options.optional
)

// ============================================
// 3. 명령어 정의
// ============================================

export const simpleSampleCommand = Command.make("sample", {
  // 인수들
  file: fileArg,
  path: pathArg,
  pattern: patternArg,
  // 옵션들
  verbose: verboseOption,
  format: formatOption,
  limit: limitOption
}).pipe(
  Command.withDescription("Simple sample command demonstrating patterns"),
  // ============================================
  // 4. 핸들러 구현
  // ============================================
  Command.withHandler(({ file, path, pattern, verbose, format, limit }) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem
      const pathService = yield* Path.Path

      // 1. 시작 로그
      if (verbose) {
        yield* log("🚀 Simple Sample Command Started")
        yield* log(`📄 File: ${file}`)
        yield* log(`📁 Path: ${path}`)
        yield* log(`🔍 Pattern: ${pattern}`)
        yield* log(`📊 Format: ${format}`)
      }

      // 2. 파일 읽기
      yield* log("\n=== File Content Analysis ===")
      const fileContent = yield* fs.readFileString(file).pipe(
        Effect.catchAll((error) => {
          return error(`❌ Cannot read file: ${error}`)
            .pipe(Effect.as(""))
        })
      )

      if (fileContent) {
        const lines = fileContent.split("\n")
        yield* log(`📄 File: ${file}`)
        yield* log(`📝 Lines: ${lines.length}`)
        
        // 처음 3줄 미리보기
        const preview = lines.slice(0, 3).join("\\n")
        yield* log(`👀 Preview: ${preview}${lines.length > 3 ? "..." : ""}`)
      }

      // 3. 디렉토리 검색
      yield* log("\n=== Directory Search ===")
      const entries = yield* fs.readDirectory(path).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      )

      // 패턴 필터링
      const filteredEntries = entries.filter(entry => 
        entry.toLowerCase().includes(pattern.toLowerCase())
      )

      // limit 적용
      const maxResults = isSome(limit) ? limit.value : filteredEntries.length
      const results = filteredEntries.slice(0, maxResults)

      if (verbose) {
        yield* log(`🔍 Found ${filteredEntries.length} entries matching "${pattern}"`)
        if (isSome(limit)) {
          yield* log(`📊 Showing first ${maxResults} results`)
        }
      }

      // 4. 결과 출력 (format에 따라)
      yield* log(`\n=== Results (${format} format) ===`)

      if (results.length === 0) {
        yield* log("📭 No matching files found")
        return
      }

      switch (format) {
        case "json":
          const jsonData = {
            file: {
              path: file,
              lines: fileContent ? fileContent.split("\n").length : 0
            },
            search: {
              path,
              pattern,
              results: yield* Effect.forEach(results, (entry) =>
                Effect.gen(function*() {
                  const fullPath = pathService.join(path, entry)
                  const stat = yield* fs.stat(fullPath).pipe(
                    Effect.catchAll(() => Effect.succeed(null))
                  )
                  
                  return {
                    name: entry,
                    path: fullPath,
                    type: stat?.type === "Directory" ? "directory" : "file",
                    size: stat ? Number(stat.size) : 0
                  }
                })
              )
            }
          }
          yield* log(JSON.stringify(jsonData, null, 2))
          break

        case "table":
          yield* log("Type      Size        Name")
          yield* log("--------- ----------- --------------------")
          
          yield* Effect.forEach(results, (entry) =>
            Effect.gen(function*() {
              const fullPath = pathService.join(path, entry)
              const stat = yield* fs.stat(fullPath).pipe(
                Effect.catchAll(() => Effect.succeed(null))
              )
              
              const type = stat?.type === "Directory" ? "DIR" : "FILE"
              const size = stat ? formatBytes(stat.size) : "0 B"
              
              yield* log(`${type.padEnd(9)} ${size.padStart(11)} ${entry}`)
            })
          )
          break

        case "text":
        default:
          yield* Effect.forEach(results, (entry) =>
            Effect.gen(function*() {
              const fullPath = pathService.join(path, entry)
              const stat = yield* fs.stat(fullPath).pipe(
                Effect.catchAll(() => Effect.succeed(null))
              )
              
              const icon = stat?.type === "Directory" ? "📁" : "📄"
              yield* log(`${icon} ${entry}`)
            })
          )
          break
      }

      // 5. 요약
      yield* log("\n=== Summary ===")
      yield* log(`✅ Found ${results.length} matching entries`)
      
      if (isSome(limit) && filteredEntries.length > maxResults) {
        yield* log(`⚠️  Results limited to ${maxResults}`)
      }

      if (verbose) {
        yield* log("🏁 Simple Sample Command Completed")
      }
    })
  )
)

// ============================================
// 유틸리티 함수
// ============================================

const formatBytes = (bytes: bigint): string => {
  const units = ["B", "KB", "MB", "GB"]
  let size = Number(bytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}