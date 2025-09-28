/**
 * 미러링 파일 추적 및 죽은 코드 관리를 위한 타입 정의
 */

/**
 * 미러링 파일 상태
 */
export type MirrorFileStatus = 'active' | 'inactive' | 'orphaned' | 'backup'

/**
 * 미러링 파일 정보
 */
export interface MirrorFileInfo {
  /** 미러링 파일 경로 */
  mirrorPath: string
  /** 원본 소스 파일 경로 */
  sourcePath: string
  /** 파일 상태 */
  status: MirrorFileStatus
  /** 마지막 동기화 시간 */
  lastSynced: Date
  /** 파일 생성 시간 */
  created: Date
  /** 마지막 수정 시간 */
  lastModified: Date
  /** 파일 크기 */
  size: number
  /** 원본 파일 존재 여부 */
  sourceExists: boolean
  /** 백업 파일 경로 (상태가 backup인 경우) */
  backupPath?: string
}

/**
 * 미러링 추적 데이터베이스
 */
export interface MirrorTrackingDatabase {
  /** 추적 데이터베이스 버전 */
  version: string
  /** 마지막 업데이트 시간 */
  lastUpdated: Date
  /** 미러링 파일들 */
  files: Record<string, MirrorFileInfo>
  /** 설정 */
  config: MirrorTrackingConfig
}

/**
 * 미러링 추적 설정
 */
export interface MirrorTrackingConfig {
  /** 백업 파일 보관 기간 (일) */
  backupRetentionDays: number
  /** 자동 정리 활성화 */
  autoCleanup: boolean
  /** 백업 파일 확장자 */
  backupExtension: string
  /** 추적 데이터베이스 파일 경로 */
  trackingDatabasePath: string
}

/**
 * 죽은 코드 식별 결과
 */
export interface DeadCodeAnalysisResult {
  /** 총 미러링 파일 수 */
  totalMirrorFiles: number
  /** 활성 파일 수 */
  activeFiles: number
  /** 비활성 파일 수 */
  inactiveFiles: number
  /** 고아 파일 수 (원본 삭제됨) */
  orphanedFiles: number
  /** 백업 파일 수 */
  backupFiles: number
  /** 정리 대상 파일들 */
  filesToCleanup: MirrorFileInfo[]
  /** 백업 대상 파일들 */
  filesToBackup: MirrorFileInfo[]
}

/**
 * 미러링 동기화 옵션
 */
export interface MirrorSyncOptions {
  /** 죽은 파일 자동 백업 */
  autoBackupDeadFiles: boolean
  /** 백업 파일 자동 정리 */
  autoCleanupBackups: boolean
  /** 강제 전체 동기화 */
  forceFullSync: boolean
  /** 드라이 런 (실제 변경 없이 시뮬레이션) */
  dryRun: boolean
  /** 상세 로그 출력 */
  verbose: boolean
}

/**
 * 동기화 결과
 */
export interface SyncResult {
  /** 처리된 파일 수 */
  processedFiles: number
  /** 생성된 미러링 파일 수 */
  createdFiles: number
  /** 업데이트된 미러링 파일 수 */
  updatedFiles: number
  /** 백업된 파일 수 */
  backedUpFiles: number
  /** 삭제된 파일 수 */
  deletedFiles: number
  /** 오류 발생 파일들 */
  errors: Array<{ filePath: string; error: string }>
  /** 실행 시간 (ms) */
  executionTime: number
}
