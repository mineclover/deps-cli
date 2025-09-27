/**
 * 구조적 매핑 엔진
 * 의존성 분석 결과를 ID 기반 마크다운 시스템으로 변환하는 핵심 엔진
 */

import { readFile } from 'node:fs/promises'
import type { DependencyGraph } from '../types/AnalysisTypes.js'
import {
  CodeRole,
  type DependencyMapping,
  type FileId,
  type FileMetadata,
  type IdMappingTable,
  type MappingSystemState,
  type MarkdownNode,
  type MethodId,
  type MethodMetadata,
  type NodeId,
} from '../types/MappingTypes.js'
import { IdGenerator } from '../utils/IdGenerator.js'
import { IdRegistry } from '../utils/IdRegistry.js'
import { ImprovedIdGenerator } from '../utils/ImprovedIdGenerator.js'
import { LibraryAnalyzer, type LibraryMetadata, type ModuleMetadata } from '../utils/LibraryAnalyzer.js'
import { MarkdownGenerator } from '../utils/MarkdownGenerator.js'
import { MethodAnalyzer } from '../utils/MethodAnalyzer.js'
import { MirrorPathMapper } from '../utils/MirrorPathMapper.js'
import { RoleClassifier } from '../utils/RoleClassifier.js'

export class StructuralMappingEngine {
  private state: MappingSystemState
  private roleClassifier: RoleClassifier
  private idRegistry: IdRegistry
  private pathMapper: MirrorPathMapper

  constructor(projectRoot?: string, docsRoot?: string) {
    this.roleClassifier = new RoleClassifier()
    this.idRegistry = new IdRegistry()
    this.pathMapper = new MirrorPathMapper(projectRoot || process.cwd(), docsRoot || './docs')
    this.state = this.initializeState()
  }

  /**
   * 초기 상태 설정
   */
  private initializeState(): MappingSystemState {
    return {
      initialized: false,
      lastUpdate: new Date(),
      totalNodes: 0,
      mappingTable: {
        files: new Map(),
        methods: new Map(),
        pathToId: new Map(),
        idToPath: new Map(),
        roles: new Map(),
      },
      classificationRules: [],
      generationConfig: {
        outputDirectory: './docs/dependencies',
        templateType: 'detailed',
        includeMetrics: true,
        includeDependencyGraph: true,
        includeSourceCode: false,
        linkStyle: 'id-based',
        frontMatterFormat: 'yaml',
      },
    }
  }

  /**
   * 의존성 그래프를 구조적 매핑으로 변환
   */
  async processDependencyGraph(
    dependencyGraph: DependencyGraph,
    projectPath: string,
    namespace?: string
  ): Promise<MarkdownNode[]> {
    const nodes: MarkdownNode[] = []

    // 1. 파일 노드 생성 (namespace 전달)
    const fileNodes = await this.createFileNodes(dependencyGraph, projectPath, namespace)
    nodes.push(...fileNodes)

    // 2. 메서드 노드 생성 (가벼운 구현)
    const methodNodes = await this.createMethodNodes(dependencyGraph, projectPath)
    nodes.push(...methodNodes)

    // 3. 라이브러리/모듈 노드 생성 (가벼운 구현)
    const libraryNodes = await this.createLibraryNodes(projectPath)
    nodes.push(...libraryNodes)

    // 4. 의존성 관계 매핑
    this.mapDependencyRelations(nodes, dependencyGraph)

    // 5. 매핑 테이블 업데이트
    this.updateMappingTable(nodes)

    // 6. 상태 업데이트
    this.state.totalNodes = nodes.length
    this.state.lastUpdate = new Date()
    this.state.initialized = true

    return nodes
  }

