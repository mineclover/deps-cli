import { relative, resolve } from 'node:path'
import type { FileId, NodeId } from '../types/MappingTypes.js'
import { PredictableIdGenerator } from './PredictableIdGenerator.js'

/**
 * 경로 매핑 시스템
 *
 * 핵심 기능: 파일 경로 → 마크다운 문서 위치를 정확하게, 항상 동일하게 매핑
 *
 * 원칙:
 * 1. 주어진 파일 경로에서 정확한 마크다운 파일 위치를 계산
 * 2. 언제나 동일한 결과 반환 (일관성)
 * 3. 빠른 조회 (계산 기반, DB 조회 불필요)
 * 4. namespace별 격리
 */
export class PathMapper {
  private projectRoot: string
  private baseDocsPath: string
  private namespace?: string

  constructor(projectRoot: string, baseDocsPath: string = './docs', namespace?: string) {
    this.projectRoot = resolve(projectRoot)
    this.baseDocsPath = resolve(baseDocsPath)
    this.namespace = namespace
  }

  /**
   * 파일 경로 → 마크다운 문서 경로 매핑
   *
   * 예시:
   * - Input: /project/src/utils/helper.ts
   * - Output: /docs/prod-docs/files/prod-utils-helper-ts.md
   */
  getMarkdownPath(sourceFilePath: string): string {
    const absoluteSourcePath = resolve(sourceFilePath)

    // 1. 예측 가능한 ID 생성
    const fileId = this.namespace
      ? PredictableIdGenerator.generateNamespacedFileId(absoluteSourcePath, this.projectRoot, this.namespace)
      : PredictableIdGenerator.generateSmartProjectId(absoluteSourcePath, this.projectRoot)

    // 2. 마크다운 파일 경로 계산
    const docsDirectory = this.getDocsDirectory()
    return `${docsDirectory}/files/${fileId}.md`
  }

  /**
   * 마크다운 경로 → 원본 파일 경로 역매핑
   *
   * 예시:
   * - Input: /docs/prod-docs/files/prod-utils-helper-ts.md
   * - Output: /project/src/utils/helper.ts
   *
   * 주의: 완전한 역매핑은 복잡하므로 단순한 근사치를 제공
   */
  getSourcePath(markdownPath: string): string | null {
    // 마크다운 파일명에서 ID 추출
    const fileName = markdownPath.split('/').pop()?.replace('.md', '')
    if (!fileName) return null

    // ID에서 namespace 제거
    const idWithoutNamespace = this.namespace
      ? fileName.replace(`${this.normalizeNamespace(this.namespace)}-`, '')
      : fileName

    // 더블 언더스코어를 임시 플레이스홀더로 변환
    const withPlaceholder = idWithoutNamespace.replace(/__/g, '🔸')

    // 하이픈을 슬래시로 변환 (디렉토리 구분자)
    const pathParts = withPlaceholder.split('-')

    // 확장자 복원
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && this.isFileExtension(lastPart)) {
      pathParts[pathParts.length - 1] = ''
      pathParts.push(`.${lastPart}`)
    }

    const reconstructedPath = pathParts.join('/').replace(/\/+/g, '/').replace(/🔸/g, '_') // 플레이스홀더를 언더스코어로 복원

