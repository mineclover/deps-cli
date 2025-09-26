import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'
import {
  FileUsage,
  MethodUsage,
  UnusedFile,
  UnusedMethod,
  DependencyTrackingResult,
  DependencyTrackerConfig,
  FileReference,
  ExportReference,
  MethodReference
} from '../types/DependencyTrackerTypes.js'
import { UnifiedDependencyAnalyzer } from './UnifiedDependencyAnalyzer.js'
import { EnhancedExportExtractor, TypeScriptParser } from '@context-action/dependency-linker'
import { EnhancedDependencyAnalyzer, type ProjectDependencyGraph } from './EnhancedDependencyAnalyzer'

export class DependencyTracker {
  private config: DependencyTrackerConfig
  private exportExtractor: EnhancedExportExtractor
  private parser: TypeScriptParser
  private unifiedAnalyzer: UnifiedDependencyAnalyzer
  private parseCache = new Map<string, any>() // AST 파싱 결과 캐싱
  private enhancedAnalyzer: EnhancedDependencyAnalyzer

  constructor(
    private projectRoot: string,
    config: Partial<DependencyTrackerConfig> = {}
  ) {
    this.config = {
      includeNodeModules: false,
      includeTestFiles: true,
      fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      methodAnalysisDepth: 5,
      ...config
    }

    this.exportExtractor = new EnhancedExportExtractor()
    this.parser = new TypeScriptParser()
    this.unifiedAnalyzer = new UnifiedDependencyAnalyzer(projectRoot, { includeMethodFlow: true })
    this.enhancedAnalyzer = new EnhancedDependencyAnalyzer(projectRoot)
  }

  /**
   * AST 파싱 결과를 캐싱하여 재사용
   */
  private async parseWithCache(filePath: string, content?: string): Promise<any> {
    const cacheKey = filePath

    if (this.parseCache.has(cacheKey)) {
      return this.parseCache.get(cacheKey)
    }

    const parseResult = await this.parser.parse(filePath, content)
    this.parseCache.set(cacheKey, parseResult)

    return parseResult
  }

  /**
   * 캐시 정리
   */
  private clearCache(): void {
    this.parseCache.clear()
  }

  /**
   * EnhancedExportExtractor 기반 의존성 그래프 구축 및 분석
   */
  async analyzeWithEnhancedDependencyGraph(): Promise<ProjectDependencyGraph> {
    this.clearCache()

    console.log('🔄 Building enhanced dependency graph...')
    const graph = await this.enhancedAnalyzer.buildProjectDependencyGraph()

    this.clearCache()
    return graph
  }

  /**
   * 시나리오 1: A 파일을 사용하는 모든 파일들 찾기 (edges 기반)
   */
  findFilesUsingTargetFromGraph(graph: ProjectDependencyGraph, targetFilePath: string): string[] {
    const absoluteTargetPath = path.resolve(this.projectRoot, targetFilePath)

    const usingFiles = graph.edges
      .filter(edge => edge.to === absoluteTargetPath)
      .map(edge => edge.from)

    return [...new Set(usingFiles)] // 중복 제거
  }

  /**
   * 시나리오 2: A 메서드를 사용하는 모든 파일들 찾기 (edges 기반)
   */
  findFilesUsingMethodFromGraph(
    graph: ProjectDependencyGraph,
    className: string | null,
    methodName: string
  ): Array<{ filePath: string, line: number, importedMembers: string[] }> {

    const results: Array<{ filePath: string, line: number, importedMembers: string[] }> = []

    for (const edge of graph.edges) {
      // 클래스명이나 메서드명이 importedMembers에 포함되는지 확인
      const hasRelevantImport = edge.importedMembers.some(member =>
        member === methodName ||
        (className && member === className)
      )

      if (hasRelevantImport) {
        results.push({
          filePath: edge.from,
          line: edge.line,
          importedMembers: edge.importedMembers
        })
      }
    }

    return results
  }

  /**
   * 시나리오 3: 어디서도 사용되지 않는 파일들 찾기 (edges 기반)
   */
  findUnusedFilesFromGraph(graph: ProjectDependencyGraph): string[] {
    // 모든 엣지에서 사용되는(to) 파일들 수집
    const usedFiles = new Set(graph.edges.map(edge => edge.to))

    // 엔트리 포인트들도 "사용됨"으로 간주
    graph.entryPoints.forEach(entry => usedFiles.add(entry))

    // 사용되지 않는 파일들 = 전체 - 사용된 파일들 - 엔트리 포인트들
    const unusedFiles = Array.from(graph.nodes).filter(file =>
      !usedFiles.has(file) && !graph.entryPoints.includes(file)
    )

    return unusedFiles
  }

