import type { Command } from 'commander'
import { globalConfig } from '../config/ConfigManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 네임스페이스 관리 관련 커맨드들을 등록하는 함수
 */
export const registerNamespaceCommands = (program: Command): void => {
  registerListNamespaces(program)
  registerCreateNamespace(program)
  registerDeleteNamespace(program)
}

/**
 * List namespaces command
 */
const registerListNamespaces = (program: Command): void => {
    program
      .command('list-namespaces')
      .description(
        '📋 Display all available configuration namespaces with their settings. Useful for environment management and configuration overview.'
      )
      .option(
        '--config <file>',
        'Path to configuration file (defaults to deps-cli.config.json in current directory)',
        'deps-cli.config.json'
      )
      .action(wrapAction(async (options) => {
        const namespaces = await globalConfig.listNamespaces(options.config)

        console.log('📋 Available Configuration Namespaces')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        if (namespaces.namespaces.length === 0) {
          console.log('❌ No namespaces found in configuration file')
          console.log('💡 Use "create-namespace" command to create your first namespace')
        } else {
          console.log(`📁 Total namespaces: ${namespaces.namespaces.length}`)

          if (namespaces.default) {
            console.log(`🎯 Default namespace: ${namespaces.default}`)
          }

          console.log('\n📋 Available namespaces:')
          namespaces.namespaces.forEach((ns, i) => {
            const isDefault = ns === namespaces.default ? ' (default)' : ''
            console.log(`  ${i + 1}. ${ns}${isDefault}`)
          })
        }
      }))
  }

/**
 * Create namespace command
 */
const registerCreateNamespace = (program: Command): void => {
    program
      .command('create-namespace')
      .description(
        '🆕 Create a new configuration namespace for environment-specific analysis settings (development, production, staging, etc.)'
      )
      .argument('<name>', 'Namespace name (e.g., development, production, staging, testing)')
      .option('--config <file>', 'Configuration file path (creates if not exists)', 'deps-cli.config.json')
      .option('--copy-from <namespace>', 'Copy settings from existing namespace as template')
      .option('--set-default', 'Set this namespace as the default for future operations')
      .action(wrapAction(async (name, options) => {
        let config = {}

        // 기존 namespace에서 복사
        if (options.copyFrom) {
          const existingConfig = await globalConfig.loadNamespacedConfig(options.config, options.copyFrom)
          config = { ...existingConfig }
          delete (config as any)._metadata // 메타데이터는 제외
        } else {
          // 기본 설정 사용
          config = {
            analysis: { maxConcurrency: 4, timeout: 30000 },
            logging: { level: 'info', format: 'text', enabled: true },
            output: { defaultFormat: 'summary', compression: false },
            development: { verbose: false, debugMode: false, mockApiCalls: false },
          }
        }

        await globalConfig.setNamespaceConfig(name, config, options.config)

        console.log(`✅ Namespace '${name}' created successfully`)
        if (options.copyFrom) {
          console.log(`📋 Settings copied from namespace '${options.copyFrom}'`)
        }

        // default로 설정
        if (options.setDefault) {
          console.log(`🎯 Set '${name}' as default namespace`)
        }
      }))
  }

/**
 * Delete namespace command
 */
const registerDeleteNamespace = (program: Command): void => {
    program
      .command('delete-namespace')
      .description('🗑️ Permanently remove a configuration namespace and all its settings. Use with caution!')
      .argument('<name>', 'Namespace name to delete (cannot be undone)')
      .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
      .option('--force', 'Force deletion without confirmation prompt (dangerous!)')
      .action(wrapAction(async (name, options) => {
        if (!options.force) {
          console.log(`⚠️ This will permanently delete namespace '${name}'`)
          console.log('💡 Use --force to skip this confirmation')
          process.exit(1)
        }

        await globalConfig.deleteNamespace(name, options.config)
        console.log(`✅ Namespace '${name}' deleted successfully`)
      }))
  }
