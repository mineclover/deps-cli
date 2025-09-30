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
  registerListFiles(program)
  registerDemo(program)
  registerGitHook(program)
}

/**
 * List namespaces command
 */
const registerListNamespaces = (program: Command): void => {
  program
    .command('list-namespaces')
    .description('📋 Display all available configuration namespaces')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .action(
      wrapAction(async (options) => {
        const namespaces = await globalConfig.listNamespaces(options.config)

        console.log('📋 Available Namespaces')
        console.log('━━━━━━━━━━━━━━━━━━━━')

        if (namespaces.namespaces.length === 0) {
          console.log('No namespaces found')
        } else {
          namespaces.namespaces.forEach((ns, i) => {
            console.log(`  ${i + 1}. ${ns}`)
          })
        }
      })
    )
}

/**
 * Create namespace command
 */
const registerCreateNamespace = (program: Command): void => {
  program
    .command('create-namespace')
    .description('🆕 Create a new configuration namespace')
    .argument('<name>', 'Namespace name')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .option('--copy-from <namespace>', 'Copy settings from existing namespace')
    .action(
      wrapAction(async (name, options) => {
        let config = {}

        if (options.copyFrom) {
          const existingConfig = await globalConfig.loadNamespacedConfig(options.config, options.copyFrom)
          config = { ...existingConfig }
        } else {
          config = { filePatterns: [], excludePatterns: [] }
        }

        await globalConfig.setNamespaceConfig(name, config, options.config)

        console.log(`✅ Namespace '${name}' created successfully`)
        if (options.copyFrom) {
          console.log(`📋 Settings copied from namespace '${options.copyFrom}'`)
        }
      })
    )
}

/**
 * Delete namespace command
 */
const registerDeleteNamespace = (program: Command): void => {
  program
    .command('delete-namespace')
    .description('🗑️ Delete a configuration namespace')
    .argument('<name>', 'Namespace name to delete')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .action(
      wrapAction(async (name, options) => {
        await globalConfig.deleteNamespace(name, options.config)
        console.log(`✅ Namespace '${name}' deleted`)
      })
    )
}

/**
 * List files matching namespace patterns command
 */
const registerListFiles = (program: Command): void => {
  program
    .command('list-files')
    .description('📁 List files matching namespace patterns')
    .argument('<namespace>', 'Namespace name')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(
      wrapAction(async (namespace, options) => {
        const files = await globalConfig.listFiles(namespace, options.config, options.cwd)

        console.log(`📁 Files in namespace '${namespace}'`)
        console.log('━━━━━━━━━━━━━━━━━━━━')

        if (files.length === 0) {
          console.log('No files found matching the patterns')
        } else {
          console.log(`Found ${files.length} file(s):\n`)
          files.forEach((file) => {
            console.log(`  ${file}`)
          })
        }
      })
    )
}

/**
 * Demo command - outputs namespace metadata and files
 */
const registerDemo = (program: Command): void => {
  program
    .command('demo')
    .description('🎯 Demo: Output namespace metadata and file list')
    .argument('<namespace>', 'Namespace name')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .option('--json', 'Output as JSON')
    .action(
      wrapAction(async (namespace, options) => {
        const result = await globalConfig.getNamespaceWithFiles(namespace, options.config, options.cwd)

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log('🎯 Namespace Demo Output')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log(`Namespace: ${result.namespace}`)
          console.log(`\nMetadata:`)
          console.log(`  File Patterns:`)
          result.metadata.filePatterns?.forEach((pattern) => {
            console.log(`    - ${pattern}`)
          })
          if (result.metadata.excludePatterns && result.metadata.excludePatterns.length > 0) {
            console.log(`  Exclude Patterns:`)
            result.metadata.excludePatterns.forEach((pattern) => {
              console.log(`    - ${pattern}`)
            })
          }
          console.log(`\nFiles (${result.fileCount}):`)
          if (result.files.length === 0) {
            console.log('  (No files found)')
          } else {
            result.files.forEach((file) => {
              console.log(`  - ${file}`)
            })
          }
        }
      })
    )
}

/**
 * Git hook command - categorize files by namespace and save to files
 */
const registerGitHook = (program: Command): void => {
  program
    .command('git-hook')
    .description('🪝 Git hook: Categorize files by namespace (for post-commit hooks)')
    .option('--config <file>', 'Configuration file path', 'deps-cli.config.json')
    .option('--output-dir <dir>', 'Output directory', 'logs/commits')
    .option('--files <files...>', 'Files to categorize (if not provided, reads from stdin)')
    .action(
      wrapAction(async (options) => {
        const { execSync } = await import('node:child_process')
        const { writeFileSync, mkdirSync, existsSync } = await import('node:fs')
        const { join } = await import('node:path')

        // Get files from stdin or git diff-tree
        let files: string[] = []

        if (options.files) {
          files = options.files
        } else {
          // Try to get files from git
          try {
            const output = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
              encoding: 'utf-8',
            })
            files = output.trim().split('\n').filter(Boolean)
          } catch (error) {
            console.error('❌ Failed to get git files. Use --files option or ensure this is run in a git repository after a commit.')
            process.exit(1)
          }
        }

        if (files.length === 0) {
          console.log('ℹ️  No files to categorize')
          return
        }

        console.log(`📝 Processing ${files.length} file(s)...`)

        // Categorize files by namespaces
        const categorized = await globalConfig.categorizeFilesByNamespaces(files, options.config)

        if (Object.keys(categorized).length === 0) {
          console.log('ℹ️  No files matched any namespace patterns')
          return
        }

        // Create output directory
        if (!existsSync(options.outputDir)) {
          mkdirSync(options.outputDir, { recursive: true })
        }

        // Get datetime for filename
        const datetime = new Date()
          .toISOString()
          .replace(/:/g, '-')
          .replace(/\..+/, '')
          .replace('T', '_')

        // Get commit hash if available
        let commitHash = 'unknown'
        try {
          commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
        } catch {
          // Ignore if not in git repo
        }

        // Save each namespace to a file
        let totalFiles = 0
        for (const [namespace, namespaceFiles] of Object.entries(categorized)) {
          const filename = `${namespace}-${datetime}.txt`
          const filepath = join(options.outputDir, filename)

          const content = [
            `# Commit Files - Namespace: ${namespace}`,
            `# Date: ${new Date().toISOString()}`,
            `# Commit: ${commitHash}`,
            `# Files: ${namespaceFiles.length}`,
            '',
            ...namespaceFiles,
          ].join('\n')

          writeFileSync(filepath, content, 'utf-8')
          console.log(`✅ ${namespace}: ${namespaceFiles.length} file(s) -> ${filename}`)
          totalFiles += namespaceFiles.length
        }

        console.log(`\n📊 Total files categorized: ${totalFiles}`)
        console.log(`📁 Output directory: ${options.outputDir}`)
      })
    )
}
