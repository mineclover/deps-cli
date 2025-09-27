/**
 * 라이브러리/모듈 분석 유틸리티
 * package.json, exports, 외부 의존성 등을 분석하는 가벼운 시스템
 */

import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { FileId } from '../types/MappingTypes.js'
import { CodeRole } from '../types/MappingTypes.js'
import { IdGenerator } from './IdGenerator.js'

export interface LibraryMetadata {
  id: string
  name: string
  type: 'internal' | 'external' | 'builtin'
  role: CodeRole
  version?: string
  description?: string
  entryPoint?: string
  exports: string[]
  dependencies: string[]
  devDependencies: string[]
  peerDependencies: string[]
  documentPath?: string
}

export interface ModuleMetadata {
  id: string
  name: string
  path: string
  type: 'esm' | 'cjs' | 'hybrid'
  exports: string[]
  imports: string[]
  reexports: string[]
  isEntry: boolean
  documentPath?: string
}

export interface LibraryAnalysisResult {
  libraries: LibraryMetadata[]
  modules: ModuleMetadata[]
  internalModules: ModuleMetadata[]
  externalLibraries: LibraryMetadata[]
}

export class LibraryAnalyzer {
  /**
   * 프로젝트의 라이브러리/모듈 분석
   */
  static async analyzeProject(projectRoot: string): Promise<LibraryAnalysisResult> {
    const libraries: LibraryMetadata[] = []
    const modules: ModuleMetadata[] = []

    try {
      // 1. package.json 분석
      const packageLibraries = await LibraryAnalyzer.analyzePackageJson(projectRoot)
      libraries.push(...packageLibraries)

      // 2. 내부 모듈 분석 (src 디렉토리)
      const internalModules = await LibraryAnalyzer.analyzeInternalModules(projectRoot)
      modules.push(...internalModules)

      // 3. 결과 분류
      const internalModulesFiltered = modules.filter((m) => m.path.includes('/src/'))
      const externalLibraries = libraries.filter((l) => l.type === 'external')

      return {
        libraries,
        modules,
        internalModules: internalModulesFiltered,
        externalLibraries,
      }
    } catch (error) {
      console.warn('라이브러리 분석 실패:', error)
      return LibraryAnalyzer.createEmptyResult()
    }
  }

  /**
   * package.json에서 라이브러리 정보 추출
   */
  private static async analyzePackageJson(projectRoot: string): Promise<LibraryMetadata[]> {
    const libraries: LibraryMetadata[] = []

    try {
      const packageJsonPath = resolve(projectRoot, 'package.json')
      const packageContent = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageContent)

      // 메인 프로젝트 라이브러리
      const mainLibrary = LibraryAnalyzer.createMainLibraryMetadata(packageJson)
      libraries.push(mainLibrary)

      // 외부 의존성들
      const dependencies = Object.keys(packageJson.dependencies || {})
      const devDependencies = Object.keys(packageJson.devDependencies || {})
      const peerDependencies = Object.keys(packageJson.peerDependencies || {})

      // 외부 라이브러리 메타데이터 생성
      for (const dep of dependencies) {
        const library = LibraryAnalyzer.createExternalLibraryMetadata(dep, packageJson.dependencies[dep], 'dependency')
        libraries.push(library)
      }

      for (const dep of devDependencies) {
        const library = LibraryAnalyzer.createExternalLibraryMetadata(
          dep,
          packageJson.devDependencies[dep],
          'devDependency'
        )
        libraries.push(library)
      }

      for (const dep of peerDependencies) {
        const library = LibraryAnalyzer.createExternalLibraryMetadata(
          dep,
          packageJson.peerDependencies[dep],
          'peerDependency'
        )
        libraries.push(library)
      }
    } catch (error) {
      console.warn('package.json 분석 실패:', error)
    }

