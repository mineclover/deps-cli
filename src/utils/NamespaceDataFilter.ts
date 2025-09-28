import type {
  CollectedDataItem,
  NamespaceCollectionResult
} from '../types/NamespaceCollection.js'

/**
 * 네임스페이스 데이터 필터링 및 정제를 담당하는 클래스
 */
export class NamespaceDataFilter {
  /**
   * 수집된 데이터에서 중복 제거
   */
  public removeDuplicates(result: NamespaceCollectionResult): NamespaceCollectionResult {
    const uniqueItems = new Map<string, CollectedDataItem>()

    for (const item of result.items) {
      const key = this.generateItemKey(item)
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item)
      }
    }

    return {
      ...result,
      items: Array.from(uniqueItems.values()),
      totalCount: uniqueItems.size
    }
  }

  /**
   * 데이터 타입별 필터링
   */
  public filterByType(
    result: NamespaceCollectionResult,
    types: Array<'keyword' | 'file' | 'export' | 'import' | 'class' | 'function' | 'variable' | 'type' | 'library-import'>
  ): NamespaceCollectionResult {
    const filteredItems = result.items.filter(item => types.includes(item.type))

    return {
      ...result,
      items: filteredItems,
      totalCount: filteredItems.length
    }
  }

  /**
   * 소스 파일 경로별 필터링
   */
  public filterBySourcePath(
    result: NamespaceCollectionResult,
    pathPatterns: string[]
  ): NamespaceCollectionResult {
    const filteredItems = result.items.filter(item =>
      pathPatterns.some(pattern => this.matchesPattern(item.sourcePath, pattern))
    )

    return {
      ...result,
      items: filteredItems,
      totalCount: filteredItems.length
    }
  }

  /**
   * 값 패턴별 필터링
   */
  public filterByValuePattern(
    result: NamespaceCollectionResult,
    valuePatterns: string[]
  ): NamespaceCollectionResult {
    const filteredItems = result.items.filter(item =>
      valuePatterns.some(pattern => this.matchesPattern(item.value, pattern))
    )

    return {
      ...result,
      items: filteredItems,
      totalCount: filteredItems.length
    }
  }

  /**
   * 메타데이터 기반 필터링
   */
  public filterByMetadata(
    result: NamespaceCollectionResult,
    metadataFilters: Record<string, any>
  ): NamespaceCollectionResult {
    const filteredItems = result.items.filter(item =>
      this.matchesMetadataFilters(item.metadata || {}, metadataFilters)
    )

    return {
      ...result,
      items: filteredItems,
      totalCount: filteredItems.length
    }
  }

  /**
   * 데이터 정렬
   */
  public sortItems(
    result: NamespaceCollectionResult,
    sortBy: 'value' | 'sourcePath' | 'type' | 'matchedPattern',
    order: 'asc' | 'desc' = 'asc'
  ): NamespaceCollectionResult {
    const sortedItems = [...result.items].sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]

      if (aValue < bValue) return order === 'asc' ? -1 : 1
      if (aValue > bValue) return order === 'asc' ? 1 : -1
      return 0
    })

    return {
      ...result,
      items: sortedItems
    }
  }

  /**
   * 데이터 그룹화
   */
  public groupByType(result: NamespaceCollectionResult): Record<string, CollectedDataItem[]> {
    const groups: Record<string, CollectedDataItem[]> = {}

    for (const item of result.items) {
      if (!groups[item.type]) {
        groups[item.type] = []
      }
      groups[item.type].push(item)
    }

    return groups
  }

  /**
   * 소스 파일별 그룹화
   */
  public groupBySourcePath(result: NamespaceCollectionResult): Record<string, CollectedDataItem[]> {
    const groups: Record<string, CollectedDataItem[]> = {}

    for (const item of result.items) {
      if (!groups[item.sourcePath]) {
        groups[item.sourcePath] = []
      }
      groups[item.sourcePath].push(item)
    }

    return groups
  }

  /**
   * 매칭 패턴별 그룹화
   */
  public groupByMatchedPattern(result: NamespaceCollectionResult): Record<string, CollectedDataItem[]> {
    const groups: Record<string, CollectedDataItem[]> = {}

    for (const item of result.items) {
      if (!groups[item.matchedPattern]) {
        groups[item.matchedPattern] = []
      }
      groups[item.matchedPattern].push(item)
    }

    return groups
  }

  /**
   * 통계 정보 생성
   */
  public generateStatistics(result: NamespaceCollectionResult) {
    const typeGroups = this.groupByType(result)
    const sourceGroups = this.groupBySourcePath(result)
    const patternGroups = this.groupByMatchedPattern(result)

    return {
      namespace: result.namespace,
      totalItems: result.totalCount,
      collectedAt: result.collectedAt,
      typeDistribution: Object.fromEntries(
        Object.entries(typeGroups).map(([type, items]) => [type, items.length])
      ),
      sourceFileCount: Object.keys(sourceGroups).length,
      patternMatchCount: Object.keys(patternGroups).length,
      topSources: Object.entries(sourceGroups)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 10)
        .map(([path, items]) => ({ path, count: items.length })),
      topPatterns: Object.entries(patternGroups)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 10)
        .map(([pattern, items]) => ({ pattern, count: items.length }))
    }
  }

  /**
   * 데이터 항목의 고유 키 생성
   */
  private generateItemKey(item: CollectedDataItem): string {
    return `${item.type}:${item.value}:${item.sourcePath}`
  }

  /**
   * 패턴 매칭 (glob 패턴 지원)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(value)
  }

  /**
   * 메타데이터 필터 매칭
   */
  private matchesMetadataFilters(
    metadata: Record<string, any>,
    filters: Record<string, any>
  ): boolean {
    for (const [key, filterValue] of Object.entries(filters)) {
      const metadataValue = metadata[key]

      if (Array.isArray(filterValue)) {
        if (!filterValue.includes(metadataValue)) {
          return false
        }
      } else if (typeof filterValue === 'string' && filterValue.includes('*')) {
        if (!this.matchesPattern(String(metadataValue), filterValue)) {
          return false
        }
      } else if (metadataValue !== filterValue) {
        return false
      }
    }

    return true
  }
}