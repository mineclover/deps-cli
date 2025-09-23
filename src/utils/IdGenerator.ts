/**
 * 파일 고유 식별자 생성 유틸리티
 */

import * as crypto from 'node:crypto'
import * as path from 'node:path'
import type { IdGenerationConfig } from '../types/ReferenceMetadata.js'

export class IdGenerator {
  private counter = 0
  private generatedIds = new Set<string>()

  constructor(private config: IdGenerationConfig) {}

  /**
   * 파일 경로를 기반으로 고유 식별자 생성
   */
  generateFileId(filePath: string, projectRoot: string): string {
    const relativePath = path.relative(projectRoot, filePath)

    switch (this.config.strategy) {
      case 'hash':
        return this.generateHashId(relativePath)

      case 'path-based':
        return this.generatePathBasedId(relativePath)

      case 'sequential':
        return this.generateSequentialId(relativePath)

      default:
        throw new Error(`Unknown ID generation strategy: ${this.config.strategy}`)
    }
  }

  /**
   * 해시 기반 ID 생성
   */
  private generateHashId(relativePath: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(relativePath)
      .digest('hex')
      .substring(0, this.config.hashLength || 8)

    const prefix = this.config.prefix || 'file'
    return `${prefix}_${hash}`
  }

  /**
   * 경로 기반 ID 생성
   */
  private generatePathBasedId(relativePath: string): string {
    // 경로를 안전한 식별자로 변환
    const safeId = relativePath
      .replace(/[^a-zA-Z0-9]/g, '_')  // 특수문자를 언더스코어로
      .replace(/_+/g, '_')           // 연속된 언더스코어 제거
      .replace(/^_|_$/g, '')         // 시작/끝 언더스코어 제거
      .toLowerCase()

    const prefix = this.config.prefix || 'file'
    let id = `${prefix}_${safeId}`

    // 중복 방지
    if (this.generatedIds.has(id)) {
      let suffix = 1
      while (this.generatedIds.has(`${id}_${suffix}`)) {
        suffix++
      }
      id = `${id}_${suffix}`
    }

    this.generatedIds.add(id)
    return id
  }

  /**
   * 순차적 ID 생성
   */
  private generateSequentialId(relativePath: string): string {
    const prefix = this.config.prefix || 'file'
    const id = `${prefix}_${String(this.counter).padStart(4, '0')}`
    this.counter++
    return id
  }

  /**
   * 생성된 ID 초기화
   */
  reset(): void {
    this.counter = 0
    this.generatedIds.clear()
  }

  /**
   * 생성된 ID 개수 반환
   */
  getGeneratedCount(): number {
    return this.generatedIds.size
  }
}

/**
 * 기본 ID 생성기 팩토리
 */
export function createDefaultIdGenerator(): IdGenerator {
  return new IdGenerator({
    strategy: 'path-based',
    prefix: 'file'
  })
}

/**
 * 해시 기반 ID 생성기 팩토리
 */
export function createHashIdGenerator(hashLength = 8): IdGenerator {
  return new IdGenerator({
    strategy: 'hash',
    prefix: 'f',
    hashLength
  })
}

/**
 * 순차적 ID 생성기 팩토리
 */
export function createSequentialIdGenerator(): IdGenerator {
  return new IdGenerator({
    strategy: 'sequential',
    prefix: 'file'
  })
}