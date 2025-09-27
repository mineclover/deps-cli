import { createHash } from 'node:crypto'
import { basename, dirname, extname } from 'node:path'
import type { FileId, MethodId, NodeId } from '../types/MappingTypes.js'

/**
 * 개선된 ID 생성기 - 가독성과 휴먼 프렌들리한 ID 생성
 *
 * 개선점:
 * 1. 파일명 기반의 읽기 쉬운 ID
 * 2. 계층적 구조 반영
 * 3. 충돌 방지를 위한 최소한의 해시
 * 4. 디버깅 친화적인 구조
 */
export class ImprovedIdGenerator {
  /**
   * 개선된 파일 ID 생성
   * 예시: config-manager-ts-a5ec  (ConfigManager.ts -> config-manager-ts-a5ec)
   */
  static generateReadableFileId(filePath: string, content: string): FileId {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const fileName = basename(normalizedPath)
    const dirName = basename(dirname(normalizedPath))

    // 파일명을 kebab-case로 변환
    const cleanFileName = ImprovedIdGenerator.toKebabCase(fileName)

    // 디렉토리 정보 포함 (상위 1개 디렉토리만)
    const dirPrefix =
      dirName !== '.' && dirName !== normalizedPath ? ImprovedIdGenerator.toKebabCase(dirName) + '-' : ''

    // 충돌 방지용 짧은 해시 (4자리)
    const shortHash = createHash('sha256')
      .update(normalizedPath + content.substring(0, 1000)) // 처음 1000자만 사용
      .digest('hex')
      .substring(0, 4)

    return `${dirPrefix}${cleanFileName}-${shortHash}` as FileId
  }

  /**
   * 개선된 메서드 ID 생성
   * 예시: config-manager-ts-a5ec--get-config-b2f1
   */
  static generateReadableMethodId(methodName: string, signature: string, fileId: FileId, startLine: number): MethodId {
    const cleanMethodName = ImprovedIdGenerator.toKebabCase(methodName)

    // 메서드 시그니처 기반 짧은 해시
    const signatureHash = createHash('sha256')
      .update(signature.replace(/\s+/g, ' ').trim())
      .digest('hex')
      .substring(0, 4)

    return `${fileId}--${cleanMethodName}-${signatureHash}` as MethodId
  }

  /**
   * 계층적 구조를 반영한 파일 ID 생성
   * 예시: src-config-manager-ts-a5ec
   */
  static generateHierarchicalFileId(filePath: string, content: string): FileId {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const pathParts = normalizedPath.split('/').filter((part) => part !== '.' && part !== '')

    // 최대 3개 레벨까지만 포함 (너무 길어지지 않도록)
    const relevantParts = pathParts.slice(-3)
    const hierarchicalName = relevantParts.map((part) => ImprovedIdGenerator.toKebabCase(part)).join('-')

    // 충돌 방지용 해시
    const hash = createHash('sha256').update(normalizedPath).digest('hex').substring(0, 4)

    return `${hierarchicalName}-${hash}` as FileId
  }

  /**
   * 역할 기반 파일 ID 생성
   * 예시: service-config-manager-ts-a5ec
   */
  static generateRoleBasedFileId(filePath: string, content: string, role: string): FileId {
    const fileName = basename(filePath)
    const cleanFileName = ImprovedIdGenerator.toKebabCase(fileName)
    const cleanRole = ImprovedIdGenerator.toKebabCase(role)

    const hash = createHash('sha256')
      .update(filePath + content.substring(0, 500))
      .digest('hex')
      .substring(0, 4)

    return `${cleanRole}-${cleanFileName}-${hash}` as FileId
  }

  /**
   * 시맨틱한 파일 ID 생성 (가장 읽기 쉬운 버전)
   * 예시: config-manager (유니크하지 않을 수 있음)
   * 충돌 시에만 해시 추가: config-manager-a5ec
   */
  static generateSemanticFileId(filePath: string, existingIds: Set<string>): FileId {
    const fileName = basename(filePath, extname(filePath))
    const semanticName = ImprovedIdGenerator.toKebabCase(fileName)

    // 충돌 체크
    if (!existingIds.has(semanticName)) {
      return semanticName as FileId
    }

    // 충돌 시 짧은 해시 추가
    const hash = createHash('sha256').update(filePath).digest('hex').substring(0, 4)

    return `${semanticName}-${hash}` as FileId
  }

