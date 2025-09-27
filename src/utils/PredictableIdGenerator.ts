import { basename, dirname, relative, resolve } from 'node:path'
import type { FileId, MethodId, NodeId } from '../types/MappingTypes.js'

/**
 * 예측 가능한 ID 생성기
 *
 * 핵심 원칙:
 * 1. 프로젝트 루트 기반 상대 경로 사용
 * 2. 동일한 파일은 항상 동일한 ID 생성
 * 3. namespace별로 고유성 보장
 * 4. 예측 가능하고 재현 가능한 결과
 */
export class PredictableIdGenerator {
  /**
   * 프로젝트 루트 기반 예측 가능한 파일 ID 생성
   *
   * 예시:
   * - src/utils/IdGenerator.ts -> src-utils-id-generator-ts
   * - test/unit/helper.ts -> test-unit-helper-ts
   * - README.md -> readme-md
   */
  static generateProjectBasedFileId(filePath: string, projectRoot: string): FileId {
    // 프로젝트 루트 기준 상대 경로 계산
    const absoluteFilePath = resolve(filePath)
    const absoluteProjectRoot = resolve(projectRoot)
    const relativePath = relative(absoluteProjectRoot, absoluteFilePath)

    // 경로를 kebab-case로 정규화
    const normalizedPath = PredictableIdGenerator.pathToKebabCase(relativePath)

    return normalizedPath as FileId
  }

  /**
   * 역매핑 가능한 프로젝트 기반 파일 ID 생성
   *
   * 구분자 규칙:
   * - 디렉토리 구분: `-`
   * - 파일명 내 하이픈: `_`
   * - 파일명 내 언더스코어: `__`
   *
   * 예시:
   * - src/utils/my-helper.ts -> src-utils-my_helper-ts
   * - src/utils/my_helper.ts -> src-utils-my__helper-ts
   */
  static generateReversibleFileId(filePath: string, projectRoot: string): FileId {
    // 프로젝트 루트 기준 상대 경로 계산
    const absoluteFilePath = resolve(filePath)
    const absoluteProjectRoot = resolve(projectRoot)
    const relativePath = relative(absoluteProjectRoot, absoluteFilePath)

    // 역매핑 가능한 ID 생성
    const normalizedPath = PredictableIdGenerator.pathToReversibleId(relativePath)

    return normalizedPath as FileId
  }

  /**
   * 네임스페이스별 고유 파일 ID 생성
   *
   * 예시:
   * - namespace: "production", file: "src/utils/IdGenerator.ts"
   *   -> "prod-src-utils-id-generator-ts"
   * - namespace: "test", file: "src/utils/IdGenerator.ts"
   *   -> "test-src-utils-id-generator-ts"
   */
  static generateNamespacedFileId(filePath: string, projectRoot: string, namespace: string): FileId {
    const baseId = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)
    const namespacePrefix = PredictableIdGenerator.normalizeNamespace(namespace)

