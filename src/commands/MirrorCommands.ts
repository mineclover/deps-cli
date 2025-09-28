import type { Command } from 'commander'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SimpleMirrorManager } from '../utils/SimpleMirrorManager.js'
import { MirrorTrackingManager } from '../utils/MirrorTrackingManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 미러/마크다운 관련 커맨드들을 등록하는 함수
 */
export const registerMirrorCommands = (program: Command): void => {
  registerMirrorCommand(program)
  registerMirrorSyncCommand(program)
  registerMirrorAnalyzeCommand(program)
  registerMirrorCleanupCommand(program)
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

/**
 * 미러링 동기화 명령어
 */
const registerMirrorSyncCommand = (program: Command): void => {
  program
    .command('mirror-sync')
    .description('🔄 동기화 미러링 파일들과 죽은 코드 관리')
    .argument('[path]', '분석할 소스 경로', '.')
    .option('-d, --docs-path <path>', '미러링 문서 경로', './docs/mirror')
    .option('--auto-backup', '죽은 파일 자동 백업', true)
    .option('--auto-cleanup', '백업 파일 자동 정리', false)
    .option('--force-sync', '강제 전체 동기화', false)
    .option('--dry-run', '실제 변경 없이 시뮬레이션')
    .option('-v, --verbose', '상세 로그 출력')
    .action(wrapAction(async (sourcePath, options) => {
      console.log('🔄 Mirror Sync System')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const trackingManager = new MirrorTrackingManager()

      // 소스 파일 스캔
      const manager = new SimpleMirrorManager(process.cwd(), options.docsPath)
      const sourceFiles = manager.scanFiles(sourcePath, ['.ts', '.tsx', '.js', '.jsx'])

      console.log(`📁 소스 파일: ${sourceFiles.length}개`)
      console.log(`📂 미러링 경로: ${options.docsPath}`)

      if (options.dryRun) {
        console.log('🔍 시뮬레이션 모드 - 실제 변경사항 없음')
      }

      console.log('')
      console.log('⏳ 미러링 파일 동기화 중...')

      // 미러링 동기화 실행
      const syncResult = await trackingManager.syncMirrorFiles(sourceFiles, options.docsPath, {
        autoBackupDeadFiles: options.autoBackup,
        autoCleanupBackups: options.autoCleanup,
        forceFullSync: options.forceSync,
        dryRun: options.dryRun,
        verbose: options.verbose
      })

      // 결과 출력
      console.log('')
      console.log('📊 동기화 결과:')
      console.log(`  ✅ 처리된 파일: ${syncResult.processedFiles}개`)
      console.log(`  🆕 생성된 파일: ${syncResult.createdFiles}개`)
      console.log(`  🔄 업데이트된 파일: ${syncResult.updatedFiles}개`)
      console.log(`  📦 백업된 파일: ${syncResult.backedUpFiles}개`)
      console.log(`  🗑️ 삭제된 파일: ${syncResult.deletedFiles}개`)
      console.log(`  ⚡ 실행 시간: ${syncResult.executionTime}ms`)

      if (syncResult.errors.length > 0) {
        console.log('')
        console.log('❌ 오류 발생:')
        syncResult.errors.forEach(error => {
          console.log(`  • ${error.filePath}: ${error.error}`)
        })
      }

      if (options.dryRun) {
        console.log('')
        console.log('🔍 시뮬레이션 모드 - 실제 변경사항 없음')
      }
    }))
}

/**
 * 죽은 코드 분석 명령어
 */
const registerMirrorAnalyzeCommand = (program: Command): void => {
  program
    .command('mirror-analyze')
    .description('🔍 죽은 코드 및 미러링 파일 상태 분석')
    .argument('[path]', '분석할 소스 경로', '.')
    .option('-d, --docs-path <path>', '미러링 문서 경로', './docs/mirror')
    .option('--detailed', '상세 분석 결과 출력')
    .action(wrapAction(async (sourcePath, options) => {
      console.log('🔍 Mirror Analysis System')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const trackingManager = new MirrorTrackingManager()

      // 소스 파일 스캔
      const manager = new SimpleMirrorManager(process.cwd(), options.docsPath)
      const sourceFiles = manager.scanFiles(sourcePath, ['.ts', '.tsx', '.js', '.jsx'])

      console.log(`📁 현재 소스 파일: ${sourceFiles.length}개`)

      // 죽은 코드 분석
      const analysis = await trackingManager.analyzeDeadCode(sourceFiles)

      console.log('')
      console.log('📊 분석 결과:')
      console.log(`  📄 총 미러링 파일: ${analysis.totalMirrorFiles}개`)
      console.log(`  ✅ 활성 파일: ${analysis.activeFiles}개`)
      console.log(`  ⚠️ 비활성 파일: ${analysis.inactiveFiles}개`)
      console.log(`  🔍 고아 파일: ${analysis.orphanedFiles}개`)
      console.log(`  📦 백업 파일: ${analysis.backupFiles}개`)

      if (analysis.filesToBackup.length > 0) {
        console.log('')
        console.log(`🔄 백업 대상 파일: ${analysis.filesToBackup.length}개`)
        if (options.detailed) {
          analysis.filesToBackup.forEach(file => {
            console.log(`  • ${file.mirrorPath} (소스: ${file.sourcePath})`)
          })
        }
      }

      if (analysis.filesToCleanup.length > 0) {
        console.log('')
        console.log(`🗑️ 정리 대상 파일: ${analysis.filesToCleanup.length}개`)
        if (options.detailed) {
          analysis.filesToCleanup.forEach(file => {
            console.log(`  • ${file.mirrorPath} (백업: ${file.backupPath})`)
          })
        }
      }

      // 통계 정보
      const stats = await trackingManager.getStatistics()
      console.log('')
      console.log('📈 통계:')
      console.log(`  💾 총 파일 크기: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`  🎯 활성 비율: ${stats.totalFiles > 0 ? Math.round((stats.activeFiles / stats.totalFiles) * 100) : 0}%`)
    }))
}

/**
 * 미러링 정리 명령어
 */
const registerMirrorCleanupCommand = (program: Command): void => {
  program
    .command('mirror-cleanup')
    .description('🧹 오래된 백업 파일 및 죽은 미러링 파일 정리')
    .option('--retention-days <days>', '백업 파일 보관 일수', '30')
    .option('--force', '확인 없이 강제 정리')
    .option('--dry-run', '실제 삭제 없이 시뮬레이션')
    .option('-v, --verbose', '상세 로그 출력')
    .action(wrapAction(async (options) => {
      console.log('🧹 Mirror Cleanup System')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const trackingManager = new MirrorTrackingManager({
        backupRetentionDays: Number(options.retentionDays),
        autoCleanup: true
      })

      // 현재 상태 확인
      const stats = await trackingManager.getStatistics()
      console.log(`📄 총 추적 파일: ${stats.totalFiles}개`)
      console.log(`📦 백업 파일: ${stats.backupFiles}개`)

      if (!options.force && !options.dryRun) {
        console.log('')
        console.log('⚠️  이 작업은 오래된 백업 파일들을 영구적으로 삭제합니다.')
        console.log('   --force 옵션 또는 --dry-run 옵션을 사용하세요.')
        return
      }

      // 빈 소스 파일 목록으로 정리 실행 (백업 정리만)
      const syncResult = await trackingManager.syncMirrorFiles([], './docs/mirror', {
        autoBackupDeadFiles: false,
        autoCleanupBackups: true,
        forceFullSync: false,
        dryRun: options.dryRun,
        verbose: options.verbose
      })

      console.log('')
      console.log('📊 정리 결과:')
      console.log(`  🗑️ 삭제된 파일: ${syncResult.deletedFiles}개`)
      console.log(`  ⚡ 실행 시간: ${syncResult.executionTime}ms`)

      if (options.dryRun) {
        console.log('')
        console.log('🔍 시뮬레이션 모드 - 실제 삭제 없음')
      }
    }))
}
