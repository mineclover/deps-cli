import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { log } from "effect/Console"
import * as Effect from "effect/Effect"
import { isSome } from "effect/Option"
import { FileSystem } from "../services/FileSystem.js"

// ============================================
// 1. Arguments (인수) 패턴
// ============================================

// 필수 인수
const fileArg = Args.file({ name: "file" }).pipe(
  Args.withDescription("File to process")
)

// 기본값이 있는 선택적 인수
const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault("."),
  Args.withDescription("Directory path")
)

// 텍스트 인수
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

// Choice 옵션 (선택적)
const formatOption = Options.choice("format", ["json", "text", "table"]).pipe(
  Options.withDescription("Output format"),
  Options.withDefault("text")
)

// Integer 옵션 (선택적)
const limitOption = Options.integer("limit").pipe(
  Options.withDescription("Maximum number of results"),
  Options.optional
)

// String 옵션 (여러 개 허용)
const excludeOption = Options.text("exclude").pipe(
  Options.withDescription("Patterns to exclude"),
  Options.repeated
)

// ============================================
// 3. 명령어 정의
// ============================================

export const sampleCommand = Command.make("sample", {
  // 인수들
  file: fileArg,
  path: pathArg,
  pattern: patternArg,
  // 옵션들
  verbose: verboseOption,
  format: formatOption,
  limit: limitOption,
  exclude: excludeOption
}).pipe(
  Command.withDescription("Sample command demonstrating all patterns"),
  // ============================================
  // 4. 핸들러 구현 패턴
  // ============================================
  Command.withHandler(({
    exclude,
    file,
    format,
    limit,
    path,
    pattern,
    verbose
  }) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem

      // 1. 시작 로그 (verbose 모드에서만)
      if (verbose) {
        yield* Effect.log(`Sample command started`)
        yield* Effect.log(`File: ${file}`)
        yield* Effect.log(`Path: ${path}`)
        yield* Effect.log(`Pattern: ${pattern}`)
        yield* Effect.log(`Format: ${format}`)
      }

      // 2. Optional 처리
      const maxResults = isSome(limit) ? limit.value : 100
      if (verbose && isSome(limit)) {
        yield* log(`Limiting results to ${maxResults}`)
      }

      // 3. 배열 옵션 처리 (exclude)
      const excludePatterns = exclude.length > 0 ? exclude : []
      if (verbose && excludePatterns.length > 0) {
        yield* log(`Excluding patterns: ${excludePatterns.join(", ")}`)
      }

      // 4. 핵심 로직 실행
      yield* log("\n=== Processing Started ===")

      // 4-1. 파일 내용 읽기
      const fileContent = yield* fs.readFileContent(file).pipe(
        Effect.tap(() => {
          if (verbose) {
            return Effect.log("File content loaded successfully")
          }
          return Effect.succeed(undefined)
        })
      )

      // 4-2. 디렉토리 검색
      const searchResults = yield* fs.findFiles(path, pattern).pipe(
        Effect.map((results) => {
          // exclude 패턴 필터링
          if (excludePatterns.length > 0) {
            return results.filter((r) => !excludePatterns.some((p) => r.name.includes(p)))
          }
          return results
        }),
        Effect.map((results) => {
          // limit 적용
          return results.slice(0, maxResults)
        })
      )

      // 5. 결과 출력 (format에 따라)
      yield* log(`\n=== Results (${format} format) ===`)

      switch (format) {
        case "json":
          yield* log(JSON.stringify(
            {
              file: {
                path: file,
                lines: fileContent.split("\n").length
              },
              searchResults: searchResults.map((r) => ({
                name: r.name,
                path: r.path,
                type: r.isDirectory ? "directory" : "file",
                size: Number(r.size)
              }))
            },
            null,
            2
          ))
          break

        case "table":
          // 테이블 헤더
          yield* log("Type      Size        Name")
          yield* log("--------- ----------- --------------------")

          // 테이블 데이터
          yield* Effect.forEach(searchResults, (result) => {
            const type = result.isDirectory ? "DIR" : "FILE"
            const size = formatBytes(result.size)
            return log(
              `${type.padEnd(9)} ${size.padStart(11)} ${result.name}`
            )
          })
          break

        case "text":
        default:
          // 파일 정보
          yield* log(`\nFile: ${file}`)
          yield* log(`Lines: ${fileContent.split("\n").length}`)

          // 검색 결과
          yield* log(`\nSearch results for pattern "${pattern}":`)
          if (searchResults.length === 0) {
            yield* log("No results found")
          } else {
            yield* Effect.forEach(searchResults, (result) => {
              const icon = result.isDirectory ? "📁" : "📄"
              return log(`${icon} ${result.path}`)
            })
          }
          break
      }

      // 6. 요약 정보
      yield* log("\n=== Summary ===")
      const dirCount = searchResults.filter((r) => r.isDirectory).length
      const fileCount = searchResults.length - dirCount
      yield* log(`Total: ${fileCount} files, ${dirCount} directories`)

      if (excludePatterns.length > 0) {
        yield* log(`Excluded patterns: ${excludePatterns.length}`)
      }

      if (isSome(limit) && searchResults.length === maxResults) {
        yield* log(`Results limited to ${maxResults}`)
      }

      // 7. 완료 로그
      if (verbose) {
        yield* Effect.log("Sample command completed successfully")
      }
    }).pipe(
      // Span 추가 (트레이싱)
      Effect.withSpan("sample-command", {
        attributes: {
          file,
          path,
          pattern,
          format
        }
      })
    )
  )
)

// ============================================
// 5. 유틸리티 함수
// ============================================

const formatBytes = (bytes: bigint): string => {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = Number(bytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// ============================================
// 6. 추가 명령어 예제 - 서브커맨드 패턴
// ============================================

const infoSubcommand = Command.make("info", {
  target: Args.text({ name: "target" })
}).pipe(
  Command.withDescription("Show information about target"),
  Command.withHandler(({ target }) =>
    Effect.gen(function*() {
      yield* log(`Information about: ${target}`)
      // 구현...
    })
  )
)

const processSubcommand = Command.make("process", {
  input: Args.file({ name: "input" }),
  output: Args.file({ name: "output" }).pipe(Args.optional)
}).pipe(
  Command.withDescription("Process input file"),
  Command.withHandler(({ input, output }) =>
    Effect.gen(function*() {
      yield* log(`Processing: ${input}`)
      if (isSome(output)) {
        yield* log(`Output to: ${output.value}`)
      }
      // 구현...
    })
  )
)

// 서브커맨드가 있는 메인 명령어
export const advancedCommand = Command.make("advanced").pipe(
  Command.withDescription("Advanced command with subcommands"),
  Command.withSubcommands([
    infoSubcommand,
    processSubcommand
  ])
)