  /**
   * 파일 노드 생성
   */
  private async createFileNodes(
    dependencyGraph: DependencyGraph,
    projectPath: string,
    namespace?: string
  ): Promise<MarkdownNode[]> {
    const fileNodes: MarkdownNode[] = []
    const processedFiles = new Set<string>()

    // 모든 파일 경로 수집 (edges와 entry points에서)
    const allFiles = new Set<string>()

    // Entry points 추가
    for (const entryPoint of dependencyGraph.entryPoints) {
      allFiles.add(entryPoint)
    }

    // Edges에서 파일 추가
    for (const edge of dependencyGraph.edges) {
      allFiles.add(edge.from)
      allFiles.add(edge.to)
    }

    // 각 파일에 대해 노드 생성
    const allFilesArray = Array.from(allFiles)
    for (const filePath of allFilesArray) {
      if (processedFiles.has(filePath)) continue

      try {
        const fileNode = await this.createFileNode(filePath, projectPath, namespace)
        if (fileNode) {
          fileNodes.push(fileNode)
          processedFiles.add(filePath)
        }
      } catch (error) {
        console.warn(`파일 처리 실패: ${filePath}`, error)
      }
    }

    return fileNodes
  }

  /**
   * 메서드 노드 생성 (가벼운 구현)
   */
  private async createMethodNodes(dependencyGraph: DependencyGraph, projectPath: string): Promise<MarkdownNode[]> {
    const methodNodes: MarkdownNode[] = []
    const allFiles = new Set<string>()

    // 모든 파일 경로 수집
    for (const entryPoint of dependencyGraph.entryPoints) {
      allFiles.add(entryPoint)
    }

    for (const edge of dependencyGraph.edges) {
      allFiles.add(edge.from)
      allFiles.add(edge.to)
    }

    // 각 파일에서 메서드 추출
    for (const filePath of allFiles) {
      try {
        // 해당 파일의 FileId 가져오기 (이미 생성된 것 사용)
        const { id: fileId } = this.idRegistry.getOrCreatePredictableFileId(filePath, projectPath)

        // 메서드 분석
        const analysisResult = await MethodAnalyzer.analyzeFile(filePath, fileId)

        // 각 메서드에 대해 MarkdownNode 생성
        for (const methodMetadata of analysisResult.methods) {
          const methodNode = this.createMethodNode(methodMetadata, filePath)
          if (methodNode) {
            methodNodes.push(methodNode)
          }
        }
      } catch (error) {
        console.warn(`메서드 분석 실패: ${filePath}`, error)
      }
    }

    return methodNodes
  }

  /**
   * 라이브러리/모듈 노드 생성 (가벼운 구현)
   */
  private async createLibraryNodes(projectPath: string): Promise<MarkdownNode[]> {
    const libraryNodes: MarkdownNode[] = []

    try {
      // 프로젝트 라이브러리/모듈 분석
      const analysisResult = await LibraryAnalyzer.analyzeProject(projectPath)

      // 라이브러리 노드 생성
      for (const libraryMetadata of analysisResult.libraries) {
        const libraryNode = this.createLibraryNode(libraryMetadata)
        if (libraryNode) {
          libraryNodes.push(libraryNode)
        }
      }

      // 모듈 노드 생성
      for (const moduleMetadata of analysisResult.modules) {
        const moduleNode = this.createModuleNode(moduleMetadata)
        if (moduleNode) {
          libraryNodes.push(moduleNode)
        }
      }

      console.log(
        `📚 라이브러리/모듈 분석 완료: ${analysisResult.libraries.length}개 라이브러리, ${analysisResult.modules.length}개 모듈`
      )

      // 순환 의존성 검사
      const dependencyGraph = LibraryAnalyzer.generateLibraryDependencyGraph(
        analysisResult.libraries,
        analysisResult.modules
      )

      const cycles = LibraryAnalyzer.detectCircularDependencies(dependencyGraph)
      if (cycles.length > 0) {
        console.warn(`⚠️  순환 의존성 발견: ${cycles.length}개`)
        cycles.forEach((cycle, index) => {
          console.warn(`   ${index + 1}. ${cycle.join(' → ')}`)
        })
      }
    } catch (error) {
      console.warn('라이브러리/모듈 분석 실패:', error)
    }

    return libraryNodes
  }

