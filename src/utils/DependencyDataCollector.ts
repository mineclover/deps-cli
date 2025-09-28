import type { ProjectDependencyGraph } from '../analyzers/EnhancedDependencyAnalyzer.js'
import type {
  NamespaceCollectionRule,
  CollectedDataItem,
  NamespaceCollectionResult
} from '../types/NamespaceCollection.js'
import { relative } from 'path'

/**
 * 의존성 데이터에서 네임스페이스별 데이터를 수집하는 핵심 클래스
 */
export class DependencyDataCollector {
  private projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
  }

  /**
   * 단일 네임스페이스에 대해 데이터 수집
   */
  public collectForNamespace(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule
  ): NamespaceCollectionResult {
    const collectedItems: CollectedDataItem[] = []

    // library-structure 전략인 경우 외부 라이브러리 import 수집
    if (rule.documentStrategy === 'library-structure') {
      const libraryItems = this.collectLibraryImportItems(dependencyGraph, rule)
      collectedItems.push(...libraryItems)
    } else {
      // 다른 전략들은 기존 방식 사용
      // 파일 경로 기반 수집
      const fileItems = this.collectFilePathItems(dependencyGraph, rule)
      collectedItems.push(...fileItems)

      // 키워드 기반 수집
      const keywordItems = this.collectKeywordItems(dependencyGraph, rule)
      collectedItems.push(...keywordItems)
    }

    return {
      namespace: rule.namespace,
      items: collectedItems,
      collectedAt: new Date(),
      totalCount: collectedItems.length
    }
  }

  /**
   * 모든 네임스페이스에 대해 데이터 수집
   */
  public collectForAllNamespaces(
    dependencyGraph: ProjectDependencyGraph,
    rules: NamespaceCollectionRule[]
  ): NamespaceCollectionResult[] {
    return rules.map(rule => this.collectForNamespace(dependencyGraph, rule))
  }

  /**
   * 파일 경로 패턴을 기반으로 데이터 수집
   */
  private collectFilePathItems(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []

    // 모든 파일 노드를 순회
    for (const absoluteFilePath of dependencyGraph.nodes) {
      // 절대 경로를 상대 경로로 변환
      const relativePath = relative(this.projectRoot, absoluteFilePath)
      
      // 파일 경로 패턴 매칭 확인
      const matchedPattern = this.findMatchingPattern(relativePath, rule.filePaths)
      if (matchedPattern) {
        // 제외 패턴 확인
        if (!this.shouldExclude(relativePath, rule.excludePatterns)) {
          items.push({
            type: 'file',
            value: relativePath,
            sourcePath: absoluteFilePath,
            matchedPattern,
            metadata: {
              exports: this.getFileExports(dependencyGraph, absoluteFilePath),
              imports: this.getFileImports(dependencyGraph, absoluteFilePath)
            }
          })
        }
      }
    }
    return items
  }

  /**
   * 키워드 패턴을 기반으로 데이터 수집
   */
  private collectKeywordItems(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []

    // 각 파일의 export 정보에서 키워드 검색
    for (const [absoluteFilePath, exportInfo] of dependencyGraph.exportMap) {
      // 절대 경로를 상대 경로로 변환
      const relativePath = relative(this.projectRoot, absoluteFilePath)
      
      // 제외 패턴 확인
      if (this.shouldExclude(relativePath, rule.excludePatterns)) {
        continue
      }

      // export된 이름들에서 키워드 매칭
      for (const exportItem of exportInfo.exportMethods) {
        for (const keyword of rule.keywords) {
          if (this.matchesKeywordPattern(exportItem.name, keyword)) {
            items.push({
              type: 'keyword',
              value: exportItem.name,
              sourcePath: absoluteFilePath,
              matchedPattern: keyword,
              metadata: {
                exportType: exportItem.exportType,
                declarationType: exportItem.declarationType,
                parentClass: exportItem.parentClass
              }
            })
          }
        }
      }
    }

    return items
  }

  /**
   * 라이브러리 구조 전략을 위한 외부 라이브러리 import 수집
   */
  private collectLibraryImportItems(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []
    const libraryImports = new Map<string, Set<{name: string, isType: boolean}>>() // 라이브러리별 import된 메서드들

    console.log(`🔍 Debug: importMap has ${dependencyGraph.importMap.size} files`)

    // 모든 파일의 import 정보 분석
    for (const [absoluteFilePath, imports] of dependencyGraph.importMap) {
      console.log(`🔍 Debug: Processing ${absoluteFilePath} with ${imports.length} imports`)
      const relativePath = relative(this.projectRoot, absoluteFilePath)
      
      // 제외 패턴 확인
      if (this.shouldExclude(relativePath, rule.excludePatterns)) {
        continue
      }

      // 각 import 분석
      for (const importDecl of imports) {
        // 외부 라이브러리만 처리 (node_modules에서 오는 것들)
        if (this.isExternalLibrary(importDecl.importPath)) {
          const libraryName = this.extractLibraryName(importDecl.importPath)
          
          if (!libraryImports.has(libraryName)) {
            libraryImports.set(libraryName, new Set())
          }

          // 일반 import된 메서드들 추가
          for (const member of importDecl.importedMembers) {
            libraryImports.get(libraryName)!.add({
              name: member,
              isType: false
            })
          }

          // 타입 import된 메서드들 추가 (새로운 typeImportMembers 사용)
          if (importDecl.typeImportMembers && importDecl.typeImportMembers.length > 0) {
            for (const typeMember of importDecl.typeImportMembers) {
              libraryImports.get(libraryName)!.add({
                name: typeMember,
                isType: true
              })
              console.log(`🚨 ADDED TYPE IMPORT: ${typeMember} from ${libraryName}`)
            }
          }
        }
      }
    }

    // 라이브러리별로 수집된 데이터를 CollectedDataItem으로 변환
    for (const [libraryName, methods] of libraryImports) {
      for (const method of methods) {
        items.push({
          type: 'library-import',
          value: method.name,
          sourcePath: `external/${libraryName}`,
          matchedPattern: `library:${libraryName}`,
          metadata: {
            libraryName,
            importType: 'named',
            isExternal: true,
            isTypeImport: method.isType
          }
        })
      }
    }

    return items
  }

  /**
   * 외부 라이브러리인지 확인
   */
  private isExternalLibrary(importPath: string): boolean {
    // 상대경로나 절대경로가 아닌 경우 (node_modules의 패키지 + node: 내장 모듈)
    return !importPath.startsWith('.') && !importPath.startsWith('/')
  }

  /**
   * import 경로에서 라이브러리 이름 추출
   */
  private extractLibraryName(importPath: string): string {
    // node: 프로토콜 처리 - node:fs/promises → node/fs
    if (importPath.startsWith('node:')) {
      const withoutProtocol = importPath.substring(5) // 'node:' 제거
      const parts = withoutProtocol.split('/')
      return parts.length > 1 ? `node/${parts[0]}` : `node/${withoutProtocol}`
    }
    
    // @scope/package 형태 처리
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/')
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath
    }
    
    // 일반 패키지에서 첫 번째 부분만 추출
    return importPath.split('/')[0]
  }

  /**
   * 패턴 매칭 확인
   */
  private findMatchingPattern(value: string, patterns: string[]): string | null {
    for (const pattern of patterns) {
      if (this.matchesPattern(value, pattern)) {
        return pattern
      }
    }
    return null
  }

  /**
   * 단일 패턴 매칭 (glob 패턴 지원)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // 간단한 glob 패턴 구현 (*, **)
    let regexPattern = pattern
      .replace(/\*\*/g, 'DOUBLE_ASTERISK')  // ** -> 임시 플레이스홀더
      .replace(/\./g, '\\.')                // . -> \.
      .replace(/\*/g, '[^/]*')              // * -> [^/]*
      .replace(/DOUBLE_ASTERISK/g, '.*')    // ** -> .* (0개 이상의 모든 문자)

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(value)
  }

  /**
   * 키워드 패턴 매칭
   */
  private matchesKeywordPattern(value: string, pattern: string): boolean {
    // 정확한 매칭 또는 포함 확인
    if (pattern.includes('*')) {
      return this.matchesPattern(value, pattern)
    }
    return value.includes(pattern)
  }

  /**
   * 제외 패턴 확인
   */
  private shouldExclude(value: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => this.matchesPattern(value, pattern))
  }

  /**
   * 파일의 export 정보 추출
   */
  private getFileExports(dependencyGraph: ProjectDependencyGraph, filePath: string): string[] {
    const exportInfo = dependencyGraph.exportMap.get(filePath)
    if (!exportInfo) return []

    return exportInfo.exportMethods.map(exp => exp.name)
  }

  /**
   * 파일의 import 정보 추출
   */
  private getFileImports(dependencyGraph: ProjectDependencyGraph, filePath: string): string[] {
    const importInfo = dependencyGraph.importMap.get(filePath)
    if (!importInfo) return []

    return importInfo.map(imp => imp.importPath)
  }
}