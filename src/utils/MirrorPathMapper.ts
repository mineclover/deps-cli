import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

/**
 * 완전 미러링 기반 경로 매핑 시스템
 *
 * 핵심 원칙:
 * 1. 프로젝트 구조를 docs/mirror/ 아래 완전히 복제
 * 2. 변환 없음 - 단순 경로 조작만
 * 3. 100% 가역성 보장
 * 4. 파일명/경로 제한 없음
 */
export class MirrorPathMapper {
  private projectRoot: string
  private docsRoot: string
  private mirrorRoot: string

  constructor(projectRoot: string, docsRoot: string = './docs', namespace?: string) {
    this.projectRoot = resolve(projectRoot)
    this.docsRoot = resolve(docsRoot)
    
    // namespace 기본 컨벤션: 모든 경로는 프로젝트 루트 기준
    if (namespace) {
      // 절대 경로나 프로젝트 밖으로 나가는 경로는 방지
      if (namespace.startsWith('/') || namespace.includes('../')) {
        throw new Error(`Invalid namespace: cannot use absolute paths or paths outside project root. Got: ${namespace}`)
      }

      // 모든 namespace는 프로젝트 루트 기준으로 처리 (단순 이름 포함)
      const cleanNamespace = namespace.startsWith('./') ? namespace.slice(2) : namespace
      this.mirrorRoot = resolve(this.projectRoot, cleanNamespace)
    } else {
      // 기본값: docs/mirror
      this.mirrorRoot = resolve(this.docsRoot, 'mirror')
    }
  }

  /**
   * 소스 파일 → 미러 문서 경로
   *
   * 예시:
   * - /project/src/utils/my_helper.ts → /project/docs/mirror/src/utils/my_helper.ts.md
   * - /project/src/utils/my-helper.ts → /project/docs/mirror/src/utils/my-helper.ts.md
   * - /project/test/deeply/nested/file.spec.ts → /project/docs/mirror/test/deeply/nested/file.spec.ts.md
   */
  getDocumentPath(sourceFilePath: string): string {
    const absoluteSourcePath = resolve(sourceFilePath)
    const relativePath = relative(this.projectRoot, absoluteSourcePath)

    // 프로젝트 루트 밖의 파일은 처리하지 않음
    if (relativePath.startsWith('..')) {
      throw new Error(`File is outside project root: ${sourceFilePath}`)
    }

    return resolve(this.mirrorRoot, relativePath + '.md')
  }

  /**
   * 미러 문서 → 소스 파일 경로 (100% 정확한 역매핑)
   */
  getSourcePath(documentPath: string): string {
    const absoluteDocPath = resolve(documentPath)

    // docs/mirror/ 경로 검증
    if (!absoluteDocPath.startsWith(this.mirrorRoot)) {
      throw new Error(`Document is not in mirror directory: ${documentPath}`)
    }

    // .md 확장자 제거
    if (!absoluteDocPath.endsWith('.md')) {
      throw new Error(`Document must have .md extension: ${documentPath}`)
    }

    const sourceRelativePath = relative(this.mirrorRoot, absoluteDocPath.slice(0, -3)) // .md 제거
    return resolve(this.projectRoot, sourceRelativePath)
  }

  /**
   * 문서 디렉토리 자동 생성
   */
  ensureDocumentDirectory(sourceFilePath: string): string {
    const documentPath = this.getDocumentPath(sourceFilePath)
    const documentDir = dirname(documentPath)

    if (!existsSync(documentDir)) {
      mkdirSync(documentDir, { recursive: true })
    }

    return documentPath
  }

  /**
   * 매핑 정보 반환
   */
  getMappingInfo(sourceFilePath: string): {
    sourceFile: string
    documentFile: string
    sourceExists: boolean
    documentExists: boolean
    relativePath: string
  } {
    const absoluteSourcePath = resolve(sourceFilePath)
    const documentPath = this.getDocumentPath(absoluteSourcePath)
    const relativePath = relative(this.projectRoot, absoluteSourcePath)

    return {
      sourceFile: absoluteSourcePath,
      documentFile: documentPath,
      sourceExists: existsSync(absoluteSourcePath),
      documentExists: existsSync(documentPath),
      relativePath,
    }
  }

  /**
   * 배치 매핑
   */
  getBatchMapping(sourceFilePaths: string[]): Map<string, string> {
    const mapping = new Map<string, string>()

    for (const sourcePath of sourceFilePaths) {
      try {
        const documentPath = this.getDocumentPath(sourcePath)
        mapping.set(resolve(sourcePath), documentPath)
      } catch (error) {
        console.warn(`Failed to map ${sourcePath}:`, error)
      }
    }

    return mapping
  }

  /**
   * 매핑 검증 (100% 정확성 보장)
   */
  verifyMapping(sourceFilePath: string): {
    valid: boolean
    sourceFile: string
    documentFile: string
    reversedSource: string
    perfectMatch: boolean
  } {
    const sourceFile = resolve(sourceFilePath)
    const documentFile = this.getDocumentPath(sourceFile)
    const reversedSource = this.getSourcePath(documentFile)

    return {
      valid: true, // 미러링은 항상 유효
      sourceFile,
      documentFile,
      reversedSource,
      perfectMatch: reversedSource === sourceFile, // 항상 true여야 함
    }
  }