  /**
   * 단일 라이브러리 노드 생성
   */
  private createLibraryNode(libraryMetadata: LibraryMetadata): MarkdownNode | null {
    try {
      // 라이브러리 문서 경로 생성
      const documentPath = this.pathMapper.getLibraryDocumentPath(libraryMetadata.name)

      // 마크다운 노드 생성
      const markdownNode: MarkdownNode = {
        id: libraryMetadata.id as NodeId,
        title: this.generateLibraryTitle(libraryMetadata),
        type: 'file', // 라이브러리도 파일 타입으로 통합 관리
        role: libraryMetadata.role,
        metadata: {
          ...this.createLibraryFileMetadata(libraryMetadata),
          documentPath,
        },
        dependencies: [], // 라이브러리 간 의존성은 별도 처리
        dependents: [],
        content: `// Library: ${libraryMetadata.name} v${libraryMetadata.version || 'unknown'}`,
      }

      return markdownNode
    } catch (error) {
      console.error(`라이브러리 노드 생성 실패: ${libraryMetadata.name}`, error)
      return null
    }
  }

  /**
   * 단일 모듈 노드 생성
   */
  private createModuleNode(moduleMetadata: ModuleMetadata): MarkdownNode | null {
    try {
      // 모듈 문서 경로 생성
      const documentPath = this.pathMapper.getModuleDocumentPath(moduleMetadata.path)

      // 모듈 역할 분류
      const role = this.classifyModuleRole(moduleMetadata)

      // 마크다운 노드 생성
      const markdownNode: MarkdownNode = {
        id: moduleMetadata.id as NodeId,
        title: this.generateModuleTitle(moduleMetadata),
        type: 'file', // 모듈도 파일 타입으로 통합 관리
        role,
        metadata: {
          ...this.createModuleFileMetadata(moduleMetadata),
          documentPath,
        },
        dependencies: [], // 모듈 간 의존성은 별도 처리
        dependents: [],
        content: `// Module: ${moduleMetadata.name} (${moduleMetadata.type})`,
      }

      return markdownNode
    } catch (error) {
      console.error(`모듈 노드 생성 실패: ${moduleMetadata.name}`, error)
      return null
    }
  }

  /**
   * 라이브러리용 FileMetadata 생성
   */
  private createLibraryFileMetadata(libraryMetadata: LibraryMetadata): FileMetadata {
    const now = new Date()

    return {
      id: libraryMetadata.id as FileId,
      path: `library://${libraryMetadata.name}`,
      relativePath: `libraries/${libraryMetadata.name}`,
      role: libraryMetadata.role,
      language: 'Library',
      size: 0, // 가상 크기
      lines: 0, // 가상 라인 수
      lastModified: now,
      hash: IdGenerator.generateContentHash(`library::${libraryMetadata.name}::${libraryMetadata.version}`),
    }
  }

  /**
   * 모듈용 FileMetadata 생성
   */
  private createModuleFileMetadata(moduleMetadata: ModuleMetadata): FileMetadata {
    const now = new Date()

    return {
      id: moduleMetadata.id as FileId,
      path: `module://${moduleMetadata.path}`,
      relativePath: `modules/${moduleMetadata.path}`,
      role: this.classifyModuleRole(moduleMetadata),
      language: moduleMetadata.type.toUpperCase(),
      size: 0, // 가상 크기
      lines: 0, // 가상 라인 수
      lastModified: now,
      hash: IdGenerator.generateContentHash(`module::${moduleMetadata.path}`),
    }
  }

  /**
   * 모듈 역할 분류
   */
  private classifyModuleRole(moduleMetadata: ModuleMetadata): CodeRole {
    const { name, path, isEntry } = moduleMetadata

    // 엔트리 포인트
    if (isEntry || name === 'bin' || path.includes('bin.')) {
      return CodeRole.ENTRY_POINT
    }

    // 타입 정의
    if (path.includes('/types/') || name.includes('types')) {
      return CodeRole.TYPE
    }

    // 유틸리티
    if (path.includes('/utils/') || name.includes('utils')) {
      return CodeRole.UTILITY
    }

    // 설정
    if (path.includes('/config/') || name.includes('config')) {
      return CodeRole.CONFIG
    }

    // 어댑터
    if (path.includes('/adapters/') || name.includes('adapter')) {
      return CodeRole.ADAPTER
    }

    // 테스트
    if (path.includes('/test/') || name.includes('test') || name.includes('spec')) {
      return CodeRole.TEST
    }

    // 기본값
    return CodeRole.SERVICE
  }