  /**
   * 의존성 그래프 기반 미사용 메서드 찾기
   */
  findUnusedMethodsFromGraph(graph: ProjectDependencyGraph): Array<{
    methodName: string
    className: string | null
    filePath: string
    exportType: string
  }> {
    const usedMethods = new Set<string>()

    // 모든 의존성 엣지에서 사용된 멤버들 수집
    for (const edge of graph.edges) {
      for (const member of edge.importedMembers) {
        const key = `${edge.to}:${member}`
        usedMethods.add(key)
      }
    }

    // 사용되지 않는 메서드들 찾기
    const unusedMethods: Array<{
      methodName: string
      className: string | null
      filePath: string
      exportType: string
    }> = []

    for (const [filePath, exportResult] of graph.exportMap) {
      for (const exportMethod of exportResult.exportMethods || []) {
        const key = `${filePath}:${exportMethod.name}`

        if (!usedMethods.has(key) && exportMethod.exportType !== 'type') {
          unusedMethods.push({
            methodName: exportMethod.name,
            className: exportMethod.parentClass || null,
            filePath,
            exportType: exportMethod.exportType
          })
        }
      }
    }

    return unusedMethods
  }

  /**
   * 1. A 파일을 사용하는 모든 파일들 찾기
   */
  async findFileUsages(targetFilePath: string): Promise<DependencyTrackingResult> {
    const startTime = Date.now()
    const absoluteTargetPath = path.resolve(this.projectRoot, targetFilePath)

    // 프로젝트 내 모든 파일 스캔
    const allFiles = await this.getAllProjectFiles()
    const fileUsages: FileUsage[] = []
    const warnings: string[] = []

    // 타겟 파일의 exports 분석
    let targetExports: string[] = []
    try {
      const content = await fs.readFile(absoluteTargetPath, 'utf-8')
      const parseResult = await this.parser.parse(absoluteTargetPath, content)
      if (parseResult.ast) {
        const targetAnalysis = this.exportExtractor.extractExports(parseResult.ast, absoluteTargetPath)
        targetExports = targetAnalysis.exportMethods?.map(method => method.name) || []
      }
    } catch (error) {
      warnings.push(`Failed to analyze target file exports: ${error}`)
    }

    // 각 파일에서 타겟 파일 import 여부 확인
    for (const filePath of allFiles) {
      if (filePath === absoluteTargetPath) continue

      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const references = await this.findImportReferences(content, absoluteTargetPath, filePath)

        if (references.length > 0) {
          fileUsages.push({
            filePath: absoluteTargetPath,
            importedBy: references,
            exports: targetExports.map(name => ({
              name,
              type: 'unknown' as any,
              isUsed: true,
              usedBy: []
            })),
            isUsed: true
          })
        }
      } catch (error) {
        warnings.push(`Failed to analyze file ${filePath}: ${error}`)
      }
    }

