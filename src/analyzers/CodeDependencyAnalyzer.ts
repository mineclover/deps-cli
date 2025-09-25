/**
 * 코드 파일의 의존성을 분석하여 내부/외부 모듈을 구분하는 분석기
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type { CodeDependency } from "../types/DependencyClassification.js"

export interface TodoComment {
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'BUG' | 'NOTE'
  content: string
  line: number
  author?: string
  date?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  category?: string
  isMultiline: boolean
  context: string // 주변 코드 컨텍스트
}

export interface TodoAnalysis {
  totalCount: number
  byType: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  items: Array<TodoComment>
  averageWordsPerTodo: number
  oldestTodo?: TodoComment
  highPriorityTodos: Array<TodoComment>
}

export interface CodeAnalysisResult {
  internalModules: Array<CodeDependency> // 프로젝트 내부 모듈
  externalLibraries: Array<CodeDependency> // 외부 라이브러리
  builtinModules: Array<CodeDependency> // Node.js 내장 모듈
  todoAnalysis: TodoAnalysis // TODO 주석 분석 결과
}

export class CodeDependencyAnalyzer {
  private builtinModules = new Set([
    "fs",
    "path",
    "os",
    "crypto",
    "http",
    "https",
    "url",
    "util",
    "events",
    "stream",
    "buffer",
    "child_process",
    "cluster",
    "dgram",
    "dns",
    "net",
    "readline",
    "repl",
    "tls",
    "tty",
    "vm",
    "zlib",
    "assert",
    "querystring",
    "punycode",
    "string_decoder",
    "timers",
    "console",
    "process",
    "global"
  ])


  constructor(private projectRoot: string) {
    // tsconfig.json에서 alias 정보 로드
    this.loadTsConfigAliases()
  }

  private tsConfigAliases = new Map<string, string>()

  async analyzeCodeFile(filePath: string): Promise<CodeAnalysisResult>
  async analyzeCodeFile(content: string, filePath: string): Promise<CodeAnalysisResult>
  async analyzeCodeFile(contentOrFilePath: string, filePath?: string): Promise<CodeAnalysisResult> {
    let content: string
    let actualFilePath: string

    if (filePath === undefined) {
      // 첫 번째 오버로드: filePath만 제공된 경우
      actualFilePath = contentOrFilePath
      content = await fs.promises.readFile(actualFilePath, "utf-8")
    } else {
      // 두 번째 오버로드: content와 filePath가 모두 제공된 경우
      content = contentOrFilePath
      actualFilePath = filePath
    }

    const dependencies = await this.extractDependencies(content, actualFilePath)

    // 중복 처리 방지를 위한 Set 사용
    const processedSources = new Set<string>()

    return {
      internalModules: this.classifyInternalModules(dependencies, actualFilePath, processedSources),
      externalLibraries: this.classifyExternalLibraries(dependencies, actualFilePath, processedSources),
      builtinModules: this.classifyBuiltinModules(dependencies, actualFilePath, processedSources),
      todoAnalysis: this.analyzeTodoComments(content, actualFilePath)
    }
  }

  private async extractDependencies(content: string, _filePath: string): Promise<Array<any>> {
    const dependencies: Array<any> = []

    // ES6 Import 문 파싱
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1]
      const importMatch = content.substring(0, match.index).match(/import\s+(.+?)\s+from/)
      const importedMembers = importMatch ? this.parseImportMembers(importMatch[1]) : []

      dependencies.push({
        source,
        line: this.getLineNumber(content, match.index),
        importType: "import",
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
        importType: "require",
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
        importType: "dynamic",
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
        importType: "import",
        importedMembers: [],
        isTypeOnly: true
      })
    }

    return dependencies
  }

  private classifyInternalModules(
    dependencies: Array<any>,
    filePath: string,
    processedSources: Set<string>
  ): Array<CodeDependency> {
    const internalModules: Array<CodeDependency> = []

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
          type: "internal-module",
          importType: dep.importType,
          isTypeOnly: dep.isTypeOnly,
          exportedMembers: dep.importedMembers,
          usage: this.inferUsageType(dep, filePath)
        })
      }
    }

    return internalModules
  }

  private classifyExternalLibraries(
    dependencies: Array<any>,
    filePath: string,
    processedSources: Set<string>
  ): Array<CodeDependency> {
    const externalLibraries: Array<CodeDependency> = []

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
          type: "external-library",
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

  private classifyBuiltinModules(
    dependencies: Array<any>,
    filePath: string,
    processedSources: Set<string>
  ): Array<CodeDependency> {
    const builtinModules: Array<CodeDependency> = []

    for (const dep of dependencies) {
      if (!processedSources.has(dep.source) && this.isBuiltinModule(dep.source)) {
        processedSources.add(dep.source) // 처리됨으로 표시
        builtinModules.push({
          source: dep.source,
          resolvedPath: null, // 내장 모듈은 해결된 경로가 없음
          exists: true,
          line: dep.line,
          confidence: 1.0,
          type: "builtin-module",
          importType: dep.importType,
          isTypeOnly: dep.isTypeOnly,
          exportedMembers: dep.importedMembers,
          usage: "runtime"
        })
      }
    }

    return builtinModules
  }


  private isInternalModule(source: string, _currentFile: string): boolean {
    // 상대 경로이거나 프로젝트 루트 기준 절대 경로
    return source.startsWith("./") ||
      source.startsWith("../") ||
      (source.startsWith("/") && !this.isExternalLibrary(source)) ||
      source.startsWith("@/") || // 일반적인 alias
      this.isProjectAlias(source)
  }

  private isExternalLibrary(source: string): boolean {
    // node_modules 패키지이거나 스코프 패키지
    return !source.startsWith("./") &&
      !source.startsWith("../") &&
      !source.startsWith("/") &&
      !this.builtinModules.has(source.split("/")[0]) &&
      !source.startsWith("node:")
  }

  private isBuiltinModule(source: string): boolean {
    const moduleName = source.startsWith("node:") ? source.substring(5) : source
    return this.builtinModules.has(moduleName) || source.startsWith("node:")
  }

  private isProjectAlias(source: string): boolean {
    // tsconfig.json에서 로드된 alias 확인
    for (const alias of this.tsConfigAliases.keys()) {
      if (source.startsWith(alias)) {
        return true
      }
    }

    // 일반적인 alias 패턴도 확인 (fallback)
    const commonAliases = ["@/", "~/", "@components/", "@utils/", "@types/"]
    return commonAliases.some((alias) => source.startsWith(alias))
  }

  private loadTsConfigAliases(): void {
    try {
      const tsconfigPath = path.join(this.projectRoot, "tsconfig.json")
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"))

        if (tsconfig.compilerOptions?.paths) {
          for (const [alias, paths] of Object.entries(tsconfig.compilerOptions.paths)) {
            const cleanAlias = alias.replace("/*", "/")
            const targetPath = (paths as Array<string>)[0]?.replace("/*", "")
            if (targetPath) {
              this.tsConfigAliases.set(cleanAlias, targetPath)
            }
          }
        }
      }

      // 기본 alias 추가 (fallback)
      if (this.tsConfigAliases.size === 0) {
        this.tsConfigAliases.set("@/", "src/")
      }
    } catch {
      // 에러 발생 시 기본 alias만 사용
      this.tsConfigAliases.set("@/", "src/")
    }
  }

  private resolveInternalPath(source: string, currentFile: string): string | null {
    try {
      const currentDir = path.dirname(currentFile)

      // 상대 경로 해결
      if (source.startsWith("./") || source.startsWith("../")) {
        const resolved = path.resolve(currentDir, source)

        // 파일 확장자가 없으면 추가해서 시도
        if (!path.extname(resolved)) {
          const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"]
          for (const ext of extensions) {
            if (fs.existsSync(resolved + ext)) {
              return resolved + ext
            }
          }
          // index 파일 시도
          for (const ext of extensions) {
            const indexPath = path.join(resolved, "index" + ext)
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
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"]

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
      const indexPath = path.join(basePath, "index" + ext)
      if (fs.existsSync(indexPath)) {
        return indexPath
      }
    }

    return null
  }

  private getPackageInfo(source: string): { version?: string } | null {
    try {
      // package.json에서 버전 정보 추출
      const packageJsonPath = path.join(this.projectRoot, "package.json")
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        }

        const packageName = source.split("/")[0]
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
    if (dep.source.startsWith("./") || dep.source.startsWith("../")) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private inferUsageType(dep: any, filePath: string): "runtime" | "devtime" | "buildtime" {
    // 파일 위치와 import 타입으로 사용 유형 추론
    if (filePath.includes(".test.") || filePath.includes(".spec.")) return "devtime"
    if (dep.isTypeOnly) return "buildtime"
    if (dep.importType === "dynamic") return "runtime"

    // 개발 도구 패키지들
    const devPackages = ["@types/", "eslint", "prettier", "webpack", "rollup", "vite"]
    if (devPackages.some((pkg) => dep.source.includes(pkg))) return "devtime"

    return "runtime"
  }



  private analyzeTodoComments(content: string, filePath: string): TodoAnalysis {
    const lines = content.split('\n')
    const todos: TodoComment[] = []
    const todoPattern = /^\s*(?:\/\/|\/\*|\*|#|<!--|<!--)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)(?:\s*\(([^)]+)\))?\s*:?\s*(.*)(?:\*\/)?$/i
    const priorityPattern = /\b(high|critical|urgent|low|medium)\b/i
    const categoryPattern = /\[([^\]]+)\]/
    const authorPattern = /@([a-zA-Z0-9_-]+)/
    const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/

    // 분석 통계 초기화
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    const byCategory: Record<string, number> = {}
    let totalWords = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(todoPattern)

      if (match) {
        const [, type, metadata, content] = match
        const todoType = type.toUpperCase() as TodoComment['type']

        // 전체 텍스트에서 메타데이터 추출 (metadata와 content 모두에서)
        const fullText = (metadata || '') + ' ' + (content || '')
        let cleanContent = (content || '').replace(/\s*\*\/\s*$/, '').trim() // 블록 주석 닫기 제거

        // 우선순위 추출
        let priority: TodoComment['priority'] = 'medium' // 기본값
        const priorityMatch = fullText.match(priorityPattern)
        if (priorityMatch) {
          priority = priorityMatch[1].toLowerCase() as TodoComment['priority']
        }

        // 카테고리 추출
        let category: string | undefined
        const categoryMatch = fullText.match(categoryPattern)
        if (categoryMatch) {
          category = categoryMatch[1]
        }

        // 작성자 추출
        let author: string | undefined
        const authorMatch = fullText.match(authorPattern)
        if (authorMatch) {
          author = authorMatch[1]
        }

        // 날짜 추출
        let date: string | undefined
        const dateMatch = fullText.match(datePattern)
        if (dateMatch) {
          date = dateMatch[1]
        }

        // 멀티라인 검사 (다음 라인이 연속된 주석인지 확인)
        let isMultiline = false
        let fullContent = cleanContent

        // 다음 라인들을 확인하여 연속된 주석인지 판단
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          const continuationMatch = nextLine.match(/^\s*(?:\/\/|\/\*|\*|#|<!--|<!--)\s*(.*)$/)

          if (continuationMatch && !continuationMatch[1].match(/^\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)/i)) {
            isMultiline = true
            let continuationContent = continuationMatch[1].replace(/\s*\*\/\s*$/, '').trim()
            fullContent += ' ' + continuationContent
          } else {
            break
          }
        }

        // 주변 컨텍스트 추출 (앞뒤 2줄씩)
        const contextStart = Math.max(0, i - 2)
        const contextEnd = Math.min(lines.length - 1, i + 2)
        const context = lines.slice(contextStart, contextEnd + 1).join('\n')

        const todoComment: TodoComment = {
          type: todoType,
          content: fullContent.trim(),
          line: i + 1,
          author,
          date,
          priority,
          category,
          isMultiline,
          context
        }

        todos.push(todoComment)

        // 통계 업데이트
        byType[todoType] = (byType[todoType] || 0) + 1
        byPriority[priority] = (byPriority[priority] || 0) + 1

        if (category) {
          byCategory[category] = (byCategory[category] || 0) + 1
        }

        // 단어 수 계산
        totalWords += fullContent.split(/\s+/).filter(word => word.length > 0).length
      }
    }

    // 가장 오래된 TODO 찾기 (날짜가 있는 경우)
    const todosWithDate = todos.filter(todo => todo.date)
    let oldestTodo: TodoComment | undefined

    if (todosWithDate.length > 0) {
      oldestTodo = todosWithDate.reduce((oldest, current) => {
        const oldestDate = new Date(oldest.date!)
        const currentDate = new Date(current.date!)
        return currentDate < oldestDate ? current : oldest
      })
    }

    // 높은 우선순위 TODO 필터링
    const highPriorityTodos = todos.filter(todo =>
      todo.priority === 'high' || todo.priority === 'critical'
    )

    // 평균 단어 수 계산
    const averageWordsPerTodo = todos.length > 0 ? totalWords / todos.length : 0

    return {
      totalCount: todos.length,
      byType,
      byPriority,
      byCategory,
      items: todos,
      averageWordsPerTodo: Math.round(averageWordsPerTodo * 100) / 100, // 소수점 2자리
      oldestTodo,
      highPriorityTodos
    }
  }


  private detectCircularDependencies(filePath: string, dependencies: Array<any>): Array<string> {
    // 간단한 순환 의존성 감지 (실제로는 더 복잡한 그래프 분석 필요)
    const circular: Array<string> = []

    // TODO: 실제 그래프 순회 알고리즘 구현
    // 현재는 직접적인 순환만 감지
    for (const dep of dependencies) {
      if (this.isInternalModule(dep.source, filePath)) {
        const resolvedPath = this.resolveInternalPath(dep.source, filePath)
        if (resolvedPath && this.checkFileExists(resolvedPath)) {
          // 해당 파일이 현재 파일을 import하는지 확인
          try {
            const targetContent = fs.readFileSync(resolvedPath, "utf-8")
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

  private parseImportMembers(importClause: string): Array<string> {
    const members: Array<string> = []

    // 중괄호 내부의 멤버들 추출
    const braceMatch = importClause.match(/\{([^}]*)\}/)
    if (braceMatch) {
      const memberList = braceMatch[1]
        .split(",")
        .map((member) => member.trim())
        .filter((member) => member.length > 0)
      members.push.apply(members, memberList)
    }

    // default import
    const defaultMatch = importClause.match(/^\s*(\w+)/)
    if (defaultMatch && !braceMatch) {
      members.push(defaultMatch[1])
    }

    return members
  }

  private isTypeOnlyImport(importStatement: string): boolean {
    return importStatement.includes("import type") || importStatement.includes("typeof")
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
    return content.substring(0, index).split("\n").length
  }
}

// 코드 의존성 시각화를 위한 유틸리티
export class CodeDependencyVisualizer {
  static generateDependencyGraph(codeResults: Map<string, CodeAnalysisResult>): any {
    const graph = {
      nodes: [] as Array<any>,
      edges: [] as Array<any>
    }

    for (const [codeFile, result] of codeResults.entries()) {
      // 코드 파일 노드
      graph.nodes.push({
        id: codeFile,
        type: "code",
        label: path.basename(codeFile),
        metadata: result.codeMetadata
      })

      // 내부 모듈 연결
      result.internalModules.forEach((dep) => {
        if (dep.resolvedPath && dep.exists) {
          graph.nodes.push({
            id: dep.resolvedPath,
            type: "code",
            label: path.basename(dep.resolvedPath)
          })

          graph.edges.push({
            from: codeFile,
            to: dep.resolvedPath,
            type: "internal-dependency",
            confidence: dep.confidence,
            usage: dep.usage
          })
        }
      })

      // 외부 라이브러리 연결
      result.externalLibraries.forEach((dep) => {
        graph.nodes.push({
          id: dep.source,
          type: "library",
          label: dep.source,
          version: dep.packageVersion
        })

        graph.edges.push({
          from: codeFile,
          to: dep.source,
          type: "external-dependency",
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
      circularDependencies: [] as Array<Array<string>>,
      heaviestFiles: [] as Array<{ file: string; dependencies: number }>,
      frameworkUsage: {} as Record<string, number>
    }

    const fileDependencyCounts: Array<{ file: string; dependencies: number }> = []

    for (const [codeFile, result] of codeResults.entries()) {
      report.internalDependencies += result.internalModules.length
      report.externalDependencies += result.externalLibraries.length

      // 순환 의존성 수집
      if (result.codeMetadata.circularDependencies.length > 0) {
        result.codeMetadata.circularDependencies.forEach((circular) => {
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
