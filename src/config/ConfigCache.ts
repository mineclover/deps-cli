/**
 * 설정 캐싱 시스템
 */

import type { EnvironmentConfigWithMetadata } from '../types/EnvironmentConfig.js';

interface CacheEntry {
  config: EnvironmentConfigWithMetadata
  timestamp: number
  hash: string
  ttl: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of cache entries
  enableMemoryCache?: boolean
  enableFileCache?: boolean
  cacheDir?: string
}

/**
 * 설정 캐시 관리자
 */
export class ConfigCache {
  private memoryCache: Map<string, CacheEntry> = new Map()
  private options: Required<CacheOptions>

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 300000, // 5분 기본값
      maxSize: options.maxSize ?? 10,
      enableMemoryCache: options.enableMemoryCache ?? true,
      enableFileCache: options.enableFileCache ?? false,
      cacheDir: options.cacheDir ?? '.deps-cli-cache'
    }
  }

  /**
   * 캐시에서 설정 조회
   */
  async get(key: string): Promise<EnvironmentConfigWithMetadata | null> {
    if (!this.options.enableMemoryCache && !this.options.enableFileCache) {
      return null
    }

    // 메모리 캐시 우선 조회
    if (this.options.enableMemoryCache) {
      const memoryResult = this.getFromMemory(key)
      if (memoryResult) {
        return memoryResult
      }
    }

    // 파일 캐시 조회 (향후 구현)
    if (this.options.enableFileCache) {
      const fileResult = await this.getFromFile(key)
      if (fileResult) {
        // 메모리 캐시에도 저장
        if (this.options.enableMemoryCache) {
          this.setInMemory(key, fileResult, this.options.ttl)
        }
        return fileResult.config
      }
    }

    return null
  }

  /**
   * 캐시에 설정 저장
   */
  async set(
    key: string,
    config: EnvironmentConfigWithMetadata,
    ttl?: number
  ): Promise<void> {
    const actualTtl = ttl ?? this.options.ttl
    const hash = this.generateHash(config)

    const entry: CacheEntry = {
      config,
      timestamp: Date.now(),
      hash,
      ttl: actualTtl
    }

    // 메모리 캐시 저장
    if (this.options.enableMemoryCache) {
      this.setInMemory(key, entry, actualTtl)
    }

    // 파일 캐시 저장 (향후 구현)
    if (this.options.enableFileCache) {
      await this.setInFile(key, entry)
    }
  }

  /**
   * 캐시 무효화
   */
  async invalidate(key?: string): Promise<void> {
    if (key) {
      // 특정 키 무효화
      this.memoryCache.delete(key)
      if (this.options.enableFileCache) {
        await this.deleteFromFile(key)
      }
    } else {
      // 전체 캐시 무효화
      this.memoryCache.clear()
      if (this.options.enableFileCache) {
        await this.clearFileCache()
      }
    }
  }

  /**
   * 만료된 캐시 항목 정리
   */
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: Array<string> = []

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.memoryCache.delete(key))
  }

  /**
   * 캐시 통계 정보
   */
  getStats() {
    this.cleanup() // 통계 조회 시 정리도 함께 수행

    return {
      memorySize: this.memoryCache.size,
      maxSize: this.options.maxSize,
      options: this.options,
      entries: Array.from(this.memoryCache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        hash: entry.hash,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        isExpired: Date.now() - entry.timestamp > entry.ttl
      }))
    }
  }

  /**
   * 메모리 캐시에서 조회
   */
  private getFromMemory(key: string): EnvironmentConfigWithMetadata | null {
    const entry = this.memoryCache.get(key)
    if (!entry) {
      return null
    }

    // TTL 확인
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key)
      return null
    }

    return entry.config
  }

  /**
   * 메모리 캐시에 저장
   */
  private setInMemory(key: string, entry: CacheEntry, ttl: number): void {
    // 캐시 크기 제한 확인
    if (this.memoryCache.size >= this.options.maxSize) {
      // LRU 방식으로 가장 오래된 항목 제거
      const oldestKey = this.findOldestKey()
      if (oldestKey) {
        this.memoryCache.delete(oldestKey)
      }
    }

    this.memoryCache.set(key, {
      ...entry,
      ttl
    })
  }

  /**
   * 가장 오래된 캐시 키 찾기
   */
  private findOldestKey(): string | null {
    let oldestKey: string | null = null
    let oldestTimestamp = Number.MAX_SAFE_INTEGER

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    return oldestKey
  }

  /**
   * 설정 객체의 해시 생성
   */
  private generateHash(config: EnvironmentConfigWithMetadata): string {
    // 민감한 정보 제외하고 해시 생성
    const configForHash = { ...config }
    delete configForHash._metadata

    if (configForHash.notion?.apiKey) {
      configForHash.notion.apiKey = '[MASKED]'
    }

    const configString = JSON.stringify(configForHash, Object.keys(configForHash).sort())
    return this.simpleHash(configString)
  }

  /**
   * 간단한 해시 함수
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32비트 정수로 변환
    }
    return hash.toString(16)
  }

  /**
   * 파일 캐시에서 조회 (기본 구현)
   */
  private async getFromFile(_key: string): Promise<CacheEntry | null> {
    // 향후 파일 시스템 캐시 구현
    return null
  }

  /**
   * 파일 캐시에 저장 (기본 구현)
   */
  private async setInFile(_key: string, _entry: CacheEntry): Promise<void> {
    // 향후 파일 시스템 캐시 구현
  }

  /**
   * 파일 캐시에서 삭제 (기본 구현)
   */
  private async deleteFromFile(_key: string): Promise<void> {
    // 향후 파일 시스템 캐시 구현
  }

  /**
   * 파일 캐시 전체 정리 (기본 구현)
   */
  private async clearFileCache(): Promise<void> {
    // 향후 파일 시스템 캐시 구현
  }
}

/**
 * 전역 캐시 인스턴스
 */
export const globalConfigCache = new ConfigCache({
  ttl: 300000, // 5분
  maxSize: 5,
  enableMemoryCache: true,
  enableFileCache: false
})