import type {
  CollectedDataItem,
  NamespaceCollectionResult,
  GeneratedDocumentPath,
  DocumentStrategy,
  DocumentTemplates,
  DocumentPaths,
  NamespaceCollectionRule
} from '../types/NamespaceCollection.js'
import { basename, dirname, extname, relative } from 'path'

/**
 * 수집된 데이터를 기반으로 문서 경로를 생성하는 클래스
 */
export class DocumentPathGenerator {
  /**
   * 전략 기반 문서 경로 생성
   */
  public generatePathsWithStrategy(
    result: NamespaceCollectionResult,
    rule: NamespaceCollectionRule
  ): GeneratedDocumentPath[] {
    const strategy = rule.documentStrategy || 'file-mirror'
    const rootPath = rule.documentPath || rule.documentPaths?.rootPath || 'docs/default'

    switch (strategy) {
      case 'file-mirror':
        return this.generateSimpleFileMirrorPaths(result, rootPath)

      case 'method-mirror':
        return this.generateSimpleMethodMirrorPaths(result, rootPath)

      case 'library-structure':
        return this.generateSimpleLibraryStructurePaths(result, rootPath, rule.libraryName)

      case 'namespace-grouping':
        return this.generateSimpleNamespaceGroupingPaths(result, rootPath)

      default:
        // 하위 호환성: 기존 방식 사용
        if (rule.documentTemplates?.fileMirror) {
          return this.generateFileMirrorPaths(result, rule.documentTemplates.fileMirror)
        }
        return this.generatePaths(result, rule.documentPathTemplate || '{namespace}/{name}.md')
    }
  }