  /**
   * 문자열을 kebab-case로 변환
   */
  private static toKebabCase(str: string): string {
    return str
      .replace(/\.[^.]*$/, '') // 확장자 제거
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase -> kebab-case
      .replace(/[\s_.]+/g, '-') // 공백, 언더스코어, 점을 하이픈으로
      .replace(/[^a-zA-Z0-9-]/g, '') // 특수문자 제거
      .toLowerCase()
      .replace(/^-+|-+$/g, '') // 시작/끝 하이픈 제거
      .replace(/-+/g, '-') // 연속 하이픈을 하나로
  }

  /**
   * ID 가독성 검증
   */
  static isReadableId(id: string): boolean {
    // 의미있는 단어가 포함되어 있고, 너무 길지 않은지 확인
    const hasSemanticContent = /[a-z]+-[a-z]+/.test(id)
    const reasonableLength = id.length >= 3 && id.length <= 50
    const validFormat = /^[a-z0-9-]+$/.test(id)

    return hasSemanticContent && reasonableLength && validFormat
  }

  /**
   * 파일 경로에서 의미있는 컨텍스트 추출
   */
  static extractFileContext(filePath: string): {
    module: string
    category: string
    name: string
  } {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const parts = normalizedPath.split('/').filter(Boolean)

    // 파일명
    const fileName = parts[parts.length - 1] || 'unknown'
    const name = ImprovedIdGenerator.toKebabCase(fileName)

    // 카테고리 (상위 디렉토리)
    const category = parts.length >= 2 ? ImprovedIdGenerator.toKebabCase(parts[parts.length - 2]) : 'root'

    // 모듈 (src, test, examples 등)
    const module = parts.length >= 3 ? ImprovedIdGenerator.toKebabCase(parts[parts.length - 3]) : 'main'

    return { module, category, name }
  }

  /**
   * 컨텍스트 기반 파일 ID 생성
   * 예시: src-config-manager-ts
   */
  static generateContextualFileId(filePath: string, content: string): FileId {
    const context = ImprovedIdGenerator.extractFileContext(filePath)

    // 중요도에 따라 컨텍스트 조합
    const contextParts: string[] = []

    if (context.module !== 'main') {
      contextParts.push(context.module)
    }

    if (context.category !== 'root') {
      contextParts.push(context.category)
    }

    contextParts.push(context.name)

    const contextualName = contextParts.join('-')

    // 충돌 방지를 위한 선택적 해시
    const needsHash = contextualName.length < 10 // 너무 짧으면 해시 추가

    if (needsHash) {
      const hash = createHash('sha256').update(filePath).digest('hex').substring(0, 4)

      return `${contextualName}-${hash}` as FileId
    }

    return contextualName as FileId
  }

  /**
   * 레거시 해시 ID를 읽기 쉬운 ID로 변환
   */
  static migrateLegacyId(legacyId: string, filePath: string, content: string): FileId {
    // 기존 해시 ID 패턴 확인
    if (/^file_[a-f0-9]{8}_[a-f0-9]{16}$/.test(legacyId)) {
      return ImprovedIdGenerator.generateContextualFileId(filePath, content)
    }

    return legacyId as FileId
  }

  /**
   * 여러 ID 생성 전략 비교 (디버깅/선택용)
   */
  static compareIdStrategies(
    filePath: string,
    content: string,
    role?: string
  ): {
    readable: FileId
    hierarchical: FileId
    contextual: FileId
    semantic: FileId
    roleBased?: FileId
    legacy: FileId
  } {
    const existingIds = new Set<string>()

    return {
      readable: ImprovedIdGenerator.generateReadableFileId(filePath, content),
      hierarchical: ImprovedIdGenerator.generateHierarchicalFileId(filePath, content),
      contextual: ImprovedIdGenerator.generateContextualFileId(filePath, content),
      semantic: ImprovedIdGenerator.generateSemanticFileId(filePath, existingIds),
      roleBased: role ? ImprovedIdGenerator.generateRoleBasedFileId(filePath, content, role) : undefined,
      legacy: ImprovedIdGenerator.generateLegacyFileId(filePath, content),
    }
  }

  /**
   * 기존 해시 기반 ID 생성 (호환성용)
   */
  private static generateLegacyFileId(filePath: string, content: string): FileId {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const contentHash = createHash('sha256').update(content).digest('hex').substring(0, 16)

    const pathHash = createHash('sha256').update(normalizedPath).digest('hex').substring(0, 8)

    return `file_${pathHash}_${contentHash}` as FileId
  }
}