  /**
   * 프로젝트 전체 매핑 테이블 생성
   */
  generateProjectMappingTable(extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): {
    totalFiles: number
    mappings: Array<{
      sourceFile: string
      documentFile: string
      relativePath: string
    }>
  } {
    const mappings: Array<{
      sourceFile: string
      documentFile: string
      relativePath: string
    }> = []

    try {
      const directoryMapping = this.scanDirectory(this.projectRoot, extensions)

      directoryMapping.forEach((documentFile, sourceFile) => {
        const info = this.getMappingInfo(sourceFile)
        mappings.push({
          sourceFile: info.relativePath,
          documentFile: relative(process.cwd(), documentFile),
          relativePath: info.relativePath,
        })
      })
    } catch (error) {
      console.warn('프로젝트 매핑 테이블 생성 실패:', error)
    }

    return {
      totalFiles: mappings.length,
      mappings,
    }
  }

  /**
   * 디렉토리 스캔
   */
  private scanDirectory(directoryPath: string, extensions: string[]): Map<string, string> {
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
            // docs 디렉토리는 제외
            if (!fullPath.includes('/docs/') && !fullPath.endsWith('/docs')) {
              walkDir(fullPath)
            }
          } else if (extensions.some((ext) => file.endsWith(ext))) {
            const documentPath = this.getDocumentPath(fullPath)
            mapping.set(fullPath, documentPath)
          }
        }
      }

      walkDir(resolve(directoryPath))
    } catch (error) {
      console.warn('디렉토리 스캔 실패:', error)
    }

    return mapping
  }

  /**
   * 메서드별 문서 경로 생성
   */
  getMethodDocumentPath(sourceFilePath: string, methodName: string): string {
    const fileDocPath = this.getDocumentPath(sourceFilePath)
    const methodsDir = resolve(this.docsRoot, 'methods')

    const relativePath = relative(this.projectRoot, resolve(sourceFilePath))
    const methodDir = resolve(methodsDir, relativePath.replace(/\.[^.]+$/, '')) // 확장자 제거

    return resolve(methodDir, `${methodName}.md`)
  }

  /**
   * 클래스별 문서 경로 생성
   */
  getClassDocumentPath(sourceFilePath: string, className: string): string {
    const classesDir = resolve(this.docsRoot, 'classes')
    const relativePath = relative(this.projectRoot, resolve(sourceFilePath))
    const classDir = resolve(classesDir, relativePath.replace(/\.[^.]+$/, '')) // 확장자 제거

    return resolve(classDir, `${className}.md`)
  }

  /**
   * 라이브러리 문서 경로 생성
   */
  getLibraryDocumentPath(libraryName: string): string {
    const librariesDir = resolve(this.docsRoot, 'libraries')
    const safeLibraryName = libraryName.replace(/[@/]/g, '_') // npm 스코프 처리
    return resolve(librariesDir, `${safeLibraryName}.md`)
  }

  /**
   * 모듈 문서 경로 생성
   */
  getModuleDocumentPath(modulePath: string): string {
    const modulesDir = resolve(this.docsRoot, 'modules')
    const normalizedPath = modulePath.replace(/\.[^.]+$/, '') // 확장자 제거
    return resolve(modulesDir, `${normalizedPath}.md`)
  }

  /**
   * 의존성 그래프 문서 경로 생성
   */
  getDependencyGraphDocumentPath(): string {
    return resolve(this.docsRoot, 'dependency-graph.md')
  }

  // ========================================
  // PathMapper 호환성 메서드들
  // ========================================

  /**
   * PathMapper.getMarkdownPath() 호환 메서드
   */
  getMarkdownPath(sourceFilePath: string): string {
    return this.getDocumentPath(sourceFilePath)
  }

  /**
   * PathMapper.findConsistentPath() 호환 메서드
   */
  findConsistentPath(sourceFilePath: string): {
    found: boolean
    markdownPath: string
    fileId: string
    message: string
  } {
    try {
      const markdownPath = this.getDocumentPath(sourceFilePath)
      const relativePath = relative(this.projectRoot, resolve(sourceFilePath))
      const fileId = relativePath.replace(/[/\\]/g, '-').replace(/\./g, '-')

      return {
        found: true,
        markdownPath,
        fileId,
        message: `미러링 매핑: ${relativePath} → ${relative(process.cwd(), markdownPath)}`,
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
   * PathMapper.getRelativeMapping() 호환 메서드
   */
  getRelativeMapping(sourceFilePath: string): {
    sourceFile: string
    markdownFile: string
    fileId: string
  } {
    const info = this.getMappingInfo(sourceFilePath)
    const fileId = info.relativePath.replace(/[/\\]/g, '-').replace(/\./g, '-')

    return {
      sourceFile: info.relativePath,
      markdownFile: relative(process.cwd(), info.documentFile),
      fileId,
    }
  }
}
