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
 * 파일 경로 기반 데이터 수집 모듈
 */
export class FilePathCollectionModule implements CollectionModule {
  readonly id = 'file-path'
  readonly name = '파일 경로 수집기'
  readonly description = '파일 경로 패턴을 기반으로 데이터를 수집합니다'
  readonly version = '1.0.0'
  readonly supportedTypes: CollectionDataType[] = ['file']

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

    // 모든 파일 노드를 순회
    for (const filePath of dependencyGraph.nodes) {
      if (collectedCount >= maxItems) break

      // 파일 경로 패턴 매칭 확인
      const matchedPattern = this.findMatchingPattern(filePath, rule.filePaths)
      if (matchedPattern) {
        // 제외 패턴 확인
        if (!this.shouldExclude(filePath, rule.excludePatterns)) {
          items.push({
            type: 'file',
            value: filePath,
            sourcePath: filePath,
            matchedPattern,
            metadata: {
              exports: this.getFileExports(dependencyGraph, filePath),
              imports: this.getFileImports(dependencyGraph, filePath),
              moduleType: this.inferModuleType(filePath)
            }
          })
          collectedCount++
        }
      }
    }

    if (options?.debug) {
      console.log(`FilePathCollectionModule: 수집된 항목 ${items.length}개`)
    }

    return items
  }

  /**
   * 모듈이 특정 규칙을 지원하는지 확인
   */
  supports(rule: NamespaceCollectionRule): boolean {
    return rule.filePaths && rule.filePaths.length > 0
  }

  /**
   * 설정 검증
   */
  validateConfig(config: any): ValidationResult {
    const errors: string[] = []

    if (!config.filePaths || !Array.isArray(config.filePaths)) {
      errors.push('filePaths는 필수이며 배열이어야 합니다')
    }

    if (config.filePaths && config.filePaths.length === 0) {
      errors.push('최소 하나의 파일 패턴이 필요합니다')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
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
    let regexPattern = pattern
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

  /**
   * 파일의 모듈 타입 추론
   */
  private inferModuleType(filePath: string): string {
    const path = filePath.toLowerCase()

    if (path.includes('/test/') || path.includes('.test.') || path.includes('.spec.')) {
      return 'test'
    }
    if (path.includes('/component')) return 'component'
    if (path.includes('/service')) return 'service'
    if (path.includes('/util')) return 'utility'
    if (path.includes('/config')) return 'config'
    if (path.includes('/type')) return 'types'
    if (path.includes('/command')) return 'command'
    if (path.includes('/analyzer')) return 'analyzer'

    if (path.endsWith('.d.ts')) return 'declaration'
    if (path.endsWith('.ts')) return 'typescript'
    if (path.endsWith('.js')) return 'javascript'

    return 'unknown'
  }
}