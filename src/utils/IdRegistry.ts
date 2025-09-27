/**
 * ID 레지스트리 시스템
 * ID 조회, 중복 방지, 일관된 위치 지정을 담당
 */

import { createHash } from 'node:crypto'
import type { FileId, IdMappingTable, MethodId, NodeId } from '../types/MappingTypes.js'
import { ImprovedIdGenerator } from './ImprovedIdGenerator.js'
import { PredictableIdGenerator } from './PredictableIdGenerator.js'

export interface IdRegistryEntry {
  id: NodeId
  type: 'file' | 'method'
  path: string
  hash: string
  metadata?: Record<string, any>
  createdAt: Date
  lastSeen: Date
}

export class IdRegistry {
  private entries: Map<NodeId, IdRegistryEntry> = new Map()
  private pathToId: Map<string, NodeId> = new Map()
  private hashToId: Map<string, NodeId> = new Map()

  /**
   * 파일 ID 조회 또는 생성 (기존 파일 우선 사용)
   */
  getOrCreateFileId(filePath: string, content: string, relativePath: string): { id: FileId; isNew: boolean } {
    // 1. 경로로 기존 ID 조회 (가장 우선)
    const existingId = this.pathToId.get(relativePath)
    if (existingId && this.isFileId(existingId)) {
      const entry = this.entries.get(existingId)!
      entry.lastSeen = new Date()

      // 컨텐츠가 변경되었는지 확인하여 해시 업데이트
      const currentHash = this.generateContentHash(content)
      if (entry.hash !== currentHash) {
        entry.hash = currentHash
        // 해시 매핑도 업데이트
        this.hashToId.set(currentHash, existingId)
      }

      return { id: existingId as FileId, isNew: false }
    }

    // 2. 컨텐츠 해시로 조회 (파일 이동 감지)
    const contentHash = this.generateContentHash(content)
    const existingByHash = this.hashToId.get(contentHash)

    if (existingByHash && this.isFileId(existingByHash)) {
      // 파일이 이동된 경우 - 경로 업데이트
      const entry = this.entries.get(existingByHash)!

      // 이전 경로 매핑 제거
      this.pathToId.delete(entry.path)

      // 새 경로로 업데이트
      entry.path = relativePath
      entry.lastSeen = new Date()
      this.pathToId.set(relativePath, existingByHash)

      return { id: existingByHash as FileId, isNew: false }
    }

    // 3. 새 ID 생성 (파일 경로 기반으로 단순하게)
    const newId = this.generateFileId(relativePath, content)
    const entry: IdRegistryEntry = {
      id: newId,
      type: 'file',
      path: relativePath,
      hash: contentHash,
      createdAt: new Date(),
      lastSeen: new Date(),
    }

    // 레지스트리에 등록
    this.registerEntry(entry)

    return { id: newId, isNew: true }
  }

  /**
   * 읽기 쉬운 파일 ID 조회 또는 생성 (ImprovedIdGenerator 사용)
   */
  getOrCreateReadableFileId(relativePath: string, content: string): { id: FileId; isNew: boolean } {
    // 1. 경로로 기존 ID 조회 (가장 우선)
    const existingId = this.pathToId.get(relativePath)
    if (existingId && this.isFileId(existingId)) {
      const entry = this.entries.get(existingId)!
      entry.lastSeen = new Date()

      // 컨텐츠가 변경되었는지 확인하여 해시 업데이트
      const currentHash = this.generateContentHash(content)
      if (entry.hash !== currentHash) {
        entry.hash = currentHash
        // 해시 매핑도 업데이트
        this.hashToId.set(currentHash, existingId)
      }

      return { id: existingId as FileId, isNew: false }
    }

    // 2. 컨텐츠 해시로 조회 (파일 이동 감지)
    const contentHash = this.generateContentHash(content)
    const existingByHash = this.hashToId.get(contentHash)

    if (existingByHash && this.isFileId(existingByHash)) {
      // 파일이 이동된 경우 - 경로 업데이트
      const entry = this.entries.get(existingByHash)!

      // 이전 경로 매핑 제거
      this.pathToId.delete(entry.path)

      // 새 경로로 업데이트
      entry.path = relativePath
      entry.lastSeen = new Date()
      this.pathToId.set(relativePath, existingByHash)

      return { id: existingByHash as FileId, isNew: false }
    }

    // 3. ImprovedIdGenerator를 사용한 새 ID 생성
    const newId = ImprovedIdGenerator.generateReadableFileId(relativePath, content)
    const entry: IdRegistryEntry = {
      id: newId,
      type: 'file',
      path: relativePath,
      hash: contentHash,
      createdAt: new Date(),
      lastSeen: new Date(),
    }

    // 레지스트리에 등록
    this.registerEntry(entry)

    return { id: newId, isNew: true }
  }

