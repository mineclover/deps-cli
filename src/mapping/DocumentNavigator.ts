/**
 * 문서 네비게이터
 * 생성된 마크다운 문서의 일관된 경로 탐색 및 리스트 조회 기능
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { CodeRole, FileId, MethodId, NodeId } from '../types/MappingTypes.js'
import { IdRegistry } from '../utils/IdRegistry.js'
import { RoleClassifier } from '../utils/RoleClassifier.js'

export interface DocumentInfo {
  id: NodeId
  path: string
  relativePath: string
  title: string
  role: CodeRole
  type: 'file' | 'method'
  size: number
  lastModified: Date
  dependencies: string[]
  dependents: string[]
}

export interface NavigationResult {
  documents: DocumentInfo[]
  totalCount: number
  roles: Map<CodeRole, number>
  directories: string[]
}

export interface SearchOptions {
  role?: CodeRole
  type?: 'file' | 'method'
  searchTerm?: string
  limit?: number
  offset?: number
  sortBy?: 'title' | 'role' | 'lastModified' | 'size'
  sortOrder?: 'asc' | 'desc'
}

export class DocumentNavigator {
  private documentsPath: string
  private idRegistry: IdRegistry
  private documentCache: Map<string, DocumentInfo> = new Map()

  constructor(documentsPath: string, idRegistry?: IdRegistry) {
    this.documentsPath = documentsPath
    this.idRegistry = idRegistry || new IdRegistry()
  }

  /**
   * 문서 디렉토리 구조 스캔
   */
  async scanDocuments(): Promise<NavigationResult> {
    console.log(`📂 Scanning documents in: ${this.documentsPath}`)

    const documents: DocumentInfo[] = []
    const roles = new Map<CodeRole, number>()
    const directories: string[] = []

    try {
      // files 디렉토리에서 개별 문서들 스캔
      const filesDir = join(this.documentsPath, 'files')
      const fileList = await readdir(filesDir)

      console.log(`📄 Found ${fileList.length} document files`)

      for (const fileName of fileList) {
        if (!fileName.endsWith('.md')) continue

        const filePath = join(filesDir, fileName)
        const docInfo = await this.parseDocumentFile(filePath)

        if (docInfo) {
          documents.push(docInfo)
          this.documentCache.set(docInfo.id, docInfo)

          // 역할별 통계
          roles.set(docInfo.role, (roles.get(docInfo.role) || 0) + 1)
        }
      }

      // 역할별 디렉토리 스캔
      const roleDirectories = await readdir(this.documentsPath, { withFileTypes: true })
      for (const dirent of roleDirectories) {
        if (dirent.isDirectory() && dirent.name !== 'files') {
          directories.push(dirent.name)
        }
      }

      console.log(`✅ Scanned ${documents.length} documents across ${directories.length} role directories`)

      return {
        documents: documents.sort((a, b) => a.title.localeCompare(b.title)),
        totalCount: documents.length,
        roles,
        directories,
      }
    } catch (error) {
      console.error(`❌ Failed to scan documents: ${error}`)
      return {
        documents: [],
        totalCount: 0,
        roles: new Map(),
        directories: [],
      }
    }
  }

  /**
   * 문서 파일 파싱
   */
  private async parseDocumentFile(filePath: string): Promise<DocumentInfo | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const stats = await stat(filePath)

      // YAML front matter 파싱
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!frontMatterMatch) {
        console.warn(`⚠️ No front matter found in: ${filePath}`)
        return null
      }

      const frontMatter = this.parseYamlFrontMatter(frontMatterMatch[1])

      const docInfo: DocumentInfo = {
        id: frontMatter.id,
        path: filePath,
        relativePath: relative(this.documentsPath, filePath),
        title: frontMatter.title || frontMatter.id,
        role: frontMatter.role as CodeRole,
        type: frontMatter.type as 'file' | 'method',
        size: stats.size,
        lastModified: stats.mtime,
        dependencies: Array.isArray(frontMatter.dependencies)
          ? frontMatter.dependencies.map((dep: any) => (typeof dep === 'string' ? dep : dep.id))
          : [],
        dependents: Array.isArray(frontMatter.dependents)
          ? frontMatter.dependents.map((dep: any) => (typeof dep === 'string' ? dep : dep.id))
          : [],
      }

      return docInfo
    } catch (error) {
      console.warn(`⚠️ Failed to parse document: ${filePath}`, error)
      return null
    }
  }

  /**
   * 향상된 YAML front matter 파서
   * 중첩된 객체와 배열을 지원
   */
  private parseYamlFrontMatter(yamlContent: string): any {
    const lines = yamlContent.split('\n').map((line) => line.replace(/\r$/, ''))
    const result: any = {}
    let currentPath: string[] = []
    let currentObject: any = result
    let arrayContext: { path: string[]; items: any[] } | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // 빈 줄 스킵
      if (!trimmed) continue

      // 들여쓰기 레벨 계산
      const indent = line.length - line.trimStart().length
      const indentLevel = Math.floor(indent / 2)

      // 배열 아이템 처리
      if (trimmed.startsWith('-')) {
        const itemContent = trimmed.substring(1).trim()

        if (!arrayContext) {
          // 새 배열 시작
          arrayContext = { path: [...currentPath], items: [] }
        }

        if (itemContent.includes(':')) {
          // 객체 형태의 배열 아이템
          const item: any = {}
          const [key, value] = itemContent.split(':', 2)
          const cleanKey = key.trim()
          const cleanValue = value.trim().replace(/^"|"$/g, '')
          item[cleanKey] = cleanValue

          // 다음 줄들에서 같은 아이템의 추가 속성 확인
          let j = i + 1
          while (j < lines.length) {
            const nextLine = lines[j]
            const nextTrimmed = nextLine.trim()
            const nextIndent = nextLine.length - nextLine.trimStart().length

            if (!nextTrimmed || nextIndent <= indent || nextTrimmed.startsWith('-')) {
              break
            }

            if (nextTrimmed.includes(':')) {
              const [nextKey, nextValue] = nextTrimmed.split(':', 2)
              const cleanNextKey = nextKey.trim()
              const cleanNextValue = nextValue.trim().replace(/^"|"$/g, '')

              if (cleanNextKey === 'members' && cleanNextValue === '') {
                // members 배열 처리
                j++
                const members: string[] = []
                while (j < lines.length) {
                  const memberLine = lines[j]
                  const memberTrimmed = memberLine.trim()
                  const memberIndent = memberLine.length - memberLine.trimStart().length

                  if (!memberTrimmed || memberIndent <= nextIndent) {
                    j--
                    break
                  }

                  if (memberTrimmed.startsWith('-')) {
                    members.push(memberTrimmed.substring(1).trim())
                  }
                  j++
                }
                item[cleanNextKey] = members
              } else {
                item[cleanNextKey] = cleanNextValue
              }
            }
            j++
          }

          arrayContext.items.push(item)
          i = j - 1
        } else {
          // 단순 문자열 배열 아이템
          arrayContext.items.push(itemContent)
        }
        continue
      }

      // 배열 컨텍스트 종료 확인
      if (arrayContext && indentLevel <= arrayContext.path.length - 1) {
        // 배열을 적절한 위치에 할당
        let target = result
        for (let k = 0; k < arrayContext.path.length - 1; k++) {
          target = target[arrayContext.path[k]]
        }
        target[arrayContext.path[arrayContext.path.length - 1]] = arrayContext.items
        arrayContext = null
      }

      // 일반 키:값 쌍 처리
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':')
        const key = trimmed.substring(0, colonIndex).trim()
        const value = trimmed
          .substring(colonIndex + 1)
          .trim()
          .replace(/^"|"$/g, '')

        // 경로 업데이트
        currentPath = currentPath.slice(0, indentLevel)
        currentPath.push(key)

        // 현재 객체 찾기
        currentObject = result
        for (let k = 0; k < indentLevel; k++) {
          if (!currentObject[currentPath[k]]) {
            currentObject[currentPath[k]] = {}
          }
          currentObject = currentObject[currentPath[k]]
        }

        if (value === '') {
          // 빈 값은 다음 줄에 중첩된 내용이 있을 수 있음
          if (!currentObject[key]) {
            currentObject[key] = {}
          }

          // 다음 줄이 배열인지 확인
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
            arrayContext = { path: [...currentPath], items: [] }
          }
        } else {
          currentObject[key] = value
        }
      }
    }

    // 남은 배열 컨텍스트 처리
    if (arrayContext) {
      let target = result
      for (let k = 0; k < arrayContext.path.length - 1; k++) {
        target = target[arrayContext.path[k]]
      }
      target[arrayContext.path[arrayContext.path.length - 1]] = arrayContext.items
    }

    return result
  }

  /**
   * 문서 검색 및 필터링
   */
  async searchDocuments(options: SearchOptions = {}): Promise<NavigationResult> {
    const allDocs = await this.scanDocuments()
    let filteredDocs = allDocs.documents

    // 역할 필터
    if (options.role) {
      filteredDocs = filteredDocs.filter((doc) => doc.role === options.role)
    }

    // 타입 필터
    if (options.type) {
      filteredDocs = filteredDocs.filter((doc) => doc.type === options.type)
    }

    // 검색어 필터
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase()
      filteredDocs = filteredDocs.filter(
        (doc) => doc.title.toLowerCase().includes(term) || doc.id.toLowerCase().includes(term)
      )
    }

    // 정렬
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1
      filteredDocs.sort((a, b) => {
        const aVal = a[options.sortBy!]
        const bVal = b[options.sortBy!]

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * sortOrder
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * sortOrder
        }
        if (aVal instanceof Date && bVal instanceof Date) {
          return (aVal.getTime() - bVal.getTime()) * sortOrder
        }

        return 0
      })
    }

    // 페이징
    const offset = options.offset || 0
    const limit = options.limit || filteredDocs.length
    const pagedDocs = filteredDocs.slice(offset, offset + limit)

    // 역할별 통계 재계산
    const roleStats = new Map<CodeRole, number>()
    for (const doc of filteredDocs) {
      roleStats.set(doc.role, (roleStats.get(doc.role) || 0) + 1)
    }

    return {
      documents: pagedDocs,
      totalCount: filteredDocs.length,
      roles: roleStats,
      directories: allDocs.directories,
    }
  }

  /**
   * ID로 문서 조회
   */
  async getDocumentById(id: NodeId): Promise<DocumentInfo | null> {
    // 캐시에서 먼저 조회
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id)!
    }

    // 전체 스캔 후 조회
    await this.scanDocuments()
    return this.documentCache.get(id) || null
  }

  /**
   * 일관된 문서 경로 생성
   */
  getDocumentPath(id: NodeId): string {
    return join(this.documentsPath, 'files', `${id}.md`)
  }

  /**
   * 역할별 문서 리스트 조회
   */
  async getDocumentsByRole(role: CodeRole): Promise<DocumentInfo[]> {
    const result = await this.searchDocuments({ role })
    return result.documents
  }

  /**
   * 의존성 관계 탐색
   */
  async getDependencies(id: NodeId): Promise<{
    dependencies: DocumentInfo[]
    dependents: DocumentInfo[]
  }> {
    const doc = await this.getDocumentById(id)
    if (!doc) {
      return { dependencies: [], dependents: [] }
    }

    const dependencies: DocumentInfo[] = []
    const dependents: DocumentInfo[] = []

    // 의존성 문서들 조회
    for (const depId of doc.dependencies) {
      const depDoc = await this.getDocumentById(depId as NodeId)
      if (depDoc) dependencies.push(depDoc)
    }

    // 의존자 문서들 조회
    for (const depId of doc.dependents) {
      const depDoc = await this.getDocumentById(depId as NodeId)
      if (depDoc) dependents.push(depDoc)
    }

    return { dependencies, dependents }
  }

  /**
   * 문서 통계 조회
   */
  async getDocumentStatistics(): Promise<{
    totalDocuments: number
    roleBreakdown: Map<CodeRole, number>
    typeBreakdown: Map<string, number>
    averageSize: number
    lastUpdated: Date | null
  }> {
    const result = await this.scanDocuments()

    const typeBreakdown = new Map<string, number>()
    let totalSize = 0
    let lastUpdated: Date | null = null

    for (const doc of result.documents) {
      typeBreakdown.set(doc.type, (typeBreakdown.get(doc.type) || 0) + 1)
      totalSize += doc.size

      if (!lastUpdated || doc.lastModified > lastUpdated) {
        lastUpdated = doc.lastModified
      }
    }

    return {
      totalDocuments: result.totalCount,
      roleBreakdown: result.roles,
      typeBreakdown,
      averageSize: result.totalCount > 0 ? totalSize / result.totalCount : 0,
      lastUpdated,
    }
  }

  /**
   * 문서 리스트를 테이블 형태로 포맷
   */
  formatDocumentsList(
    documents: DocumentInfo[],
    options: {
      showPath?: boolean
      showSize?: boolean
      showRole?: boolean
      maxTitleLength?: number
    } = {}
  ): string {
    if (documents.length === 0) {
      return 'No documents found.'
    }

    const maxTitleLength = options.maxTitleLength || 50
    let header = 'ID                           | Title'
    let separator = '-----------------------------|------'

    if (options.showRole) {
      header += ' | Role'
      separator += '|------'
    }

    if (options.showSize) {
      header += ' | Size'
      separator += '|------'
    }

    if (options.showPath) {
      header += ' | Path'
      separator += '|------'
    }

    const lines = [header, separator]

    for (const doc of documents) {
      const id = doc.id.substring(0, 28) + (doc.id.length > 28 ? '...' : '')
      const title = doc.title.length > maxTitleLength ? doc.title.substring(0, maxTitleLength - 3) + '...' : doc.title

      let line = `${id.padEnd(29)} | ${title}`

      if (options.showRole) {
        line += ` | ${RoleClassifier.getRoleDisplayName(doc.role)}`
      }

      if (options.showSize) {
        const sizeKB = Math.round(doc.size / 1024)
        line += ` | ${sizeKB}KB`
      }

      if (options.showPath) {
        line += ` | ${doc.relativePath}`
      }

      lines.push(line)
    }

    return lines.join('\n')
  }
}
