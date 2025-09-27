import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  type EnhancedExportExtractionResult,
  EnhancedExportExtractor,
  TypeScriptParser,
} from '@context-action/dependency-linker'

export interface ProjectExportInfo {
  absolutePath: string
  exportResult: EnhancedExportExtractionResult
}

export interface ProjectImportInfo {
  absolutePath: string
  imports: Array<ImportDeclaration>
}

export interface ImportDeclaration {
  importPath: string // 원본 import 경로
  resolvedPath: string | null // 절대 경로로 resolve된 경로
  importedMembers: Array<string> // import된 멤버들
  importType: 'named' | 'default' | 'namespace' | 'side-effect'
  line: number
}

export interface DependencyEdge {
  from: string // 절대 경로
  to: string // 절대 경로
  importedMembers: Array<string> // 사용된 exports
  line: number
}

export interface ProjectDependencyGraph {
  nodes: Set<string> // 모든 파일의 절대 경로
  edges: Array<DependencyEdge> // 의존성 관계
  exportMap: Map<string, EnhancedExportExtractionResult> // 파일별 export 정보
  importMap: Map<string, Array<ImportDeclaration>> // 파일별 import 정보
  entryPoints: Array<string> // 엔트리 포인트들
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
  async buildProjectDependencyGraph(
    filePatterns: Array<string> = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    excludePatterns: Array<string> = []
  ): Promise<ProjectDependencyGraph> {
    const allFiles = await this.getAllProjectFiles(filePatterns, excludePatterns)
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
      entryPoints,
    }
  }

  /**
   * 파일들을 절대경로 기준으로 정렬
   */
  private sortFilesByAbsolutePath(files: Array<string>): Array<string> {
    return files.map((file) => path.resolve(this.projectRoot, file)).sort((a, b) => a.localeCompare(b))
  }

  /**
   * 모든 파일의 export 정보를 EnhancedExportExtractor로 수집
   */
  private async collectAllExports(sortedFiles: Array<string>): Promise<Map<string, EnhancedExportExtractionResult>> {
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
  private async collectAllImports(sortedFiles: Array<string>): Promise<Map<string, Array<ImportDeclaration>>> {
    const importMap = new Map<string, Array<ImportDeclaration>>()

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
  private async extractImportsFromFile(filePath: string, content: string): Promise<Array<ImportDeclaration>> {
    const imports: Array<ImportDeclaration> = []

    // TODO: AST 기반 import 추출 구현
    // 현재는 정규식 폴백 사용
    const importRegex = /import\s+(?:(?:\{([^}]+)\})|(?:(\w+))|(?:\*\s+as\s+(\w+)))\s+from\s+['"`]([^'"`]+)['"`]/g
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let match: RegExpExecArray | null = null

      match = importRegex.exec(line)
      while (match !== null) {
        const [, namedImports, defaultImport, namespaceImport, importPath] = match

        if (!importPath.startsWith('node:') && !this.isNodeModule(importPath)) {
          const resolvedPath = await this.resolveImportPath(importPath, filePath)
          const importedMembers = namedImports
            ? namedImports.split(',').map((m) => m.trim())
            : defaultImport
              ? [defaultImport]
              : namespaceImport
                ? [namespaceImport]
                : []

          imports.push({
            importPath,
            resolvedPath,
            importedMembers,
            importType: namedImports ? 'named' : defaultImport ? 'default' : 'namespace',
            line: i + 1,
          })
        }

        match = importRegex.exec(line)
      }
    }

    return imports
  }

  /**
   * export-import 매칭을 통한 의존성 엣지 구축
   */
  private buildDependencyEdges(
    importMap: Map<string, Array<ImportDeclaration>>,
    exportMap: Map<string, EnhancedExportExtractionResult>
  ): Array<DependencyEdge> {
    const edges: Array<DependencyEdge> = []

    for (const [fromFile, imports] of Array.from(importMap)) {
      for (const importDecl of imports) {
        if (!importDecl.resolvedPath) continue

        const targetExports = exportMap.get(importDecl.resolvedPath)
        if (!targetExports) continue

        // 실제로 존재하는 export만 의존성으로 간주
        const validImports = importDecl.importedMembers.filter((member) =>
          targetExports.exportMethods.some((exp) => exp.name === member)
        )

        if (validImports.length > 0) {
          edges.push({
            from: fromFile,
            to: importDecl.resolvedPath,
            importedMembers: validImports,
            line: importDecl.line,
          })
        }
      }
    }

    return edges
  }

  /**
   * 엔트리 포인트 식별
   */
  private identifyEntryPoints(sortedFiles: Array<string>, edges: Array<DependencyEdge>): Array<string> {
    const importedFiles = new Set(edges.map((edge) => edge.to))
    const entryPoints: Array<string> = []

    for (const file of sortedFiles) {
      const basename = path.basename(file)
      const relativePath = path.relative(this.projectRoot, file)

      // 명시적 엔트리 포인트
      if (
        basename === 'bin.ts' ||
        basename === 'index.ts' ||
        basename === 'main.ts' ||
        relativePath.includes('bin/') ||
        relativePath.includes('cli/') ||
        basename.includes('test') ||
        basename.includes('spec') ||
        relativePath.includes('example')
      ) {
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
        // File doesn't exist, continue to next extension
      }
    }

    // index 파일 시도
    for (const ext of extensions) {
      const indexFile = path.join(resolved, `index.${ext}`)
      try {
        await fs.access(indexFile)
        return indexFile
      } catch {
        // File doesn't exist, continue to next extension
      }
    }

    return null
  }

  private isNodeModule(importPath: string): boolean {
    return !importPath.startsWith('.') && !importPath.startsWith('/')
  }

  private async getAllProjectFiles(
    patterns: Array<string>,
    excludePatterns: Array<string> = []
  ): Promise<Array<string>> {
    const glob = await import('glob')
    const files: Array<string> = []

    // 기본 제외 패턴에 사용자 제외 패턴 추가
    const defaultIgnore = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**']
    const allIgnorePatterns = [...defaultIgnore, ...excludePatterns]

    for (const pattern of patterns) {
      try {
        const matches = await glob.glob(pattern, {
          cwd: this.projectRoot,
          ignore: allIgnorePatterns,
        })
        for (const match of matches) {
          files.push(match)
        }
      } catch {
        console.warn(`Failed to glob pattern ${pattern}`)
      }
    }

    return Array.from(new Set(files)) // 중복 제거
  }

  clearCache(): void {
    this.parseCache.clear()
  }

  // ========================================
  // ANALYSIS METHODS FOR ENHANCED COMMANDS
  // ========================================

  /**
   * 특정 파일을 import하는 모든 파일들을 찾습니다
   */
  async findFilesUsingTargetFromGraph(graph: ProjectDependencyGraph, targetFilePath: string): Promise<Array<string>> {
    const resolvedTargetPath = path.resolve(this.projectRoot, targetFilePath)

    return graph.edges
      .filter((edge) => edge.to === resolvedTargetPath)
      .map((edge) => edge.from)
      .filter((file, index, arr) => arr.indexOf(file) === index) // 중복 제거
  }

  /**
   * 특정 메서드를 사용하는 모든 파일들을 찾습니다
   */
  async findFilesUsingMethodFromGraph(
    graph: ProjectDependencyGraph,
    className: string | null,
    methodName: string
  ): Promise<Array<any>> {
    const results: Array<any> = []

    // 모든 파일에서 해당 메서드 사용을 찾음
    for (const filePath of Array.from(graph.nodes)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const references = this.findMethodReferences(content, className, methodName, filePath)

        if (references.length > 0) {
          results.push({
            filePath,
            references,
          })
        }
      } catch {
        // File doesn't exist, continue to next extension
      }
    }

    return results
  }

  /**
   * 어디서도 import되지 않는 파일들을 찾습니다
   */
  findUnusedFilesFromGraph(graph: ProjectDependencyGraph): Array<string> {
    const importedFiles = new Set<string>()

    // 모든 edges에서 import되는 파일들을 수집
    graph.edges.forEach((edge) => {
      importedFiles.add(edge.to)
    })

    // 엔트리 포인트들을 사용되는 파일로 간주
    graph.entryPoints.forEach((entry) => {
      importedFiles.add(entry)
    })

    // 모든 파일 중에서 import되지 않는 파일들 찾기
    return Array.from(graph.nodes).filter((file) => !importedFiles.has(file))
  }

  /**
   * 어디서도 호출되지 않는 메서드들을 찾습니다
   */
  findUnusedMethodsFromGraph(graph: ProjectDependencyGraph): Array<any> {
    const unusedMethods: Array<any> = []

    // 간단한 구현: export된 메서드들 중 import되지 않는 것들
    for (const [filePath, exportResult] of Array.from(graph.exportMap)) {
      if (exportResult.exportMethods) {
        exportResult.exportMethods.forEach((exp: any) => {
          if (exp.type === 'class_method' || exp.type === 'function') {
            // 해당 export가 다른 파일에서 import되는지 확인
            const isImported = graph.edges.some(
              (edge) => edge.to === filePath && edge.importedMembers.includes(exp.name)
            )

            if (!isImported) {
              unusedMethods.push({
                className: exp.className || 'standalone',
                methodName: exp.name,
                type: exp.type,
                filePath,
                line: exp.line || 0,
                visibility: exp.visibility || 'public',
              })
            }
          }
        })
      }
    }

    return unusedMethods
  }

  /**
   * 메서드 참조를 찾는 헬퍼 메서드
   */
  private findMethodReferences(
    content: string,
    className: string | null,
    methodName: string,
    _filePath: string
  ): Array<any> {
    const references: Array<any> = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      let found = false

      if (className) {
        // 클래스 메서드 호출 패턴
        const patterns = [
          new RegExp(`\\b${className}\\.${methodName}\\s*\\(`, 'g'),
          new RegExp(`\\.${methodName}\\s*\\(`, 'g'), // 인스턴스 메서드 호출
        ]

        patterns.forEach((pattern) => {
          if (pattern.test(line)) {
            found = true
          }
        })
      } else {
        // 독립 함수 호출 패턴
        const pattern = new RegExp(`\\b${methodName}\\s*\\(`, 'g')
        if (pattern.test(line)) {
          found = true
        }
      }

      if (found) {
        references.push({
          line: index + 1,
          context: line.trim(),
        })
      }
    })

    return references
  }
}
