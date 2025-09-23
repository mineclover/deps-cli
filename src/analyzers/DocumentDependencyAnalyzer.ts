/**
 * 문서 파일의 링크와 참조를 분석하여 문서 간 의존성을 추출하는 분석기
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type { DocumentDependency } from "../types/DependencyClassification.js"

export interface DocumentAnalysisResult {
  documentReferences: Array<DocumentDependency> // 다른 문서 참조
  externalLinks: Array<DocumentDependency> // 외부 링크
  assetReferences: Array<DocumentDependency> // 이미지/파일 참조
  documentMetadata: {
    title?: string
    description?: string
    tags: Array<string>
    lastUpdated?: Date
    wordCount: number
    linkCount: number
    brokenLinks: number
    language: string
  }
}

export class DocumentDependencyAnalyzer {
  private markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  private htmlLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  private imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  private htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  private wikiLinkRegex = /\[\[([^\]]+)\]\]/g

  private assetExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".tar",
    ".gz",
    ".json",
    ".xml",
    ".csv"
  ]

  constructor() {}

  async analyzeDocumentFile(filePath: string): Promise<DocumentAnalysisResult> {
    const content = await fs.promises.readFile(filePath, "utf-8")
    const links = this.extractLinks(content)

    return {
      documentReferences: this.classifyDocumentReferences(links, filePath),
      externalLinks: this.classifyExternalLinks(links, filePath),
      assetReferences: this.classifyAssetReferences(links, filePath),
      documentMetadata: this.analyzeDocumentMetadata(content, filePath, links)
    }
  }

  private extractLinks(content: string): Array<{ text: string; url: string; line: number; type: string }> {
    const links: Array<{ text: string; url: string; line: number; type: string }> = []

    // Markdown 링크 추출
    let match
    while ((match = this.markdownLinkRegex.exec(content)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        line: this.getLineNumber(content, match.index),
        type: "markdown"
      })
    }

    // HTML 링크 추출
    this.htmlLinkRegex.lastIndex = 0 // 정규식 상태 초기화
    while ((match = this.htmlLinkRegex.exec(content)) !== null) {
      links.push({
        text: match[2],
        url: match[1],
        line: this.getLineNumber(content, match.index),
        type: "html"
      })
    }

    // 이미지 링크 추출
    this.imageRegex.lastIndex = 0
    while ((match = this.imageRegex.exec(content)) !== null) {
      links.push({
        text: match[1] || "image",
        url: match[2],
        line: this.getLineNumber(content, match.index),
        type: "image"
      })
    }

    // HTML 이미지 추출
    this.htmlImageRegex.lastIndex = 0
    while ((match = this.htmlImageRegex.exec(content)) !== null) {
      links.push({
        text: "image",
        url: match[1],
        line: this.getLineNumber(content, match.index),
        type: "html-image"
      })
    }

    // Wiki 스타일 링크 추출
    this.wikiLinkRegex.lastIndex = 0
    while ((match = this.wikiLinkRegex.exec(content)) !== null) {
      const linkContent = match[1]
      const [url, text] = linkContent.includes("|")
        ? linkContent.split("|").map((s) => s.trim())
        : [linkContent, linkContent]

      links.push({
        text,
        url,
        line: this.getLineNumber(content, match.index),
        type: "wiki"
      })
    }

    return links
  }

  private classifyDocumentReferences(
    links: Array<{ text: string; url: string; line: number; type: string }>,
    currentFile: string
  ): Array<DocumentDependency> {
    const documentRefs: Array<DocumentDependency> = []

    for (const link of links) {
      if (this.isDocumentReference(link.url)) {
        const resolvedPath = this.resolveDocumentPath(link.url, currentFile)
        const anchor = this.extractAnchor(link.url)

        documentRefs.push({
          source: link.url,
          resolvedPath,
          exists: this.checkFileExists(resolvedPath),
          line: link.line,
          confidence: this.calculateDocumentConfidence(link, resolvedPath),
          type: "doc-reference",
          linkType: this.getLinkType(link.url),
          title: link.text,
          anchor,
          isImage: false
        })
      }
    }

    return documentRefs
  }

  private classifyExternalLinks(
    links: Array<{ text: string; url: string; line: number; type: string }>,
    _currentFile: string
  ): Array<DocumentDependency> {
    const externalLinks: Array<DocumentDependency> = []

    for (const link of links) {
      if (this.isExternalLink(link.url)) {
        externalLinks.push({
          source: link.url,
          resolvedPath: null, // 외부 링크는 해결된 경로가 없음
          exists: true, // 외부 링크는 존재한다고 가정 (실제 검증은 별도)
          line: link.line,
          confidence: 0.8,
          type: "doc-link",
          linkType: "external",
          title: link.text,
          isImage: false
        })
      }
    }

    return externalLinks
  }

  private classifyAssetReferences(
    links: Array<{ text: string; url: string; line: number; type: string }>,
    currentFile: string
  ): Array<DocumentDependency> {
    const assetRefs: Array<DocumentDependency> = []

    for (const link of links) {
      if (this.isAssetReference(link.url)) {
        const resolvedPath = this.resolveAssetPath(link.url, currentFile)

        assetRefs.push({
          source: link.url,
          resolvedPath,
          exists: this.checkFileExists(resolvedPath),
          line: link.line,
          confidence: this.calculateAssetConfidence(link, resolvedPath),
          type: "doc-asset",
          linkType: this.getLinkType(link.url),
          title: link.text,
          isImage: this.isImageFile(link.url),
          mimeType: this.getMimeType(link.url)
        })
      }
    }

    return assetRefs
  }

  private analyzeDocumentMetadata(
    content: string,
    filePath: string,
    links: Array<{ text: string; url: string; line: number; type: string }>
  ) {
    return {
      title: this.extractTitle(content),
      description: this.extractDescription(content),
      tags: this.extractTags(content),
      lastUpdated: this.getLastModified(filePath),
      wordCount: this.countWords(content),
      linkCount: links.length,
      brokenLinks: this.countBrokenLinks(links, filePath),
      language: this.detectLanguage(content)
    }
  }

  private isDocumentReference(url: string): boolean {
    // 문서 파일 확장자 체크
    const docExtensions = [".md", ".markdown", ".rst", ".txt", ".adoc"]
    return docExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
      (this.isRelativePath(url) && !this.isAssetReference(url) && !this.isExternalLink(url))
  }

  private isExternalLink(url: string): boolean {
    return url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("ftp://") ||
      url.startsWith("mailto:")
  }

  private isAssetReference(url: string): boolean {
    return this.assetExtensions.some((ext) => url.toLowerCase().endsWith(ext)) ||
      url.includes("/assets/") ||
      url.includes("/images/") ||
      url.includes("/media/")
  }

  private isRelativePath(url: string): boolean {
    return url.startsWith("./") || url.startsWith("../") || (!url.startsWith("/") && !this.isExternalLink(url))
  }

  private isImageFile(url: string): boolean {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]
    return imageExtensions.some((ext) => url.toLowerCase().endsWith(ext))
  }

  private getLinkType(url: string): "relative" | "absolute" | "external" {
    if (this.isExternalLink(url)) return "external"
    if (url.startsWith("/")) return "absolute"
    return "relative"
  }

  private extractAnchor(url: string): string | undefined {
    const anchorMatch = url.match(/#(.+)$/)
    return anchorMatch ? anchorMatch[1] : undefined
  }

  private resolveDocumentPath(url: string, currentFile: string): string | null {
    try {
      const baseDir = path.dirname(currentFile)
      const cleanUrl = url.split("#")[0] // 앵커 제거

      if (this.isExternalLink(url)) return null
      if (path.isAbsolute(cleanUrl)) return cleanUrl

      return path.resolve(baseDir, cleanUrl)
    } catch {
      return null
    }
  }

  private resolveAssetPath(url: string, currentFile: string): string | null {
    return this.resolveDocumentPath(url, currentFile)
  }

  private calculateDocumentConfidence(
    link: { text: string; url: string },
    resolvedPath: string | null
  ): number {
    let confidence = 0.5

    if (resolvedPath && this.checkFileExists(resolvedPath)) confidence += 0.4
    if (link.text && link.text.length > 0) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private calculateAssetConfidence(
    link: { text: string; url: string },
    resolvedPath: string | null
  ): number {
    let confidence = 0.6

    if (resolvedPath && this.checkFileExists(resolvedPath)) confidence += 0.3
    if (this.isImageFile(link.url)) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private extractTitle(content: string): string | undefined {
    // Markdown 제목 추출
    const h1Match = content.match(/^#\s+(.+)$/m)
    if (h1Match) return h1Match[1].trim()

    // HTML 제목 추출
    const htmlTitleMatch = content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (htmlTitleMatch) return htmlTitleMatch[1].trim()

    // YAML front matter에서 제목 추출
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (yamlMatch) {
      const titleMatch = yamlMatch[1].match(/title:\s*['"]?([^'"]+)['"]?/i)
      if (titleMatch) return titleMatch[1].trim()
    }

    return undefined
  }

  private extractDescription(content: string): string | undefined {
    // YAML front matter에서 설명 추출
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (yamlMatch) {
      const descMatch = yamlMatch[1].match(/description:\s*['"]?([^'"]+)['"]?/i)
      if (descMatch) return descMatch[1].trim()
    }

    // 첫 번째 문단을 설명으로 사용
    const firstParagraph = content
      .replace(/^---[\s\S]*?---/, "") // front matter 제거
      .replace(/^#+\s+.+$/gm, "") // 제목 제거
      .trim()
      .split("\n\n")[0]

    return firstParagraph && firstParagraph.length > 10 ? firstParagraph : undefined
  }

  private extractTags(content: string): Array<string> {
    const tags: Array<string> = []

    // YAML front matter에서 태그 추출
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (yamlMatch) {
      const tagsMatch = yamlMatch[1].match(/tags:\s*\[(.*?)\]/i)
      if (tagsMatch) {
        tags.push.apply(tags, tagsMatch[1].split(",").map((tag) => tag.trim().replace(/['"]/g, "")))
      }
    }

    // 해시태그 추출
    const hashtagMatches = content.match(/#[\w가-힣]+/g)
    if (hashtagMatches) {
      tags.push.apply(tags, hashtagMatches.map((tag) => tag.substring(1)))
    }

    return [...new Set(tags)] // 중복 제거
  }

  private countWords(content: string): number {
    // 마크다운 문법 제거 후 단어 수 계산
    const cleanContent = content
      .replace(/^---[\s\S]*?---/, "") // front matter 제거
      .replace(/```[\s\S]*?```/g, "") // 코드 블록 제거
      .replace(/`[^`]+`/g, "") // 인라인 코드 제거
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 링크는 텍스트만 남김
      .replace(/[#*_~`]/g, "") // 마크다운 문법 제거
      .replace(/\s+/g, " ") // 연속 공백 정리
      .trim()

    return cleanContent.length > 0 ? cleanContent.split(/\s+/).length : 0
  }

  private countBrokenLinks(
    links: Array<{ text: string; url: string; line: number; type: string }>,
    currentFile: string
  ): number {
    let brokenCount = 0

    for (const link of links) {
      if (!this.isExternalLink(link.url)) {
        const resolvedPath = this.resolveDocumentPath(link.url, currentFile)
        if (resolvedPath && !this.checkFileExists(resolvedPath)) {
          brokenCount++
        }
      }
    }

    return brokenCount
  }

  private detectLanguage(content: string): string {
    // 간단한 언어 감지 (한국어/영어)
    const koreanChars = content.match(/[가-힣]/g)
    const totalChars = content.replace(/\s/g, "").length

    if (koreanChars && koreanChars.length / totalChars > 0.1) {
      return "ko"
    }
    return "en"
  }

  private getMimeType(url: string): string | undefined {
    const ext = path.extname(url).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".json": "application/json",
      ".xml": "application/xml"
    }
    return mimeTypes[ext]
  }

  private checkFileExists(filePath: string | null): boolean {
    if (!filePath) return false
    try {
      return fs.existsSync(filePath)
    } catch {
      return false
    }
  }

  private getLastModified(filePath: string): Date | undefined {
    try {
      const stats = fs.statSync(filePath)
      return stats.mtime
    } catch {
      return undefined
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split("\n").length
  }
}

// 문서 의존성 시각화를 위한 유틸리티
export class DocumentDependencyVisualizer {
  static generateDocumentGraph(docResults: Map<string, DocumentAnalysisResult>): any {
    const graph = {
      nodes: [] as Array<any>,
      edges: [] as Array<any>
    }

    for (const [docFile, result] of docResults.entries()) {
      // 문서 파일 노드
      graph.nodes.push({
        id: docFile,
        type: "document",
        label: result.documentMetadata.title || path.basename(docFile),
        metadata: result.documentMetadata
      })

      // 문서 참조 연결
      result.documentReferences.forEach((ref) => {
        if (ref.resolvedPath) {
          graph.nodes.push({
            id: ref.resolvedPath,
            type: "document",
            label: ref.title || path.basename(ref.resolvedPath)
          })

          graph.edges.push({
            from: docFile,
            to: ref.resolvedPath,
            type: "references",
            confidence: ref.confidence
          })
        }
      })

      // 외부 링크 연결
      result.externalLinks.forEach((link) => {
        graph.nodes.push({
          id: link.source,
          type: "external",
          label: link.title || link.source
        })

        graph.edges.push({
          from: docFile,
          to: link.source,
          type: "external-link",
          confidence: link.confidence
        })
      })
    }

    return graph
  }

  static generateLinkReport(docResults: Map<string, DocumentAnalysisResult>): any {
    const report = {
      totalDocuments: docResults.size,
      totalLinks: 0,
      brokenLinks: [] as Array<any>,
      externalLinks: [] as Array<any>,
      orphanedDocs: [] as Array<string>
    }

    const referencedDocs = new Set<string>()

    for (const [docFile, result] of docResults.entries()) {
      report.totalLinks += result.documentMetadata.linkCount

      // 깨진 링크 수집
      result.documentReferences.forEach((ref) => {
        if (!ref.exists) {
          report.brokenLinks.push({
            document: docFile,
            link: ref.source,
            line: ref.line
          })
        } else if (ref.resolvedPath) {
          referencedDocs.add(ref.resolvedPath)
        }
      })

      // 외부 링크 수집
      result.externalLinks.forEach((link) => {
        report.externalLinks.push({
          document: docFile,
          url: link.source,
          title: link.title
        })
      })
    }

    // 고아 문서 찾기 (다른 문서에서 참조되지 않는 문서)
    for (const docFile of docResults.keys()) {
      if (!referencedDocs.has(docFile)) {
        report.orphanedDocs.push(docFile)
      }
    }

    return report
  }
}
