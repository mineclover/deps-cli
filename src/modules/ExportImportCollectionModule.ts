import type { ProjectDependencyGraph } from '../analyzers/EnhancedDependencyAnalyzer.js'
import type {
  CollectionModule,
  CollectionModuleOptions,
  ValidationResult,
  CollectionDataType
} from '../types/CollectionModules.js'
import type {
  NamespaceCollectionRule,
  CollectedDataItem
} from '../types/NamespaceCollection.js'

/**
 * Export/Import 관계 기반 데이터 수집 모듈
 */
export class ExportImportCollectionModule implements CollectionModule {
  readonly id = 'export-import'
  readonly name = 'Export/Import 수집기'
  readonly description = '모듈 간 export/import 관계를 기반으로 데이터를 수집합니다'
  readonly version = '1.0.0'
  readonly supportedTypes: CollectionDataType[] = ['export', 'import']

  /**
   * 데이터 수집 실행
   */
  collect(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    options?: CollectionModuleOptions
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []
    const maxItems = options?.maxItems || Number.MAX_SAFE_INTEGER
    let collectedCount = 0

    // Export 데이터 수집
    if (this.shouldCollectExports(rule, options)) {
      const exportItems = this.collectExports(dependencyGraph, rule, maxItems - collectedCount)
      items.push(...exportItems)
      collectedCount += exportItems.length
    }

    // Import 데이터 수집
    if (collectedCount < maxItems && this.shouldCollectImports(rule, options)) {
      const importItems = this.collectImports(dependencyGraph, rule, maxItems - collectedCount)
      items.push(...importItems)
      collectedCount += importItems.length
    }

    if (options?.debug) {
      console.log(`ExportImportCollectionModule: 수집된 항목 ${items.length}개`)
    }

    return items
  }

  /**
   * 모듈이 특정 규칙을 지원하는지 확인
   */
  supports(rule: NamespaceCollectionRule): boolean {
    // export/import 관련 키워드가 있거나, 파일 패턴이 있으면 지원
    return (rule.keywords && rule.keywords.some(k =>
      k.toLowerCase().includes('export') ||
      k.toLowerCase().includes('import')
    )) || (rule.filePaths && rule.filePaths.length > 0)
  }

  /**
   * 설정 검증
   */
  validateConfig(config: any): ValidationResult {
    // Export/Import 모듈은 기본적으로 모든 설정을 지원
    return {
      isValid: true,
      errors: []
    }
  }

  /**
   * Export 데이터 수집
   */
  private collectExports(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    maxItems: number
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []
    let collectedCount = 0

    for (const [filePath, exportInfo] of dependencyGraph.exportMap) {
      if (collectedCount >= maxItems) break

      // 파일 패턴 및 제외 패턴 확인
      if (!this.matchesFilePatterns(filePath, rule.filePaths) ||
          this.shouldExclude(filePath, rule.excludePatterns)) {
        continue
      }

      for (const exportMethod of exportInfo.exportMethods) {
        if (collectedCount >= maxItems) break

        // 키워드 필터링 (있는 경우)
        if (rule.keywords.length > 0 &&
            !rule.keywords.some(k => this.matchesKeyword(exportMethod.name, k))) {
          continue
        }

        items.push({
          type: 'export',
          value: exportMethod.name,
          sourcePath: filePath,
          matchedPattern: this.findMatchedPattern(exportMethod.name, rule.keywords) || 'export',
          metadata: {
            exportType: exportMethod.exportType,
            declarationType: exportMethod.declarationType,
            parentClass: exportMethod.parentClass,
            location: exportMethod.location,
            parameters: exportMethod.parameters,
            returnType: exportMethod.returnType,
            visibility: exportMethod.visibility,
            isAsync: exportMethod.isAsync,
            isStatic: exportMethod.isStatic
          }
        })
        collectedCount++
      }
    }

    return items
  }

  /**
   * Import 데이터 수집
   */
  private collectImports(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    maxItems: number
  ): CollectedDataItem[] {
    const items: CollectedDataItem[] = []
    let collectedCount = 0

    for (const [filePath, imports] of dependencyGraph.importMap) {
      if (collectedCount >= maxItems) break

      // 파일 패턴 및 제외 패턴 확인
      if (!this.matchesFilePatterns(filePath, rule.filePaths) ||
          this.shouldExclude(filePath, rule.excludePatterns)) {
        continue
      }

      for (const importDecl of imports) {
        if (collectedCount >= maxItems) break

        // 키워드 필터링 (있는 경우)
        if (rule.keywords.length > 0 &&
            !rule.keywords.some(k => this.matchesKeyword(importDecl.importPath, k))) {
          continue
        }

        items.push({
          type: 'import',
          value: importDecl.importPath,
          sourcePath: filePath,
          matchedPattern: this.findMatchedPattern(importDecl.importPath, rule.keywords) || 'import',
          metadata: {
            resolvedPath: importDecl.resolvedPath,
            importedMembers: importDecl.importedMembers,
            importType: importDecl.importType,
            line: importDecl.line
          }
        })
        collectedCount++
      }
    }

    return items
  }

  /**
   * Export 수집 여부 확인
   */
  private shouldCollectExports(rule: NamespaceCollectionRule, options?: CollectionModuleOptions): boolean {
    const customConfig = options?.custom
    if (customConfig?.collectTypes) {
      return customConfig.collectTypes.includes('export')
    }
    return true // 기본적으로 수집
  }

  /**
   * Import 수집 여부 확인
   */
  private shouldCollectImports(rule: NamespaceCollectionRule, options?: CollectionModuleOptions): boolean {
    const customConfig = options?.custom
    if (customConfig?.collectTypes) {
      return customConfig.collectTypes.includes('import')
    }
    return true // 기본적으로 수집
  }

  /**
   * 파일 패턴 매칭
   */
  private matchesFilePatterns(filePath: string, patterns: string[]): boolean {
    if (patterns.length === 0) return true

    return patterns.some(pattern => this.matchesGlobPattern(filePath, pattern))
  }

  /**
   * 키워드 매칭
   */
  private matchesKeyword(value: string, keyword: string): boolean {
    return value.toLowerCase().includes(keyword.toLowerCase())
  }

  /**
   * 매칭된 패턴 찾기
   */
  private findMatchedPattern(value: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      if (this.matchesKeyword(value, keyword)) {
        return keyword
      }
    }
    return null
  }

  /**
   * Glob 패턴 매칭
   */
  private matchesGlobPattern(value: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, 'DOUBLE_ASTERISK')
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^/]*')
      .replace(/DOUBLE_ASTERISK/g, '.*?')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(value)
  }

  /**
   * 제외 패턴 확인
   */
  private shouldExclude(value: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => this.matchesGlobPattern(value, pattern))
  }
}