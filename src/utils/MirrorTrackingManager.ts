import { existsSync } from 'fs'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import type {
  DeadCodeAnalysisResult,
  MirrorFileInfo,
  MirrorFileStatus,
  MirrorSyncOptions,
  MirrorTrackingConfig,
  MirrorTrackingDatabase,
  SyncResult,
} from '../types/MirrorTracking.js'

/**
 * 미러링 파일 추적 및 죽은 코드 관리자
 */
export class MirrorTrackingManager {
  private database: MirrorTrackingDatabase
  private config: MirrorTrackingConfig

  constructor(config?: Partial<MirrorTrackingConfig>) {
    this.config = {
      backupRetentionDays: 30,
      autoCleanup: true,
      backupExtension: '.bak',
      trackingDatabasePath: '.deps-cli/mirror-tracking.json',
      ...config,
    }

    this.database = this.createEmptyDatabase()
  }

  /**
   * 추적 데이터베이스 로드
   */
  async loadDatabase(): Promise<void> {
    try {
      if (existsSync(this.config.trackingDatabasePath)) {
        const content = await readFile(this.config.trackingDatabasePath, 'utf-8')
        this.database = JSON.parse(content)

        // 날짜 필드들을 Date 객체로 변환
        this.database.lastUpdated = new Date(this.database.lastUpdated)
        for (const file of Object.values(this.database.files)) {
          file.lastSynced = new Date(file.lastSynced)
          file.created = new Date(file.created)
          file.lastModified = new Date(file.lastModified)
        }
      }
    } catch (error) {
      console.warn('추적 데이터베이스 로드 실패, 새로 생성합니다:', error)
      this.database = this.createEmptyDatabase()
    }
  }

  /**
   * 추적 데이터베이스 저장
   */
  async saveDatabase(): Promise<void> {
    try {
      // 디렉토리 생성
      await mkdir(dirname(this.config.trackingDatabasePath), { recursive: true })

      this.database.lastUpdated = new Date()
      await writeFile(this.config.trackingDatabasePath, JSON.stringify(this.database, null, 2))
    } catch (error) {
      console.error('추적 데이터베이스 저장 실패:', error)
      throw error
    }
  }

  /**
   * 미러링 파일 동기화
   */
  async syncMirrorFiles(
    sourceFiles: string[],
    mirrorBasePath: string,
    options: MirrorSyncOptions = {
      autoBackupDeadFiles: false,
      autoCleanupBackups: false,
      forceFullSync: false,
      dryRun: false,
      verbose: false,
    }
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      processedFiles: 0,
      createdFiles: 0,
      updatedFiles: 0,
      backedUpFiles: 0,
      deletedFiles: 0,
      errors: [],
      executionTime: 0,
    }

    await this.loadDatabase()