    return resolve(this.projectRoot, reconstructedPath)
  }

  /**
   * 파일 존재 여부 확인 없이 일관된 매핑 제공
   */
  getMappingInfo(sourceFilePath: string): {
    sourceFile: string
    markdownFile: string
    fileId: FileId
    namespace?: string
    exists: boolean
  } {
    const absoluteSourcePath = resolve(sourceFilePath)
    const markdownPath = this.getMarkdownPath(absoluteSourcePath)

    const fileId = this.namespace
      ? PredictableIdGenerator.generateNamespacedFileId(absoluteSourcePath, this.projectRoot, this.namespace)
      : PredictableIdGenerator.generateSmartProjectId(absoluteSourcePath, this.projectRoot)

    // 파일 존재 여부 확인 (선택적)
    let exists = false
    try {
      const fs = require('node:fs')
      exists = fs.existsSync(markdownPath)
    } catch {
      exists = false
    }

    return {
      sourceFile: absoluteSourcePath,
      markdownFile: markdownPath,
      fileId: fileId as FileId,
      namespace: this.namespace,
      exists,
    }
  }

  /**
   * 배치 매핑: 여러 파일 경로를 한 번에 매핑
   */
  getBatchMapping(sourceFilePaths: string[]): Map<string, string> {
    const mapping = new Map<string, string>()

    for (const sourcePath of sourceFilePaths) {
      const markdownPath = this.getMarkdownPath(sourcePath)
      mapping.set(resolve(sourcePath), markdownPath)
    }

    return mapping
  }

  /**
   * 디렉토리 내 모든 파일의 매핑 정보 생성
   */
  getDirectoryMapping(
    directoryPath: string,
    extensions: string[] = ['.ts', '.js', '.tsx', '.jsx']
  ): Map<string, string> {
    const mapping = new Map<string, string>()

    try {
      const fs = require('node:fs')
      const path = require('node:path')

      const walkDir = (dir: string) => {
        const files = fs.readdirSync(dir)

        for (const file of files) {
          const fullPath = path.join(dir, file)
          const stat = fs.statSync(fullPath)

          if (stat.isDirectory()) {
            walkDir(fullPath)
          } else if (extensions.some((ext) => file.endsWith(ext))) {
            const markdownPath = this.getMarkdownPath(fullPath)
            mapping.set(fullPath, markdownPath)
          }
        }
      }

      walkDir(resolve(directoryPath))
    } catch (error) {
      console.warn('디렉토리 매핑 실패:', error)
    }

    return mapping
  }

  /**
   * 매핑 검증: 역매핑이 올바른지 확인
   */
  verifyMapping(sourceFilePath: string): {
    valid: boolean
    sourceFile: string
    markdownFile: string
    reversedSource: string | null
    matches: boolean
  } {
    const sourceFile = resolve(sourceFilePath)
    const markdownFile = this.getMarkdownPath(sourceFile)
    const reversedSource = this.getSourcePath(markdownFile)

    return {
      valid: reversedSource !== null,
      sourceFile,
      markdownFile,
      reversedSource,
      matches: reversedSource === sourceFile,
    }
  }

  /**
   * 네임스페이스별 문서 디렉토리 경로
   */
  private getDocsDirectory(): string {
    if (this.namespace) {
      const normalizedNamespace = this.normalizeNamespace(this.namespace)
      return `${this.baseDocsPath}/${normalizedNamespace}-docs`
    }
    return `${this.baseDocsPath}/dependencies`
  }

  /**
   * 네임스페이스 정규화 (PredictableIdGenerator와 동일)
   */
  private normalizeNamespace(namespace: string): string {
    const abbreviations: Record<string, string> = {
      production: 'prod',
      development: 'dev',
      testing: 'test',
      staging: 'stage',
    }

    const normalized = namespace.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    return abbreviations[normalized] || normalized
  }

  /**
   * 파일 확장자 판별
   */
  private isFileExtension(str: string): boolean {
    return /^[a-z]{1,4}$/.test(str) && ['ts', 'js', 'tsx', 'jsx', 'json', 'md', 'yml', 'yaml'].includes(str)
  }

  /**
   * 상대 경로로 표시된 매핑 정보
   */
  getRelativeMapping(sourceFilePath: string): {
    sourceFile: string
    markdownFile: string
    fileId: string
  } {
    const info = this.getMappingInfo(sourceFilePath)

    return {
      sourceFile: relative(this.projectRoot, info.sourceFile),
      markdownFile: relative(process.cwd(), info.markdownFile),
      fileId: info.fileId,
    }
  }

  /**
   * 일관된 경로 찾기 - 핵심 기능
   *
   * 주어진 파일에 대해 항상 동일한 마크다운 파일 경로를 반환
   */
  findConsistentPath(sourceFilePath: string): {
    found: boolean
    markdownPath: string
    fileId: string
    message: string
  } {
    try {
      const markdownPath = this.getMarkdownPath(sourceFilePath)
      const fileId = this.namespace
        ? PredictableIdGenerator.generateNamespacedFileId(resolve(sourceFilePath), this.projectRoot, this.namespace)
        : PredictableIdGenerator.generateSmartProjectId(resolve(sourceFilePath), this.projectRoot)

      return {
        found: true,
        markdownPath,
        fileId,
        message: `일관된 매핑: ${relative(this.projectRoot, sourceFilePath)} → ${relative(process.cwd(), markdownPath)}`,
      }
    } catch (error) {
      return {
        found: false,
        markdownPath: '',
        fileId: '',
        message: `매핑 실패: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * 프로젝트 전체의 일관된 매핑 테이블 생성
   */
  generateProjectMappingTable(): {
    totalFiles: number
    mappings: Array<{
      sourceFile: string
      markdownFile: string
      fileId: string
      namespace?: string
    }>
    namespace?: string
  } {
    const extensions = ['.ts', '.tsx', '.js', '.jsx']
    const mappings: Array<{
      sourceFile: string
      markdownFile: string
      fileId: string
      namespace?: string
    }> = []

    try {
      const directoryMapping = this.getDirectoryMapping(this.projectRoot, extensions)

      directoryMapping.forEach((markdownFile, sourceFile) => {
        const info = this.getMappingInfo(sourceFile)
        mappings.push({
          sourceFile: relative(this.projectRoot, sourceFile),
          markdownFile: relative(process.cwd(), markdownFile),
          fileId: info.fileId,
          namespace: this.namespace,
        })
      })
    } catch (error) {
      console.warn('프로젝트 매핑 테이블 생성 실패:', error)
    }

    return {
      totalFiles: mappings.length,
      mappings,
      namespace: this.namespace,
    }
  }
}