    return `${namespacePrefix}-${baseId}` as FileId
  }

  /**
   * 메서드 ID 생성 (파일 ID 기반)
   *
   * 예시:
   * - fileId: "src-utils-id-generator-ts", method: "generateFileId"
   *   -> "src-utils-id-generator-ts--generate-file-id"
   */
  static generatePredictableMethodId(methodName: string, fileId: FileId, startLine?: number): MethodId {
    const normalizedMethodName = PredictableIdGenerator.toKebabCase(methodName)

    // 라인 번호가 있는 경우 포함 (같은 이름의 메서드 구분용)
    const linePrefix = startLine ? `-l${startLine}` : ''

    return `${fileId}--${normalizedMethodName}${linePrefix}` as MethodId
  }

  /**
   * 디렉토리 기반 계층적 ID 생성
   *
   * 예시:
   * - src/components/ui/Button.tsx -> "src-components-ui-button-tsx"
   * - docs/guides/setup.md -> "docs-guides-setup-md"
   */
  static generateHierarchicalId(filePath: string, projectRoot: string, maxDepth: number = 5): FileId {
    const relativePath = relative(resolve(projectRoot), resolve(filePath))
    const pathParts = relativePath.split('/').filter((part) => part !== '')

    // 최대 깊이 제한
    const limitedParts = pathParts.slice(0, maxDepth)

    return PredictableIdGenerator.pathToKebabCase(limitedParts.join('/')) as FileId
  }

  /**
   * 단순한 파일명 기반 ID (충돌 시 경로 포함)
   *
   * 예시:
   * - utils/helper.ts -> "helper-ts"
   * - src/utils/helper.ts (충돌 시) -> "src-utils-helper-ts"
   */
  static generateSimpleFileId(filePath: string, projectRoot: string, existingIds: Set<string>): FileId {
    const relativePath = relative(resolve(projectRoot), resolve(filePath))
    const fileName = basename(relativePath)
    const simpleId = PredictableIdGenerator.toKebabCase(fileName)

    // 충돌 검사
    if (!existingIds.has(simpleId)) {
      return simpleId as FileId
    }

    // 충돌 시 부모 디렉토리 포함
    const parentDir = basename(dirname(relativePath))
    const expandedId =
      parentDir !== '.'
        ? `${PredictableIdGenerator.toKebabCase(parentDir)}-${simpleId}`
        : PredictableIdGenerator.pathToKebabCase(relativePath)

    return expandedId as FileId
  }

  /**
   * 프로젝트 구조 기반 스마트 ID 생성
   *
   * 규칙:
   * 1. src/ -> 생략 (기본)
   * 2. test/ -> test- 접두사
   * 3. docs/ -> docs- 접두사
   * 4. examples/ -> ex- 접두사
   */
  static generateSmartProjectId(filePath: string, projectRoot: string): FileId {
    const relativePath = relative(resolve(projectRoot), resolve(filePath))
    const pathParts = relativePath.split('/').filter((part) => part !== '')

    if (pathParts.length === 0) {
      return 'root' as FileId
    }

    const [firstDir, ...restParts] = pathParts
    const fileName = pathParts[pathParts.length - 1]

    // 스마트 접두사 결정
    let prefix = ''
    const pathToProcess = restParts

    switch (firstDir) {
      case 'src':
        // src는 생략
        prefix = ''
        break
      case 'test':
      case 'tests':
        prefix = 'test-'
        break
      case 'docs':
      case 'documentation':
        prefix = 'docs-'
        break
      case 'examples':
      case 'example':
        prefix = 'ex-'
        break
      case 'scripts':
        prefix = 'script-'
        break
      case 'config':
        prefix = 'cfg-'
        break
      default:
        // 기타 디렉토리는 포함
        prefix = `${PredictableIdGenerator.toKebabCase(firstDir)}-`
        break
    }

    // 나머지 경로 처리
    const remainingPath = pathToProcess.length > 0 ? pathToProcess.join('/') : fileName

    const normalizedPath = PredictableIdGenerator.pathToKebabCase(remainingPath)

    return `${prefix}${normalizedPath}` as FileId
  }

  /**
   * ID 검증 - 예측 가능한 형식인지 확인
   */
  static isValidPredictableId(id: string): boolean {
    // 소문자, 숫자, 하이픈, 언더스코어 허용
    const validFormat = /^[a-z0-9-_]+$/.test(id)

    // 연속 하이픈 불허
    const noConsecutiveHyphens = !/-{2,}/.test(id)

    // 시작/끝 하이픈 불허
    const noEdgeHyphens = !id.startsWith('-') && !id.endsWith('-')

    // 적절한 길이
    const reasonableLength = id.length >= 1 && id.length <= 100

    return validFormat && noConsecutiveHyphens && noEdgeHyphens && reasonableLength
  }

  /**
   * 프로젝트 내 파일 경로에서 의미 있는 컨텍스트 추출
   */
  static extractFileContext(
    filePath: string,
    projectRoot: string
  ): {
    category: string
    subcategory: string
    name: string
    extension: string
  } {
    const relativePath = relative(resolve(projectRoot), resolve(filePath))
    const pathParts = relativePath.split('/').filter((part) => part !== '')

    const fileName = pathParts[pathParts.length - 1] || 'unknown'
    const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : ''

    // 마지막 확장자만 제거 (예: helper.spec.ts -> helper.spec)
    const nameWithoutExtension = fileName.replace(/\.[^.]*$/, '')
    const name = PredictableIdGenerator.toKebabCase(nameWithoutExtension)

    const category = pathParts.length >= 2 ? PredictableIdGenerator.toKebabCase(pathParts[0]) : 'root'

    const subcategory = pathParts.length >= 3 ? PredictableIdGenerator.toKebabCase(pathParts[1]) : 'main'

    return { category, subcategory, name, extension }
  }

  /**
   * ID 비교 및 분석 도구
   */
  static compareIdStrategies(
    filePath: string,
    projectRoot: string,
    namespace?: string
  ): {
    projectBased: FileId
    namespaced?: FileId
    hierarchical: FileId
    simple: FileId
    smart: FileId
    context: ReturnType<typeof PredictableIdGenerator.extractFileContext>
  } {
    const existingIds = new Set<string>()

    const result = {
      projectBased: PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot),
      hierarchical: PredictableIdGenerator.generateHierarchicalId(filePath, projectRoot),
      simple: PredictableIdGenerator.generateSimpleFileId(filePath, projectRoot, existingIds),
      smart: PredictableIdGenerator.generateSmartProjectId(filePath, projectRoot),
      context: PredictableIdGenerator.extractFileContext(filePath, projectRoot),
    }

    if (namespace) {
      ;(result as any).namespaced = PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, namespace)
    }

    return result
  }

  /**
   * 역매핑 가능한 경로 ID 생성
   *
   * 구분자 규칙:
   * - 디렉토리 구분: `-`
   * - 파일명 내 하이픈: `_`
   * - 파일명 내 언더스코어: `__`
   */
  private static pathToReversibleId(path: string): string {
    return path
      .replace(/\\/g, '/') // 윈도우 경로 정규화
      .split('/')
      .map((part) => PredictableIdGenerator.toReversibleKebabCase(part))
      .join('-')
  }

  /**
   * 경로를 kebab-case로 변환 (기존 호환성)
   */
  private static pathToKebabCase(path: string): string {
    return path
      .replace(/\\/g, '/') // 윈도우 경로 정규화
      .split('/')
      .map((part) => PredictableIdGenerator.toKebabCase(part))
      .join('-')
  }

  /**
   * 역매핑 가능한 kebab-case 변환
   *
   * 새로운 구분자 규칙 (완전히 분리된 문자 사용):
   * - 파일명 내 하이픈: `x`로 변환 (hyphen marker)
   * - 파일명 내 언더스코어: `z`로 변환 (underscore marker)
   * - camelCase: `y`로 구분 (camel marker)
   * - 확장자 점: `dot`로 변환
   */
  private static toReversibleKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1y$2') // camelCase -> y 구분
      .replace(/_/g, 'z') // 언더스코어를 z로 변환
      .replace(/-/g, 'x') // 하이픈을 x로 변환
      .replace(/\./g, 'dot') // 점을 dot으로 변환
      .replace(/[\s]+/g, 'x') // 공백을 x로 변환
      .replace(/[^a-zA-Z0-9]/g, '') // 특수문자 제거
      .toLowerCase()
  }

  /**
   * 문자열을 kebab-case로 변환 (기존 호환성)
   */
  private static toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase -> kebab-case
      .replace(/_/g, '__') // 언더스코어를 더블 언더스코어로 변환 (구분 보존)
      .replace(/[\s.]+/g, '-') // 공백, 점을 하이픈으로
      .replace(/[^a-zA-Z0-9\-_]/g, '') // 특수문자 제거 (언더스코어는 보존)
      .toLowerCase()
      .replace(/^-+|-+$/g, '') // 시작/끝 하이픈 제거
      .replace(/-+/g, '-') // 연속 하이픈을 하나로
  }

  /**
   * 역매핑: ID에서 원본 파일 경로 복원
   *
   * 예시:
   * - src-utils-myxhelperdotts -> src/utils/my-helper.ts
   * - src-utils-myzhelperdotts -> src/utils/my_helper.ts
   */
  static reverseFileId(fileId: string, projectRoot: string): string {
    // 디렉토리 구분자(하이픈)를 슬래시로 변환
    const pathParts = fileId.split('-')

    // 각 파트에서 파일명 내 구분자 복원
    const restoredParts = pathParts.map((part) => {
      return part
        .replace(/dot/g, '.') // dot을 점으로 복원
        .replace(/y([a-z])/g, (match, p1) => p1.toUpperCase()) // camelCase 복원: y다음 문자를 대문자로
        .replace(/y/g, '') // 남은 y 제거
        .replace(/z/g, '_') // z를 언더스코어로 복원
        .replace(/x/g, '-') // x를 하이픈으로 복원
    })

    const relativePath = restoredParts.join('/')
    return resolve(projectRoot, relativePath)
  }

  /**
   * 파일 확장자 판별 (PathMapper와 동일한 로직)
   */
  private static isFileExtension(str: string): boolean {
    return /^[a-z]{1,4}$/.test(str) && ['ts', 'js', 'tsx', 'jsx', 'json', 'md', 'yml', 'yaml'].includes(str)
  }

  /**
   * 네임스페이스 정규화
   */
  private static normalizeNamespace(namespace: string): string {
    // 일반적인 네임스페이스 축약
    const abbreviations: Record<string, string> = {
      production: 'prod',
      development: 'dev',
      testing: 'test',
      staging: 'stage',
    }

    const normalized = PredictableIdGenerator.toKebabCase(namespace)
    return abbreviations[normalized] || normalized
  }

  /**
   * 프로젝트 루트 검증
   */
  static validateProjectRoot(projectRoot: string): boolean {
    try {
      const fs = require('node:fs')
      return fs.existsSync(projectRoot) && fs.statSync(projectRoot).isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 배치 ID 생성 (프로젝트 전체)
   */
  static generateBatchIds(
    filePaths: string[],
    projectRoot: string,
    strategy: 'smart' | 'hierarchical' | 'simple' = 'smart'
  ): Map<string, FileId> {
    const existingIds = new Set<string>()
    const result = new Map<string, FileId>()

    for (const filePath of filePaths) {
      let id: FileId

      switch (strategy) {
        case 'hierarchical':
          id = PredictableIdGenerator.generateHierarchicalId(filePath, projectRoot)
          break
        case 'simple':
          id = PredictableIdGenerator.generateSimpleFileId(filePath, projectRoot, existingIds)
          break
        case 'smart':
        default:
          id = PredictableIdGenerator.generateSmartProjectId(filePath, projectRoot)
          break
      }

      // 중복 방지
      if (existingIds.has(id)) {
        // 충돌 시 전체 경로 사용
        id = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)
      }

      existingIds.add(id)
      result.set(filePath, id)
    }

    return result
  }
}