    // 현재 소스 파일들 처리
    for (const sourcePath of sourceFiles) {
      try {
        await this.processMirrorFile(sourcePath, mirrorBasePath, options, result)
        result.processedFiles++
      } catch (error) {
        result.errors.push({
          filePath: sourcePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // 죽은 파일들 처리
    if (options.autoBackupDeadFiles) {
      const deadFiles = await this.identifyDeadFiles(sourceFiles)
      for (const deadFile of deadFiles.filesToBackup) {
        try {
          await this.backupMirrorFile(deadFile.mirrorPath, options)
          result.backedUpFiles++
        } catch (error) {
          result.errors.push({
            filePath: deadFile.mirrorPath,
            error: error instanceof Error ? error.message : 'Backup failed',
          })
        }
      }
    }

    // 백업 파일 정리
    if (options.autoCleanupBackups) {
      const cleanedCount = await this.cleanupOldBackups()
      result.deletedFiles += cleanedCount
    }

    result.executionTime = Date.now() - startTime

    if (!options.dryRun) {
      await this.saveDatabase()
    }

    return result
  }

  /**
   * 죽은 코드 분석
   */
  async analyzeDeadCode(currentSourceFiles: string[]): Promise<DeadCodeAnalysisResult> {
    await this.loadDatabase()

    const currentSourceSet = new Set(currentSourceFiles)
    const result: DeadCodeAnalysisResult = {
      totalMirrorFiles: 0,
      activeFiles: 0,
      inactiveFiles: 0,
      orphanedFiles: 0,
      backupFiles: 0,
      filesToCleanup: [],
      filesToBackup: [],
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.backupRetentionDays)

    for (const file of Object.values(this.database.files)) {
      result.totalMirrorFiles++

      switch (file.status) {
        case 'active':
          if (currentSourceSet.has(file.sourcePath)) {
            result.activeFiles++
          } else {
            result.orphanedFiles++
            result.filesToBackup.push(file)
          }
          break

        case 'inactive':
          result.inactiveFiles++
          break

        case 'orphaned':
          result.orphanedFiles++
          result.filesToBackup.push(file)
          break

        case 'backup':
          result.backupFiles++
          if (file.lastModified < cutoffDate) {
            result.filesToCleanup.push(file)
          }
          break
      }
    }

    return result
  }

  /**
   * 단일 미러링 파일 처리
   */
  private async processMirrorFile(
    sourcePath: string,
    mirrorBasePath: string,
    options: MirrorSyncOptions,
    result: SyncResult
  ): Promise<void> {
    const mirrorPath = this.generateMirrorPath(sourcePath, mirrorBasePath)
    const existingFile = this.database.files[mirrorPath]

    // 소스 파일 정보 확인
    let sourceStats
    try {
      sourceStats = await stat(sourcePath)
    } catch {
      // 소스 파일이 없으면 기존 미러링 파일을 orphaned 상태로 변경
      if (existingFile) {
        existingFile.status = 'orphaned'
        existingFile.sourceExists = false
      }
      return
    }

    const shouldUpdate = !existingFile || existingFile.lastModified < sourceStats.mtime || !existsSync(mirrorPath)

    if (shouldUpdate && !options.dryRun) {
      // 미러링 파일 생성/업데이트
      await this.createOrUpdateMirrorFile(sourcePath, mirrorPath, sourceStats)

      if (existingFile) {
        result.updatedFiles++
      } else {
        result.createdFiles++
      }
    }

    // 추적 정보 업데이트
    this.database.files[mirrorPath] = {
      mirrorPath,
      sourcePath,
      status: 'active',
      lastSynced: new Date(),
      created: existingFile?.created || new Date(),
      lastModified: sourceStats.mtime,
      size: sourceStats.size,
      sourceExists: true,
    }

    if (options.verbose) {
      console.log(`${shouldUpdate ? '업데이트' : '확인'}: ${mirrorPath}`)
    }
  }

  /**
   * 미러링 파일 백업
   */
  private async backupMirrorFile(mirrorPath: string, options: MirrorSyncOptions): Promise<void> {
    if (!existsSync(mirrorPath)) {
      return
    }

    const backupPath = `${mirrorPath}${this.config.backupExtension}`

    if (!options.dryRun) {
      await rename(mirrorPath, backupPath)
    }

    const fileInfo = this.database.files[mirrorPath]
    if (fileInfo) {
      fileInfo.status = 'backup'
      fileInfo.backupPath = backupPath
      fileInfo.sourceExists = false
    }

    if (options.verbose) {
      console.log(`백업: ${mirrorPath} → ${backupPath}`)
    }
  }

  /**
   * 죽은 파일들 식별
   */
  private async identifyDeadFiles(currentSourceFiles: string[]): Promise<DeadCodeAnalysisResult> {
    return this.analyzeDeadCode(currentSourceFiles)
  }

  /**
   * 오래된 백업 파일들 정리
   */
  private async cleanupOldBackups(): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.backupRetentionDays)

    let cleanedCount = 0

    for (const [mirrorPath, fileInfo] of Object.entries(this.database.files)) {
      if (fileInfo.status === 'backup' && fileInfo.lastModified < cutoffDate && fileInfo.backupPath) {
        try {
          if (existsSync(fileInfo.backupPath)) {
            await unlink(fileInfo.backupPath)
          }
          delete this.database.files[mirrorPath]
          cleanedCount++
        } catch (error) {
          console.warn(`백업 파일 정리 실패: ${fileInfo.backupPath}`, error)
        }
      }
    }

    return cleanedCount
  }

  /**
   * 미러링 파일 생성/업데이트
   */
  private async createOrUpdateMirrorFile(sourcePath: string, mirrorPath: string, sourceStats: any): Promise<void> {
    // 디렉토리 생성
    await mkdir(dirname(mirrorPath), { recursive: true })

    // 메타데이터 생성
    const metadata = {
      path: sourcePath,
      size: sourceStats.size,
      lines: 0, // 실제로는 파일을 읽어서 계산해야 함
      extension: extname(sourcePath),
      lastModified: sourceStats.mtime.toISOString(),
      created: new Date().toISOString(),
    }

    const content = `# ${sourcePath}

## 📄 File Metadata

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`
`

    await writeFile(mirrorPath, content)
  }

  /**
   * 미러링 경로 생성
   */
  private generateMirrorPath(sourcePath: string, mirrorBasePath: string): string {
    return join(mirrorBasePath, `${sourcePath}.md`)
  }

  /**
   * 빈 데이터베이스 생성
   */
  private createEmptyDatabase(): MirrorTrackingDatabase {
    return {
      version: '1.0.0',
      lastUpdated: new Date(),
      files: {},
      config: this.config,
    }
  }

  /**
   * 통계 정보 조회
   */
  async getStatistics(): Promise<{
    totalFiles: number
    activeFiles: number
    orphanedFiles: number
    backupFiles: number
    totalSize: number
  }> {
    await this.loadDatabase()

    let totalFiles = 0
    let activeFiles = 0
    let orphanedFiles = 0
    let backupFiles = 0
    let totalSize = 0

    for (const file of Object.values(this.database.files)) {
      totalFiles++
      totalSize += file.size

      switch (file.status) {
        case 'active':
          activeFiles++
          break
        case 'orphaned':
          orphanedFiles++
          break
        case 'backup':
          backupFiles++
          break
      }
    }

    return {
      totalFiles,
      activeFiles,
      orphanedFiles,
      backupFiles,
      totalSize,
    }
  }
}
