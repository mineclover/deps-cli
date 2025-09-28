import type {
  CollectionModule,
  CollectionModuleRegistry,
  CollectionModuleMetadata,
  CollectionDataType
} from '../types/CollectionModules.js'

/**
 * 수집 모듈 레지스트리 구현
 */
export class DefaultCollectionModuleRegistry implements CollectionModuleRegistry {
  private modules = new Map<string, CollectionModule>()

  /**
   * 모듈 등록
   */
  register(module: CollectionModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module with id '${module.id}' is already registered`)
    }

    this.modules.set(module.id, module)
  }

  /**
   * 모듈 조회
   */
  get(id: string): CollectionModule | undefined {
    return this.modules.get(id)
  }

  /**
   * 등록된 모든 모듈 목록
   */
  list(): CollectionModuleMetadata[] {
    return Array.from(this.modules.values()).map(module => ({
      id: module.id,
      name: module.name,
      description: module.description,
      version: module.version,
      supportedTypes: module.supportedTypes
    }))
  }

  /**
   * 특정 데이터 타입을 지원하는 모듈들
   */
  getByType(type: CollectionDataType): CollectionModule[] {
    return Array.from(this.modules.values()).filter(module =>
      module.supportedTypes.includes(type)
    )
  }

  /**
   * 모듈 제거
   */
  unregister(id: string): boolean {
    return this.modules.delete(id)
  }

  /**
   * 모든 모듈 초기화
   */
  clear(): void {
    this.modules.clear()
  }

  /**
   * 등록된 모듈 개수
   */
  size(): number {
    return this.modules.size
  }

  /**
   * 모듈 ID들 조회
   */
  getModuleIds(): string[] {
    return Array.from(this.modules.keys())
  }

  /**
   * 네임스페이스 규칙에 적합한 모듈들 찾기
   */
  findCompatibleModules(rule: any): CollectionModule[] {
    return Array.from(this.modules.values()).filter(module =>
      module.supports(rule)
    )
  }
}