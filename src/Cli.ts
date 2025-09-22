/**
 * Effect CLI Application
 *
 * Main CLI configuration combining core functionality with optional samples.
 */
import * as Command from "@effect/cli/Command"

// Main commands (core functionality + templates)
import { greetCommand, queueCommand, queueStatusCommand, simpleQueueCommand } from "./commands/index.js"

// 메인 커맨드 생성 - 기본 핸들러 없이 서브커맨드만 사용
const mainCommand = Command.make("effect-cli")

// CLI 구성: 메인 기능 명령어들
const command = mainCommand.pipe(
  Command.withSubcommands([greetCommand, queueCommand, queueStatusCommand, simpleQueueCommand])
)

// 커맨드 실행
export const run = Command.run(command, {
  name: "Effect CLI Application",
  version: "1.0.0"
})