  /**
   * 예측 가능한 프로젝트 기반 파일 ID 조회 또는 생성
   */
  getOrCreatePredictableFileId(
    filePath: string,
    projectRoot: string,
    namespace?: string
  ): { id: FileId; isNew: boolean } {
    // 1. 경로로 기존 ID 조회 (가장 우선)
    const normalizedPath = filePath.replace(/\\/g, '/')
    const existingId = this.pathToId.get(normalizedPath)

    if (existingId && this.isFileId(existingId)) {
      const entry = this.entries.get(existingId)!
      entry.lastSeen = new Date()
      return { id: existingId as FileId, isNew: false }
    }

    // 2. PredictableIdGenerator를 사용한 새 ID 생성
    const newId = namespace
      ? PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, namespace)
      : PredictableIdGenerator.generateSmartProjectId(filePath, projectRoot)

    // 3. ID 충돌 검사 및 해결
    let finalId = newId
    if (this.entries.has(newId)) {
      // 충돌 시 전체 프로젝트 경로 사용
      finalId = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)

      // 여전히 충돌하는 경우 (매우 드묾) 타임스탬프 추가
      if (this.entries.has(finalId)) {
        finalId = `${finalId}-${Date.now()}` as FileId
      }
    }

    const entry: IdRegistryEntry = {
      id: finalId,
      type: 'file',
      path: normalizedPath,
      hash: this.generateContentHash(''), // 컨텐츠 해시는 나중에 업데이트
      createdAt: new Date(),
      lastSeen: new Date(),
    }

    // 레지스트리에 등록
    this.registerEntry(entry)

    return { id: finalId, isNew: true }
  }

  /**
   * 예측 가능한 메서드 ID 조회 또는 생성
   */
  getOrCreatePredictableMethodId(
    methodName: string,
    fileId: FileId,
    startLine?: number
  ): { id: MethodId; isNew: boolean } {
    const methodPath = `${fileId}:${methodName}${startLine ? `:${startLine}` : ''}`

    // 1. 경로로 기존 ID 조회
    const existingId = this.pathToId.get(methodPath)
    if (existingId && this.isMethodId(existingId)) {
      const entry = this.entries.get(existingId)!
      entry.lastSeen = new Date()
      return { id: existingId as MethodId, isNew: false }
    }

    // 2. 예측 가능한 메서드 ID 생성
    const newId = PredictableIdGenerator.generatePredictableMethodId(methodName, fileId, startLine)

    const entry: IdRegistryEntry = {
      id: newId,
      type: 'method',
      path: methodPath,
      hash: this.generateSignatureHash(''), // 시그니처 해시는 나중에 업데이트
      createdAt: new Date(),
      lastSeen: new Date(),
    }

    // 레지스트리에 등록
    this.registerEntry(entry)

    return { id: newId, isNew: true }
  }

  /**
   * 메서드 ID 조회 또는 생성 (기존 메서드 우선 사용)
   */
  getOrCreateMethodId(
    methodName: string,
    signature: string,
    fileId: FileId,
    startLine: number
  ): { id: MethodId; isNew: boolean } {
    const methodPath = `${fileId}:${methodName}:${startLine}`

    // 1. 경로로 기존 ID 조회 (가장 우선)
    const existingId = this.pathToId.get(methodPath)
    if (existingId && this.isMethodId(existingId)) {
      const entry = this.entries.get(existingId)!
      entry.lastSeen = new Date()

      // 시그니처 변경 확인하여 해시 업데이트
      const currentHash = this.generateSignatureHash(signature)
      if (entry.hash !== currentHash) {
        entry.hash = currentHash
        // 해시 매핑도 업데이트
        const signatureKey = `${fileId}:${currentHash}`
        this.hashToId.set(signatureKey, existingId)
      }

      return { id: existingId as MethodId, isNew: false }
    }

    // 2. 시그니처 해시로 조회 (메서드 이동 감지)
    const signatureHash = this.generateSignatureHash(signature)
    const signatureKey = `${fileId}:${signatureHash}`
    const existingBySignature = this.hashToId.get(signatureKey)

    if (existingBySignature && this.isMethodId(existingBySignature)) {
      const entry = this.entries.get(existingBySignature)!

      // 이전 경로 매핑 제거
      this.pathToId.delete(entry.path)

      // 새 위치로 업데이트
      entry.path = methodPath
      entry.lastSeen = new Date()
      this.pathToId.set(methodPath, existingBySignature)

      return { id: existingBySignature as MethodId, isNew: false }
    }

    // 3. 새 ID 생성 (메서드 경로 기반으로 단순하게)
    const newId = this.generateMethodId(methodName, signature, fileId, startLine)
    const entry: IdRegistryEntry = {
      id: newId,
      type: 'method',
      path: methodPath,
      hash: signatureHash,
      createdAt: new Date(),
      lastSeen: new Date(),
    }

    // 레지스트리에 등록
    this.registerEntry(entry)

    return { id: newId, isNew: true }
  }

  /**
   * 일관된 마크다운 파일 경로 생성
   */
  getMarkdownPath(nodeId: NodeId, baseOutputDir: string): string {
    const entry = this.entries.get(nodeId)
    if (!entry) {
      throw new Error(`ID not found in registry: ${nodeId}`)
    }

    const { type } = entry

    // 일관된 디렉토리 구조
    const typeDir = type === 'file' ? 'files' : 'methods'

    // ID 기반 파일명 (충돌 방지)
    const fileName = `${nodeId}.md`

    return `${baseOutputDir}/${typeDir}/${fileName}`
  }

  /**
   * ID로 마크다운 링크 생성
   */
  generateIdLink(targetId: NodeId, currentId: NodeId, baseOutputDir: string): string {
    const targetPath = this.getMarkdownPath(targetId, baseOutputDir)
    const currentPath = this.getMarkdownPath(currentId, baseOutputDir)

    // 상대 경로 계산
    const { relative } = require('node:path')
    const relativePath = relative(require('node:path').dirname(currentPath), targetPath)

    const entry = this.entries.get(targetId)
    const displayName = entry ? this.generateDisplayName(entry) : targetId

    return `[${displayName}](${relativePath})`
  }

  /**
   * 엔트리 등록
   */
  private registerEntry(entry: IdRegistryEntry): void {
    this.entries.set(entry.id, entry)
    this.pathToId.set(entry.path, entry.id)

    // 해시 매핑 (중복 감지용)
    if (entry.type === 'file') {
      this.hashToId.set(entry.hash, entry.id)
    } else {
      // 메서드는 파일ID와 함께 해시 저장
      const fileId = entry.path.split(':')[0]
      this.hashToId.set(`${fileId}:${entry.hash}`, entry.id)
    }
  }

  /**
   * 파일 ID 생성 (단순하고 결정적)
   */
  private generateFileId(relativePath: string, content: string): FileId {
    const normalizedPath = relativePath.replace(/\\/g, '/')
    const contentHash = this.generateContentHash(content)
    const pathHash = createHash('sha256').update(normalizedPath).digest('hex').substring(0, 8)

    return `file_${pathHash}_${contentHash.substring(0, 16)}` as FileId
  }

  /**
   * 메서드 ID 생성 (단순하고 결정적)
   */
  private generateMethodId(methodName: string, signature: string, fileId: FileId, startLine: number): MethodId {
    const signatureHash = this.generateSignatureHash(signature)
    const locationHash = createHash('sha256')
      .update(`${fileId}:${startLine}:${methodName}`)
      .digest('hex')
      .substring(0, 8)

    return `method_${locationHash}_${signatureHash.substring(0, 16)}` as MethodId
  }

  /**
   * 컨텐츠 해시 생성
   */
  private generateContentHash(content: string): string {
    return createHash('sha256')
      .update(content.trim()) // 공백 정규화
      .digest('hex')
  }

  /**
   * 시그니처 해시 생성
   */
  private generateSignatureHash(signature: string): string {
    const normalized = signature
      .replace(/\s+/g, ' ') // 공백 정규화
      .trim()

    return createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * ID 타입 확인
   */
  private isFileId(id: NodeId): boolean {
    return (id as string).startsWith('file_')
  }

  private isMethodId(id: NodeId): boolean {
    return (id as string).startsWith('method_')
  }

  /**
   * 표시명 생성
   */
  private generateDisplayName(entry: IdRegistryEntry): string {
    if (entry.type === 'file') {
      const filename = entry.path.split('/').pop() || entry.path
      return filename
    } else {
      const parts = entry.path.split(':')
      return parts[1] || entry.id // method name
    }
  }

  /**
   * 레지스트리 통계
   */
  getStatistics(): {
    totalEntries: number
    fileCount: number
    methodCount: number
    oldestEntry: Date | null
    newestEntry: Date | null
  } {
    const files = Array.from(this.entries.values()).filter((e) => e.type === 'file')
    const methods = Array.from(this.entries.values()).filter((e) => e.type === 'method')

    const allDates = Array.from(this.entries.values()).map((e) => e.createdAt)

    return {
      totalEntries: this.entries.size,
      fileCount: files.length,
      methodCount: methods.length,
      oldestEntry: allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : null,
      newestEntry: allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null,
    }
  }

  /**
   * 사용되지 않는 엔트리 정리 (일정 시간 이후 lastSeen)
   */
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    // 기본 7일
    const now = new Date()
    const removedCount = 0

    for (const [id, entry] of this.entries) {
      if (now.getTime() - entry.lastSeen.getTime() > maxAge) {
        this.entries.delete(id)
        this.pathToId.delete(entry.path)
        this.hashToId.delete(entry.hash)
      }
    }

    return removedCount
  }

  /**
   * 레지스트리 직렬화 (영속성)
   */
  serialize(): string {
    const data = {
      entries: Array.from(this.entries.entries()),
      pathToId: Array.from(this.pathToId.entries()),
      hashToId: Array.from(this.hashToId.entries()),
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * 레지스트리 복원
   */
  static deserialize(data: string): IdRegistry {
    const registry = new IdRegistry()
    const parsed = JSON.parse(data)

    // Map 복원
    registry.entries = new Map(
      parsed.entries.map(([id, entry]: [string, any]) => [
        id,
        {
          ...entry,
          createdAt: new Date(entry.createdAt),
          lastSeen: new Date(entry.lastSeen),
        },
      ])
    )

    registry.pathToId = new Map(parsed.pathToId)
    registry.hashToId = new Map(parsed.hashToId)

    return registry
  }

  /**
   * ID 매핑 테이블 생성 (기존 시스템과 호환)
   */
  toMappingTable(): IdMappingTable {
    const files = new Map<string, FileId>()
    const methods = new Map<string, MethodId>()
    const pathToId = new Map<string, NodeId>()
    const idToPath = new Map<NodeId, string>()
    const roles = new Map<NodeId, any>() // CodeRole은 다른 곳에서 관리

    for (const [id, entry] of this.entries) {
      if (entry.type === 'file') {
        files.set(entry.path, id as FileId)
      } else {
        methods.set(entry.path, id as MethodId)
      }

      pathToId.set(entry.path, id)
      idToPath.set(id, entry.path)
    }

    return { files, methods, pathToId, idToPath, roles }
  }
}
