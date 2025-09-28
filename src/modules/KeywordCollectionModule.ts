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
 * 키워드 기반 데이터 수집 모듈
 */
export class KeywordCollectionModule implements CollectionModule {
  readonly id = 'keyword'
  readonly name = '키워드 수집기'
  readonly description = 'export된 식별자 이름에서 키워드를 기반으로 데이터를 수집합니다'
  readonly version = '1.0.0'
  readonly supportedTypes: CollectionDataType[] = ['keyword', 'class', 'function', 'variable', 'type']

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

    // 각 파일의 export 정보에서 키워드 검색
    for (const [filePath, exportInfo] of dependencyGraph.exportMap) {
      if (collectedCount >= maxItems) break

      // 제외 패턴 확인
      if (this.shouldExclude(filePath, rule.excludePatterns)) {
        continue
      }

      // export된 이름들에서 키워드 매칭
      for (const exportItem of exportInfo.exportMethods) {
        if (collectedCount >= maxItems) break

        for (const keyword of rule.keywords) {
          if (this.matchesKeywordPattern(exportItem.name, keyword)) {
            const dataType = this.mapExportTypeToDataType(exportItem.exportType)

            items.push({
              type: dataType,
              value: exportItem.name,
              sourcePath: filePath,
              matchedPattern: keyword,
              metadata: {
                exportType: exportItem.exportType,
                declarationType: exportItem.declarationType,
                parentClass: exportItem.parentClass,
                isAsync: exportItem.isAsync,
                isStatic: exportItem.isStatic,
                visibility: exportItem.visibility,
                location: exportItem.location
              }
            })
            collectedCount++
            break // 같은 아이템에 대해 여러 키워드가 매칭되어도 한 번만 수집
          }
        }
      }
    }

    if (options?.debug) {
      console.log(`KeywordCollectionModule: 수집된 항목 ${items.length}개`)
    }

    return items
  }

  /**
   * 모듈이 특정 규칙을 지원하는지 확인
   */
  supports(rule: NamespaceCollectionRule): boolean {
    return rule.keywords && rule.keywords.length > 0
  }

  /**
   * 설정 검증
   */
  validateConfig(config: any): ValidationResult {
    const errors: string[] = []

    if (!config.keywords || !Array.isArray(config.keywords)) {
      errors.push('keywords는 필수이며 배열이어야 합니다')
    }

    if (config.keywords && config.keywords.length === 0) {
      errors.push('최소 하나의 키워드가 필요합니다')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 키워드 패턴 매칭
   */
  private matchesKeywordPattern(value: string, pattern: string): boolean {
    // 정확한 매칭 또는 포함 확인
    if (pattern.includes('*')) {
      return this.matchesGlobPattern(value, pattern)
    }

    // 대소문자 구분 없는 포함 검사
    return value.toLowerCase().includes(pattern.toLowerCase())
  }

  /**
   * Glob 패턴 매칭
   */
  private matchesGlobPattern(value: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(value)
  }

  /**
   * 제외 패턴 확인
   */
  private shouldExclude(value: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => this.matchesGlobPattern(value, pattern))
  }

  /**
   * Export 타입을 수집 데이터 타입으로 매핑
   */
  private mapExportTypeToDataType(exportType: string): CollectionDataType {
    switch (exportType) {
      case 'class':
        return 'class'
      case 'function':
        return 'function'
      case 'variable':
        return 'variable'
      case 'type':
      case 'enum':
        return 'type'
      default:
        return 'keyword'
    }
  }
}