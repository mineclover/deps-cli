/**
 * 참조 관계용 메타데이터 추출기
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import { IdGenerator } from '../utils/IdGenerator.js'
import type {
  FileMetadata,
  DependencyReference,
  ProjectReferenceData,
  FileType,
  DependencyCategory
} from '../types/ReferenceMetadata.js'
import type { UnifiedAnalysisResult } from './UnifiedDependencyAnalyzer.js'
import type { DependencyNode, ClassifiedDependency } from '../types/DependencyClassification.js'

export class MetadataExtractor {
  private idGenerator: IdGenerator
  private fileIdMap = new Map<string, string>() // filePath -> fileId 매핑

  constructor(
    private projectRoot: string,
    idGenerator?: IdGenerator
  ) {
    this.idGenerator = idGenerator || new IdGenerator({
      strategy: 'path-based',
      prefix: 'file'
    })
  }

  /**
   * 통합 분석 결과에서 참조 메타데이터 추출
   */
  extractMetadata(analysisResult: UnifiedAnalysisResult): ProjectReferenceData {
    // 1단계: 모든 파일의 ID 먼저 생성
    this.generateFileIds(analysisResult)

    // 2단계: 파일 메타데이터 추출
    const files = this.extractFileMetadata(analysisResult)

    // 3단계: 참조 관계 그래프 구성
    const referenceGraph = this.buildReferenceGraph(files)

    // 4단계: 통계 정보 계산
    const statistics = this.calculateStatistics(files)

    return {
      project: {
        root: this.projectRoot,
        name: path.basename(this.projectRoot),
        analyzedAt: new Date(),
        version: '1.0.0'
      },
      files,
      statistics,
      referenceGraph
    }
  }

  /**
   * 모든 파일의 고유 ID 생성
   */
  private generateFileIds(analysisResult: UnifiedAnalysisResult): void {
    this.idGenerator.reset()
    this.fileIdMap.clear()

    // 모든 노드에 대해 ID 생성
    for (const [filePath, node] of analysisResult.graph.nodes.entries()) {
      if (node.nodeType !== 'library') { // 라이브러리 노드는 제외
        const fileId = this.idGenerator.generateFileId(filePath, this.projectRoot)
        this.fileIdMap.set(filePath, fileId)
      }
    }
  }

  /**
   * 파일 메타데이터 추출
   */
  private extractFileMetadata(analysisResult: UnifiedAnalysisResult): FileMetadata[] {
    const files: FileMetadata[] = []

    for (const [filePath, node] of analysisResult.graph.nodes.entries()) {
      if (node.nodeType === 'library') continue // 라이브러리 노드는 제외

      const fileMetadata = this.extractSingleFileMetadata(filePath, node)
      files.push(fileMetadata)
    }

    return files
  }

  /**
   * 단일 파일 메타데이터 추출
   */
  private extractSingleFileMetadata(filePath: string, node: DependencyNode): FileMetadata {
    const fileId = this.fileIdMap.get(filePath)!
    const dependencies = this.categorizeDependencies(node.dependencies)

    return {
      fileId,
      filePath,
      relativePath: node.relativePath,
      fileType: this.mapNodeTypeToFileType(node.nodeType),
      language: node.language,
      size: node.size,
      lastModified: node.lastModified,
      complexity: this.extractComplexity(node),
      maintainability: this.extractMaintainability(node),
      dependencies,
      dependents: node.dependents.map(dep => this.fileIdMap.get(dep)).filter(Boolean) as string[],
      metadata: {
        framework: node.framework,
        testCoverage: this.extractTestCoverage(node),
        documentation: this.extractDocumentation(node),
        riskFactors: node.analysis.riskFactors,
        clusters: node.clusters
      }
    }
  }

  /**
   * 의존성을 카테고리별로 분류
   */
  private categorizeDependencies(dependencies: ClassifiedDependency[]): FileMetadata['dependencies'] {
    const categorized: FileMetadata['dependencies'] = {
      internal: [],
      external: [],
      builtin: []
    }

    for (const dep of dependencies) {
      const depRef = this.createDependencyReference(dep)

      switch (dep.type) {
        case 'internal-module':
          categorized.internal.push(depRef)
          break

        case 'external-library':
          categorized.external.push(depRef)
          break

        case 'builtin-module':
          categorized.builtin.push(depRef)
          break

        case 'test-target':
        case 'test-utility':
        case 'test-setup':
          if (!categorized.test) {
            categorized.test = { targets: [], utilities: [], setup: [] }
          }

          if (dep.type === 'test-target') {
            categorized.test.targets.push(depRef)
          } else if (dep.type === 'test-utility') {
            categorized.test.utilities.push(depRef)
          } else if (dep.type === 'test-setup') {
            categorized.test.setup.push(depRef)
          }
          break

        case 'doc-reference':
        case 'doc-link':
        case 'doc-asset':
          if (!categorized.docs) {
            categorized.docs = { references: [], links: [], assets: [] }
          }

          if (dep.type === 'doc-reference') {
            categorized.docs.references.push(depRef)
          } else if (dep.type === 'doc-link') {
            categorized.docs.links.push(depRef)
          } else if (dep.type === 'doc-asset') {
            categorized.docs.assets.push(depRef)
          }
          break
      }
    }

    return categorized
  }

  /**
   * 의존성 참조 객체 생성
   */
  private createDependencyReference(dep: ClassifiedDependency): DependencyReference {
    // 타겟 파일 ID 결정 (internal 의존성인 경우)
    let targetFileId: string | undefined
    if (dep.resolvedPath && this.fileIdMap.has(dep.resolvedPath)) {
      targetFileId = this.fileIdMap.get(dep.resolvedPath)
    }

    return {
      source: dep.source,
      resolvedPath: dep.resolvedPath,
      category: this.mapTypeToCategory(dep.type),
      type: dep.type,
      line: dep.line,
      confidence: dep.confidence,
      isTypeOnly: 'isTypeOnly' in dep ? dep.isTypeOnly : false,
      targetFileId
    }
  }

  /**
   * 참조 관계 그래프 구성
   */
  private buildReferenceGraph(files: FileMetadata[]): ProjectReferenceData['referenceGraph'] {
    const edges: ProjectReferenceData['referenceGraph']['edges'] = []

    for (const file of files) {
      // internal 의존성에 대해서만 엣지 생성
      for (const dep of file.dependencies.internal) {
        if (dep.targetFileId) {
          edges.push({
            from: file.fileId,
            to: dep.targetFileId,
            dependency: dep,
            weight: dep.confidence
          })
        }
      }

      // 테스트 타겟에 대해서도 엣지 생성
      if (file.dependencies.test) {
        for (const dep of file.dependencies.test.targets) {
          if (dep.targetFileId) {
            edges.push({
              from: file.fileId,
              to: dep.targetFileId,
              dependency: dep,
              weight: dep.confidence
            })
          }
        }
      }

      // 문서 참조에 대해서도 엣지 생성
      if (file.dependencies.docs) {
        for (const dep of file.dependencies.docs.references) {
          if (dep.targetFileId) {
            edges.push({
              from: file.fileId,
              to: dep.targetFileId,
              dependency: dep,
              weight: dep.confidence
            })
          }
        }
      }
    }

    return { edges }
  }

  /**
   * 통계 정보 계산
   */
  private calculateStatistics(files: FileMetadata[]): ProjectReferenceData['statistics'] {
    const filesByType: Record<FileType, number> = {
      code: 0,
      test: 0,
      docs: 0
    }

    const dependenciesByCategory: Record<DependencyCategory, number> = {
      internal: 0,
      external: 0,
      builtin: 0,
      'test-utility': 0,
      'test-setup': 0,
      'doc-reference': 0,
      'doc-link': 0,
      'doc-asset': 0
    }

    let totalDependencies = 0

    for (const file of files) {
      filesByType[file.fileType]++

      // 의존성 개수 집계
      totalDependencies += file.dependencies.internal.length
      totalDependencies += file.dependencies.external.length
      totalDependencies += file.dependencies.builtin.length

      dependenciesByCategory.internal += file.dependencies.internal.length
      dependenciesByCategory.external += file.dependencies.external.length
      dependenciesByCategory.builtin += file.dependencies.builtin.length

      if (file.dependencies.test) {
        const testDeps = file.dependencies.test.targets.length +
                        file.dependencies.test.utilities.length +
                        file.dependencies.test.setup.length
        totalDependencies += testDeps

        dependenciesByCategory['test-utility'] += file.dependencies.test.utilities.length
        dependenciesByCategory['test-setup'] += file.dependencies.test.setup.length
      }

      if (file.dependencies.docs) {
        const docDeps = file.dependencies.docs.references.length +
                       file.dependencies.docs.links.length +
                       file.dependencies.docs.assets.length
        totalDependencies += docDeps

        dependenciesByCategory['doc-reference'] += file.dependencies.docs.references.length
        dependenciesByCategory['doc-link'] += file.dependencies.docs.links.length
        dependenciesByCategory['doc-asset'] += file.dependencies.docs.assets.length
      }
    }

    return {
      totalFiles: files.length,
      filesByType,
      totalDependencies,
      dependenciesByCategory,
      averageDependenciesPerFile: totalDependencies / files.length,
      circularDependencies: 0, // TODO: 구현 필요
      orphanedFiles: files.filter(f => f.dependents.length === 0 &&
                                      f.dependencies.internal.length === 0).length
    }
  }

  // Helper methods
  private mapNodeTypeToFileType(nodeType: string): FileType {
    switch (nodeType) {
      case 'test': return 'test'
      case 'docs': return 'docs'
      case 'code':
      default: return 'code'
    }
  }

  private mapTypeToCategory(type: string): DependencyCategory {
    switch (type) {
      case 'internal-module': return 'internal'
      case 'external-library': return 'external'
      case 'builtin-module': return 'builtin'
      case 'test-target':
      case 'test-utility': return 'test-utility'
      case 'test-setup': return 'test-setup'
      case 'doc-reference': return 'doc-reference'
      case 'doc-link': return 'doc-link'
      case 'doc-asset': return 'doc-asset'
      default: return 'external'
    }
  }

  private extractComplexity(node: DependencyNode): number {
    return typeof node.metadata.complexity === 'number' ? node.metadata.complexity : 1
  }

  private extractMaintainability(node: DependencyNode): number {
    return typeof node.metadata.maintainability === 'number' ? node.metadata.maintainability : 0.5
  }

  private extractTestCoverage(node: DependencyNode): number | undefined {
    return typeof node.metadata.testCoverage === 'number' ? node.metadata.testCoverage : undefined
  }

  private extractDocumentation(node: DependencyNode): number | undefined {
    return typeof node.metadata.documentation === 'number' ? node.metadata.documentation : undefined
  }
}