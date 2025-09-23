/**
 * 통합 의존성 분석기 - 모든 파일 타입의 의존성을 분류하여 통합된 데이터 포맷으로 저장
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import {
  TestDependencyAnalyzer,
  type TestAnalysisResult
} from './TestDependencyAnalyzer.js'
import {
  DocumentDependencyAnalyzer,
  type DocumentAnalysisResult
} from './DocumentDependencyAnalyzer.js'
import {
  CodeDependencyAnalyzer,
  type CodeAnalysisResult
} from './CodeDependencyAnalyzer.js'
import type {
  DependencyGraph,
  DependencyNode,
  DependencyReport,
  AnalysisConfig,
  ClassifiedDependency,
  NodeType,
  StorageOptions
} from '../types/DependencyClassification.js'

export interface UnifiedAnalysisResult {
  graph: DependencyGraph
  report: DependencyReport
  nodesByType: Map<NodeType, DependencyNode[]>
  analysisMetadata: {
    startTime: Date
    endTime: Date
    duration: number
    filesProcessed: number
    errorsCount: number
    warnings: string[]
  }
}

export class UnifiedDependencyAnalyzer {
  private testAnalyzer: TestDependencyAnalyzer
  private documentAnalyzer: DocumentDependencyAnalyzer
  private codeAnalyzer: CodeDependencyAnalyzer

  constructor(private projectRoot: string) {
    this.testAnalyzer = new TestDependencyAnalyzer()
    this.documentAnalyzer = new DocumentDependencyAnalyzer()
    this.codeAnalyzer = new CodeDependencyAnalyzer(projectRoot)
  }

  async analyzeProject(files: string[]): Promise<UnifiedAnalysisResult> {
    const startTime = new Date()
    const warnings: string[] = []
    let errorsCount = 0

    // 파일 타입별 그룹화
    const fileGroups = this.groupFilesByType(files)

    // 노드 맵 초기화
    const nodes = new Map<string, DependencyNode>()

    // 각 파일 타입별 병렬 분석
    const [testResults, docResults, codeResults] = await Promise.all([
      this.analyzeTestFiles(fileGroups.test, nodes, warnings),
      this.analyzeDocumentFiles(fileGroups.docs, nodes, warnings),
      this.analyzeCodeFiles(fileGroups.code, nodes, warnings)
    ])

    // 라이브러리 노드들 추가 (외부 의존성)
    this.addLibraryNodes(nodes, codeResults, testResults)

    // 의존성 그래프 구성
    const graph = this.buildDependencyGraph(nodes)

    // 분석 보고서 생성
    const report = this.generateReport(testResults, docResults, codeResults, graph)

    // 노드 타입별 분류
    const nodesByType = this.groupNodesByType(nodes)

    const endTime = new Date()

    return {
      graph,
      report,
      nodesByType,
      analysisMetadata: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        filesProcessed: files.length,
        errorsCount,
        warnings
      }
    }
  }

  private groupFilesByType(files: string[]): {
    test: string[]
    docs: string[]
    code: string[]
    library: string[]
  } {
    const groups = {
      test: [] as string[],
      docs: [] as string[],
      code: [] as string[],
      library: [] as string[]
    }

    for (const file of files) {
      const nodeType = this.getNodeType(file)
      switch (nodeType) {
        case 'test':
          groups.test.push(file)
          break
        case 'docs':
          groups.docs.push(file)
          break
        case 'code':
          groups.code.push(file)
          break
        case 'library':
          groups.library.push(file)
          break
      }
    }

    return groups
  }

  private getNodeType(filePath: string): NodeType {
    const normalizedPath = filePath.toLowerCase()

    // 테스트 파일
    if (
      normalizedPath.includes('.test.') ||
      normalizedPath.includes('.spec.') ||
      normalizedPath.includes('/__tests__/') ||
      normalizedPath.includes('/test/') ||
      normalizedPath.includes('/tests/')
    ) {
      return 'test'
    }

    // 문서 파일
    if (
      normalizedPath.endsWith('.md') ||
      normalizedPath.endsWith('.markdown') ||
      normalizedPath.endsWith('.rst') ||
      normalizedPath.endsWith('.txt')
    ) {
      return 'docs'
    }

    // 라이브러리 파일 (node_modules)
    if (normalizedPath.includes('node_modules')) {
      return 'library'
    }

    // 코드 파일
    if (
      normalizedPath.endsWith('.ts') ||
      normalizedPath.endsWith('.tsx') ||
      normalizedPath.endsWith('.js') ||
      normalizedPath.endsWith('.jsx') ||
      normalizedPath.endsWith('.vue') ||
      normalizedPath.endsWith('.svelte')
    ) {
      return 'code'
    }

    return 'code' // 기본값
  }

  private async analyzeTestFiles(
    testFiles: string[],
    nodes: Map<string, DependencyNode>,
    warnings: string[]
  ): Promise<Map<string, TestAnalysisResult>> {
    const testResults = new Map<string, TestAnalysisResult>()

    for (const testFile of testFiles) {
      try {
        const result = await this.testAnalyzer.analyzeTestFile(testFile)
        testResults.set(testFile, result)

        // 노드 생성
        const node = this.createTestNode(testFile, result)
        nodes.set(testFile, node)
      } catch (error) {
        warnings.push(`테스트 파일 분석 실패: ${testFile} - ${error}`)
      }
    }

    return testResults
  }

  private async analyzeDocumentFiles(
    docFiles: string[],
    nodes: Map<string, DependencyNode>,
    warnings: string[]
  ): Promise<Map<string, DocumentAnalysisResult>> {
    const docResults = new Map<string, DocumentAnalysisResult>()

    for (const docFile of docFiles) {
      try {
        const result = await this.documentAnalyzer.analyzeDocumentFile(docFile)
        docResults.set(docFile, result)

        // 노드 생성
        const node = this.createDocumentNode(docFile, result)
        nodes.set(docFile, node)
      } catch (error) {
        warnings.push(`문서 파일 분석 실패: ${docFile} - ${error}`)
      }
    }

    return docResults
  }

  private async analyzeCodeFiles(
    codeFiles: string[],
    nodes: Map<string, DependencyNode>,
    warnings: string[]
  ): Promise<Map<string, CodeAnalysisResult>> {
    const codeResults = new Map<string, CodeAnalysisResult>()

    for (const codeFile of codeFiles) {
      try {
        const result = await this.codeAnalyzer.analyzeCodeFile(codeFile)
        codeResults.set(codeFile, result)

        // 노드 생성
        const node = this.createCodeNode(codeFile, result)
        nodes.set(codeFile, node)
      } catch (error) {
        warnings.push(`코드 파일 분석 실패: ${codeFile} - ${error}`)
      }
    }

    return codeResults
  }

  private addLibraryNodes(
    nodes: Map<string, DependencyNode>,
    codeResults: Map<string, CodeAnalysisResult>,
    testResults: Map<string, TestAnalysisResult>
  ): void {
    const libraryNodes = new Set<string>()

    // 코드에서 사용된 외부 라이브러리
    for (const result of codeResults.values()) {
      for (const lib of result.externalLibraries) {
        libraryNodes.add(lib.source)
      }
    }

    // 테스트에서 사용된 유틸리티
    for (const result of testResults.values()) {
      for (const util of result.testUtilities) {
        if (!util.source.startsWith('./') && !util.source.startsWith('../')) {
          libraryNodes.add(util.source)
        }
      }
    }

    // 라이브러리 노드 생성
    for (const libName of libraryNodes) {
      if (!nodes.has(libName)) {
        const node = this.createLibraryNode(libName)
        nodes.set(libName, node)
      }
    }
  }

  private createTestNode(filePath: string, result: TestAnalysisResult): DependencyNode {
    const allDependencies: ClassifiedDependency[] = [
      ...result.testTargets,
      ...result.testUtilities,
      ...result.testSetup
    ]

    return {
      filePath,
      nodeType: 'test',
      relativePath: path.relative(this.projectRoot, filePath),
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath),
      language: 'typescript',
      framework: result.testMetadata.framework,
      metadata: {
        testCoverage: 1.0 // 테스트 파일 자체는 100% 커버리지
      },
      dependencies: allDependencies,
      dependents: [],
      clusters: this.assignClusters(filePath, 'test'),
      analysis: {
        totalDependencies: allDependencies.length,
        internalDependencies: result.testTargets.length,
        externalDependencies: result.testUtilities.length,
        cyclicDependencies: [],
        riskFactors: this.calculateTestRiskFactors(result)
      }
    }
  }

  private createDocumentNode(filePath: string, result: DocumentAnalysisResult): DependencyNode {
    const allDependencies: ClassifiedDependency[] = [
      ...result.documentReferences,
      ...result.externalLinks,
      ...result.assetReferences
    ]

    return {
      filePath,
      nodeType: 'docs',
      relativePath: path.relative(this.projectRoot, filePath),
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath),
      language: result.documentMetadata.language,
      metadata: {
        documentation: result.documentMetadata.wordCount > 100 ? 0.8 : 0.4
      },
      dependencies: allDependencies,
      dependents: [],
      clusters: this.assignClusters(filePath, 'docs'),
      analysis: {
        totalDependencies: allDependencies.length,
        internalDependencies: result.documentReferences.length,
        externalDependencies: result.externalLinks.length,
        cyclicDependencies: [],
        riskFactors: this.calculateDocumentRiskFactors(result)
      }
    }
  }

  private createCodeNode(filePath: string, result: CodeAnalysisResult): DependencyNode {
    const allDependencies: ClassifiedDependency[] = [
      ...result.internalModules,
      ...result.externalLibraries,
      ...result.builtinModules
    ]

    return {
      filePath,
      nodeType: 'code',
      relativePath: path.relative(this.projectRoot, filePath),
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath),
      language: result.codeMetadata.language,
      framework: result.codeMetadata.framework,
      metadata: {
        complexity: result.codeMetadata.complexity / 10, // 정규화
        maintainability: this.calculateMaintainability(result)
      },
      dependencies: allDependencies,
      dependents: [],
      clusters: this.assignClusters(filePath, 'code'),
      analysis: {
        totalDependencies: allDependencies.length,
        internalDependencies: result.internalModules.length,
        externalDependencies: result.externalLibraries.length + result.builtinModules.length,
        cyclicDependencies: result.codeMetadata.circularDependencies,
        riskFactors: this.calculateCodeRiskFactors(result)
      }
    }
  }

  private createLibraryNode(libName: string): DependencyNode {
    return {
      filePath: libName,
      nodeType: 'library',
      relativePath: libName,
      size: 0,
      lastModified: new Date(),
      language: 'unknown',
      metadata: {},
      dependencies: [],
      dependents: [],
      clusters: ['external'],
      analysis: {
        totalDependencies: 0,
        internalDependencies: 0,
        externalDependencies: 0,
        cyclicDependencies: [],
        riskFactors: []
      }
    }
  }

  private buildDependencyGraph(nodes: Map<string, DependencyNode>): DependencyGraph {
    const edges: DependencyGraph['edges'] = []

    // 의존성 관계를 엣지로 변환
    for (const [filePath, node] of nodes.entries()) {
      for (const dep of node.dependencies) {
        const targetPath = dep.resolvedPath || dep.source

        if (nodes.has(targetPath)) {
          edges.push({
            from: filePath,
            to: targetPath,
            dependency: dep,
            weight: dep.confidence
          })

          // 역방향 dependents 관계 설정
          const targetNode = nodes.get(targetPath)!
          if (!targetNode.dependents.includes(filePath)) {
            targetNode.dependents.push(filePath)
          }
        }
      }
    }

    // 클러스터 정보 생성
    const clusters = this.generateClusters(nodes)

    return {
      projectRoot: this.projectRoot,
      timestamp: new Date(),
      version: '1.0.0',
      nodes,
      edges,
      metrics: this.calculateGraphMetrics(nodes, edges),
      clusters
    }
  }

  private generateClusters(nodes: Map<string, DependencyNode>): DependencyGraph['clusters'] {
    const clusters = new Map<string, DependencyGraph['clusters'][string]>()

    // 디렉토리 기반 클러스터링
    for (const [filePath, node] of nodes.entries()) {
      if (node.nodeType !== 'library') {
        const dirPath = path.dirname(node.relativePath)
        const clusterName = dirPath.split('/')[0] || 'root'

        if (!clusters.has(clusterName)) {
          clusters.set(clusterName, {
            name: clusterName,
            files: [],
            type: this.inferClusterType(clusterName),
            cohesion: 0,
            coupling: 0
          })
        }

        clusters.get(clusterName)!.files.push(filePath)
      }
    }

    // 응집도/결합도 계산
    for (const cluster of clusters.values()) {
      const metrics = this.calculateClusterMetrics(cluster, nodes)
      cluster.cohesion = metrics.cohesion
      cluster.coupling = metrics.coupling
    }

    return clusters
  }

  private inferClusterType(clusterName: string): 'feature' | 'layer' | 'domain' | 'infrastructure' {
    const featurePatterns = ['components', 'pages', 'features']
    const layerPatterns = ['services', 'utils', 'helpers', 'config']
    const domainPatterns = ['models', 'entities', 'domain']
    const infraPatterns = ['infrastructure', 'adapters', 'providers']

    if (featurePatterns.some(p => clusterName.includes(p))) return 'feature'
    if (layerPatterns.some(p => clusterName.includes(p))) return 'layer'
    if (domainPatterns.some(p => clusterName.includes(p))) return 'domain'
    if (infraPatterns.some(p => clusterName.includes(p))) return 'infrastructure'

    return 'feature'
  }

  private calculateClusterMetrics(
    cluster: DependencyGraph['clusters'][string],
    nodes: Map<string, DependencyNode>
  ): { cohesion: number; coupling: number } {
    const clusterFiles = new Set(cluster.files)
    let internalEdges = 0
    let externalEdges = 0

    for (const filePath of cluster.files) {
      const node = nodes.get(filePath)
      if (!node) continue

      for (const dep of node.dependencies) {
        const targetPath = dep.resolvedPath || dep.source
        if (clusterFiles.has(targetPath)) {
          internalEdges++
        } else {
          externalEdges++
        }
      }
    }

    const totalEdges = internalEdges + externalEdges
    const cohesion = totalEdges > 0 ? internalEdges / totalEdges : 0
    const coupling = totalEdges > 0 ? externalEdges / totalEdges : 0

    return { cohesion, coupling }
  }

  private calculateGraphMetrics(
    nodes: Map<string, DependencyNode>,
    edges: DependencyGraph['edges']
  ): DependencyGraph['metrics'] {
    const totalDeps = Array.from(nodes.values()).reduce((sum, node) => sum + node.analysis.totalDependencies, 0)
    const cyclicDepCount = Array.from(nodes.values()).reduce((sum, node) => sum + node.analysis.cyclicDependencies.length, 0)
    const isolatedFiles = Array.from(nodes.values()).filter(node =>
      node.dependencies.length === 0 && node.dependents.length === 0
    ).length

    return {
      totalFiles: nodes.size,
      totalDependencies: totalDeps,
      averageDependenciesPerFile: totalDeps / nodes.size,
      cyclicDependencyCount: cyclicDepCount,
      isolatedFileCount: isolatedFiles,
      maxDepth: this.calculateMaxDepth(nodes)
    }
  }

  private calculateMaxDepth(nodes: Map<string, DependencyNode>): number {
    // DFS를 통한 최대 깊이 계산
    const visited = new Set<string>()
    let maxDepth = 0

    const dfs = (nodeKey: string, depth: number): number => {
      if (visited.has(nodeKey)) return depth
      visited.add(nodeKey)

      const node = nodes.get(nodeKey)
      if (!node) return depth

      let currentMaxDepth = depth
      for (const dep of node.dependencies) {
        const targetPath = dep.resolvedPath || dep.source
        if (nodes.has(targetPath)) {
          currentMaxDepth = Math.max(currentMaxDepth, dfs(targetPath, depth + 1))
        }
      }

      return currentMaxDepth
    }

    for (const nodeKey of nodes.keys()) {
      if (!visited.has(nodeKey)) {
        maxDepth = Math.max(maxDepth, dfs(nodeKey, 0))
      }
    }

    return maxDepth
  }

  private generateReport(
    testResults: Map<string, TestAnalysisResult>,
    docResults: Map<string, DocumentAnalysisResult>,
    codeResults: Map<string, CodeAnalysisResult>,
    graph: DependencyGraph
  ): DependencyReport {
    // 테스트 분석
    const testAnalysis = this.generateTestAnalysis(testResults, codeResults)

    // 코드 분석
    const codeAnalysis = this.generateCodeAnalysis(codeResults)

    // 문서 분석
    const documentationAnalysis = this.generateDocumentationAnalysis(docResults)

    // 추천사항 생성
    const recommendations = this.generateRecommendations(testAnalysis, codeAnalysis, documentationAnalysis)

    return {
      summary: {
        projectName: path.basename(this.projectRoot),
        analysisDate: new Date(),
        fileTypes: {
          test: testResults.size,
          code: codeResults.size,
          docs: docResults.size,
          library: Array.from(graph.nodes.values()).filter(n => n.nodeType === 'library').length
        },
        dependencyTypes: this.calculateDependencyTypeCounts(graph)
      },
      testAnalysis,
      codeAnalysis,
      documentationAnalysis,
      recommendations
    }
  }

  // Helper methods...
  private assignClusters(filePath: string, nodeType: NodeType): string[] {
    const relativePath = path.relative(this.projectRoot, filePath)
    const parts = relativePath.split(path.sep)
    return [parts[0] || 'root', nodeType]
  }

  private calculateTestRiskFactors(result: TestAnalysisResult): string[] {
    const risks: string[] = []
    if (result.testMetadata.mockCount > 5) risks.push('heavy-mocking')
    if (result.testMetadata.assertionCount < 3) risks.push('insufficient-assertions')
    return risks
  }

  private calculateDocumentRiskFactors(result: DocumentAnalysisResult): string[] {
    const risks: string[] = []
    if (result.documentMetadata.brokenLinks > 0) risks.push('broken-links')
    if (result.documentMetadata.wordCount < 50) risks.push('insufficient-documentation')
    return risks
  }

  private calculateCodeRiskFactors(result: CodeAnalysisResult): string[] {
    const risks: string[] = []
    if (result.codeMetadata.complexity > 10) risks.push('high-complexity')
    if (result.codeMetadata.circularDependencies.length > 0) risks.push('circular-dependencies')
    return risks
  }

  private calculateMaintainability(result: CodeAnalysisResult): number {
    // 간단한 유지보수성 점수 계산
    let score = 1.0
    if (result.codeMetadata.complexity > 10) score -= 0.3
    if (result.codeMetadata.linesOfCode > 300) score -= 0.2
    if (result.externalLibraries.length > 20) score -= 0.1
    return Math.max(score, 0)
  }

  // 더 많은 helper methods 필요...
  private generateTestAnalysis(testResults: Map<string, TestAnalysisResult>, codeResults: Map<string, CodeAnalysisResult>) {
    // 테스트 분석 로직...
    const testedFiles = new Set<string>()

    for (const result of testResults.values()) {
      result.testTargets.forEach(target => {
        if (target.resolvedPath) {
          testedFiles.add(target.resolvedPath)
        }
      })
    }

    const codeFiles = Array.from(codeResults.keys())
    const uncoveredFiles = codeFiles.filter(file => !testedFiles.has(file))

    return {
      testFiles: testResults.size,
      testedFiles: testedFiles.size,
      testCoverage: testedFiles.size / codeFiles.length,
      uncoveredFiles,
      testDependencyGraph: new Map() // TODO: 구현
    }
  }

  private generateCodeAnalysis(codeResults: Map<string, CodeAnalysisResult>) {
    // 코드 분석 로직...
    const internalModules = Array.from(codeResults.values()).reduce((sum, r) => sum + r.internalModules.length, 0)
    const externalLibraries = Array.from(codeResults.values()).reduce((sum, r) => sum + r.externalLibraries.length, 0)

    return {
      internalModules,
      externalLibraries,
      circularDependencies: [],
      heaviestDependencies: [],
      isolatedFiles: []
    }
  }

  private generateDocumentationAnalysis(docResults: Map<string, DocumentAnalysisResult>) {
    // 문서 분석 로직...
    return {
      documentFiles: docResults.size,
      brokenLinks: [],
      orphanedDocs: [],
      documentationGraph: new Map()
    }
  }

  private generateRecommendations(testAnalysis: any, codeAnalysis: any, documentationAnalysis: any) {
    // 추천사항 생성 로직...
    return []
  }

  private calculateDependencyTypeCounts(graph: DependencyGraph) {
    // 의존성 타입별 개수 계산...
    return {} as any
  }

  private groupNodesByType(nodes: Map<string, DependencyNode>): Map<NodeType, DependencyNode[]> {
    const nodesByType = new Map<NodeType, DependencyNode[]>()

    // 각 노드 타입별로 빈 배열 초기화
    const nodeTypes: NodeType[] = ['test', 'code', 'docs', 'library']
    for (const nodeType of nodeTypes) {
      nodesByType.set(nodeType, [])
    }

    // 노드들을 타입별로 분류
    for (const node of nodes.values()) {
      const typeArray = nodesByType.get(node.nodeType)
      if (typeArray) {
        typeArray.push(node)
      }
    }

    return nodesByType
  }

  private getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size
    } catch {
      return 0
    }
  }

  private getLastModified(filePath: string): Date {
    try {
      return fs.statSync(filePath).mtime
    } catch {
      return new Date()
    }
  }

  // 저장 관련 메서드들
  async save(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    const storage = new DependencyStorageManager(this.projectRoot)
    await storage.save(result, options)
  }
}

// 저장 관리자
class DependencyStorageManager {
  constructor(private projectRoot: string) {}

  async save(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    switch (options.format) {
      case 'json':
        await this.saveAsJSON(result, options)
        break
      case 'sqlite':
        await this.saveAsSQLite(result, options)
        break
      case 'neo4j':
        await this.saveAsNeo4j(result, options)
        break
      case 'graphml':
        await this.saveAsGraphML(result, options)
        break
    }
  }

  private async saveAsJSON(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    const outputDir = path.join(this.projectRoot, '.deps-analysis')
    await fs.promises.mkdir(outputDir, { recursive: true })

    // 그래프 저장
    const graphData = this.serializeGraph(result.graph, options)
    await fs.promises.writeFile(
      path.join(outputDir, 'dependency-graph.json'),
      JSON.stringify(graphData, null, 2)
    )

    // 보고서 저장
    await fs.promises.writeFile(
      path.join(outputDir, 'analysis-report.json'),
      JSON.stringify(result.report, null, 2)
    )

    // 타입별 노드 저장
    for (const [nodeType, nodes] of result.nodesByType.entries()) {
      await fs.promises.writeFile(
        path.join(outputDir, `nodes-${nodeType}.json`),
        JSON.stringify(nodes, null, 2)
      )
    }
  }

  private serializeGraph(graph: DependencyGraph, options: StorageOptions): any {
    const serialized: any = {
      projectRoot: graph.projectRoot,
      timestamp: graph.timestamp,
      version: graph.version,
      metrics: graph.metrics,
      clusters: Object.fromEntries(graph.clusters),
      nodes: {},
      edges: graph.edges
    }

    // 노드 직렬화
    for (const [key, node] of graph.nodes.entries()) {
      serialized.nodes[key] = {
        ...node,
        dependencies: options.includeSourceCode ? node.dependencies : node.dependencies.map(dep => ({
          ...dep,
          // 소스 코드 제외하고 메타데이터만 포함
        }))
      }
    }

    return serialized
  }

  private async saveAsSQLite(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    // SQLite 저장 로직 (추후 구현)
    throw new Error('SQLite storage not implemented yet')
  }

  private async saveAsNeo4j(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    // Neo4j 저장 로직 (추후 구현)
    throw new Error('Neo4j storage not implemented yet')
  }

  private async saveAsGraphML(result: UnifiedAnalysisResult, options: StorageOptions): Promise<void> {
    // GraphML 저장 로직 (추후 구현)
    throw new Error('GraphML storage not implemented yet')
  }
}