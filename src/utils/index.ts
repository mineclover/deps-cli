/**
 * deps-cli 유틸리티 모듈들
 *
 * 이 파일을 통해 모든 유틸리티 클래스들을 쉽게 import할 수 있습니다.
 */


// ID 생성 및 관리 클래스들
export { IdGenerator } from './IdGenerator.js'
export { IdRegistry } from './IdRegistry.js'
export { ImprovedIdGenerator } from './ImprovedIdGenerator.js'
// 분석 및 분류 클래스들
export { LibraryAnalyzer } from './LibraryAnalyzer.js'
export type { MarkdownContent } from './MarkdownGenerator.js'
// 마크다운 생성 클래스들
// 마크다운 생성 유틸리티
export { MarkdownGenerator, MarkdownGenerator as MarkdownGeneratorUtil } from './MarkdownGenerator.js'
export { MarkdownPathResolver } from './MarkdownPathResolver.js'
export { MethodAnalyzer } from './MethodAnalyzer.js'
// 경로 해결 및 매핑 클래스들
export { MirrorPathMapper } from './MirrorPathMapper.js'
export { PredictableIdGenerator } from './PredictableIdGenerator.js'
export { RoleClassifier } from './RoleClassifier.js'
export type { FileMetadata, MirrorOptions } from './SimpleMirrorManager.js'
// 핵심 매니저 클래스들
export { SimpleMirrorManager } from './SimpleMirrorManager.js'

/**
 * 편의 함수들
 */

/**
 * SimpleMirrorManager를 빠르게 생성하는 팩토리 함수
 */
export function createMirrorManager(
  projectRoot: string = process.cwd(),
  docsPath: string = './docs',
  namespace?: string
) {
  const { SimpleMirrorManager } = require('./SimpleMirrorManager.js')
  return new SimpleMirrorManager(projectRoot, docsPath, namespace)
}

/**
 * 마크다운 경로 해결기를 빠르게 생성하는 팩토리 함수
 */
export function createPathResolver(
  projectRoot: string = process.cwd(),
  docsPath: string = './docs',
  namespace?: string
) {
  const { MarkdownPathResolver } = require('./MarkdownPathResolver.js')
  return new MarkdownPathResolver(projectRoot, docsPath, namespace)
}

/**
 * 마크다운 생성기를 빠르게 생성하는 팩토리 함수
 */
export function createMarkdownGenerator(
  projectRoot: string = process.cwd(),
  docsPath: string = './docs',
  namespace?: string
) {
  const { MarkdownGenerator } = require('./MarkdownGenerator.js')
  return new MarkdownGenerator(projectRoot, docsPath, namespace)
}

/**
 * 통합 마크다운 생성 함수 (CLI 없이 사용)
 */
export async function generateMarkdownForFile(
  filePath: string,
  options: {
    projectRoot?: string
    docsPath?: string
    namespace?: string
    template?: 'basic' | 'detailed'
    includeSource?: boolean
  } = {}
): Promise<string | null> {
  const {
    projectRoot = process.cwd(),
    docsPath = './docs',
    namespace,
    template = 'basic',
    includeSource = false
  } = options

  const generator = createMarkdownGenerator(projectRoot, docsPath, namespace)
  return await generator.generateMarkdownFile(filePath, {
    includeSource,
    template,
    namespace
  })
}

/**
 * 배치 마크다운 생성 함수
 */
export async function generateMarkdownForFiles(
  filePaths: Array<string>,
  options: {
    projectRoot?: string
    docsPath?: string
    namespace?: string
    template?: 'basic' | 'detailed'
    includeSource?: boolean
    maxFiles?: number
  } = {}
) {
  const {
    projectRoot = process.cwd(),
    docsPath = './docs',
    namespace,
    template = 'basic',
    includeSource = false,
    maxFiles
  } = options

  const generator = createMarkdownGenerator(projectRoot, docsPath, namespace)
  return await generator.generateBatchMarkdown(filePaths, {
    includeSource,
    template,
    namespace,
    maxFiles
  })
}

/**
 * 마크다운 경로 조회 함수
 */
export function getMarkdownPath(
  sourcePath: string,
  options: {
    projectRoot?: string
    docsPath?: string
    namespace?: string
  } = {}
): string {
  const {
    projectRoot = process.cwd(),
    docsPath = './docs',
    namespace
  } = options

  const resolver = createPathResolver(projectRoot, docsPath, namespace)
  return resolver.getMarkdownPath(sourcePath)
}
