import type { Command } from 'commander'

/**
 * 커맨드 등록을 위한 함수 타입
 */
export type CommandModule = (program: Command) => void

/**
 * 커맨드 등록 유틸리티 함수들
 */
export const createCommandRegistry = () => {
  const modules: Array<CommandModule> = []

  return {
    /**
     * 커맨드 모듈을 등록합니다
     */
    registerModule: (module: CommandModule): void => {
      modules.push(module)
    },

    /**
     * 모든 등록된 모듈의 커맨드를 프로그램에 등록합니다
     */
    registerAll: (program: Command): void => {
      for (const module of modules) {
        module(program)
      }
    },

    /**
     * 등록된 모듈 수를 반환합니다
     */
    getModuleCount: (): number => modules.length,

    /**
     * 등록된 모듈 목록을 반환합니다
     */
    getModules: (): Array<CommandModule> => [...modules],
  }
}

/**
 * 공통 옵션들을 추가하는 함수
 */
export const addCommonOptions = (command: Command): Command => {
  return command.option('-v, --verbose', 'Show detailed information').option('--format <format>', 'Output format')
}

/**
 * 에러 핸들링을 위한 래퍼 함수
 */
export const wrapAction = <T extends Array<any>>(
  action: (...args: T) => Promise<void>
): ((...args: T) => Promise<void>) => {
  return async (...args: T) => {
    try {
      await action(...args)
      // Give time for any async operations to complete before exiting
      setTimeout(() => process.exit(0), 100)
    } catch (error) {
      console.error('❌ Command failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}
