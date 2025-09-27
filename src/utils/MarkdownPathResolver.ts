import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

/**
 * 마크다운 저장 위치를 찾는 전용 클래스
 *
 * 핵심 기능:
 * 1. namespace 기반 경로 결정
 * 2. 파일 경로 → 마크다운 경로 매핑
 * 3. 일관된 저장 구조 보장
 */
export class MarkdownPathResolver {
  private projectRoot: string
  private docsRoot: string
  private namespace?: string

  constructor(projectRoot: string, docsRoot: string = './docs', namespace?: string) {
    this.projectRoot = resolve(projectRoot)
    this.docsRoot = resolve(docsRoot)
    this.namespace = namespace
  }

  /**
   * namespace 업데이트
   */
  updateNamespace(namespace?: string): void {
    this.namespace = namespace
  }

  /**
   * 파일 경로에서 마크다운 저장 위치를 결정합니다
   */
  getMarkdownPath(sourceFilePath: string): string {
    const absoluteSourcePath = resolve(sourceFilePath)
    const relativePath = relative(this.projectRoot, absoluteSourcePath)

    // 프로젝트 루트 밖의 파일은 처리하지 않음
    if (relativePath.startsWith('..')) {
      throw new Error(`File is outside project root: ${sourceFilePath}`)
    }

    // namespace 기반 저장 위치 결정
    const basePath = this.getBasePath()
    return resolve(basePath, relativePath + '.md')
  }

  /**
   * namespace에 따른 기본 저장 경로를 반환합니다
   */
  private getBasePath(): string {
    if (this.namespace) {
      // namespace가 있으면 프로젝트 루트 기준으로 해당 경로 사용
      if (this.namespace.startsWith('/') || this.namespace.includes('../')) {
        throw new Error(`Invalid namespace: cannot use absolute paths or paths outside project root. Got: ${this.namespace}`)
      }

      const cleanNamespace = this.namespace.startsWith('./') ? this.namespace.slice(2) : this.namespace
      return resolve(this.projectRoot, cleanNamespace)
    } else {
      // 기본값: docs/mirror
      return resolve(this.docsRoot, 'mirror')
    }
  }

  /**
   * 마크다운 파일에서 원본 파일 경로를 역추적합니다
   */
  getSourcePath(markdownPath: string): string {
    const absoluteDocPath = resolve(markdownPath)
    const basePath = this.getBasePath()

    // 올바른 저장 위치인지 검증
    if (!absoluteDocPath.startsWith(basePath)) {
      throw new Error(`Document is not in expected directory: ${markdownPath}`)
    }

    // .md 확장자 제거
    if (!absoluteDocPath.endsWith('.md')) {
      throw new Error(`Document must have .md extension: ${markdownPath}`)
    }

    const sourceRelativePath = relative(basePath, absoluteDocPath.slice(0, -3)) // .md 제거
    return resolve(this.projectRoot, sourceRelativePath)
  }

  /**
   * 마크다운 저장 디렉토리를 생성합니다
   */
  ensureMarkdownDirectory(sourceFilePath: string): string {
    const markdownPath = this.getMarkdownPath(sourceFilePath)
    const markdownDir = dirname(markdownPath)

    if (!existsSync(markdownDir)) {
      const { mkdirSync } = require('node:fs')
      mkdirSync(markdownDir, { recursive: true })
    }

    return markdownPath
  }

  /**
   * 매핑 정보를 반환합니다
   */
  getMappingInfo(sourceFilePath: string): {
    sourceFile: string
    markdownFile: string
    sourceExists: boolean
    markdownExists: boolean
    relativePath: string
    namespace: string | undefined
  } {
    const absoluteSourcePath = resolve(sourceFilePath)
    const markdownPath = this.getMarkdownPath(absoluteSourcePath)
    const relativePath = relative(this.projectRoot, absoluteSourcePath)

    return {
      sourceFile: absoluteSourcePath,
      markdownFile: markdownPath,
      sourceExists: existsSync(absoluteSourcePath),
      markdownExists: existsSync(markdownPath),
      relativePath,
      namespace: this.namespace,
    }
  }

  /**
   * 배치 매핑을 수행합니다
   */
  getBatchMapping(sourceFilePaths: Array<string>): Map<string, string> {
    const mapping = new Map<string, string>()

    for (const sourcePath of sourceFilePaths) {
      try {
        const markdownPath = this.getMarkdownPath(sourcePath)
        mapping.set(resolve(sourcePath), markdownPath)
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
    markdownFile: string
    reversedSource: string
    perfectMatch: boolean
  } {
    const sourceFile = resolve(sourceFilePath)
    const markdownFile = this.getMarkdownPath(sourceFile)
    const reversedSource = this.getSourcePath(markdownFile)

    return {
      valid: true,
      sourceFile,
      markdownFile,
      reversedSource,
      perfectMatch: reversedSource === sourceFile,
    }
  }

  /**
   * 현재 설정 정보를 반환합니다
   */
  getConfig(): {
    projectRoot: string
    docsRoot: string
    namespace: string | undefined
    basePath: string
  } {
    return {
      projectRoot: this.projectRoot,
      docsRoot: this.docsRoot,
      namespace: this.namespace,
      basePath: this.getBasePath(),
    }
  }
}
