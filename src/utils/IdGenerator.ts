/**
 * ID 생성 시스템
 * 파일과 메서드에 대한 안정적인 고유 ID 생성
 */

import { createHash } from 'node:crypto'
import type { FileId, FileMetadata, MethodId, MethodMetadata } from '../types/MappingTypes.js'

export class IdGenerator {
  /**
   * 파일 ID 생성 (컨텐츠 해시 기반)
   * 파일 이동에도 안정적이도록 컨텐츠와 상대경로 조합 사용
   */
  static generateFileId(filePath: string, content: string): FileId {
    // 상대경로 정규화 (OS 독립적)
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 컨텐츠 해시 생성
    const contentHash = createHash('sha256').update(content).digest('hex').substring(0, 16)

    // 경로 해시 생성 (파일명 변경 시 추적 가능)
    const pathHash = createHash('sha256').update(normalizedPath).digest('hex').substring(0, 8)

    return `file_${pathHash}_${contentHash}` as FileId
  }

  /**
   * 메서드 ID 생성 (시그니처 해시 기반)
   * 메서드 이동, 이름 변경에도 시그니처가 같으면 동일 ID 유지
   */
  static generateMethodId(methodName: string, signature: string, fileId: FileId, startLine: number): MethodId {
    // 시그니처 정규화 (공백, 줄바꿈 제거)
    const normalizedSignature = signature.replace(/\s+/g, ' ').trim()

    // 시그니처 해시 생성
    const signatureHash = createHash('sha256').update(normalizedSignature).digest('hex').substring(0, 16)

    // 위치 정보 포함 (같은 시그니처의 오버로드 구분)
    const locationHash = createHash('sha256')
      .update(`${fileId}:${startLine}:${methodName}`)
      .digest('hex')
      .substring(0, 8)

    return `method_${locationHash}_${signatureHash}` as MethodId
  }

  /**
   * 컨텐츠 해시 생성 (변경 감지용)
   */
  static generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * 시그니처 해시 생성 (메서드 변경 감지용)
   */
  static generateSignatureHash(signature: string): string {
    const normalized = signature.replace(/\s+/g, ' ').trim()

    return createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * 안정적인 ID 생성을 위한 파일 메타데이터 기반 ID
   * (컨텐츠가 없을 때 사용)
   */
  static generateStableFileId(metadata: Partial<FileMetadata>): FileId {
    const { path, size, lastModified } = metadata

    const stableData = [
      path || 'unknown',
      size?.toString() || '0',
      lastModified?.toISOString() || new Date().toISOString(),
    ].join('|')

    const hash = createHash('sha256').update(stableData).digest('hex').substring(0, 24)

    return `file_stable_${hash}` as FileId
  }

  /**
   * 메서드 메타데이터 기반 안정적 ID 생성
   */
  static generateStableMethodId(metadata: Partial<MethodMetadata>): MethodId {
    const { name, signature, startLine, parentId } = metadata

    const stableData = [
      name || 'anonymous',
      signature || 'unknown',
      startLine?.toString() || '0',
      parentId || 'unknown',
    ].join('|')

    const hash = createHash('sha256').update(stableData).digest('hex').substring(0, 24)

    return `method_stable_${hash}` as MethodId
  }

  /**
   * ID가 유효한 형식인지 검증
   */
  static isValidFileId(id: string): id is FileId {
    return /^file_(stable_)?[a-f0-9]{8,}_[a-f0-9]{16,}$/.test(id)
  }

  static isValidMethodId(id: string): id is MethodId {
    return /^method_(stable_)?[a-f0-9]{8,}_[a-f0-9]{16,}$/.test(id)
  }

  /**
   * ID에서 타입 추출
   */
  static getIdType(id: string): 'file' | 'method' | 'unknown' {
    if (IdGenerator.isValidFileId(id)) return 'file'
    if (IdGenerator.isValidMethodId(id)) return 'method'
    return 'unknown'
  }
}
