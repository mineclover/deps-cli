/**
 * 분석 관련 에러 타입들
 */

import * as Data from "effect/Data"

export class FileNotFoundError extends Data.TaggedError("FileNotFoundError")<{
  readonly filePath: string
  readonly reason?: string
}> {
  get message() {
    return `파일을 찾을 수 없습니다: ${this.filePath}${this.reason ? ` (${this.reason})` : ''}`
  }
}

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly filePath: string
  readonly line?: number
  readonly column?: number
  readonly reason: string
}> {
  get message() {
    const location = this.line && this.column ? ` at ${this.line}:${this.column}` : ''
    return `파싱 오류${location}: ${this.reason} in ${this.filePath}`
  }
}

export class DependencyResolutionError extends Data.TaggedError("DependencyResolutionError")<{
  readonly dependency: string
  readonly fromFile: string
  readonly reason: string
}> {
  get message() {
    return `의존성 해결 실패: '${this.dependency}' from ${this.fromFile} - ${this.reason}`
  }
}

export class AnalysisTimeoutError extends Data.TaggedError("AnalysisTimeoutError")<{
  readonly filePath: string
  readonly timeoutMs: number
}> {
  get message() {
    return `분석 시간 초과: ${this.filePath} (${this.timeoutMs}ms)`
  }
}

export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly field: string
  readonly value: unknown
  readonly expected: string
}> {
  get message() {
    return `설정 오류: ${this.field} = ${this.value}, 예상값: ${this.expected}`
  }
}

export type AnalysisError =
  | FileNotFoundError
  | ParseError
  | DependencyResolutionError
  | AnalysisTimeoutError
  | ConfigurationError