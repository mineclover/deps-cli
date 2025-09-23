/**
 * PathResolverInterpreter를 활용한 향상된 분석 유틸리티
 * 프로젝트 루트 감지, 데이터 분류, 포매팅 기능 통합
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import {
  analyzeTypeScriptFile,
  analyzeMarkdownFile,
  AnalysisEngine,
  AnalysisEngineFactory,
  PathResolverInterpreter
} from '@context-action/dependency-linker'
import type { AnalysisResult } from '@context-action/dependency-linker'
import { findProjectRoot, analyzeProjectRoot, type ProjectRootInfo } from './ProjectRootDetector.js'

export interface EnhancedAnalysisResult extends AnalysisResult {
  projectInfo: ProjectRootInfo
  pathResolution: {
    resolvedDependencies: Array<{
      originalSource: string
      resolvedPath: string | null
      resolutionType: 'relative' | 'absolute' | 'alias' | 'nodeModules' | 'builtin' | 'unresolved'
      exists: boolean
      isInternal: boolean
      projectRelativePath?: string
      error?: string
    }>
    summary: {
      totalDependencies: number
      resolvedCount: number
      unresolvedCount: number
      internalCount: number
      externalCount: number
      aliasCount: number
      relativeCount: number
    }
    pathMappings: Record<string, string>
  }
}

export interface AnalysisOptions {
  enablePathResolution: boolean
  resolveNodeModules: boolean
  includePackageInfo: boolean
  validateFileExists: boolean
  customAliases?: Record<string, string>
  verbose?: boolean
}

/**
 * TypeScript 컴일러 옵션에서 경로 매핑 로드
 */
async function loadTsconfigPaths(projectRoot: string): Promise<Record<string, string>> {
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json')

  if (!fs.existsSync(tsconfigPath)) {
    return {}
  }

  try {
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    const baseUrl = tsconfig.compilerOptions?.baseUrl || './'
    const paths = tsconfig.compilerOptions?.paths || {}

    const pathMappings: Record<string, string> = {}

    for (const [alias, targets] of Object.entries(paths)) {
      if (Array.isArray(targets) && targets.length > 0) {
        // 첫 번째 타겟 사용하고 /*를 제거
        const target = targets[0].replace('/*', '')
        const aliasKey = alias.replace('/*', '')
        pathMappings[aliasKey] = path.resolve(projectRoot, baseUrl, target)
      }
    }

    return pathMappings
  } catch (error) {
    console.warn(`tsconfig.json 파싱 실패: ${error}`)
    return {}
  }
}

/**
 * 단일 파일의 향상된 분석
 */
export async function analyzeFileWithPathResolution(
  filePath: string,
  options: AnalysisOptions = { enablePathResolution: true, resolveNodeModules: true, includePackageInfo: true, validateFileExists: true }
): Promise<EnhancedAnalysisResult> {
  // 1. 프로젝트 루트 감지
  const projectRoot = findProjectRoot(filePath)
  const projectInfo = analyzeProjectRoot(projectRoot)

  if (options.verbose) {
    console.log(`🏠 프로젝트 루트: ${projectRoot}`)
    console.log(`📊 프로젝트 타입: ${projectInfo.projectType}`)
  }

  // 2. 기본 분석 수행
  let baseResult: AnalysisResult
  const fileExtension = path.extname(filePath).toLowerCase()

  if (fileExtension === '.md' || fileExtension === '.markdown') {
    baseResult = await analyzeMarkdownFile(filePath, {
      format: 'json',
      includeSources: true,
      classifyDependencies: true
    })
  } else {
    baseResult = await analyzeTypeScriptFile(filePath, {
      format: 'json',
      includeSources: true,
      classifyDependencies: true
    })
  }

  // 3. PathResolver 설정 및 분석
  let pathResolution = {
    resolvedDependencies: [],
    summary: {
      totalDependencies: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      internalCount: 0,
      externalCount: 0,
      aliasCount: 0,
      relativeCount: 0
    },
    pathMappings: {}
  }

  if (options.enablePathResolution && baseResult.extractedData?.dependency) {
    const pathMappings = await loadTsconfigPaths(projectRoot)

    // 사용자 정의 별칭과 tsconfig 경로 매핑 결합
    const allAliases = {
      '@': 'src',
      '@components': 'src/components',
      '@utils': 'src/utils',
      '@types': 'src/types',
      ...pathMappings,
      ...options.customAliases
    }

    // PathResolverInterpreter 설정
    const pathResolver = new PathResolverInterpreter()
    pathResolver.configure({
      resolveNodeModules: options.resolveNodeModules,
      includePackageInfo: options.includePackageInfo,
      validateFileExists: options.validateFileExists,
      aliasPatterns: allAliases
    })

    // 인터프리터 컨텍스트 구성
    const context = {
      filePath,
      language: fileExtension === '.md' ? 'markdown' : 'typescript',
      metadata: { hasTypeScript: projectInfo.hasTypeScript },
      timestamp: new Date(),
      projectContext: {
        rootPath: projectRoot,
        projectType: projectInfo.projectType
      }
    }

    // 경로 해결 수행
    const pathResult = pathResolver.interpret(baseResult.extractedData.dependency, context)

    // 결과 변환 및 보강
    const resolvedDependencies = pathResult.resolvedDependencies.map(dep => ({
      originalSource: dep.originalSource,
      resolvedPath: dep.resolvedPath,
      resolutionType: dep.resolutionType,
      exists: dep.exists || false,
      isInternal: dep.resolvedPath ? isFileWithinProject(dep.resolvedPath, projectRoot) : false,
      projectRelativePath: dep.resolvedPath ? path.relative(projectRoot, dep.resolvedPath) : undefined,
      error: dep.error
    }))

    pathResolution = {
      resolvedDependencies,
      summary: {
        totalDependencies: pathResult.summary.totalDependencies,
        resolvedCount: pathResult.summary.resolvedCount,
        unresolvedCount: pathResult.summary.unresolvedCount,
        internalCount: resolvedDependencies.filter(d => d.isInternal).length,
        externalCount: resolvedDependencies.filter(d => !d.isInternal && d.resolvedPath).length,
        aliasCount: pathResult.summary.aliasCount || 0,
        relativeCount: pathResult.summary.relativeCount || 0
      },
      pathMappings: pathResult.pathMappings || allAliases
    }
  }

  return {
    ...baseResult,
    projectInfo,
    pathResolution
  }
}