    return {
      projectRoot: this.projectRoot,
      timestamp: new Date(),
      analysisType: 'file-usage',
      results: fileUsages,
      metadata: {
        totalFiles: allFiles.length,
        analysisTime: Date.now() - startTime,
        warnings
      }
    }
  }

  /**
   * 2. A 메서드를 사용하는 모든 파일들 찾기
   */
  async findMethodUsages(className: string, methodName: string): Promise<DependencyTrackingResult> {
    const startTime = Date.now()
    const allFiles = await this.getAllProjectFiles()
    const methodUsages: MethodUsage[] = []
    const warnings: string[] = []

    // 타겟 메서드가 정의된 파일 찾기
    let targetFilePath = ''
    let methodInfo: any = null

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const parseResult = await this.parseWithCache(filePath, content)
        if (parseResult.ast) {
          const analysis = this.exportExtractor.extractExports(parseResult.ast, filePath)
          const targetClass = analysis.classes?.find(cls => cls.className === className)

          if (targetClass) {
            const targetMethod = targetClass.methods?.find(method => method.name === methodName)
            if (targetMethod) {
              targetFilePath = filePath
              methodInfo = targetMethod
              break
            }
          }
        }
      } catch (error) {
        warnings.push(`Failed to analyze file ${filePath}: ${error}`)
      }
    }

    if (!targetFilePath) {
      warnings.push(`Method ${className}.${methodName} not found in project`)
      return {
        projectRoot: this.projectRoot,
        timestamp: new Date(),
        analysisType: 'method-usage',
        results: [],
        metadata: {
          totalFiles: allFiles.length,
          analysisTime: Date.now() - startTime,
          warnings
        }
      }
    }

    // 모든 파일에서 메서드 사용 찾기
    const usedBy: MethodReference[] = []

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const references = await this.findMethodReferences(content, className, methodName, filePath)
        usedBy.push(...references)
      } catch (error) {
        warnings.push(`Failed to analyze file ${filePath}: ${error}`)
      }
    }

    methodUsages.push({
      methodSignature: `${className}.${methodName}`,
      className,
      filePath: targetFilePath,
      isUsed: usedBy.length > 0,
      usedBy,
      visibility: methodInfo?.visibility || 'public',
      isStatic: methodInfo?.isStatic || false,
      isAsync: methodInfo?.isAsync || false
    })

    return {
      projectRoot: this.projectRoot,
      timestamp: new Date(),
      analysisType: 'method-usage',
      results: methodUsages,
      metadata: {
        totalFiles: allFiles.length,
        totalMethods: 1,
        analysisTime: Date.now() - startTime,
        warnings
      }
    }
  }

  /**
   * 3. 어디서도 사용되지 않는 파일들 찾기
   */
  async findUnusedFiles(): Promise<DependencyTrackingResult> {
    const startTime = Date.now()
    const allFiles = await this.getAllProjectFiles()
    const unusedFiles: UnusedFile[] = []
    const warnings: string[] = []

    // 모든 파일의 import 관계 분석
    const importMap = new Map<string, Set<string>>()

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const imports = await this.extractImportPaths(content, filePath)
        importMap.set(filePath, new Set(imports))
      } catch (error) {
        warnings.push(`Failed to analyze imports in ${filePath}: ${error}`)
      }
    }

    // 사용된 파일들을 찾기 위해 의존성 그래프 구축
    const usedFiles = new Set<string>()

    // 엔트리 포인트들 정의 (더 포괄적으로)
    const entryPoints = this.findEntryPoints(allFiles)
    warnings.push(`Found ${entryPoints.length} entry points: ${entryPoints.map(f => path.relative(this.projectRoot, f)).join(', ')}`)

    // 엔트리 포인트부터 시작해서 재귀적으로 의존성 추가
    const toProcess = [...entryPoints]
    const processed = new Set<string>()

    while (toProcess.length > 0) {
      const currentFile = toProcess.pop()!
      if (processed.has(currentFile)) continue

      processed.add(currentFile)
      usedFiles.add(currentFile)

      // 현재 파일이 import하는 모든 파일들을 처리 대기열에 추가
      const imports = importMap.get(currentFile) || new Set()
      warnings.push(`File ${path.relative(this.projectRoot, currentFile)} imports ${imports.size} files: ${Array.from(imports).map(f => path.relative(this.projectRoot, f)).join(', ')}`)

      for (const importedFile of imports) {
        if (!processed.has(importedFile)) {
          toProcess.push(importedFile)
        }
      }
    }

    // 사용되지 않는 파일들 식별 (단, 엔트리 포인트는 제외)
    for (const filePath of allFiles) {
      const isEntryPoint = entryPoints.includes(filePath)

      if (!usedFiles.has(filePath) && !isEntryPoint) {
        try {
          const stat = await fs.stat(filePath)
          const content = await fs.readFile(filePath, 'utf-8')
          const parseResult = await this.parseWithCache(filePath, content)
          let exports: string[] = []

          if (parseResult.ast) {
            const analysis = this.exportExtractor.extractExports(parseResult.ast, filePath)
            exports = analysis.exportMethods?.map(method => method.name) || []
          }

          // 파일 분류에 따른 더 구체적인 이유 제공
          const reason = this.categorizeUnusedFile(filePath, exports)

          unusedFiles.push({
            filePath,
            reason,
            size: stat.size,
            lastModified: stat.mtime,
            exports
          })
        } catch (error) {
          warnings.push(`Failed to analyze unused file ${filePath}: ${error}`)
        }
      }
    }

    return {
      projectRoot: this.projectRoot,
      timestamp: new Date(),
      analysisType: 'unused-files',
      results: unusedFiles,
      metadata: {
        totalFiles: allFiles.length,
        analysisTime: Date.now() - startTime,
        warnings
      }
    }
  }

  /**
   * 4. 어디서도 사용되지 않는 메서드들 찾기
   */
  async findUnusedMethods(): Promise<DependencyTrackingResult> {
    const startTime = Date.now()
    this.clearCache() // 분석 시작 시 캐시 초기화

    const allFiles = await this.getAllProjectFiles()
    const unusedMethods: UnusedMethod[] = []
    const warnings: string[] = []

    // 모든 메서드 수집
    const allMethods = new Map<string, any>()

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const parseResult = await this.parseWithCache(filePath, content)

        if (parseResult.ast) {
          const analysis = this.exportExtractor.extractExports(parseResult.ast, filePath)

          // 클래스 메서드들
          if (analysis.classes) {
            for (const cls of analysis.classes) {
              if (cls.methods) {
                for (const method of cls.methods) {
                  const key = `${cls.className}.${method.name}`
                  allMethods.set(key, {
                    ...method,
                    className: cls.className,
                    filePath,
                    key
                  })
                }
              }
            }
          }

          // 함수들
          if (analysis.exportMethods) {
            for (const method of analysis.exportMethods) {
              if (method.exportType === 'function') {
                allMethods.set(method.name, {
                  ...method,
                  filePath,
                  key: method.name
                })
              }
            }
          }
        }
      } catch (error) {
        warnings.push(`Failed to analyze methods in ${filePath}: ${error}`)
      }
    }

    // 사용된 메서드들 찾기
    const usedMethods = new Set<string>()

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')

        for (const [methodKey, methodInfo] of allMethods) {
          const isUsed = await this.isMethodUsedInFile(content, methodInfo)
          if (isUsed) {
            usedMethods.add(methodKey)
          }
        }
      } catch (error) {
        warnings.push(`Failed to check method usage in ${filePath}: ${error}`)
      }
    }

    // 사용되지 않는 메서드들 식별
    for (const [methodKey, methodInfo] of allMethods) {
      if (!usedMethods.has(methodKey) && methodInfo.visibility === 'public') {
        unusedMethods.push({
          methodName: methodInfo.name,
          className: methodInfo.className,
          filePath: methodInfo.filePath,
          line: methodInfo.location?.line || 0,
          visibility: methodInfo.visibility || 'public',
          isStatic: methodInfo.isStatic || false,
          reason: 'No usages found',
          potentialImpact: methodInfo.visibility === 'public' ? 'high' : 'low'
        })
      }
    }

    this.clearCache() // 분석 완료 후 캐시 정리

    return {
      projectRoot: this.projectRoot,
      timestamp: new Date(),
      analysisType: 'unused-methods',
      results: unusedMethods,
      metadata: {
        totalFiles: allFiles.length,
        totalMethods: allMethods.size,
        analysisTime: Date.now() - startTime,
        warnings
      }
    }
  }

  // Helper methods
  private async getAllProjectFiles(): Promise<string[]> {
    const patterns = this.config.fileExtensions.map(ext => `**/*.${ext}`)
    const files: string[] = []

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        ignore: this.config.excludePatterns
      })
      files.push(...matches)
    }

    return [...new Set(files)]
  }

  private async findImportReferences(content: string, targetPath: string, currentFilePath: string): Promise<FileReference[]> {
    const references: FileReference[] = []
    const lines = content.split('\n')
    const relativePath = path.relative(path.dirname(currentFilePath), targetPath)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // import 문 매칭
      const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g

      let match
      while ((match = importRegex.exec(line)) !== null) {
        if (this.isPathMatch(match[1], relativePath)) {
          references.push({
            filePath: currentFilePath,
            line: i + 1,
            importType: 'import',
            importedMembers: this.extractImportedMembers(line),
            importStatement: line.trim()
          })
        }
      }

      while ((match = requireRegex.exec(line)) !== null) {
        if (this.isPathMatch(match[1], relativePath)) {
          references.push({
            filePath: currentFilePath,
            line: i + 1,
            importType: 'require',
            importedMembers: [],
            importStatement: line.trim()
          })
        }
      }
    }

    return references
  }

  private async findMethodReferences(content: string, className: string, methodName: string, filePath: string): Promise<MethodReference[]> {
    // 현재는 AST 로직이 구현되지 않았으므로 정규식 사용
    return this.findMethodReferencesRegex(content, className, methodName, filePath)
  }

  private findMethodCallsInAST(ast: any, className: string, methodName: string, filePath: string): MethodReference[] {
    const references: MethodReference[] = []

    // AST 순회를 통한 메서드 호출 탐지
    // 현재는 구현되지 않았으므로 빈 배열 반환
    // 이렇게 되면 자동으로 폴백(정규식) 로직으로 넘어감

    return references
  }

  private findMethodReferencesRegex(content: string, className: string, methodName: string, filePath: string): MethodReference[] {
    const references: MethodReference[] = []
    const lines = content.split('\n')
    const processedLines = new Set<number>() // 라인별 중복 방지

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 이미 처리된 라인은 스킵
      if (processedLines.has(i + 1)) {
        continue
      }

      // 메서드 호출이 있는지 확인 (우선순위별로)
      const patterns = [
        new RegExp(`${className}\\.${methodName}\\s*\\(`, 'g'), // 정적 메서드 호출
        new RegExp(`\\w+\\.${methodName}\\s*\\(`, 'g'), // 인스턴스 메서드 호출
        new RegExp(`\\.${methodName}\\s*\\(`, 'g') // 체이닝된 메서드 호출
      ]

      let foundMatch = false
      for (const pattern of patterns) {
        const match = pattern.exec(line)
        if (match) {
          processedLines.add(i + 1)
          references.push({
            filePath,
            line: i + 1,
            column: match.index,
            callType: 'method-call',
            context: line.trim()
          })
          foundMatch = true
          break // 첫 번째 패턴 매치만 사용
        }
      }
    }

    return references
  }

  private async extractImportPaths(content: string, currentFilePath: string): Promise<string[]> {
    // 현재는 AST 로직이 구현되지 않았으므로 정규식 사용 (하지만 개선된 경로 매칭 로직 포함)
    return this.extractImportPathsRegex(content, currentFilePath)
  }

  private extractImportsFromAST(ast: any, currentFilePath: string): string[] {
    const imports: string[] = []

    // AST를 순회하면서 import 선언을 찾음
    // 현재는 간단한 구현으로 시작
    // TODO: AST 노드 순회 로직 구현 필요

    return imports
  }

  private async extractImportPathsRegex(content: string, currentFilePath: string): Promise<string[]> {
    const imports: string[] = []
    const importRegex = /(?:import.*?from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g

    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2]
      if (importPath && !importPath.startsWith('node:') && !this.isNodeModule(importPath)) {
        const resolvedPath = await this.resolveImportPath(importPath, currentFilePath)
        if (resolvedPath) {
          imports.push(resolvedPath)
        }
      }
    }

    return imports
  }

  private async isMethodUsedInFile(content: string, methodInfo: any): Promise<boolean> {
    const methodName = methodInfo.name
    const className = methodInfo.className

    if (className) {
      // 클래스 메서드 사용 확인
      const patterns = [
        new RegExp(`${className}\\.${methodName}\\s*\\(`, 'g'),
        new RegExp(`\\w+\\.${methodName}\\s*\\(`, 'g')
      ]

      return patterns.some(pattern => pattern.test(content))
    } else {
      // 함수 사용 확인
      const pattern = new RegExp(`\\b${methodName}\\s*\\(`, 'g')
      return pattern.test(content)
    }
  }

  private isPathMatch(importPath: string, targetPath: string): boolean {
    // 정규화
    const normalized1 = path.normalize(importPath).replace(/\\/g, '/')
    const normalized2 = path.normalize(targetPath).replace(/\\/g, '/')

    // ./ prefix 처리
    const cleanImportPath = normalized1.startsWith('./') ? normalized1.slice(2) : normalized1
    const cleanTargetPath = normalized2.startsWith('./') ? normalized2.slice(2) : normalized2

    // 확장자 제거 버전
    const importWithoutExt = cleanImportPath.replace(/\.(ts|js|tsx|jsx|mjs)$/, '')
    const targetWithoutExt = cleanTargetPath.replace(/\.(ts|js|tsx|jsx|mjs)$/, '')

    // 다양한 매칭 패턴 시도
    return (
      // 정확한 매치
      cleanImportPath === cleanTargetPath ||
      // 확장자 다른 경우 (.js import -> .ts file)
      importWithoutExt === targetWithoutExt ||
      // TypeScript의 .js import를 .ts와 매칭
      (cleanImportPath.endsWith('.js') && cleanTargetPath.endsWith('.ts') &&
       cleanImportPath.replace(/\.js$/, '') === cleanTargetPath.replace(/\.ts$/, '')) ||
      // 반대의 경우도 체크
      (cleanTargetPath.endsWith('.js') && cleanImportPath.endsWith('.ts') &&
       cleanTargetPath.replace(/\.js$/, '') === cleanImportPath.replace(/\.ts$/, ''))
    )
  }

  private extractImportedMembers(importStatement: string): string[] {
    const match = importStatement.match(/import\s+\{([^}]+)\}/)
    if (match) {
      return match[1].split(',').map(member => member.trim())
    }
    return []
  }

  private isNodeModule(importPath: string): boolean {
    return !importPath.startsWith('.') && !importPath.startsWith('/')
  }

  private findEntryPoints(allFiles: string[]): string[] {
    const entryPoints: string[] = []

    for (const filePath of allFiles) {
      const basename = path.basename(filePath)
      const relativePath = path.relative(this.projectRoot, filePath)

      // CLI 엔트리 포인트들
      if (basename === 'bin.ts' || basename === 'index.ts' ||
          basename === 'main.ts' || basename === 'app.ts') {
        entryPoints.push(filePath)
      }

      // 설정 파일들 (독립적으로 실행됨)
      if (basename.endsWith('config.ts') || basename.endsWith('config.js') ||
          basename.endsWith('config.mjs') || basename.endsWith('.config.ts') ||
          basename.endsWith('.config.js') || basename.endsWith('.config.mjs')) {
        entryPoints.push(filePath)
      }

      // 테스트 파일들 (독립적으로 실행됨)
      if (this.config.includeTestFiles &&
          (basename.includes('.test.') || basename.includes('.spec.') ||
           relativePath.startsWith('test/') || relativePath.startsWith('tests/'))) {
        entryPoints.push(filePath)
      }

      // 예제/샘플 파일들 (독립적으로 실행됨)
      if (relativePath.startsWith('examples/') || relativePath.startsWith('samples/') ||
          relativePath.startsWith('demo/')) {
        entryPoints.push(filePath)
      }

      // 스크립트 파일들
      if (relativePath.startsWith('scripts/') || basename.startsWith('script')) {
        entryPoints.push(filePath)
      }
    }

    return entryPoints
  }

  private async resolveImportPath(importPath: string, currentFilePath: string): Promise<string | null> {
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(currentFilePath), importPath)

      // TypeScript의 .js import를 .ts 파일로 해석
      if (importPath.endsWith('.js')) {
        const tsVersion = resolved.replace(/\.js$/, '.ts')
        try {
          await fs.access(tsVersion)
          return tsVersion
        } catch {
          // .js 파일이 실제로 존재하는지 확인
          try {
            await fs.access(resolved)
            return resolved
          } catch {
            // 계속 진행
          }
        }
      }

      // 파일이 정확히 존재하는지 확인
      try {
        await fs.access(resolved)
        return resolved
      } catch {
        // 파일 확장자 추가 시도
        for (const ext of this.config.fileExtensions) {
          const withExt = `${resolved}.${ext}`
          try {
            await fs.access(withExt)
            return withExt
          } catch {
            continue
          }
        }

        // index 파일 시도 (디렉토리 import인 경우)
        for (const ext of this.config.fileExtensions) {
          const indexFile = path.join(resolved, `index.${ext}`)
          try {
            await fs.access(indexFile)
            return indexFile
          } catch {
            continue
          }
        }
      }
    }
    return null
  }

  private categorizeUnusedFile(filePath: string, exports: string[]): string {
    const relativePath = path.relative(this.projectRoot, filePath)
    const basename = path.basename(filePath)

    // 생성된 파일들 (빌드 결과물 등)
    if (relativePath.startsWith('coverage/') || relativePath.startsWith('dist/') ||
        basename.includes('generated') || basename.includes('build')) {
      return 'Generated file - safe to ignore'
    }

    // 독립적으로 실행되는 스크립트 파일
    if (basename.startsWith('test-') && !basename.includes('.test.') && !basename.includes('.spec.')) {
      return 'Standalone test script - not imported by other files'
    }

    // 유틸리티/라이브러리 파일
    if (relativePath.startsWith('src/utils/') || relativePath.startsWith('src/lib/')) {
      if (exports.length > 0) {
        return `Unused utility - exports ${exports.length} items but not imported`
      } else {
        return 'Unused utility - no exports found'
      }
    }

    // 타입 정의 파일
    if (relativePath.startsWith('src/types/')) {
      return 'Unused type definitions'
    }

    // 스펙/계약 파일
    if (relativePath.startsWith('specs/') || basename.includes('contract') || basename.includes('interface')) {
      return 'Specification/contract file - not directly imported'
    }

    // 기본적인 미사용 파일
    if (exports.length > 0) {
      return `No imports found - exports ${exports.length} items`
    } else {
      return 'No imports found - no exports'
    }
  }
}