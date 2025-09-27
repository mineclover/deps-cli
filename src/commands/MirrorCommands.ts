import type { Command } from 'commander'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SimpleMirrorManager } from '../utils/SimpleMirrorManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 미러/마크다운 관련 커맨드들을 등록하는 함수
 */
export const registerMirrorCommands = (program: Command): void => {
  registerMirrorCommand(program)
  registerMarkdownCommands(program)
}

/**
 * 기본 미러 커맨드
 */
const registerMirrorCommand = (program: Command): void => {
    program
      .command('mirror')
      .description('🪞 File mirroring system for creating documentation mirrors of source files')
      .argument('[path]', 'Path to file or directory to mirror', '.')
      .option('-c, --create', 'Create mirror files instead of just showing mapping')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .option('-e, --extensions <exts>', 'File extensions to process (comma-separated)', '.ts,.tsx,.js,.jsx')
      .option('-m, --max-display <num>', 'Maximum files to display', '20')
      .option('-v, --verbose', 'Show detailed information')
      .action(wrapAction(async (targetPath, options) => {
        console.log('🪞 Mirror System')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        const resolvedPath = resolve(targetPath)
        if (!existsSync(resolvedPath)) {
          console.error(`❌ Error: Path does not exist: ${targetPath}`)
          process.exit(1)
        }

        const manager = new SimpleMirrorManager(process.cwd(), options.docsPath, options.namespace)

        if (options.create) {
          const result = await manager.processFiles({
            targetPath,
            shouldCreate: true,
            namespace: options.namespace,
            extensions: options.extensions.split(',').map((ext: string) => ext.trim()),
            maxDisplay: Number(options.maxDisplay)
          })
          console.log(`✅ Created ${result.processed} mirror files`)
        } else {
          await manager.showMirrorMapping(targetPath, Number(options.maxDisplay))
        }
      }))
  }

/**
 * 마크다운 관련 커맨드들
 */
const registerMarkdownCommands = (program: Command): void => {
    const markdownCommand = program
      .command('markdown')
      .description('📝 Markdown generation and path resolution utilities')

    registerMarkdownPathCommand(markdownCommand)
    registerMarkdownGenerateCommand(markdownCommand)
    registerMarkdownVerifyCommand(markdownCommand)
  }

/**
 * 마크다운 경로 조회 커맨드
 */
const registerMarkdownPathCommand = (markdownCommand: Command): void => {
    markdownCommand
      .command('path')
      .description('🗂️ Show markdown path for source file')
      .argument('<sourcePath>', 'Source file path')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .action(wrapAction(async (sourcePath, options) => {
        const manager = new SimpleMirrorManager(process.cwd(), options.docsPath, options.namespace)
        const pathResolver = manager.getPathResolver()

        const mappingInfo = pathResolver.getMappingInfo(sourcePath)
        console.log('📄 Markdown Path Resolution')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Source: ${mappingInfo.sourceFile}`)
        console.log(`📝 Markdown: ${mappingInfo.markdownFile}`)
        console.log(`📏 Relative: ${mappingInfo.relativePath}`)
        console.log(`🏷️ Namespace: ${mappingInfo.namespace || 'default'}`)
        console.log(`✅ Source exists: ${mappingInfo.sourceExists}`)
        console.log(`📄 Markdown exists: ${mappingInfo.markdownExists}`)
      }))
  }

/**
 * 마크다운 생성 커맨드
 */
const registerMarkdownGenerateCommand = (markdownCommand: Command): void => {
    markdownCommand
      .command('generate')
      .description('✨ Generate markdown files from source files')
      .argument('[path]', 'Path to file or directory to process', '.')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .option('-e, --extensions <exts>', 'File extensions to process (comma-separated)', '.ts,.tsx,.js,.jsx')
      .option('-t, --template <type>', 'Template type: basic, detailed', 'basic')
      .option('-s, --include-source', 'Include source code in markdown', false)
      .option('-m, --max-files <num>', 'Maximum files to process', '20')
      .option('-v, --verbose', 'Show detailed information')
      .action(wrapAction(async (targetPath, options) => {
        console.log('📝 Markdown Generation')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        const manager = new SimpleMirrorManager(process.cwd(), options.docsPath, options.namespace)
        const markdownGenerator = manager.getMarkdownGenerator()

        // 파일 스캔
        const files = manager.scanFiles(targetPath, options.extensions.split(',').map((ext: string) => ext.trim()))
        const targetFiles = files.slice(0, Number(options.maxFiles))

        console.log(`📁 Found ${files.length} files (processing ${targetFiles.length})`)
        if (options.namespace) console.log(`🏷️ Namespace: ${options.namespace}`)
        console.log(`📄 Template: ${options.template}`)
        console.log(`📝 Include source: ${options.includeSource}`)
        console.log('')

        // 배치 마크다운 생성
        const result = await markdownGenerator.generateBatchMarkdown(targetFiles, {
          includeSource: options.includeSource,
          template: options.template as 'basic' | 'detailed',
          namespace: options.namespace,
          maxFiles: Number(options.maxFiles)
        })

        // 결과 출력
        if (options.verbose) {
          console.log('📊 Generation Results:')
          result.results.forEach((item, i) => {
            const status = item.markdown ? '✅' : '❌'
            const error = item.error ? ` (${item.error})` : ''
            console.log(`  ${i + 1}. ${status} ${item.source}${error}`)
          })
        }

        console.log('')
        console.log(`✅ Generated ${result.processed} markdown files`)
        console.log(`📁 Total files: ${result.total}`)
        console.log(`🎯 Success rate: ${result.total > 0 ? Math.round((result.processed / result.total) * 100) : 0}%`)
      }))
  }

  /**
   * 마크다운 매핑 검증 커맨드
   */
const registerMarkdownVerifyCommand = (markdownCommand: Command): void => {
    markdownCommand
      .command('verify')
      .description('✅ Verify markdown path mappings')
      .argument('<sourcePath>', 'Source file path to verify')
      .option('-n, --namespace <name>', 'Namespace for organizing mirrors')
      .option('-d, --docs-path <path>', 'Documentation output path', './docs')
      .action(wrapAction(async (sourcePath, options) => {
        const manager = new SimpleMirrorManager(process.cwd(), options.docsPath, options.namespace)
        const pathResolver = manager.getPathResolver()

        const verification = pathResolver.verifyMapping(sourcePath)
        console.log('✅ Mapping Verification')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📁 Source: ${verification.sourceFile}`)
        console.log(`📝 Markdown: ${verification.markdownFile}`)
        console.log(`🔄 Reversed: ${verification.reversedSource}`)
        console.log(`✅ Valid: ${verification.valid}`)
        console.log(`🎯 Perfect match: ${verification.perfectMatch}`)

        if (verification.perfectMatch) {
          console.log('✅ Mapping is perfectly reversible')
        } else {
          console.log('❌ Mapping has issues - paths do not match')
        }
      }))
  }
