import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { EnhancedExportExtractor, TypeScriptParser, type EnhancedExportExtractionResult } from '@context-action/dependency-linker'

export interface ProjectExportInfo {
  absolutePath: string
  exportResult: EnhancedExportExtractionResult
}

export interface ProjectImportInfo {
  absolutePath: string
  imports: ImportDeclaration[]
}

export interface ImportDeclaration {
  importPath: string           // 원본 import 경로
  resolvedPath: string | null  // 절대 경로로 resolve된 경로
  importedMembers: string[]    // import된 멤버들
  importType: 'named' | 'default' | 'namespace' | 'side-effect'
  line: number
}

export interface DependencyEdge {
  from: string                 // 절대 경로
  to: string                   // 절대 경로
  importedMembers: string[]    // 사용된 exports
  line: number
}

export interface ProjectDependencyGraph {
  nodes: Set<string>           // 모든 파일의 절대 경로
  edges: DependencyEdge[]      // 의존성 관계
  exportMap: Map<string, EnhancedExportExtractionResult>  // 파일별 export 정보
  importMap: Map<string, ImportDeclaration[]>             // 파일별 import 정보
  entryPoints: string[]        // 엔트리 포인트들
}

/**
 * EnhancedExportExtractor의 출력을 기반으로 하는 진정한 의존성 분석기
 * 절대 경로 기준으로 정렬된 파일들의 export-import 매칭을 통해 정확한 의존성 분석 수행
 */
export class EnhancedDependencyAnalyzer {
  private parser: TypeScriptParser
  private extractor: EnhancedExportExtractor
  private parseCache = new Map<string, any>()

  constructor(private projectRoot: string) {
    this.parser = new TypeScriptParser()
    this.extractor = new EnhancedExportExtractor()
  }

  /**
   * 프로젝트 전체 의존성 그래프 구축
   */
  async buildProjectDependencyGraph(filePatterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']): Promise<ProjectDependencyGraph> {
    const allFiles = await this.getAllProjectFiles(filePatterns)
    const sortedFiles = this.sortFilesByAbsolutePath(allFiles)

    // 1단계: 모든 파일의 export 정보 수집 (절대경로 기준)
    const exportMap = await this.collectAllExports(sortedFiles)

    // 2단계: 모든 파일의 import 정보 수집 (절대경로로 resolve)
    const importMap = await this.collectAllImports(sortedFiles)

    // 3단계: export-import 매칭을 통한 의존성 엣지 구축
    const edges = this.buildDependencyEdges(importMap, exportMap)

    // 4단계: 엔트리 포인트 식별
    const entryPoints = this.identifyEntryPoints(sortedFiles, edges)

    return {
      nodes: new Set(sortedFiles),
      edges,
      exportMap,
      importMap,
      entryPoints
    }
  }

  /**
   * 파일들을 절대경로 기준으로 정렬
   */
  private sortFilesByAbsolutePath(files: string[]): string[] {
    return files
      .map(file => path.resolve(this.projectRoot, file))
      .sort((a, b) => a.localeCompare(b))
  }

  /**
   * 모든 파일의 export 정보를 EnhancedExportExtractor로 수집
   */
  private async collectAllExports(sortedFiles: string[]): Promise<Map<string, EnhancedExportExtractionResult>> {
    const exportMap = new Map<string, EnhancedExportExtractionResult>()

    for (const filePath of sortedFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const parseResult = await this.parseWithCache(filePath, content)

        if (parseResult.ast) {
          const exportResult = this.extractor.extractExports(parseResult.ast, filePath)
          exportMap.set(filePath, exportResult)
        }
      } catch (error) {
        console.warn(`Failed to extract exports from ${filePath}:`, error)
      }
    }

