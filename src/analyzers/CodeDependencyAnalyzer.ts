/**
 * 코드 파일의 의존성을 분석하여 내부/외부 모듈을 구분하는 분석기
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import type { CodeDependency } from '../types/DependencyClassification.js'

export interface CodeAnalysisResult {
  internalModules: CodeDependency[]    // 프로젝트 내부 모듈
  externalLibraries: CodeDependency[]  // 외부 라이브러리
  builtinModules: CodeDependency[]     // Node.js 내장 모듈
  codeMetadata: {
    language: string                   // typescript, javascript 등
    framework?: string                 // react, vue, angular 등
    complexity: number                 // 복잡도 점수
    linesOfCode: number
    exportCount: number
    importCount: number
    circularDependencies: string[]
  }
}

export class CodeDependencyAnalyzer {
  private builtinModules = new Set([
    'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'events',
    'stream', 'buffer', 'child_process', 'cluster', 'dgram', 'dns', 'net',
    'readline', 'repl', 'tls', 'tty', 'vm', 'zlib', 'assert', 'querystring',
    'punycode', 'string_decoder', 'timers', 'console', 'process', 'global'
  ])

  private frameworkPatterns = {
    react: ['react', '@types/react', 'react-dom'],
    vue: ['vue', '@vue', 'nuxt'],
    angular: ['@angular', 'rxjs'],
    svelte: ['svelte', '@sveltejs'],
    express: ['express', '@types/express'],
    nestjs: ['@nestjs'],
    next: ['next', '@next'],
    gatsby: ['gatsby', '@gatsby']
  }

  constructor(private projectRoot: string) {
    // tsconfig.json에서 alias 정보 로드
    this.loadTsConfigAliases()
  }

  private tsConfigAliases = new Map<string, string>()

  async analyzeCodeFile(filePath: string): Promise<CodeAnalysisResult> {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const dependencies = await this.extractDependencies(content, filePath)

    // 중복 처리 방지를 위한 Set 사용
    const processedSources = new Set<string>()

    return {
      internalModules: this.classifyInternalModules(dependencies, filePath, processedSources),
      externalLibraries: this.classifyExternalLibraries(dependencies, filePath, processedSources),
      builtinModules: this.classifyBuiltinModules(dependencies, filePath, processedSources),
      codeMetadata: this.analyzeCodeMetadata(content, filePath, dependencies)
    }
  }

  private async extractDependencies(content: string, filePath: string): Promise<any[]> {
    const dependencies: any[] = []

    // ES6 Import 문 파싱
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1]
      const importMatch = content.substring(0, match.index).match(/import\s+(.+?)\s+from/)
      const importedMembers = importMatch ? this.parseImportMembers(importMatch[1]) : []

      dependencies.push({
        source,
        line: this.getLineNumber(content, match.index),
        importType: 'import',
        importedMembers,
        isTypeOnly: this.isTypeOnlyImport(match[0])
      })
    }

    // CommonJS require 문 파싱
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push({
        source: match[1],
        line: this.getLineNumber(content, match.index),
        importType: 'require',
        importedMembers: [],
        isTypeOnly: false
      })
    }

    // Dynamic import 파싱
    const dynamicImportRegex = /import\(['"`]([^'"`]+)['"`]\)/g
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dependencies.push({
        source: match[1],
        line: this.getLineNumber(content, match.index),
        importType: 'dynamic',
        importedMembers: [],
        isTypeOnly: false
      })
    }

    // TypeScript type import 파싱
    const typeImportRegex = /import\s+type\s+(?:\{[^}]*\}|\w+)\s+from\s+['"`]([^'"`]+)['"`]/g
    while ((match = typeImportRegex.exec(content)) !== null) {
      dependencies.push({
        source: match[1],
        line: this.getLineNumber(content, match.index),
        importType: 'import',
        importedMembers: [],
        isTypeOnly: true
      })
    }

    return dependencies
  }

  private classifyInternalModules(dependencies: any[], filePath: string, processedSources: Set<string>): CodeDependency[] {
    const internalModules: CodeDependency[] = []

    for (const dep of dependencies) {
      if (!processedSources.has(dep.source) && this.isInternalModule(dep.source, filePath)) {
        processedSources.add(dep.source) // 처리됨으로 표시
        const resolvedPath = this.resolveInternalPath(dep.source, filePath)

        internalModules.push({
          source: dep.source,
          resolvedPath,
          exists: this.checkFileExists(resolvedPath),
          line: dep.line,
          confidence: this.calculateInternalConfidence(dep, resolvedPath),
          type: 'internal-module',
          importType: dep.importType,
          isTypeOnly: dep.isTypeOnly,
          exportedMembers: dep.importedMembers,
          usage: this.inferUsageType(dep, filePath)
        })
      }
    }

    return internalModules
  }

  private classifyExternalLibraries(dependencies: any[], filePath: string, processedSources: Set<string>): CodeDependency[] {
    const externalLibraries: CodeDependency[] = []

    for (const dep of dependencies) {
      if (!processedSources.has(dep.source) && this.isExternalLibrary(dep.source)) {
        processedSources.add(dep.source) // 처리됨으로 표시
        const packageInfo = this.getPackageInfo(dep.source)

        externalLibraries.push({
          source: dep.source,
          resolvedPath: null, // 외부 패키지는 해결된 경로가 없음
          exists: true, // package.json에 있다고 가정
          line: dep.line,
          confidence: 0.9,
          type: 'external-library',
          importType: dep.importType,
          isTypeOnly: dep.isTypeOnly,
          exportedMembers: dep.importedMembers,
          packageVersion: packageInfo?.version,
          usage: this.inferUsageType(dep, filePath)
        })
      }
    }

    return externalLibraries
  }

  private classifyBuiltinModules(dependencies: any[], filePath: string, processedSources: Set<string>): CodeDependency[] {
    const builtinModules: CodeDependency[] = []

    for (const dep of dependencies) {
      if (!processedSources.has(dep.source) && this.isBuiltinModule(dep.source)) {
        processedSources.add(dep.source) // 처리됨으로 표시
        builtinModules.push({
          source: dep.source,
          resolvedPath: null, // 내장 모듈은 해결된 경로가 없음
          exists: true,
          line: dep.line,
          confidence: 1.0,
          type: 'builtin-module',
          importType: dep.importType,
          isTypeOnly: dep.isTypeOnly,
          exportedMembers: dep.importedMembers,
          usage: 'runtime'
        })
      }
    }

    return builtinModules
  }

  private analyzeCodeMetadata(content: string, filePath: string, dependencies: any[]) {
    return {
      language: this.detectLanguage(filePath),
      framework: this.detectFramework(dependencies),
      complexity: this.calculateComplexity(content),
      linesOfCode: this.countLines(content),
      exportCount: this.countExports(content),
      importCount: dependencies.length,
      circularDependencies: this.detectCircularDependencies(filePath, dependencies)
    }
  }

  private isInternalModule(source: string, currentFile: string): boolean {
    // 상대 경로이거나 프로젝트 루트 기준 절대 경로
    return source.startsWith('./') ||
           source.startsWith('../') ||
           (source.startsWith('/') && !this.isExternalLibrary(source)) ||
           source.startsWith('@/') || // 일반적인 alias
           this.isProjectAlias(source)
  }

  private isExternalLibrary(source: string): boolean {
    // node_modules 패키지이거나 스코프 패키지
    return !source.startsWith('./') &&
           !source.startsWith('../') &&
           !source.startsWith('/') &&
           !this.builtinModules.has(source.split('/')[0]) &&
           !source.startsWith('node:')
  }

  private isBuiltinModule(source: string): boolean {
    const moduleName = source.startsWith('node:') ? source.substring(5) : source
    return this.builtinModules.has(moduleName) || source.startsWith('node:')
  }

  private isProjectAlias(source: string): boolean {
    // tsconfig.json에서 로드된 alias 확인
    for (const alias of this.tsConfigAliases.keys()) {
      if (source.startsWith(alias)) {
        return true
      }
    }

    // 일반적인 alias 패턴도 확인 (fallback)
    const commonAliases = ['@/', '~/', '@components/', '@utils/', '@types/']
    return commonAliases.some(alias => source.startsWith(alias))
  }

  private loadTsConfigAliases(): void {
    try {
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json')
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'))

        if (tsconfig.compilerOptions?.paths) {
          for (const [alias, paths] of Object.entries(tsconfig.compilerOptions.paths)) {
            const cleanAlias = alias.replace('/*', '/')
            const targetPath = (paths as string[])[0]?.replace('/*', '')
            if (targetPath) {
              this.tsConfigAliases.set(cleanAlias, targetPath)
            }
          }
        }
      }

      // 기본 alias 추가 (fallback)
      if (this.tsConfigAliases.size === 0) {
        this.tsConfigAliases.set('@/', 'src/')
      }
    } catch (error) {
      // 에러 발생 시 기본 alias만 사용
      this.tsConfigAliases.set('@/', 'src/')
    }
  }

  private resolveInternalPath(source: string, currentFile: string): string | null {
    try {
      const currentDir = path.dirname(currentFile)

      // 상대 경로 해결
      if (source.startsWith('./') || source.startsWith('../')) {
        const resolved = path.resolve(currentDir, source)

        // 파일 확장자가 없으면 추가해서 시도
        if (!path.extname(resolved)) {
          const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json']
          for (const ext of extensions) {
            if (fs.existsSync(resolved + ext)) {
              return resolved + ext
            }
          }
          // index 파일 시도
          for (const ext of extensions) {
            const indexPath = path.join(resolved, 'index' + ext)
            if (fs.existsSync(indexPath)) {
              return indexPath
            }
          }
        }

        return resolved
      }

      // 프로젝트 alias 해결 (동적 감지)
      for (const [alias, targetPath] of this.tsConfigAliases.entries()) {
        if (source.startsWith(alias)) {
          const remainingPath = source.substring(alias.length)
          const resolved = path.resolve(this.projectRoot, targetPath, remainingPath)
          return this.resolveWithExtensions(resolved)
        }
      }

      return null
    } catch {
      return null
    }
  }

  private resolveWithExtensions(basePath: string): string | null {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json']

    // 직접 파일 시도
    if (fs.existsSync(basePath)) return basePath

    // 확장자 추가해서 시도
    for (const ext of extensions) {
      if (fs.existsSync(basePath + ext)) {
        return basePath + ext
      }
    }

    // index 파일 시도
    for (const ext of extensions) {
      const indexPath = path.join(basePath, 'index' + ext)
      if (fs.existsSync(indexPath)) {
        return indexPath
      }
    }

    return null
  }

  private getPackageInfo(source: string): { version?: string } | null {
    try {
      // package.json에서 버전 정보 추출
      const packageJsonPath = path.join(this.projectRoot, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        }

        const packageName = source.split('/')[0]
        if (allDeps[packageName]) {
          return { version: allDeps[packageName] }
        }
      }
      return null
    } catch {
      return null
    }
  }

  private calculateInternalConfidence(dep: any, resolvedPath: string | null): number {
    let confidence = 0.5

    if (resolvedPath && this.checkFileExists(resolvedPath)) confidence += 0.4
    if (dep.source.startsWith('./') || dep.source.startsWith('../')) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private inferUsageType(dep: any, filePath: string): 'runtime' | 'devtime' | 'buildtime' {
    // 파일 위치와 import 타입으로 사용 유형 추론
    if (filePath.includes('.test.') || filePath.includes('.spec.')) return 'devtime'
    if (dep.isTypeOnly) return 'buildtime'
    if (dep.importType === 'dynamic') return 'runtime'

    // 개발 도구 패키지들
    const devPackages = ['@types/', 'eslint', 'prettier', 'webpack', 'rollup', 'vite']
    if (devPackages.some(pkg => dep.source.includes(pkg))) return 'devtime'

    return 'runtime'
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath)
    switch (ext) {
      case '.ts': return 'typescript'
      case '.tsx': return 'typescript-jsx'
      case '.js': return 'javascript'
      case '.jsx': return 'javascript-jsx'
      case '.vue': return 'vue'
      case '.svelte': return 'svelte'
      default: return 'unknown'
    }
  }

  private detectFramework(dependencies: any[]): string | undefined {
    for (const [framework, patterns] of Object.entries(this.frameworkPatterns)) {
      if (dependencies.some(dep => patterns.some(pattern => dep.source.includes(pattern)))) {
        return framework
      }
    }
    return undefined
  }

  private calculateComplexity(content: string): number {
    // 간단한 복잡도 계산 (McCabe 복잡도 기반)
    let complexity = 1 // 기본 복잡도

    // 분기문 카운트
    const branchPatterns = [
      /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\btry\b/g,
      /\?\s*[^:]*:/g // 삼항 연산자
    ]

    branchPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) complexity += matches.length
    })

    return complexity
  }

  private countLines(content: string): number {
    return content.split('\n').filter(line => line.trim().length > 0).length
  }

  private countExports(content: string): number {
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+/g,
      /export\s*\{[^}]*\}/g,
      /export\s*\*/g
    ]

    let count = 0
    exportPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) count += matches.length
    })

    return count
  }

  private detectCircularDependencies(filePath: string, dependencies: any[]): string[] {
    // 간단한 순환 의존성 감지 (실제로는 더 복잡한 그래프 분석 필요)
    const circular: string[] = []

    // TODO: 실제 그래프 순회 알고리즘 구현
    // 현재는 직접적인 순환만 감지
    for (const dep of dependencies) {
      if (this.isInternalModule(dep.source, filePath)) {
        const resolvedPath = this.resolveInternalPath(dep.source, filePath)
        if (resolvedPath && this.checkFileExists(resolvedPath)) {
          // 해당 파일이 현재 파일을 import하는지 확인
          try {
            const targetContent = fs.readFileSync(resolvedPath, 'utf-8')
            const relativePath = path.relative(path.dirname(resolvedPath), filePath)
            if (targetContent.includes(relativePath)) {
              circular.push(resolvedPath)
            }
          } catch {
            // 파일 읽기 실패시 무시
          }
        }
      }
    }

    return circular
  }

  private parseImportMembers(importClause: string): string[] {
    const members: string[] = []

    // 중괄호 내부의 멤버들 추출
    const braceMatch = importClause.match(/\{([^}]*)\}/)
    if (braceMatch) {
      const memberList = braceMatch[1]
        .split(',')
        .map(member => member.trim())
        .filter(member => member.length > 0)
      members.push(...memberList)
    }

    // default import
    const defaultMatch = importClause.match(/^\s*(\w+)/)
    if (defaultMatch && !braceMatch) {
      members.push(defaultMatch[1])
    }

    return members
  }

  private isTypeOnlyImport(importStatement: string): boolean {
    return importStatement.includes('import type') || importStatement.includes('typeof')
  }

  private checkFileExists(filePath: string | null): boolean {
    if (!filePath) return false
    try {
      return fs.existsSync(filePath)
    } catch {
      return false
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }
}