/**
 * 파일이 프로젝트 내부에 있는지 확인
 */
function isFileWithinProject(filePath: string, projectRoot: string): boolean {
  const relative = path.relative(projectRoot, filePath)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * 디렉토리의 향상된 일괄 분석
 */
export async function analyzeDirectoryWithPathResolution(
  dirPath: string,
  options: AnalysisOptions & {
    extensions?: string[]
    exclude?: string[]
    maxDepth?: number
    parallel?: boolean
    concurrency?: number
  } = { enablePathResolution: true, resolveNodeModules: true, includePackageInfo: true, validateFileExists: true }
): Promise<EnhancedAnalysisResult[]> {
  const extensions = options.extensions || ['.ts', '.tsx', '.js', '.jsx', '.md', '.markdown']
  const exclude = options.exclude || ['node_modules', '.git', 'dist', 'build']
  const maxDepth = options.maxDepth || 10

  // 분석할 파일들 수집
  const filesToAnalyze = collectFiles(dirPath, extensions, exclude, maxDepth)

  if (options.verbose) {
    console.log(`📁 분석할 파일 수: ${filesToAnalyze.length}`)
  }

  // 병렬 또는 순차 분석
  if (options.parallel) {
    const concurrency = options.concurrency || 4
    const chunks = chunkArray(filesToAnalyze, concurrency)
    const results: EnhancedAnalysisResult[] = []

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(file =>
          analyzeFileWithPathResolution(file, options).catch(error => {
            console.error(`분석 실패 ${file}:`, error)
            return null
          })
        )
      )
      results.push(...chunkResults.filter(Boolean) as EnhancedAnalysisResult[])
    }

    return results
  } else {
    const results: EnhancedAnalysisResult[] = []

    for (const file of filesToAnalyze) {
      try {
        const result = await analyzeFileWithPathResolution(file, options)
        results.push(result)
      } catch (error) {
        console.error(`분석 실패 ${file}:`, error)
      }
    }

    return results
  }
}

/**
 * 파일 수집 유틸리티
 */
function collectFiles(dirPath: string, extensions: string[], exclude: string[], maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth >= maxDepth) return []

  const files: string[] = []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (exclude.some(pattern => entry.name.includes(pattern))) {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath, extensions, exclude, maxDepth, currentDepth + 1))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.error(`디렉토리 읽기 실패 ${dirPath}:`, error)
  }

  return files
}

/**
 * 배열을 청크로 나누는 유틸리티
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * 분석 결과 포매팅
 */
export function formatAnalysisResults(results: EnhancedAnalysisResult[], format: 'summary' | 'detailed' | 'json' = 'summary'): string {
  if (format === 'json') {
    return JSON.stringify(results, null, 2)
  }

  const totalFiles = results.length
  const totalDependencies = results.reduce((sum, r) => sum + (r.pathResolution?.summary.totalDependencies || 0), 0)
  const totalResolved = results.reduce((sum, r) => sum + (r.pathResolution?.summary.resolvedCount || 0), 0)
  const totalInternal = results.reduce((sum, r) => sum + (r.pathResolution?.summary.internalCount || 0), 0)

  let output = `📊 분석 결과 요약\n`
  output += `═══════════════════════════════════════\n`
  output += `📁 분석된 파일: ${totalFiles}개\n`
  output += `📦 총 의존성: ${totalDependencies}개\n`
  output += `✅ 해결된 경로: ${totalResolved}개 (${Math.round(totalResolved / totalDependencies * 100)}%)\n`
  output += `🏠 내부 파일: ${totalInternal}개\n`
  output += `📦 외부 패키지: ${totalResolved - totalInternal}개\n\n`

  if (format === 'detailed') {
    // 프로젝트별 정보
    const projectInfo = results[0]?.projectInfo
    if (projectInfo) {
      output += `🏠 프로젝트 정보\n`
      output += `───────────────────────────────────────\n`
      output += `루트: ${projectInfo.rootPath}\n`
      output += `타입: ${projectInfo.projectType}\n`
      output += `패키지 매니저: ${projectInfo.packageManager}\n`
      output += `TypeScript: ${projectInfo.hasTypeScript ? '✅' : '❌'}\n\n`
    }

    // 파일별 상세 정보
    output += `📄 파일별 상세 분석\n`
    output += `───────────────────────────────────────\n`

    for (const result of results.slice(0, 10)) { // 처음 10개만 표시
      const relativePath = projectInfo ? path.relative(projectInfo.rootPath, result.filePath) : result.filePath
      const depCount = result.pathResolution?.summary.totalDependencies || 0
      const resolvedCount = result.pathResolution?.summary.resolvedCount || 0

      output += `📁 ${relativePath}\n`
      output += `   의존성: ${depCount}개, 해결: ${resolvedCount}개\n\n`
    }

    if (results.length > 10) {
      output += `... 그리고 ${results.length - 10}개 파일 더\n\n`
    }
  }

  return output
}