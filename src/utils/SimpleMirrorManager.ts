import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { MarkdownGenerator } from './MarkdownGenerator.js'
import { MarkdownPathResolver } from './MarkdownPathResolver.js'
import { MirrorPathMapper } from './MirrorPathMapper.js'

export interface FileMetadata {
  path: string
  size: number
  lines: number
  extension: string
  lastModified: string
  created: string
  namespace?: string
}

export interface MirrorOptions {
  targetPath?: string
  shouldCreate?: boolean
  namespace?: string
  extensions?: Array<string>
  maxDisplay?: number
  docsPath?: string
  verbose?: boolean
}

export class SimpleMirrorManager {
  private projectRoot: string
  private mapper: MirrorPathMapper
  private pathResolver: MarkdownPathResolver
  private markdownGenerator: MarkdownGenerator

  constructor(projectRoot: string = process.cwd(), docsPath: string = './docs', namespace?: string) {
    this.projectRoot = projectRoot
    this.mapper = new MirrorPathMapper(projectRoot, docsPath, namespace)
    this.pathResolver = new MarkdownPathResolver(projectRoot, docsPath, namespace)
    this.markdownGenerator = new MarkdownGenerator(projectRoot, docsPath, namespace)
  }

  /**
   * 새로운 MirrorPathMapper로 업데이트합니다
   */
  updateMapper(docsPath: string, namespace?: string): void {
    this.mapper = new MirrorPathMapper(this.projectRoot, docsPath, namespace)
    this.pathResolver = new MarkdownPathResolver(this.projectRoot, docsPath, namespace)
    this.markdownGenerator = new MarkdownGenerator(this.projectRoot, docsPath, namespace)
  }

  /**
   * 마크다운 경로 해결기를 반환합니다
   */
  getPathResolver(): MarkdownPathResolver {
    return this.pathResolver
  }

  /**
   * 마크다운 생성기를 반환합니다
   */
  getMarkdownGenerator(): MarkdownGenerator {
    return this.markdownGenerator
  }

  /**
   * 디렉토리를 스캔하여 지정된 확장자의 파일들을 찾습니다
   */
  scanFiles(dir: string, extensions: Array<string> = ['.ts', '.tsx', '.js', '.jsx']): Array<string> {
    const files: Array<string> = []

    const walk = (currentDir: string): void => {
      if (!existsSync(currentDir)) return

      try {
        const items = readdirSync(currentDir)

        for (const item of items) {
          const fullPath = join(currentDir, item)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            if (!['node_modules', 'docs', 'dist', '.git'].some(excluded => item.includes(excluded))) {
              walk(fullPath)
            }
          } else if (extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath)
          }
        }
      } catch (error) {
        // 권한 오류 등 무시
        console.error(`디렉토리 스캔 실패: ${dir}`, error instanceof Error ? error.message : error)
      }
    }

    walk(resolve(dir))
    return files
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
    } catch (err) {
      console.error(`메타데이터 생성 실패: ${filePath}`, err instanceof Error ? err.message : err)
      return null
    }
  }

  /**
   * 단일 파일의 미러를 생성합니다
   */
  async createSimpleMirror(filePath: string, namespace?: string): Promise<string | null> {
    const metadata = await this.createFileMetadata(filePath, namespace)
    if (!metadata) return null

    const mirrorPath = this.mapper.getDocumentPath(filePath)

    // JSON 메타데이터를 마크다운으로 저장
    const content = `# ${metadata.path}

## 📄 File Metadata

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`
`

    // 디렉토리 생성
    await mkdir(dirname(mirrorPath), { recursive: true })

    // 파일 저장
    await writeFile(mirrorPath, content, 'utf-8')

    return mirrorPath
  }

  /**
   * 미러링 작업을 수행합니다
   */
  async processFiles(options: MirrorOptions = {}): Promise<{ processed: number; total: number }> {
    const {
      targetPath = '.',
      shouldCreate = false,
      namespace,
      extensions = ['.ts', '.tsx', '.js', '.jsx'],
      maxDisplay = 20
    } = options

    console.log('🪞 Simple Mirror System')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log(`📁 Target: ${targetPath}`)
    console.log(`📄 Mode: ${shouldCreate ? 'CREATE FILES' : 'SHOW MAPPING ONLY'}`)
    if (namespace) {
      console.log(`🏷️ Namespace: ${namespace}`)
    }
    console.log('')

    let filesToProcess: Array<string> = []

    if (existsSync(targetPath) && statSync(targetPath).isFile()) {
      // 단일 파일 처리
      filesToProcess = [resolve(targetPath)]
    } else {
      // 디렉토리 처리
      filesToProcess = this.scanFiles(targetPath, extensions)
    }

    console.log(`📋 Found ${filesToProcess.length} files:`)
    console.log('')

    let processed = 0

    for (const filePath of filesToProcess.slice(0, maxDisplay)) {
      const mirrorPath = this.mapper.getDocumentPath(filePath)
      const relativePath = relative(this.projectRoot, filePath)
      const relativeMirror = relative(this.projectRoot, mirrorPath)

      console.log(`📄 ${relativePath}`)
      console.log(`   → ${relativeMirror}`)

      if (shouldCreate) {
        try {
          const createdPath = await this.createSimpleMirror(filePath, namespace)
          if (createdPath) {
            console.log(`   ✅ Created`)
            processed++
          } else {
            console.log(`   ❌ Failed`)
          }
        } catch (err) {
          console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`)
        }
      }

      console.log('')
    }

    if (filesToProcess.length > maxDisplay) {
      console.log(`   ... and ${filesToProcess.length - maxDisplay} more files`)
    }

    console.log('')
    if (shouldCreate) {
      console.log(`✅ Created ${processed} mirror files`)
    } else {
      console.log('✅ Mapping completed (use --create to generate files)')
    }
    console.log('🎯 Files contain only JSON metadata')

    return { processed, total: filesToProcess.length }
  }

  /**
   * 파일 매핑만 표시합니다 (파일 생성 없음)
   */
  async showMirrorMapping(targetPath: string = '.', maxDisplay: number = 15): Promise<void> {
    console.log('🪞 Simple File Mirror Mapping')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log(`📁 Target: ${targetPath}`)
    console.log(`📄 Project Root: ${this.projectRoot}`)
    console.log('')

    if (existsSync(targetPath) && statSync(targetPath).isFile()) {
      // 단일 파일 처리
      const mirrorPath = this.mapper.getDocumentPath(resolve(targetPath))
      const relativePath = relative(this.projectRoot, resolve(targetPath))
      const relativeMirror = relative(this.projectRoot, mirrorPath)

      console.log('📄 Single File Mapping:')
      console.log(`   Source: ${relativePath}`)
      console.log(`   Mirror: ${relativeMirror}`)
    } else {
      // 디렉토리 처리
      const files = this.scanFiles(targetPath)
      console.log(`📋 Found ${files.length} files:`)
      console.log('')

      files.slice(0, maxDisplay).forEach(filePath => {
        const mirrorPath = this.mapper.getDocumentPath(filePath)
        const relativePath = relative(this.projectRoot, filePath)
        const relativeMirror = relative(this.projectRoot, mirrorPath)

        console.log(`📄 ${relativePath}`)
        console.log(`   → ${relativeMirror}`)
      })

      if (files.length > maxDisplay) {
        console.log(`   ... and ${files.length - maxDisplay} more files`)
      }
    }

    console.log('')
    console.log('✅ Mapping completed (no files created)')
  }
}
