/**
 * 의존성 분류 명령어 - 파일 타입별 의존성을 분류하여 저장하는 CLI 명령어
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Args from "@effect/cli/Args"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import * as Option from "effect/Option"
import * as path from 'node:path'
import * as fs from 'node:fs'

import { UnifiedDependencyAnalyzer } from '../analyzers/UnifiedDependencyAnalyzer.js'
import { MetadataExtractor } from '../analyzers/MetadataExtractor.js'
import type { AnalysisConfig, StorageOptions, NodeType } from '../types/DependencyClassification.js'

// CLI 옵션 정의
const filePathArg = Args.text({ name: "filePath" }).pipe(
  Args.withDescription("분석할 파일 또는 디렉토리 경로")
)

const outputFormatOption = Options.choice("format", ["json", "sqlite", "neo4j", "graphml"]).pipe(
  Options.withDefault("json" as const),
  Options.withDescription("출력 형식")
)

const outputDirOption = Options.text("output-dir").pipe(
  Options.optional,
  Options.withDescription("결과 저장 디렉토리")
)

const includeTestsOption = Options.boolean("include-tests").pipe(
  Options.withDefault(true),
  Options.withDescription("테스트 파일 포함 여부")
)

const includeDocsOption = Options.boolean("include-docs").pipe(
  Options.withDefault(true),
  Options.withDescription("문서 파일 포함 여부")
)

const includeNodeModulesOption = Options.boolean("include-node-modules").pipe(
  Options.withDefault(false),
  Options.withDescription("node_modules 포함 여부")
)

const maxDepthOption = Options.integer("max-depth").pipe(
  Options.withDefault(10),
  Options.withDescription("최대 탐색 깊이")
)

const verboseOption = Options.boolean("verbose").pipe(
  Options.withDefault(false),
  Options.withAlias("v"),
  Options.withDescription("상세 출력 모드")
)

const nodeTypeFilterOption = Options.choice("node-type", ["test", "code", "docs", "library", "all"]).pipe(
  Options.withDefault("all" as const),
  Options.withDescription("분석할 노드 타입 필터")
)

const compressionOption = Options.boolean("compression").pipe(
  Options.withDefault(false),
  Options.withDescription("결과 압축 여부")
)

const incrementalOption = Options.boolean("incremental").pipe(
  Options.withDefault(false),
  Options.withDescription("증분 분석 모드")
)

// 메인 명령어
export const classifyCommand = Command.make(
  "classify",
  {
    filePath: filePathArg,
    format: outputFormatOption,
    outputDir: outputDirOption,
    includeTests: includeTestsOption,
    includeDocs: includeDocsOption,
    includeNodeModules: includeNodeModulesOption,
    maxDepth: maxDepthOption,
    verbose: verboseOption,
    nodeType: nodeTypeFilterOption,
    compression: compressionOption,
    incremental: incrementalOption
  }
).pipe(
  Command.withDescription("파일 타입별 의존성을 분류하여 저장"),
  Command.withHandler((args) =>
    Effect.gen(function*() {
      const {
        filePath,
        format,
        outputDir,
        includeTests,
        includeDocs,
        includeNodeModules,
        maxDepth,
        verbose,
        nodeType,
        compression,
        incremental
      } = args

      if (verbose) {
        yield* Console.log(`🔍 의존성 분류 분석 시작: ${filePath}`)
        yield* Console.log(`📊 형식: ${format}, 노드 타입: ${nodeType}`)
        yield* Console.log(`📁 출력 디렉토리: ${Option.getOrElse(outputDir, () => "기본값 사용")}`)
        yield* Console.log(`⚙️ 설정: 테스트=${includeTests}, 문서=${includeDocs}, 깊이=${maxDepth}`)
      }

      // 파일 시스템 체크
      const isDirectory = yield* Effect.tryPromise(async () => {
        const fs = await import("fs/promises")
        const stat = await fs.stat(filePath)
        return stat.isDirectory()
      })

      // 분석할 파일들 수집
      const files = yield* Effect.tryPromise(async () => {
        if (isDirectory) {
          return await collectFiles(filePath, {
            includeTests,
            includeDocs,
            includeNodeModules,
            maxDepth,
            nodeType: nodeType as NodeType | 'all'
          })
        } else {
          return [filePath]
        }
      })

      if (verbose) {
        yield* Console.log(`📂 발견된 파일: ${files.length}개`)
        for (const file of files) {
          const nodeType = getFileNodeType(file)
          yield* Console.log(`  • ${file} (${nodeType})`)
        }
      } else {
        yield* Console.log(`📂 발견된 파일: ${files.length}개`)
        // 기본 모드에서도 파일 타입 분포 표시
        const fileTypeCount = files.reduce((acc, file) => {
          const nodeType = getFileNodeType(file)
          acc[nodeType] = (acc[nodeType] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        for (const [type, count] of Object.entries(fileTypeCount)) {
          yield* Console.log(`  ${type}: ${count}개`)
        }
      }

      // 분석 설정 구성
      const analysisConfig: AnalysisConfig = {
        includeTests,
        includeDocumentation: includeDocs,
        includeNodeModules,
        maxDepth,
        excludePatterns: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**'
        ],
        testConfig: {
          detectTestFrameworks: true,
          analyzeMocks: true,
          calculateCoverage: true
        },
        codeConfig: {
          resolveTypeImports: true,
          analyzeUsage: true,
          detectCircularDeps: true
        },
        docConfig: {
          validateLinks: true,
          extractMetadata: true,
          analyzeStructure: true
        }
      }

      // 저장 옵션 구성
      const storageOptions: StorageOptions = {
        format: format as StorageOptions['format'],
        compression,
        incremental,
        includeMetadata: true,
        includeSourceCode: verbose
      }

      // 프로젝트 루트 찾기
      const projectRoot = yield* Effect.tryPromise(async () => {
        return findProjectRoot(filePath)
      })

      if (verbose) {
        yield* Console.log(`🏠 프로젝트 루트: ${projectRoot}`)
      }

      // 통합 분석기 생성
      const analyzer = new UnifiedDependencyAnalyzer(projectRoot, analysisConfig)

      // 분석 실행
      yield* Console.log(`🚀 의존성 분류 분석 시작...`)
      const startTime = Date.now()

      const result = yield* Effect.tryPromise(async () => {
        return await analyzer.analyzeProject(files)
      })

      const duration = Date.now() - startTime

      // 분석 결과 출력
      yield* outputAnalysisResults(result, verbose)

      // 참조 관계 메타데이터 추출
      yield* Console.log(`\n🔗 참조 관계 메타데이터 추출 중...`)
      const metadataExtractor = new MetadataExtractor(projectRoot)
      const referenceData = yield* Effect.tryPromise(async () => {
        return metadataExtractor.extractMetadata(result)
      })

      // 참조 관계 요약 출력
      yield* outputReferenceMetadata(referenceData, verbose)

      // 결과 저장
      const outputDirectory = Option.getOrElse(outputDir, () => path.join(projectRoot, '.deps-analysis'))

      yield* Effect.tryPromise(async () => {
        await analyzer.save(result, {
          ...storageOptions,
          format: format as StorageOptions['format']
        })

        // 메타데이터 별도 저장
        await saveReferenceMetadata(referenceData, outputDirectory, format)
      })

      yield* Console.log(`✅ 분석 완료! (${duration}ms)`)
      yield* Console.log(`💾 결과 저장됨: ${outputDirectory}`)

      // 타입별 요약 출력
      yield* outputTypeSummary(result, nodeType as NodeType | 'all')
    })
  )
)

// 파일 수집 함수
async function collectFiles(
  dirPath: string,
  options: {
    includeTests: boolean
    includeDocs: boolean
    includeNodeModules: boolean
    maxDepth: number
    nodeType: NodeType | 'all'
  }
): Promise<string[]> {
  const files: string[] = []

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte']
  if (options.includeDocs) {
    extensions.push('.md', '.markdown', '.rst', '.txt')
  }

  const walk = async (currentPath: string, depth: number) => {
    if (depth > options.maxDepth) return

    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        // 제외 패턴 체크
        if (!options.includeNodeModules && entry.name === 'node_modules') continue
        if (entry.name.startsWith('.') && entry.name !== '.md') continue

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)

          if (extensions.includes(ext)) {
            const nodeType = getFileNodeType(fullPath)

            // 노드 타입 필터링
            if (options.nodeType !== 'all' && nodeType !== options.nodeType) continue

            // 테스트 파일 필터링
            if (!options.includeTests && nodeType === 'test') continue

            // 문서 파일 필터링
            if (!options.includeDocs && nodeType === 'docs') continue

            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.warn(`디렉토리 읽기 실패: ${currentPath}`, error)
    }
  }

  await walk(dirPath, 0)
  return files
}

// 파일 노드 타입 결정
function getFileNodeType(filePath: string): NodeType {
  const normalizedPath = filePath.toLowerCase()

  if (
    normalizedPath.includes('.test.') ||
    normalizedPath.includes('.spec.') ||
    normalizedPath.includes('/__tests__/') ||
    normalizedPath.includes('/test/') ||
    normalizedPath.includes('/tests/')
  ) {
    return 'test'
  }

  if (
    normalizedPath.endsWith('.md') ||
    normalizedPath.endsWith('.markdown') ||
    normalizedPath.endsWith('.rst') ||
    normalizedPath.endsWith('.txt')
  ) {
    return 'docs'
  }

  if (normalizedPath.includes('node_modules')) {
    return 'library'
  }

  return 'code'
}

// 프로젝트 루트 찾기
function findProjectRoot(startPath: string): string {
  let currentPath = path.resolve(startPath)

  while (currentPath !== path.dirname(currentPath)) {
    const indicators = ['package.json', 'tsconfig.json', '.git']

    for (const indicator of indicators) {
      if (fs.existsSync(path.join(currentPath, indicator))) {
        return currentPath
      }
    }

    currentPath = path.dirname(currentPath)
  }

  return path.dirname(startPath)
}

// 분석 결과 출력
const outputAnalysisResults = (result: any, verbose: boolean) =>
  Effect.gen(function*() {
    yield* Console.log(`\n📊 의존성 분류 분석 결과`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // 기본 통계
    yield* Console.log(`📁 총 파일: ${result.graph.nodes.size}개`)
    yield* Console.log(`🔗 총 의존성: ${result.graph.metrics.totalDependencies}개`)
    yield* Console.log(`⏱️ 분석 시간: ${result.analysisMetadata.duration}ms`)

    // 파일 타입별 통계
    yield* Console.log(`\n📋 파일 타입별 분포:`)
    for (const [nodeType, count] of Object.entries(result.report.summary.fileTypes)) {
      const icon = getNodeTypeIcon(nodeType as NodeType)
      yield* Console.log(`  ${icon} ${nodeType}: ${count}개`)
    }

    // 의존성 타입별 통계
    yield* Console.log(`\n🔗 의존성 타입별 분포:`)
    for (const [depType, count] of Object.entries(result.report.summary.dependencyTypes)) {
      yield* Console.log(`  • ${depType}: ${count}개`)
    }

    // 클러스터 정보
    if (result.graph.clusters.size > 0) {
      yield* Console.log(`\n🏗️ 코드 클러스터:`)
      for (const [name, cluster] of result.graph.clusters.entries()) {
        yield* Console.log(`  📦 ${name}: ${cluster.files.length}개 파일 (응집도: ${Math.round(cluster.cohesion * 100)}%)`)
      }
    }

    // 경고 및 위험 요소
    if (result.analysisMetadata.warnings.length > 0) {
      yield* Console.log(`\n⚠️ 경고사항:`)
      for (const warning of result.analysisMetadata.warnings.slice(0, 5)) {
        yield* Console.log(`  • ${warning}`)
      }
      if (result.analysisMetadata.warnings.length > 5) {
        yield* Console.log(`  ... 그리고 ${result.analysisMetadata.warnings.length - 5}개 더`)
      }
    }

    if (verbose) {
      // 상세 정보 출력
      yield* outputDetailedAnalysis(result)
    }
  })

// 타입별 요약 출력
const outputTypeSummary = (result: any, filterType: NodeType | 'all') =>
  Effect.gen(function*() {
    yield* Console.log(`\n🎯 ${filterType === 'all' ? '전체' : filterType} 노드 타입 상세 분석`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    for (const [nodeType, nodes] of result.nodesByType.entries()) {
      if (filterType !== 'all' && nodeType !== filterType) continue

      const icon = getNodeTypeIcon(nodeType)
      yield* Console.log(`\n${icon} ${nodeType.toUpperCase()} 파일들 (${nodes.length}개):`)

      // 상위 의존성이 많은 파일들
      const sortedByDeps = nodes
        .sort((a: any, b: any) => b.analysis.totalDependencies - a.analysis.totalDependencies)
        .slice(0, 5)

      yield* Console.log(`  📊 의존성이 많은 파일들:`)
      for (const node of sortedByDeps) {
        yield* Console.log(`    • ${node.relativePath}: ${node.analysis.totalDependencies}개`)
      }

      // 타입별 특화 정보
      yield* outputNodeTypeSpecificInfo(nodeType, nodes)
    }
  })

// 노드 타입별 특화 정보 출력
const outputNodeTypeSpecificInfo = (nodeType: NodeType, nodes: any[]) =>
  Effect.gen(function*() {
    switch (nodeType) {
      case 'test':
        const totalTargets = nodes.reduce((sum, node) => sum + node.dependencies.filter((d: any) => d.type === 'test-target').length, 0)
        yield* Console.log(`    🎯 테스트 대상: ${totalTargets}개`)
        break

      case 'code':
        const circularDeps = nodes.filter(node => node.analysis.cyclicDependencies.length > 0).length
        yield* Console.log(`    🔄 순환 의존성: ${circularDeps}개 파일`)
        break

      case 'docs':
        const brokenLinks = nodes.reduce((sum, node) => sum + node.dependencies.filter((d: any) => !d.exists).length, 0)
        yield* Console.log(`    🔗 깨진 링크: ${brokenLinks}개`)
        break

      case 'library':
        yield* Console.log(`    📦 외부 라이브러리`)
        break
    }
  })

// 상세 분석 출력
const outputDetailedAnalysis = (result: any) =>
  Effect.gen(function*() {
    yield* Console.log(`\n🔍 상세 분석 결과`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // 테스트 커버리지
    if (result.report.testAnalysis) {
      const coverage = Math.round(result.report.testAnalysis.testCoverage * 100)
      yield* Console.log(`🧪 테스트 커버리지: ${coverage}%`)

      if (result.report.testAnalysis.uncoveredFiles.length > 0) {
        yield* Console.log(`  테스트되지 않은 파일들:`)
        for (const file of result.report.testAnalysis.uncoveredFiles.slice(0, 3)) {
          yield* Console.log(`    • ${file}`)
        }
      }
    }

    // 아키텍처 메트릭
    yield* Console.log(`\n🏗️ 아키텍처 메트릭:`)
    yield* Console.log(`  • 평균 의존성: ${Math.round(result.graph.metrics.averageDependenciesPerFile)}개/파일`)
    yield* Console.log(`  • 최대 깊이: ${result.graph.metrics.maxDepth}`)
    yield* Console.log(`  • 고립된 파일: ${result.graph.metrics.isolatedFileCount}개`)

    // 추천사항
    if (result.report.recommendations.length > 0) {
      yield* Console.log(`\n💡 추천사항:`)
      for (const rec of result.report.recommendations.slice(0, 3)) {
        yield* Console.log(`  ${getPriorityIcon(rec.priority)} ${rec.description}`)
      }
    }
  })

// 유틸리티 함수들
function getNodeTypeIcon(nodeType: NodeType): string {
  switch (nodeType) {
    case 'test': return '🧪'
    case 'code': return '📄'
    case 'docs': return '📝'
    case 'library': return '📦'
    default: return '📁'
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'high': return '🔴'
    case 'medium': return '🟡'
    case 'low': return '🟢'
    default: return '⚪'
  }
}

// 참조 관계 메타데이터 출력
const outputReferenceMetadata = (referenceData: any, verbose: boolean) =>
  Effect.gen(function*() {
    yield* Console.log(`\n🔗 참조 관계 메타데이터`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // 기본 통계
    yield* Console.log(`📊 메타데이터 통계:`)
    yield* Console.log(`  📁 총 파일: ${referenceData.files.length}개`)
    yield* Console.log(`  🔗 참조 관계: ${referenceData.referenceGraph.edges.length}개`)
    yield* Console.log(`  📈 평균 의존성: ${referenceData.statistics.averageDependenciesPerFile.toFixed(1)}개/파일`)
    yield* Console.log(`  ⚠️ 고립된 파일: ${referenceData.statistics.orphanedFiles}개`)

    // 파일 타입별 통계
    yield* Console.log(`\n📋 파일 타입별 분포:`)
    for (const [fileType, count] of Object.entries(referenceData.statistics.filesByType)) {
      const icon = getFileTypeIcon(fileType)
      yield* Console.log(`  ${icon} ${fileType}: ${count}개`)
    }

    // 의존성 카테고리별 통계
    yield* Console.log(`\n🏷️ 의존성 카테고리별 분포:`)
    for (const [category, count] of Object.entries(referenceData.statistics.dependenciesByCategory)) {
      yield* Console.log(`  • ${category}: ${count}개`)
    }

    if (verbose) {
      // 상세 파일 정보
      yield* Console.log(`\n📄 파일별 상세 정보 (상위 5개):`)
      const topFiles = referenceData.files
        .sort((a: any, b: any) => {
          const aDeps = a.dependencies.internal.length + a.dependencies.external.length + a.dependencies.builtin.length
          const bDeps = b.dependencies.internal.length + b.dependencies.external.length + b.dependencies.builtin.length
          return bDeps - aDeps
        })
        .slice(0, 5)

      for (const file of topFiles) {
        const totalDeps = file.dependencies.internal.length + file.dependencies.external.length + file.dependencies.builtin.length
        yield* Console.log(`  📁 ${file.relativePath}`)
        yield* Console.log(`    ID: ${file.fileId}`)
        yield* Console.log(`    타입: ${file.fileType}`)
        yield* Console.log(`    의존성: ${totalDeps}개 (내부: ${file.dependencies.internal.length}, 외부: ${file.dependencies.external.length})`)
        yield* Console.log(`    참조당함: ${file.dependents.length}개 파일`)
      }

      // 순환 의존성 체크 결과
      if (referenceData.statistics.circularDependencies > 0) {
        yield* Console.log(`\n🔄 순환 의존성 감지: ${referenceData.statistics.circularDependencies}개`)
      }
    }
  })

// 참조 메타데이터 저장
async function saveReferenceMetadata(referenceData: any, outputDir: string, format: string): Promise<void> {
  const fileName = `reference-metadata.${format === 'json' ? 'json' : 'json'}`
  const filePath = path.join(outputDir, fileName)

  // 출력 디렉토리 생성
  await fs.promises.mkdir(outputDir, { recursive: true })

  if (format === 'json') {
    await fs.promises.writeFile(filePath, JSON.stringify(referenceData, null, 2), 'utf-8')
  } else {
    // 다른 형식도 JSON으로 저장 (향후 확장 가능)
    await fs.promises.writeFile(filePath, JSON.stringify(referenceData, null, 2), 'utf-8')
  }

  console.log(`🔗 참조 메타데이터 저장됨: ${filePath}`)
}

// 파일 타입 아이콘
function getFileTypeIcon(fileType: string): string {
  switch (fileType) {
    case 'code': return '📄'
    case 'test': return '🧪'
    case 'docs': return '📝'
    default: return '📁'
  }
}