  /**
   * 라이브러리 제목 생성
   */
  private generateLibraryTitle(libraryMetadata: LibraryMetadata): string {
    const { name, type, version } = libraryMetadata
    const typeLabel = type === 'internal' ? 'Internal' : type === 'external' ? 'External' : 'Builtin'
    const versionLabel = version ? ` v${version}` : ''

    return `${typeLabel} Library: ${name}${versionLabel}`
  }

  /**
   * 모듈 제목 생성
   */
  private generateModuleTitle(moduleMetadata: ModuleMetadata): string {
    const { name, type, isEntry } = moduleMetadata
    const typeLabel = type.toUpperCase()
    const entryLabel = isEntry ? ' (Entry Point)' : ''

    return `${typeLabel} Module: ${name}${entryLabel}`
  }

  /**
   * 단일 메서드 노드 생성
   */
  private createMethodNode(methodMetadata: MethodMetadata, filePath: string): MarkdownNode | null {
    try {
      // 메서드 역할 분류 (간단한 추론)
      const role = this.classifyMethodRole(methodMetadata)

      // 메서드 문서 경로 생성
      const documentPath = this.pathMapper.getMethodDocumentPath(filePath, methodMetadata.name)

      // 마크다운 노드 생성
      const markdownNode: MarkdownNode = {
        id: methodMetadata.id,
        title: this.generateMethodTitle(methodMetadata),
        type: 'method',
        role,
        metadata: {
          ...methodMetadata,
          documentPath,
        },
        dependencies: [], // 메서드 간 의존성은 현재 단계에서는 구현하지 않음
        dependents: [], // 메서드 간 의존성은 현재 단계에서는 구현하지 않음
        content: `// Method: ${methodMetadata.signature}`, // 가벼운 컨텐츠
      }

      return markdownNode
    } catch (error) {
      console.error(`메서드 노드 생성 실패: ${methodMetadata.name}`, error)
      return null
    }
  }

  /**
   * 메서드 역할 분류 (간단한 추론)
   */
  private classifyMethodRole(methodMetadata: MethodMetadata): CodeRole {
    const { name, type, signature } = methodMetadata

    // 테스트 메서드
    if (name.includes('test') || name.includes('spec') || signature.includes('describe') || signature.includes('it')) {
      return CodeRole.TEST
    }

    // 유틸리티 함수
    if (type === 'function' && methodMetadata.exported) {
      return CodeRole.UTILITY
    }

    // 클래스/인터페이스
    if (type === 'class') {
      return CodeRole.SERVICE // 기본적으로 서비스로 분류
    }

    if (type === 'interface' || type === 'type') {
      return CodeRole.TYPE
    }

    // 기본값
    return CodeRole.SERVICE
  }

  /**
   * 메서드 제목 생성
   */
  private generateMethodTitle(methodMetadata: MethodMetadata): string {
    const { name, type, exported } = methodMetadata
    const exportLabel = exported ? ' (exported)' : ''
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)