    return exportMap
  }

  /**
   * 모든 파일의 import 정보를 AST 기반으로 수집
   */
  private async collectAllImports(sortedFiles: string[]): Promise<Map<string, ImportDeclaration[]>> {
    const importMap = new Map<string, ImportDeclaration[]>()

    for (const filePath of sortedFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const imports = await this.extractImportsFromFile(filePath, content)
        importMap.set(filePath, imports)
      } catch (error) {
        console.warn(`Failed to extract imports from ${filePath}:`, error)
        importMap.set(filePath, [])
      }
    }

    return importMap
  }

  /**
   * 파일에서 import 선언들을 추출하고 절대경로로 resolve
   */
  private async extractImportsFromFile(filePath: string, content: string): Promise<ImportDeclaration[]> {
    const imports: ImportDeclaration[] = []

    // TODO: AST 기반 import 추출 구현
    // 현재는 정규식 폴백 사용
    const importRegex = /import\s+(?:(?:\{([^}]+)\})|(?:(\w+))|(?:\*\s+as\s+(\w+)))\s+from\s+['"`]([^'"`]+)['"`]/g
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let match

      while ((match = importRegex.exec(line)) !== null) {
        const [, namedImports, defaultImport, namespaceImport, importPath] = match

        if (!importPath.startsWith('node:') && !this.isNodeModule(importPath)) {
          const resolvedPath = await this.resolveImportPath(importPath, filePath)
          const importedMembers = namedImports ?
            namedImports.split(',').map(m => m.trim()) :
            defaultImport ? [defaultImport] :
            namespaceImport ? [namespaceImport] : []

          imports.push({
            importPath,
            resolvedPath,
            importedMembers,
            importType: namedImports ? 'named' : defaultImport ? 'default' : 'namespace',
            line: i + 1
          })
        }
      }
    }

    return imports
  }

  /**
   * export-import 매칭을 통한 의존성 엣지 구축
   */
  private buildDependencyEdges(
    importMap: Map<string, ImportDeclaration[]>,
    exportMap: Map<string, EnhancedExportExtractionResult>
  ): DependencyEdge[] {
    const edges: DependencyEdge[] = []

    for (const [fromFile, imports] of importMap) {
      for (const importDecl of imports) {
        if (!importDecl.resolvedPath) continue

        const targetExports = exportMap.get(importDecl.resolvedPath)
        if (!targetExports) continue

        // 실제로 존재하는 export만 의존성으로 간주
        const validImports = importDecl.importedMembers.filter(member =>
          targetExports.exportMethods.some(exp => exp.name === member)
        )

        if (validImports.length > 0) {
          edges.push({
            from: fromFile,
            to: importDecl.resolvedPath,
            importedMembers: validImports,
            line: importDecl.line
          })
        }
      }
    }

    return edges
  }

  /**
   * 엔트리 포인트 식별
   */
  private identifyEntryPoints(sortedFiles: string[], edges: DependencyEdge[]): string[] {
    const importedFiles = new Set(edges.map(edge => edge.to))
    const entryPoints: string[] = []

    for (const file of sortedFiles) {
      const basename = path.basename(file)
      const relativePath = path.relative(this.projectRoot, file)

      // 명시적 엔트리 포인트
      if (basename === 'bin.ts' || basename === 'index.ts' ||
          basename === 'main.ts' || relativePath.includes('bin/') ||
          relativePath.includes('cli/') || basename.includes('test') ||
          basename.includes('spec') || relativePath.includes('example')) {
        entryPoints.push(file)
      }
      // 어떤 파일에서도 import되지 않는 파일 (독립적인 스크립트)
      else if (!importedFiles.has(file)) {
        entryPoints.push(file)
      }
    }

    return entryPoints
  }

  // Helper methods
  private async parseWithCache(filePath: string, content?: string): Promise<any> {
    if (this.parseCache.has(filePath)) {
      return this.parseCache.get(filePath)
    }

    const parseResult = await this.parser.parse(filePath, content)
    this.parseCache.set(filePath, parseResult)
    return parseResult
  }

  private async resolveImportPath(importPath: string, currentFile: string): Promise<string | null> {
    if (!importPath.startsWith('.')) return null

    const resolved = path.resolve(path.dirname(currentFile), importPath)

    // TypeScript .js import → .ts 파일 매칭
    if (importPath.endsWith('.js')) {
      const tsVersion = resolved.replace(/\.js$/, '.ts')
      try {
        await fs.access(tsVersion)
        return tsVersion
      } catch {
        // 실제 .js 파일 확인
        try {
          await fs.access(resolved)
          return resolved
        } catch {
          // 계속 진행
        }
      }
    }

    // 확장자 추가 시도
    const extensions = ['ts', 'tsx', 'js', 'jsx', 'mjs']
    for (const ext of extensions) {
      const withExt = `${resolved}.${ext}`
      try {
        await fs.access(withExt)
        return withExt
      } catch {
        continue
      }
    }

    // index 파일 시도
    for (const ext of extensions) {
      const indexFile = path.join(resolved, `index.${ext}`)
      try {
        await fs.access(indexFile)
        return indexFile
      } catch {
        continue
      }
    }

    return null
  }

  private isNodeModule(importPath: string): boolean {
    return !importPath.startsWith('.') && !importPath.startsWith('/')
  }

  private async getAllProjectFiles(patterns: string[]): Promise<string[]> {
    const glob = await import('glob')
    const files: string[] = []

    for (const pattern of patterns) {
      try {
        const matches = await glob.glob(pattern, {
          cwd: this.projectRoot,
          ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**']
        })
        files.push(...matches)
      } catch (error) {
        console.warn(`Failed to glob pattern ${pattern}:`, error)
      }
    }

    return [...new Set(files)] // 중복 제거
  }

  clearCache(): void {
    this.parseCache.clear()
  }
}