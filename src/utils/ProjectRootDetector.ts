/**
 * 프로젝트 루트 자동 감지 유틸리티
 * dependency-linker 예제를 기반으로 한 고급 프로젝트 루트 감지
 */

import * as path from 'node:path'
import * as fs from 'node:fs'

export interface ProjectRootInfo {
  rootPath: string
  projectType: 'frontend' | 'backend' | 'library' | 'monorepo' | 'unknown'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown'
  hasTypeScript: boolean
  indicators: string[]
}

/**
 * 프로젝트 루트를 자동 감지합니다
 */
export function findProjectRoot(startPath: string): string {
  let currentPath = path.resolve(startPath)

  while (currentPath !== path.dirname(currentPath)) {
    // package.json, tsconfig.json, .git 등으로 프로젝트 루트 감지
    const indicators = [
      'package.json',
      'tsconfig.json',
      '.git',
      'yarn.lock',
      'pnpm-lock.yaml',
      'lerna.json',
      'nx.json',
      'rush.json'
    ]

    for (const indicator of indicators) {
      const indicatorPath = path.join(currentPath, indicator)
      if (fs.existsSync(indicatorPath)) {
        return currentPath
      }
    }

    currentPath = path.dirname(currentPath)
  }

  // 찾지 못한 경우 원래 경로의 상위 디렉토리 반환
  return path.dirname(startPath)
}

/**
 * 프로젝트 루트의 상세 정보를 분석합니다
 */
export function analyzeProjectRoot(rootPath: string): ProjectRootInfo {
  const indicators: string[] = []
  let projectType: ProjectRootInfo['projectType'] = 'unknown'
  let packageManager: ProjectRootInfo['packageManager'] = 'unknown'
  let hasTypeScript = false

  // 프로젝트 지표 파일들 확인
  const projectFiles = [
    'package.json',
    'tsconfig.json',
    '.git',
    'yarn.lock',
    'pnpm-lock.yaml',
    'package-lock.json',
    'lerna.json',
    'nx.json',
    'rush.json',
    'next.config.js',
    'nuxt.config.js',
    'vite.config.js',
    'webpack.config.js'
  ]

  for (const file of projectFiles) {
    const filePath = path.join(rootPath, file)
    if (fs.existsSync(filePath)) {
      indicators.push(file)
    }
  }

  // 패키지 매니저 감지
  if (indicators.includes('pnpm-lock.yaml')) {
    packageManager = 'pnpm'
  } else if (indicators.includes('yarn.lock')) {
    packageManager = 'yarn'
  } else if (indicators.includes('package-lock.json')) {
    packageManager = 'npm'
  }

  // TypeScript 프로젝트 여부
  hasTypeScript = indicators.includes('tsconfig.json')

  // 프로젝트 타입 감지
  if (indicators.includes('lerna.json') || indicators.includes('nx.json') || indicators.includes('rush.json')) {
    projectType = 'monorepo'
  } else if (indicators.includes('next.config.js') || indicators.includes('nuxt.config.js') || indicators.includes('vite.config.js')) {
    projectType = 'frontend'
  } else {
    // package.json을 읽어서 더 정확한 타입 판단
    try {
      const packageJsonPath = path.join(rootPath, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

        // 의존성을 통한 타입 추정
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

        if (dependencies['react'] || dependencies['vue'] || dependencies['angular'] || dependencies['svelte']) {
          projectType = 'frontend'
        } else if (dependencies['express'] || dependencies['koa'] || dependencies['fastify'] || dependencies['nestjs']) {
          projectType = 'backend'
        } else if (packageJson.main || packageJson.module || packageJson.exports) {
          projectType = 'library'
        }
      }
    } catch (error) {
      // package.json 파싱 실패시 무시
    }
  }

  return {
    rootPath,
    projectType,
    packageManager,
    hasTypeScript,
    indicators
  }
}

/**
 * 프로젝트 루트로부터의 상대 경로를 계산합니다
 */
export function getProjectRelativePath(filePath: string, projectRoot: string): string {
  return path.relative(projectRoot, filePath)
}

/**
 * 파일이 프로젝트 내부에 있는지 확인합니다
 */
export function isWithinProject(filePath: string, projectRoot: string): boolean {
  const relative = path.relative(projectRoot, filePath)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * 여러 경로의 공통 기준 경로를 찾습니다
 */
export function findCommonBasePath(paths: string[]): string {
  if (paths.length === 0) return ''
  if (paths.length === 1) return path.dirname(paths[0])

  let commonPath = paths[0]

  for (let i = 1; i < paths.length; i++) {
    const currentPath = paths[i]

    // 두 경로의 공통 부분 찾기
    const commonParts: string[] = []
    const path1Parts = commonPath.split(path.sep)
    const path2Parts = currentPath.split(path.sep)

    const minLength = Math.min(path1Parts.length, path2Parts.length)

    for (let j = 0; j < minLength; j++) {
      if (path1Parts[j] === path2Parts[j]) {
        commonParts.push(path1Parts[j])
      } else {
        break
      }
    }

    commonPath = commonParts.join(path.sep)
  }

  return commonPath || path.sep
}