import { readFile, stat, writeFile } from 'node:fs/promises'
import { extname, relative } from 'node:path'
import { MarkdownPathResolver } from './MarkdownPathResolver.js'

export interface FileMetadata {
  path: string
  size: number
  lines: number
  extension: string
  lastModified: string
  created: string
  namespace?: string
}

export interface MarkdownContent {
  title: string
  metadata: FileMetadata
  content: string
  frontMatter?: Record<string, any>
}

/**
 * 마크다운 생성 전용 클래스
 *
 * 핵심 기능:
 * 1. 파일 메타데이터 생성
 * 2. 마크다운 콘텐츠 생성
 * 3. 다양한 템플릿 지원
 */
export class MarkdownGenerator {
  private projectRoot: string
  private pathResolver: MarkdownPathResolver

  constructor(projectRoot: string, docsRoot: string = './docs', namespace?: string) {
    this.projectRoot = projectRoot
    this.pathResolver = new MarkdownPathResolver(projectRoot, docsRoot, namespace)
  }

  /**
   * namespace 업데이트
   */
  updateNamespace(namespace?: string): void {
    this.pathResolver.updateNamespace(namespace)
  }

  /**
   * 파일의 메타데이터를 생성합니다
   */
  async createFileMetadata(filePath: string, namespace?: string): Promise<FileMetadata | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const stats = await stat(filePath)
      const relativePath = relative(this.projectRoot, filePath)

      return {
        path: relativePath,
        size: stats.size,
        lines: content.split('\n').length,
        extension: extname(filePath),
        lastModified: stats.mtime.toISOString(),
        created: new Date().toISOString(),
        ...(namespace && { namespace }),
      }
    } catch (error) {
      console.error(`메타데이터 생성 실패: ${filePath}`, error instanceof Error ? error.message : error)
      return null
    }
  }

  /**
   * 기본 마크다운 콘텐츠를 생성합니다
   */
  generateBasicMarkdown(metadata: FileMetadata): MarkdownContent {
    const title = metadata.path.split('/').pop() || metadata.path

    const content = `# ${title}

## 📄 File Metadata

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`
`

    return {
      title,
      metadata,
      content,
    }
  }

  /**
   * 상세한 마크다운 콘텐츠를 생성합니다
   */
  generateDetailedMarkdown(metadata: FileMetadata, sourceContent: string): MarkdownContent {
    const title = metadata.path.split('/').pop() || metadata.path

    const frontMatter = {
      title,
      path: metadata.path,
      size: metadata.size,
      lines: metadata.lines,
      extension: metadata.extension,
      lastModified: metadata.lastModified,
      namespace: metadata.namespace,
    }

    const content = `---
title: "${title}"
path: "${metadata.path}"
size: ${metadata.size}
lines: ${metadata.lines}
extension: "${metadata.extension}"
lastModified: "${metadata.lastModified}"
${metadata.namespace ? `namespace: "${metadata.namespace}"` : ''}
---

# ${title}

## 📄 File Information

- **Path**: \`${metadata.path}\`
- **Size**: ${metadata.size} bytes
- **Lines**: ${metadata.lines}
- **Extension**: \`${metadata.extension}\`
- **Last Modified**: ${new Date(metadata.lastModified).toLocaleString()}
${metadata.namespace ? `- **Namespace**: \`${metadata.namespace}\`` : ''}

## 📝 Source Code

\`\`\`${this.getLanguageFromExtension(metadata.extension)}
${sourceContent}
\`\`\`
`

    return {
      title,
      metadata,
      content,
      frontMatter,
    }
  }

  /**
   * 확장자에서 언어를 추출합니다
   */
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.json': 'json',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
    }

    return languageMap[extension] || 'text'
  }

  /**
   * 단일 파일의 마크다운을 생성하고 저장합니다
   */
  async generateMarkdownFile(
    filePath: string,
    options: {
      includeSource?: boolean
      template?: 'basic' | 'detailed'
      namespace?: string
    } = {}
  ): Promise<string | null> {
    const { includeSource = false, template = 'basic', namespace } = options

    const metadata = await this.createFileMetadata(filePath, namespace)
    if (!metadata) return null

    let markdownContent: MarkdownContent

    if (template === 'detailed' && includeSource) {
      const sourceContent = await readFile(filePath, 'utf-8')
      markdownContent = this.generateDetailedMarkdown(metadata, sourceContent)
    } else {
      markdownContent = this.generateBasicMarkdown(metadata)
    }

    const markdownPath = this.pathResolver.ensureMarkdownDirectory(filePath)
    await writeFile(markdownPath, markdownContent.content, 'utf-8')

    return markdownPath
  }

  /**
   * 배치로 마크다운 파일들을 생성합니다
   */
  async generateBatchMarkdown(
    filePaths: Array<string>,
    options: {
      includeSource?: boolean
      template?: 'basic' | 'detailed'
      namespace?: string
      maxFiles?: number
    } = {}
  ): Promise<{
    processed: number
    total: number
    results: Array<{ source: string; markdown: string | null; error?: string }>
  }> {
    const { includeSource = false, template = 'basic', namespace, maxFiles } = options
    const targetFiles = maxFiles ? filePaths.slice(0, maxFiles) : filePaths

    const results: Array<{ source: string; markdown: string | null; error?: string }> = []
    let processed = 0

    for (const filePath of targetFiles) {
      try {
        const markdownPath = await this.generateMarkdownFile(filePath, {
          includeSource,
          template,
          namespace,
        })

        results.push({
          source: filePath,
          markdown: markdownPath,
        })

        if (markdownPath) processed++
      } catch (error) {
        results.push({
          source: filePath,
          markdown: null,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      processed,
      total: filePaths.length,
      results,
    }
  }

  /**
   * 마크다운 경로 해결기를 반환합니다
   */
  getPathResolver(): MarkdownPathResolver {
    return this.pathResolver
  }

  /**
   * 현재 설정을 반환합니다
   */
  getConfig() {
    return this.pathResolver.getConfig()
  }
}