// 코드 의존성 시각화를 위한 유틸리티
export class CodeDependencyVisualizer {
  static generateDependencyGraph(codeResults: Map<string, CodeAnalysisResult>): any {
    const graph = {
      nodes: [] as any[],
      edges: [] as any[]
    }

    for (const [codeFile, result] of codeResults.entries()) {
      // 코드 파일 노드
      graph.nodes.push({
        id: codeFile,
        type: 'code',
        label: path.basename(codeFile),
        metadata: result.codeMetadata
      })

      // 내부 모듈 연결
      result.internalModules.forEach(dep => {
        if (dep.resolvedPath && dep.exists) {
          graph.nodes.push({
            id: dep.resolvedPath,
            type: 'code',
            label: path.basename(dep.resolvedPath)
          })

          graph.edges.push({
            from: codeFile,
            to: dep.resolvedPath,
            type: 'internal-dependency',
            confidence: dep.confidence,
            usage: dep.usage
          })
        }
      })

      // 외부 라이브러리 연결
      result.externalLibraries.forEach(dep => {
        graph.nodes.push({
          id: dep.source,
          type: 'library',
          label: dep.source,
          version: dep.packageVersion
        })

        graph.edges.push({
          from: codeFile,
          to: dep.source,
          type: 'external-dependency',
          confidence: dep.confidence,
          usage: dep.usage
        })
      })
    }

    return graph
  }

