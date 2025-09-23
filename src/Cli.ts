/**
 * Effect CLI Application
 *
 * Main CLI configuration combining core functionality with optional samples.
 */
import * as Command from "@effect/cli/Command"

// Simple commands (no queue system)
import { analyzeCommand, classifyCommand } from "./commands/simple.js"

// 메인 커맨드 생성 - 기본 핸들러 없이 서브커맨드만 사용
const mainCommand = Command.make("effect-cli")

// Simple CLI for non-queue commands
export const simpleCommand = mainCommand.pipe(
  Command.withSubcommands([analyzeCommand, classifyCommand])
)

// Simple command runner
export const runSimple = Command.run(simpleCommand, {
  name: "Effect CLI Application",
  version: "1.0.0"
})

// Dynamic import for full command with queue system
export const createFullCommand = async () => {
  const { queueCommand, queueStatusCommand, simpleQueueCommand } = await import("./commands/index.js")

  const fullCommand = mainCommand.pipe(
    Command.withSubcommands([analyzeCommand, classifyCommand, queueCommand, queueStatusCommand, simpleQueueCommand])
  )

  return Command.run(fullCommand, {
    name: "Effect CLI Application",
    version: "1.0.0"
  })
}

// Full command runner (lazy loaded)
export const runFull = async () => {
  const { queueCommand, queueStatusCommand, simpleQueueCommand } = await import("./commands/index.js")

  const fullCommand = mainCommand.pipe(
    Command.withSubcommands([analyzeCommand, classifyCommand, queueCommand, queueStatusCommand, simpleQueueCommand])
  )

  return Command.run(fullCommand, {
    name: "Effect CLI Application",
    version: "1.0.0"
  })
}

// Default export for backward compatibility
export const run = runFull