    return libraries
  }

  /**
   * 내부 모듈 분석
   */
  private static async analyzeInternalModules(projectRoot: string): Promise<ModuleMetadata[]> {
    const modules: ModuleMetadata[] = []

    try {
      // src 디렉토리의 주요 모듈들 분석
      const srcModules = [
        'analyzers/index.ts',
        'mapping/index.ts',
        'utils/index.ts',
        'types/index.ts',
        'config/index.ts',
        'adapters/index.ts',
      ]

      for (const modulePath of srcModules) {
        const fullPath = resolve(projectRoot, 'src', modulePath)
        try {
          const moduleMetadata = await LibraryAnalyzer.analyzeModule(fullPath, projectRoot)
          if (moduleMetadata) {
            modules.push(moduleMetadata)
          }
        } catch (error) {
          // 파일이 존재하지 않을 수 있으므로 조용히 넘어감
        }
      }

      // bin.ts (엔트리 포인트)
      const binPath = resolve(projectRoot, 'src/bin.ts')
      try {
        const binModule = await LibraryAnalyzer.analyzeModule(binPath, projectRoot)
        if (binModule) {
          binModule.isEntry = true
          modules.push(binModule)
        }
      } catch (error) {
        // bin.ts가 없을 수 있음
      }
    } catch (error) {
      console.warn('내부 모듈 분석 실패:', error)
    }

    return modules
  }

  /**
   * 단일 모듈 분석
   */
  private static async analyzeModule(filePath: string, projectRoot: string): Promise<ModuleMetadata | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const relativePath = filePath.replace(projectRoot, '').replace(/^\//, '')

      const moduleId = IdGenerator.generateContentHash(`module::${relativePath}`)
      const moduleName = basename(filePath, '.ts').replace(/\.d$/, '')

      // export 문 분석
      const exports = LibraryAnalyzer.extractExports(content)

      // import 문 분석
      const imports = LibraryAnalyzer.extractImports(content)

      // re-export 분석
      const reexports = LibraryAnalyzer.extractReexports(content)

      // 모듈 타입 추론
      const moduleType = LibraryAnalyzer.inferModuleType(content)

      const moduleMetadata: ModuleMetadata = {
        id: moduleId,
        name: moduleName,
        path: relativePath,
        type: moduleType,
        exports,
        imports,
        reexports,
        isEntry: false,
      }

      return moduleMetadata
    } catch (error) {
      return null
    }
  }

  /**
   * export 문 추출
   */
  private static extractExports(content: string): string[] {
    const exports: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // export { ... }
      const namedExportMatch = trimmed.match(/export\s*\{\s*([^}]+)\s*\}/)
      if (namedExportMatch) {
        const names = namedExportMatch[1]
          .split(',')
          .map((name) => name.trim().split(' as ')[0].trim())
          .filter((name) => name)
        exports.push(...names)
      }

      // export function/class/const/let/var
      const declarationMatch = trimmed.match(
        /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/
      )
      if (declarationMatch) {
        exports.push(declarationMatch[1])
      }

      // export default
      if (trimmed.includes('export default')) {
        exports.push('default')
      }
    }

    return [...new Set(exports)] // 중복 제거
  }

  /**
   * import 문 추출
   */
  private static extractImports(content: string): string[] {
    const imports: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // import ... from '...'
      const importMatch = trimmed.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/)
      if (importMatch) {
        imports.push(importMatch[1])
      }

      // import('...')
      const dynamicImportMatch = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/)
      if (dynamicImportMatch) {
        imports.push(dynamicImportMatch[1])
      }
    }

    return [...new Set(imports)] // 중복 제거
  }

  /**
   * re-export 문 추출
   */
  private static extractReexports(content: string): string[] {
    const reexports: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // export ... from '...'
      const reexportMatch = trimmed.match(/export\s+.*\s+from\s+['"]([^'"]+)['"]/)
      if (reexportMatch) {
        reexports.push(reexportMatch[1])
      }

      // export * from '...'
      const reexportAllMatch = trimmed.match(/export\s*\*\s*from\s+['"]([^'"]+)['"]/)
      if (reexportAllMatch) {
        reexports.push(reexportAllMatch[1])
      }
    }

    return [...new Set(reexports)] // 중복 제거
  }

  /**
   * 모듈 타입 추론
   */
  private static inferModuleType(content: string): 'esm' | 'cjs' | 'hybrid' {
    const hasEsmImport = content.includes('import ') || content.includes('export ')
    const hasCjsRequire = content.includes('require(') || content.includes('module.exports')

    if (hasEsmImport && hasCjsRequire) {
      return 'hybrid'
    } else if (hasEsmImport) {
      return 'esm'
    } else if (hasCjsRequire) {
      return 'cjs'
    } else {
      return 'esm' // 기본값
    }
  }

  /**
   * 메인 라이브러리 메타데이터 생성
   */
  private static createMainLibraryMetadata(packageJson: any): LibraryMetadata {
    const id = IdGenerator.generateContentHash(`library::${packageJson.name}`)

    return {
      id,
      name: packageJson.name || 'unnamed-project',
      type: 'internal',
      role: CodeRole.SERVICE,
      version: packageJson.version,
      description: packageJson.description,
      entryPoint: packageJson.main || packageJson.bin || 'dist/bin.js',
      exports: packageJson.exports ? Object.keys(packageJson.exports) : [],
      dependencies: Object.keys(packageJson.dependencies || {}),
      devDependencies: Object.keys(packageJson.devDependencies || {}),
      peerDependencies: Object.keys(packageJson.peerDependencies || {}),
    }
  }

  /**
   * 외부 라이브러리 메타데이터 생성
   */
  private static createExternalLibraryMetadata(name: string, version: string, depType: string): LibraryMetadata {
    const id = IdGenerator.generateContentHash(`external::${name}`)

    // 라이브러리 타입 추론
    const role = LibraryAnalyzer.classifyLibraryRole(name)
    const type = LibraryAnalyzer.isBuiltinLibrary(name) ? 'builtin' : 'external'

    return {
      id,
      name,
      type,
      role,
      version,
      description: `External ${depType}: ${name}`,
      exports: [],
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
    }
  }

  /**
   * 라이브러리 역할 분류
   */
  private static classifyLibraryRole(name: string): CodeRole {
    // 테스트 관련
    if (
      name.includes('test') ||
      name.includes('jest') ||
      name.includes('vitest') ||
      name.includes('mocha') ||
      name.includes('chai')
    ) {
      return CodeRole.TEST
    }

    // 타입 관련
    if (name.startsWith('@types/') || name.includes('typescript')) {
      return CodeRole.TYPE
    }

    // 빌드/스크립트 관련
    if (
      name.includes('webpack') ||
      name.includes('vite') ||
      name.includes('rollup') ||
      name.includes('babel') ||
      name.includes('esbuild') ||
      name.includes('tsc')
    ) {
      return CodeRole.SCRIPT
    }

    // 설정 관련
    if (name.includes('config') || name.includes('eslint') || name.includes('prettier')) {
      return CodeRole.CONFIG
    }

    // 유틸리티
    if (name.includes('lodash') || name.includes('ramda') || name.includes('util')) {
      return CodeRole.UTILITY
    }

    // 기본값
    return CodeRole.SERVICE
  }

  /**
   * 내장 라이브러리 확인
   */
  private static isBuiltinLibrary(name: string): boolean {
    const builtins = [
      'fs',
      'path',
      'url',
      'crypto',
      'os',
      'util',
      'events',
      'stream',
      'http',
      'https',
      'net',
      'tls',
      'dns',
      'child_process',
      'cluster',
      'readline',
      'repl',
      'vm',
      'zlib',
      'buffer',
      'querystring',
      'node:fs',
      'node:path',
      'node:url',
      'node:crypto',
      'node:os',
    ]

    return builtins.includes(name) || name.startsWith('node:')
  }

  /**
   * 빈 결과 생성
   */
  private static createEmptyResult(): LibraryAnalysisResult {
    return {
      libraries: [],
      modules: [],
      internalModules: [],
      externalLibraries: [],
    }
  }

  /**
   * 라이브러리 의존성 그래프 생성
   */
  static generateLibraryDependencyGraph(
    libraries: LibraryMetadata[],
    modules: ModuleMetadata[]
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    // 라이브러리 간 의존성
    for (const library of libraries) {
      graph.set(library.name, library.dependencies)
    }

    // 모듈 간 의존성
    for (const module of modules) {
      graph.set(module.name, module.imports)
    }

    return graph
  }

  /**
   * 순환 의존성 검사
   */
  static detectCircularDependencies(dependencyGraph: Map<string, string[]>): string[][] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // 순환 의존성 발견
        const cycleStart = path.indexOf(node)
        cycles.push([...path.slice(cycleStart), node])
        return
      }

      if (visited.has(node)) {
        return
      }

      visited.add(node)
      recursionStack.add(node)
      path.push(node)

      const dependencies = dependencyGraph.get(node) || []
      for (const dep of dependencies) {
        dfs(dep, [...path])
      }

      recursionStack.delete(node)
    }

    for (const node of dependencyGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node, [])
      }
    }

    return cycles
  }
}
