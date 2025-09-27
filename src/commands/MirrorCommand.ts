import { Command } from 'commander'
import { SimpleMirrorManager, type MirrorOptions } from '../utils/SimpleMirrorManager.js'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export interface MirrorCommandOptions {
  namespace?: string
  docsPath?: string
  create?: boolean
  extensions?: string
  verbose?: boolean
  maxDisplay?: number
}

export class MirrorCommand {
  private manager: SimpleMirrorManager

  constructor(projectRoot: string = process.cwd()) {
    this.manager = new SimpleMirrorManager(projectRoot)
  }

  /**
   * Commander.js를 위한 미러링 명령어를 생성합니다
   */
  createCommand(): Command {
    const mirrorCommand = new Command('mirror')
      .description('🪞 File mirroring system for creating documentation mirrors of source files')
      .addHelpText('after', `
Examples:
  $ deps-cli mirror src/                           # Show mirror mapping for src directory
  $ deps-cli mirror src/ --create                  # Create mirror files
  $ deps-cli mirror src/utils/Helper.ts --create   # Mirror single file
  $ deps-cli mirror . --namespace core --create    # Create with namespace
  $ deps-cli mirror src/ --docs-path ./documentation --create
      `)

    // mirror-show 서브커맨드 (기본 동작)
    mirrorCommand
      .command('show [path]')
      .description('📋 Show mirror mapping for files (default action)')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .option('-e, --extensions <exts>', 'File extensions to process (comma-separated)', '.ts,.tsx,.js,.jsx')
      .option('-m, --max-display <num>', 'Maximum files to display', '20')
      .option('-v, --verbose', 'Show detailed information')
      .action(async (path: string = '.', options: MirrorCommandOptions) => {
        await this.showMirrorMapping(path, options)
      })

    // mirror-create 서브커맨드
    mirrorCommand
      .command('create [path]')
      .description('✨ Create mirror documentation files')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .option('-e, --extensions <exts>', 'File extensions to process (comma-separated)', '.ts,.tsx,.js,.jsx')
      .option('-m, --max-display <num>', 'Maximum files to display', '20')
      .option('-v, --verbose', 'Show detailed information')
      .action(async (path: string = '.', options: MirrorCommandOptions) => {
        await this.createMirrorFiles(path, options)
      })

    // 기본 액션 (show와 동일)
    mirrorCommand
      .argument('[path]', 'Path to file or directory to mirror', '.')
      .option('-c, --create', 'Create mirror files instead of just showing mapping')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .option('-e, --extensions <exts>', 'File extensions to process (comma-separated)', '.ts,.tsx,.js,.jsx')
      .option('-m, --max-display <num>', 'Maximum files to display', '20')
      .option('-v, --verbose', 'Show detailed information')
      .action(async (path: string, options: MirrorCommandOptions & { create?: boolean }) => {
        if (options.create) {
          await this.createMirrorFiles(path, options)
        } else {
          await this.showMirrorMapping(path, options)
        }
      })

    return mirrorCommand
  }

  /**
   * 미러링 매핑을 표시합니다
   */
  private async showMirrorMapping(targetPath: string, options: MirrorCommandOptions): Promise<void> {
    const { namespace, docsPath = './docs', verbose = false, maxDisplay = 20 } = options

    if (verbose) {
      console.log('🔧 Mirror Configuration:')
      console.log(`  📁 Target Path: ${targetPath}`)
      console.log(`  📄 Docs Path: ${docsPath}`)
      if (namespace) console.log(`  🏷️ Namespace: ${namespace}`)
      console.log('')
    }

    // Mapper 업데이트
    this.manager.updateMapper(docsPath, namespace)

    // 검증
    if (!this.validatePath(targetPath)) {
      return
    }

    try {
      await this.manager.showMirrorMapping(targetPath, Number(maxDisplay))
    } catch (error) {
      console.error('❌ Error showing mirror mapping:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }

  /**
   * 미러 파일들을 생성합니다
   */
  private async createMirrorFiles(targetPath: string, options: MirrorCommandOptions): Promise<void> {
    const {
      namespace,
      docsPath = './docs',
      extensions = '.ts,.tsx,.js,.jsx',
      verbose = false,
      maxDisplay = 20
    } = options

    if (verbose) {
      console.log('🔧 Mirror Creation Configuration:')
      console.log(`  📁 Target Path: ${targetPath}`)
      console.log(`  📄 Docs Path: ${docsPath}`)
      console.log(`  📎 Extensions: ${extensions}`)
      if (namespace) console.log(`  🏷️ Namespace: ${namespace}`)
      console.log('')
    }

    // Mapper 업데이트
    this.manager.updateMapper(docsPath, namespace)

    // 검증
    if (!this.validatePath(targetPath)) {
      return
    }

    const extensionsArray = extensions.split(',').map(ext => ext.trim())

    const mirrorOptions: MirrorOptions = {
      targetPath,
      shouldCreate: true,
      namespace,
      extensions: extensionsArray,
      maxDisplay: Number(maxDisplay),
      docsPath,
      verbose
    }

    try {
      const result = await this.manager.processFiles(mirrorOptions)

      if (verbose) {
        console.log('')
        console.log(`📊 Summary:`)
        console.log(`  ✅ Created: ${result.processed} files`)
        console.log(`  📁 Total found: ${result.total} files`)
        console.log(`  🎯 Success rate: ${result.total > 0 ? Math.round((result.processed / result.total) * 100) : 0}%`)
      }
    } catch (error) {
      console.error('❌ Error creating mirror files:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }

  /**
   * 경로가 유효한지 검증합니다
   */
  private validatePath(targetPath: string): boolean {
    const resolvedPath = resolve(targetPath)

    if (!existsSync(resolvedPath)) {
      console.error(`❌ Error: Path does not exist: ${targetPath}`)
      return false
    }

    const stat = statSync(resolvedPath)
    if (!stat.isFile() && !stat.isDirectory()) {
      console.error(`❌ Error: Path is neither a file nor directory: ${targetPath}`)
      return false
    }

    return true
  }
}