    return `${typeLabel}: ${name}${exportLabel}`
  }

  /**
   * 단일 파일 노드 생성
   */
  private async createFileNode(
    filePath: string,
    projectPath: string,
    namespace?: string
  ): Promise<MarkdownNode | null> {
    try {
      // 파일 컨텐츠 읽기
      const content = await readFile(filePath, 'utf-8')
      const stats = await import('node:fs').then((fs) => fs.promises.stat(filePath))

      // 상대 경로 계산
      const relativePath = filePath.replace(projectPath, '').replace(/^\//, '')

      // PredictableIdGenerator를 사용한 예측 가능한 ID 생성
      const { id: fileId, isNew } = this.idRegistry.getOrCreatePredictableFileId(filePath, projectPath, namespace)

      // 파일 메타데이터 생성
      const fileMetadata: FileMetadata = {
        id: fileId,
        path: filePath,
        relativePath,
        role: CodeRole.SERVICE, // 임시, 나중에 분류
        language: this.detectLanguage(filePath),
        size: stats.size,
        lines: content.split('\n').length,
        lastModified: stats.mtime,
        hash: IdGenerator.generateContentHash(content),
      }

      if (isNew) {
        console.log(`  🆕 New predictable ID: ${fileId} for ${relativePath}`)
      } else {
        console.log(`  🔄 Existing predictable ID: ${fileId} for ${relativePath}`)
      }

      // 역할 분류
      fileMetadata.role = this.roleClassifier.classifyFile(fileMetadata, content)

      // MirrorPathMapper를 사용한 문서 경로 매핑
      const documentPath = this.pathMapper.getDocumentPath(filePath)
      const mappingInfo = this.pathMapper.getMappingInfo(filePath)

      // 마크다운 노드 생성
      const markdownNode: MarkdownNode = {
        id: fileMetadata.id,
        title: this.generateFileTitle(fileMetadata),
        type: 'file',
        role: fileMetadata.role,
        metadata: {
          ...fileMetadata,
          documentPath,
          mirrorPath: mappingInfo.relativePath,
        },
        dependencies: [], // 나중에 매핑
        dependents: [], // 나중에 매핑
        content: content, // 옵션에 따라 포함
      }

      return markdownNode
    } catch (error) {
      console.error(`파일 노드 생성 실패: ${filePath}`, error)
      return null
    }
  }

  /**
   * 의존성 관계 매핑
   */
  private mapDependencyRelations(nodes: MarkdownNode[], dependencyGraph: DependencyGraph): void {
    // 파일 경로 → 노드 ID 매핑 테이블 생성
    const pathToNodeMap = new Map<string, MarkdownNode>()
    for (const node of nodes) {
      if (node.type === 'file') {
        const metadata = node.metadata as FileMetadata
        pathToNodeMap.set(metadata.path, node)
      }
    }

    // 의존성 그래프의 edges를 DependencyMapping으로 변환
    for (const edge of dependencyGraph.edges) {
      const fromNode = pathToNodeMap.get(edge.from)
      const toNode = pathToNodeMap.get(edge.to)

      if (fromNode && toNode) {
        // Dependency 생성 (from이 to에 의존)
        const dependency: DependencyMapping = {
          fromId: fromNode.id,
          toId: toNode.id,
          type: 'import',
          importedMembers: edge.importedMembers,
          line: edge.line,
        }

        // 역방향 의존성 (to가 from에 의해 사용됨)
        const dependent: DependencyMapping = {
          fromId: fromNode.id,
          toId: toNode.id,
          type: 'import',
          importedMembers: edge.importedMembers,
          line: edge.line,
        }

        // 관계 추가
        fromNode.dependencies.push(dependency)
        toNode.dependents.push(dependent)
      }
    }
  }

  /**
   * 매핑 테이블 업데이트
   */
  private updateMappingTable(nodes: MarkdownNode[]): void {
    const { mappingTable } = this.state

    // 기존 매핑 초기화
    mappingTable.files.clear()
    mappingTable.methods.clear()
    mappingTable.pathToId.clear()
    mappingTable.idToPath.clear()
    mappingTable.roles.clear()

    // 노드별 매핑 정보 추가
    for (const node of nodes) {
      if (node.type === 'file') {
        const metadata = node.metadata as FileMetadata
        const fileId = node.id as FileId

        mappingTable.files.set(metadata.relativePath, fileId)
        mappingTable.pathToId.set(metadata.relativePath, fileId)
        mappingTable.idToPath.set(fileId, metadata.relativePath)
        mappingTable.roles.set(fileId, node.role)
      } else if (node.type === 'method') {
        const metadata = node.metadata as MethodMetadata
        const methodId = node.id as MethodId

        mappingTable.methods.set(metadata.signature, methodId)
        mappingTable.pathToId.set(metadata.signature, methodId)
        mappingTable.idToPath.set(methodId, metadata.signature)
        mappingTable.roles.set(methodId, node.role)
      }
    }
  }

  /**
   * 마크다운 생성 (ID 레지스트리 전달)
   */
  async generateMarkdown(nodes: MarkdownNode[]): Promise<void> {
    const generator = new MarkdownGenerator(this.state.generationConfig, this.idRegistry)
    await generator.generateProjectMarkdown(nodes)
  }

  /**
   * 파일 제목 생성
   */
  private generateFileTitle(metadata: FileMetadata): string {
    const { relativePath, role } = metadata
    const roleDisplay = RoleClassifier.getRoleDisplayName(role)
    return `${relativePath} (${roleDisplay})`
  }

  /**
   * 언어 감지
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()

    const languageMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      js: 'JavaScript',
      jsx: 'JavaScript React',
      json: 'JSON',
      md: 'Markdown',
      yml: 'YAML',
      yaml: 'YAML',
      toml: 'TOML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'Less',
      html: 'HTML',
      vue: 'Vue',
      svelte: 'Svelte',
    }

    return languageMap[ext || ''] || 'Unknown'
  }

  /**
   * 매핑 시스템 상태 반환
   */
  getState(): MappingSystemState {
    return { ...this.state }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<typeof this.state.generationConfig>): void {
    this.state.generationConfig = {
      ...this.state.generationConfig,
      ...config,
    }
  }

  /**
   * ID로 노드 조회
   */
  getNodeById(nodeId: NodeId, nodes: MarkdownNode[]): MarkdownNode | undefined {
    return nodes.find((node) => node.id === nodeId)
  }

  /**
   * 역할별 노드 필터링
   */
  getNodesByRole(role: CodeRole, nodes: MarkdownNode[]): MarkdownNode[] {
    return nodes.filter((node) => node.role === role)
  }

  /**
   * 의존성 통계 생성
   */
  generateDependencyStatistics(nodes: MarkdownNode[]): {
    totalNodes: number
    totalDependencies: number
    roleStatistics: Map<CodeRole, number>
    averageDependencies: number
    averageDependents: number
  } {
    const roleStats = new Map<CodeRole, number>()
    let totalDependencies = 0
    let totalDependents = 0

    for (const node of nodes) {
      // 역할별 통계
      roleStats.set(node.role, (roleStats.get(node.role) || 0) + 1)

      // 의존성 통계
      totalDependencies += node.dependencies.length
      totalDependents += node.dependents.length
    }

    return {
      totalNodes: nodes.length,
      totalDependencies,
      roleStatistics: roleStats,
      averageDependencies: nodes.length > 0 ? totalDependencies / nodes.length : 0,
      averageDependents: nodes.length > 0 ? totalDependents / nodes.length : 0,
    }
  }

  /**
   * 매핑 무결성 검증
   */
  verifyMappingIntegrity(nodes: MarkdownNode[]): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    // ID 중복 검사
    const idCounts = new Map<string, number>()
    for (const node of nodes) {
      idCounts.set(node.id, (idCounts.get(node.id) || 0) + 1)
    }

    idCounts.forEach((count, id) => {
      if (count > 1) {
        errors.push(`중복된 ID 발견: ${id} (${count}개)`)
      }
    })

    // 의존성 참조 무결성 검사
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        if (!nodeIds.has(dep.toId)) {
          warnings.push(`${node.id}의 의존성 참조 오류: ${dep.toId} 노드가 존재하지 않음`)
        }
      }

      for (const dep of node.dependents) {
        if (!nodeIds.has(dep.fromId)) {
          warnings.push(`${node.id}의 의존자 참조 오류: ${dep.fromId} 노드가 존재하지 않음`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
