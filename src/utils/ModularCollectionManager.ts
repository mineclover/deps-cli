import type { ProjectDependencyGraph } from '../analyzers/EnhancedDependencyAnalyzer.js'
import type {
  CollectionModule,
  CollectionModuleRegistry,
  ModuleExecutionResult,
  ModuleExecutionConfig,
  ModuleSelectionStrategy,
  CollectionModuleOptions
} from '../types/CollectionModules.js'
import type {
  NamespaceCollectionRule,
  NamespaceCollectionResult
} from '../types/NamespaceCollection.js'
import { DefaultCollectionModuleRegistry } from './CollectionModuleRegistry.js'

/**
 * 모듈화된 수집 시스템 관리자
 */
export class ModularCollectionManager {
  private registry: CollectionModuleRegistry

  constructor(registry?: CollectionModuleRegistry) {
    this.registry = registry || new DefaultCollectionModuleRegistry()
  }

  /**
   * 기본 모듈들을 등록
   */
  async registerDefaultModules(): Promise<void> {
    const { FilePathCollectionModule } = await import('../modules/FilePathCollectionModule.js')
    const { KeywordCollectionModule } = await import('../modules/KeywordCollectionModule.js')
    const { ExportImportCollectionModule } = await import('../modules/ExportImportCollectionModule.js')

    this.registry.register(new FilePathCollectionModule())
    this.registry.register(new KeywordCollectionModule())
    this.registry.register(new ExportImportCollectionModule())
  }

  /**
   * 사용자 정의 모듈 등록
   */
  registerModule(module: CollectionModule): void {
    this.registry.register(module)
  }

  /**
   * 네임스페이스에 대해 모듈화된 데이터 수집 실행
   */
  async collectForNamespace(
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    config?: ModuleExecutionConfig,
    options?: CollectionModuleOptions
  ): Promise<NamespaceCollectionResult> {
    const executionResults: ModuleExecutionResult[] = []
    const selectedModules = this.selectModules(rule, config)

    if (config?.parallel) {
      // 병렬 실행
      const promises = selectedModules.map(module =>
        this.executeModule(module, dependencyGraph, rule, options)
      )
      const results = await Promise.allSettled(promises)

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          executionResults.push(result.value)
        } else {
          executionResults.push({
            moduleId: selectedModules[index].id,
            items: [],
            executionTime: 0,
            success: false,
            error: result.reason?.message || 'Unknown error'
          })
        }
      })
    } else {
      // 순차 실행
      for (const module of selectedModules) {
        try {
          const result = await this.executeModule(module, dependencyGraph, rule, options)
          executionResults.push(result)

          if (!result.success && config?.failFast) {
            break
          }
        } catch (error) {
          const errorResult: ModuleExecutionResult = {
            moduleId: module.id,
            items: [],
            executionTime: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
          executionResults.push(errorResult)

          if (config?.failFast) {
            break
          }
        }
      }
    }

    // 모든 성공한 결과를 합치기
    const allItems = executionResults
      .filter(result => result.success)
      .flatMap(result => result.items)

    return {
      namespace: rule.namespace,
      items: allItems,
      collectedAt: new Date(),
      totalCount: allItems.length,
      metadata: {
        executionResults,
        totalExecutionTime: executionResults.reduce((sum, r) => sum + r.executionTime, 0),
        successfulModules: executionResults.filter(r => r.success).length,
        failedModules: executionResults.filter(r => !r.success).length
      }
    }
  }

  /**
   * 등록된 모듈 목록 조회
   */
  listModules() {
    return this.registry.list()
  }

  /**
   * 특정 모듈 조회
   */
  getModule(id: string): CollectionModule | undefined {
    return this.registry.get(id)
  }

  /**
   * 모듈 선택
   */
  private selectModules(
    rule: NamespaceCollectionRule,
    config?: ModuleExecutionConfig
  ): CollectionModule[] {
    const strategy = config?.strategy || 'auto'

    switch (strategy) {
      case 'all':
        return Array.from(this.registry.list()).map(meta => this.registry.get(meta.id)!)

      case 'explicit':
        if (!config?.selectedModules) {
          throw new Error('명시적 선택 전략에는 selectedModules이 필요합니다')
        }
        return config.selectedModules
          .map(id => this.registry.get(id))
          .filter((module): module is CollectionModule => module !== undefined)

      case 'auto':
        return this.registry.findCompatibleModules(rule)

      case 'priority':
        // 우선순위 기반 선택 (파일 > 키워드 > export/import)
        const compatible = this.registry.findCompatibleModules(rule)
        return compatible.sort((a, b) => this.getModulePriority(a) - this.getModulePriority(b))

      default:
        return this.registry.findCompatibleModules(rule)
    }
  }

  /**
   * 모듈 우선순위 결정
   */
  private getModulePriority(module: CollectionModule): number {
    switch (module.id) {
      case 'file-path': return 1
      case 'keyword': return 2
      case 'export-import': return 3
      default: return 10
    }
  }

  /**
   * 단일 모듈 실행
   */
  private async executeModule(
    module: CollectionModule,
    dependencyGraph: ProjectDependencyGraph,
    rule: NamespaceCollectionRule,
    options?: CollectionModuleOptions
  ): Promise<ModuleExecutionResult> {
    const startTime = Date.now()

    try {
      const items = await Promise.resolve(module.collect(dependencyGraph, rule, options))
      const executionTime = Date.now() - startTime

      return {
        moduleId: module.id,
        items,
        executionTime,
        success: true,
        metadata: {
          moduleName: module.name,
          moduleVersion: module.version
        }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime

      return {
        moduleId: module.id,
        items: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 레지스트리 조회 (고급 사용자용)
   */
  getRegistry(): CollectionModuleRegistry {
    return this.registry
  }
}