  /**
   * 네임스페이스 수집 결과에서 문서 경로들 생성 (기존 방식, 하위 호환성용)
   */
  public generatePaths(
    result: NamespaceCollectionResult,
    template: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item =>
      this.generatePathForItem(result.namespace, item, template)
    )
  }

  /**
   * 단일 데이터 항목에 대한 문서 경로 생성
   */
  public generatePathForItem(
    namespace: string,
    item: CollectedDataItem,
    template: string
  ): GeneratedDocumentPath {
    const templateVariables = this.extractTemplateVariables(namespace, item)
    const documentPath = this.replaceTemplateVariables(template, templateVariables)

    return {
      namespace,
      documentPath,
      sourceItem: item,
      templateVariables
    }
  }

  /**
   * 여러 네임스페이스 결과에 대한 문서 경로 생성
   */
  public generatePathsForMultipleNamespaces(
    results: NamespaceCollectionResult[],
    templateMap: Record<string, string>
  ): GeneratedDocumentPath[] {
    const allPaths: GeneratedDocumentPath[] = []

    for (const result of results) {
      const template = templateMap[result.namespace]
      if (template) {
        const paths = this.generatePaths(result, template)
        allPaths.push(...paths)
      }
    }

    return allPaths
  }

  /**
   * 경로 중복 제거 및 충돌 해결
   */
  public resolveDuplicatePaths(paths: GeneratedDocumentPath[]): GeneratedDocumentPath[] {
    const pathMap = new Map<string, GeneratedDocumentPath[]>()

    // 경로별로 그룹화
    for (const path of paths) {
      const normalizedPath = path.documentPath.toLowerCase()
      if (!pathMap.has(normalizedPath)) {
        pathMap.set(normalizedPath, [])
      }
      pathMap.get(normalizedPath)!.push(path)
    }

    const resolvedPaths: GeneratedDocumentPath[] = []

    // 충돌 해결
    for (const [, duplicatePaths] of pathMap) {
      if (duplicatePaths.length === 1) {
        resolvedPaths.push(duplicatePaths[0])
      } else {
        // 충돌하는 경우 인덱스 추가
        for (let i = 0; i < duplicatePaths.length; i++) {
          const originalPath = duplicatePaths[i]
          const resolvedPath = this.addIndexToPath(originalPath.documentPath, i + 1)

          resolvedPaths.push({
            ...originalPath,
            documentPath: resolvedPath
          })
        }
      }
    }

    return resolvedPaths
  }

  /**
   * 경로별 그룹화
   */
  public groupPathsByDirectory(paths: GeneratedDocumentPath[]): Record<string, GeneratedDocumentPath[]> {
    const groups: Record<string, GeneratedDocumentPath[]> = {}

    for (const path of paths) {
      const directory = dirname(path.documentPath)
      if (!groups[directory]) {
        groups[directory] = []
      }
      groups[directory].push(path)
    }

    return groups
  }

  /**
   * 네임스페이스별 그룹화
   */
  public groupPathsByNamespace(paths: GeneratedDocumentPath[]): Record<string, GeneratedDocumentPath[]> {
    const groups: Record<string, GeneratedDocumentPath[]> = {}

    for (const path of paths) {
      if (!groups[path.namespace]) {
        groups[path.namespace] = []
      }
      groups[path.namespace].push(path)
    }

    return groups
  }

  /**
   * 템플릿 변수 추출
   */
  private extractTemplateVariables(namespace: string, item: CollectedDataItem): Record<string, string> {
    const fileName = basename(item.sourcePath, extname(item.sourcePath))
    const fileDir = dirname(item.sourcePath)
    const fileExt = extname(item.sourcePath).slice(1) // 점 제거

    // 디렉토리 경로를 세분화
    const pathParts = fileDir.split('/').filter(part => part !== '' && part !== '.')
    const sourceDir = pathParts[pathParts.length - 1] || 'root'

    // 카테고리 추론
    const category = this.inferCategory(item)

    // 값에서 파일명 추출 (키워드인 경우)
    const valueName = item.type === 'keyword' ? item.value : fileName

    return {
      namespace,
      name: valueName,
      filename: fileName,
      category,
      type: item.type,
      sourceDir,
      sourcePath: item.sourcePath,
      matchedPattern: item.matchedPattern,
      fileExt,
      // 경로의 각 부분
      ...Object.fromEntries(
        pathParts.map((part, index) => [`dir${index + 1}`, part])
      )
    }
  }

  /**
   * 템플릿 변수 치환
   */
  private replaceTemplateVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template

    // {variable} 형태의 변수 치환
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`
      result = result.replace(new RegExp(this.escapeRegex(placeholder), 'g'), value)
    }

    // 치환되지 않은 변수는 기본값 또는 제거
    result = result.replace(/{[^}]+}/g, (match) => {
      console.warn(`Template variable ${match} not found, using default`)
      return 'unknown'
    })

    return result
  }

  /**
   * 카테고리 추론
   */
  private inferCategory(item: CollectedDataItem): string {
    if (item.type === 'file') {
      const path = item.sourcePath.toLowerCase()

      if (path.includes('/component')) return 'components'
      if (path.includes('/service')) return 'services'
      if (path.includes('/util')) return 'utils'
      if (path.includes('/hook')) return 'hooks'
      if (path.includes('/api')) return 'api'
      if (path.includes('/type')) return 'types'
      if (path.includes('/config')) return 'config'
      if (path.includes('/command')) return 'commands'
      if (path.includes('/analyzer')) return 'analyzers'

      return 'general'
    }

    if (item.type === 'keyword') {
      const keyword = item.value.toLowerCase()
      const metadata = item.metadata || {}

      if (keyword.includes('component')) return 'components'
      if (keyword.includes('service')) return 'services'
      if (keyword.includes('controller')) return 'controllers'
      if (keyword.includes('manager')) return 'managers'
      if (keyword.includes('analyzer')) return 'analyzers'
      if (keyword.includes('generator')) return 'generators'
      if (keyword.includes('filter')) return 'filters'
      if (keyword.includes('command')) return 'commands'

      // 메타데이터 기반 추론
      if (metadata.exportType === 'class') return 'classes'
      if (metadata.exportType === 'function') return 'functions'
      if (metadata.exportType === 'interface') return 'interfaces'
      if (metadata.exportType === 'type') return 'types'

      return 'general'
    }

    return 'unknown'
  }

  /**
   * 경로에 인덱스 추가 (충돌 해결용)
   */
  private addIndexToPath(originalPath: string, index: number): string {
    const ext = extname(originalPath)
    const basePath = originalPath.slice(0, -ext.length)
    return `${basePath}_${index}${ext}`
  }

  /**
   * 루트 기반 파일 미러링 경로 생성
   */
  private generateFileMirrorPathsWithRoot(
    result: NamespaceCollectionResult,
    rootPath: string,
    subPath: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const documentPath = `${rootPath}/${subPath}/${item.sourcePath}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          subPath,
          filePath: item.sourcePath,
          namespace: result.namespace,
          filename: basename(item.sourcePath, extname(item.sourcePath)),
          extension: extname(item.sourcePath).slice(1)
        }
      }
    })
  }

  /**
   * 파일 미러링 경로 생성 (하위 호환성용)
   */
  private generateFileMirrorPaths(
    result: NamespaceCollectionResult,
    template: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const variables = {
        filePath: item.sourcePath,
        namespace: result.namespace,
        filename: basename(item.sourcePath, extname(item.sourcePath)),
        extension: extname(item.sourcePath).slice(1)
      }

      return {
        namespace: result.namespace,
        documentPath: this.replaceTemplateVariables(template, variables),
        sourceItem: item,
        templateVariables: variables
      }
    })
  }

  /**
   * 루트 기반 라이브러리 구조 경로 생성
   */
  private generateLibraryStructurePathsWithRoot(
    result: NamespaceCollectionResult,
    rootPath: string,
    subPath: string,
    libraryName?: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const category = this.inferLibraryCategory(item)
      const methodName = this.extractMethodName(item)
      const library = libraryName || 'unknown'

      const documentPath = `${rootPath}/${subPath}/${library}/${category}/${methodName}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          subPath,
          library,
          category,
          method: methodName,
          namespace: result.namespace,
          type: item.type,
          name: item.value
        }
      }
    })
  }

  /**
   * 루트 기반 네임스페이스 그룹핑 경로 생성
   */
  private generateNamespaceGroupingPathsWithRoot(
    result: NamespaceCollectionResult,
    rootPath: string,
    subPath: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const category = this.inferCategory(item)
      const documentPath = `${rootPath}/${subPath}/${result.namespace}/${item.type}/${item.value}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          subPath,
          namespace: result.namespace,
          type: item.type,
          name: item.value,
          category,
          filename: basename(item.sourcePath, extname(item.sourcePath))
        }
      }
    })
  }

  /**
   * 라이브러리 구조 경로 생성 (하위 호환성용)
   */
  private generateLibraryStructurePaths(
    result: NamespaceCollectionResult,
    template: string,
    libraryName?: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const category = this.inferLibraryCategory(item)
      const methodName = this.extractMethodName(item)

      const variables = {
        library: libraryName || 'unknown',
        category,
        method: methodName,
        namespace: result.namespace,
        type: item.type,
        name: item.value
      }

      return {
        namespace: result.namespace,
        documentPath: this.replaceTemplateVariables(template, variables),
        sourceItem: item,
        templateVariables: variables
      }
    })
  }

  /**
   * 네임스페이스 그룹핑 경로 생성
   */
  private generateNamespaceGroupingPaths(
    result: NamespaceCollectionResult,
    template: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const variables = {
        namespace: result.namespace,
        type: item.type,
        name: item.value,
        category: this.inferCategory(item),
        filename: basename(item.sourcePath, extname(item.sourcePath))
      }

      return {
        namespace: result.namespace,
        documentPath: this.replaceTemplateVariables(template, variables),
        sourceItem: item,
        templateVariables: variables
      }
    })
  }

  /**
   * 라이브러리 카테고리 추론
   */
  private inferLibraryCategory(item: CollectedDataItem): string {
    const metadata = item.metadata || {}

    // export/import 타입 기반
    if (item.type === 'export' || item.type === 'import') {
      if (metadata.exportType === 'function') return 'functions'
      if (metadata.exportType === 'class') return 'classes'
      if (metadata.exportType === 'interface') return 'interfaces'
      if (metadata.exportType === 'type') return 'types'
    }

    // 키워드 기반
    if (item.type === 'keyword') {
      const value = item.value.toLowerCase()
      if (value.includes('hook')) return 'hooks'
      if (value.includes('component')) return 'components'
      if (value.includes('util')) return 'utils'
      if (value.includes('service')) return 'services'
    }

    // 파일 경로 기반
    const path = item.sourcePath.toLowerCase()
    if (path.includes('hook')) return 'hooks'
    if (path.includes('component')) return 'components'
    if (path.includes('util')) return 'utils'
    if (path.includes('service')) return 'services'

    return 'general'
  }

  /**
   * 메서드 이름 추출
   */
  private extractMethodName(item: CollectedDataItem): string {
    if (item.type === 'export' || item.type === 'import' || item.type === 'library-import') {
      // 빈 값인 경우 파일명으로 대체
      if (!item.value || item.value.trim() === '') {
        return basename(item.sourcePath, extname(item.sourcePath))
      }
      
      // TypeScript type import에서 "type " 접두사 제거
      let cleanValue = item.value
      if (cleanValue.startsWith('type ')) {
        cleanValue = cleanValue.substring(5).trim()
      }
      
      return cleanValue
    }

    if (item.type === 'keyword') {
      return item.value
    }

    // 파일 이름에서 추출
    return basename(item.sourcePath, extname(item.sourcePath))
  }

  /**
   * 단순화된 파일 미러링 경로 생성
   */
  private generateSimpleFileMirrorPaths(
    result: NamespaceCollectionResult,
    rootPath: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      let relativePath: string
      
      if (item.type === 'file') {
        // file 타입: value가 이미 상대경로
        relativePath = item.value
      } else {
        // keyword 타입: sourcePath를 상대경로로 변환
        relativePath = relative(process.cwd(), item.sourcePath)
      }
      
      const documentPath = `${rootPath}/${relativePath}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          filePath: relativePath,
          namespace: result.namespace,
          filename: basename(relativePath, extname(relativePath)),
          extension: extname(relativePath).slice(1)
        }
      }
    })
  }

  /**
   * 단순화된 메서드 미러링 경로 생성
   */
  private generateSimpleMethodMirrorPaths(
    result: NamespaceCollectionResult,
    rootPath: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      // 메서드/함수 이름 추출
      const methodName = this.extractMethodName(item)
      const fileName = basename(item.sourcePath, extname(item.sourcePath))
      const documentPath = `${rootPath}/${fileName}/${methodName}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          methodName,
          fileName,
          namespace: result.namespace,
          type: item.type,
          value: item.value,
          sourcePath: item.sourcePath
        }
      }
    })
  }

  /**
   * 단순화된 라이브러리 구조 경로 생성
   */
  private generateSimpleLibraryStructurePaths(
    result: NamespaceCollectionResult,
    rootPath: string,
    libraryName?: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      // library-import 타입인 경우 메타데이터에서 라이브러리 이름 추출
      let library: string
      if (item.type === 'library-import' && item.metadata?.libraryName) {
        library = item.metadata.libraryName
      } else {
        library = libraryName || 'unknown'
      }

      // TypeScript type import 감지 - 간단한 문자열 패턴 매칭
      const isTypeImport = item.metadata?.isTypeImport || item.value.startsWith('type ')
      
      // 메서드 이름에서 "type " 접두사 제거
      let methodName = this.extractMethodName(item)
      if (methodName.startsWith('type ')) {
        methodName = methodName.substring(5).trim()
      }
      
      // 라이브러리 경로 변환 처리
      let libraryPath: string
      
      if (library.startsWith('node:')) {
        // node:fs/promises → node/fs, node:fs → node/fs
        const withoutProtocol = library.substring(5) // 'node:' 제거
        const parts = withoutProtocol.split('/')
        libraryPath = parts.length > 1 ? `node/${parts[0]}` : `node/${withoutProtocol}`
      } else if (library.startsWith('@')) {
        // @scope/package → scope/package
        libraryPath = library.replace('@', '').replace('/', '/')
      } else {
        // 일반 패키지는 그대로
        libraryPath = library
      }
      
      // TypeScript type import인 경우 type/ 폴더에 배치
      let documentPath: string
      if (isTypeImport) {
        documentPath = `${rootPath}/${libraryPath}/type/${methodName}.md`
      } else {
        documentPath = `${rootPath}/${libraryPath}/${methodName}.md`
      }

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          library,
          libraryPath,
          method: methodName,
          namespace: result.namespace,
          type: item.type,
          name: item.value,
          isExternal: item.metadata?.isExternal || false,
          importType: item.metadata?.importType || 'unknown',
          isTypeImport: isTypeImport
        }
      }
    })
  }

  /**
   * 단순화된 네임스페이스 그룹핑 경로 생성
   */
  private generateSimpleNamespaceGroupingPaths(
    result: NamespaceCollectionResult,
    rootPath: string
  ): GeneratedDocumentPath[] {
    return result.items.map(item => {
      const category = this.inferCategory(item)
      const documentPath = `${rootPath}/${result.namespace}/${item.type}/${item.value}.md`

      return {
        namespace: result.namespace,
        documentPath,
        sourceItem: item,
        templateVariables: {
          rootPath,
          namespace: result.namespace,
          type: item.type,
          name: item.value,
          category,
          filename: basename(item.sourcePath, extname(item.sourcePath))
        }
      }
    })
  }

  /**
   * 정규식 이스케이프
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}