  static generateArchitectureReport(codeResults: Map<string, CodeAnalysisResult>): any {
    const report = {
      totalFiles: codeResults.size,
      internalDependencies: 0,
      externalDependencies: 0,
      circularDependencies: [] as string[][],
      heaviestFiles: [] as Array<{ file: string; dependencies: number }>,
      frameworkUsage: {} as Record<string, number>
    }

    const fileDependencyCounts: Array<{ file: string; dependencies: number }> = []

    for (const [codeFile, result] of codeResults.entries()) {
      report.internalDependencies += result.internalModules.length
      report.externalDependencies += result.externalLibraries.length

      // 순환 의존성 수집
      if (result.codeMetadata.circularDependencies.length > 0) {
        result.codeMetadata.circularDependencies.forEach(circular => {
          report.circularDependencies.push([codeFile, circular])
        })
      }

      // 파일별 의존성 수 수집
      fileDependencyCounts.push({
        file: codeFile,
        dependencies: result.internalModules.length + result.externalLibraries.length + result.builtinModules.length
      })

      // 프레임워크 사용량 집계
      if (result.codeMetadata.framework) {
        report.frameworkUsage[result.codeMetadata.framework] =
          (report.frameworkUsage[result.codeMetadata.framework] || 0) + 1
      }
    }

    // 의존성이 많은 파일 상위 10개
    report.heaviestFiles = fileDependencyCounts
      .sort((a, b) => b.dependencies - a.dependencies)
      .slice(0, 10)

    return report
  }
}