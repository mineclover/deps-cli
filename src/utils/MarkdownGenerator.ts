/**
 * 마크다운 생성 엔진
 * ID 기반 구조적 마크다운 문서 생성
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type {
  CodeRole,
  DependencyMapping,
  FileMetadata,
  MarkdownGenerationConfig,
  MarkdownNode,
  MethodMetadata,
  NodeId,
} from '../types/MappingTypes.js'
import { RoleClassifier } from './RoleClassifier.js'

export class MarkdownGenerator {
  private config: MarkdownGenerationConfig

  constructor(config: MarkdownGenerationConfig) {
    this.config = config
  }

  /**
   * 단일 노드의 마크다운 생성
   */
  async generateNodeMarkdown(node: MarkdownNode): Promise<string> {
    const frontMatter = this.generateFrontMatter(node)
    const content = this.generateContent(node)

    return `${frontMatter}\n\n${content}`
  }

  /**
   * 전체 프로젝트의 마크다운 생성 (일관된 위치 지정)
   */
  async generateProjectMarkdown(nodes: MarkdownNode[]): Promise<void> {
    console.log(`📝 Generating ${nodes.length} markdown files...`)

    // 각 노드별 마크다운 파일 생성 (MirrorPathMapper 경로 사용)
    for (const node of nodes) {
      const markdown = await this.generateNodeMarkdown(node)

      // 파일 메타데이터에서 documentPath 사용 (MirrorPathMapper에 의해 생성된 경로)
      const metadata = node.metadata as FileMetadata
      const filePath = metadata.documentPath

      if (!filePath) {
        console.warn(`  ⚠️  No documentPath for file: ${metadata.path}`)
        continue
      }

      // 디렉토리 생성
      await mkdir(dirname(filePath), { recursive: true })

      // 마크다운 파일 저장
      await writeFile(filePath, markdown, 'utf-8')

      console.log(`  ✅ Generated: ${filePath}`)
    }

    console.log(`✅ All markdown files generated successfully!`)
  }

  /**
   * YAML/JSON Front Matter 생성
   */
  private generateFrontMatter(node: MarkdownNode): string {
    const { metadata } = node

    const frontMatterData = {
      title: node.title,
      type: node.type,
      lastUpdated: new Date().toISOString(),
      ...(node.type === 'file' && {
        file: {
          path: (metadata as FileMetadata).relativePath,
          language: (metadata as FileMetadata).language,
          size: (metadata as FileMetadata).size,
          lines: (metadata as FileMetadata).lines,
        },
      }),
    }

    if (this.config.frontMatterFormat === 'json') {
      return `---json\n${JSON.stringify(frontMatterData, null, 2)}\n---`
    } else {
      return `---\n${this.objectToYaml(frontMatterData)}\n---`
    }
  }

  /**
   * 마크다운 컨텐츠 생성
   */
  private generateContent(node: MarkdownNode): string {
    const { type, metadata } = node

    let content = `# ${node.title}\n\n`

    // 개요 섹션
    content += this.generateOverviewSection(node)

    // 파일 메타데이터 섹션
    if (type === 'file') {
      content += this.generateFileMetadataSection(metadata as FileMetadata)
    }

    // 소스 코드 섹션 (항상 포함)
    if (node.content) {
      content += this.generateSourceCodeSection(node)
    }

    return content
  }

  /**
   * 개요 섹션 생성
   */
  private generateOverviewSection(node: MarkdownNode): string {
    const { type, metadata } = node

    let overview = `## 📋 개요\n\n`

    if (type === 'file') {
      const fileMeta = metadata as FileMetadata
      overview += `- **파일 경로**: \`${fileMeta.relativePath}\`\n`
      overview += `- **언어**: ${fileMeta.language}\n`
      overview += `- **크기**: ${fileMeta.size} bytes\n`
      overview += `- **라인 수**: ${fileMeta.lines}\n`
      overview += `- **최종 수정**: ${fileMeta.lastModified.toLocaleDateString()}\n\n`
    } else {
      const methodMeta = metadata as MethodMetadata
      overview += `- **메서드명**: \`${methodMeta.name}\`\n`
      overview += `- **타입**: ${methodMeta.type}\n`
      overview += `- **내보내기**: ${methodMeta.exported ? '✅ Yes' : '❌ No'}\n`
      overview += `- **위치**: 라인 ${methodMeta.startLine}-${methodMeta.endLine}\n\n`
    }

    return overview
  }

  /**
   * 파일 메타데이터 섹션 생성
   */
  private generateFileMetadataSection(metadata: FileMetadata): string {
    let section = `## 📄 파일 정보\n\n`

    section += `| 속성 | 값 |\n`
    section += `|------|----|\n`
    section += `| 경로 | \`${metadata.relativePath}\` |\n`
    section += `| 언어 | ${metadata.language} |\n`
    section += `| 파일 크기 | ${metadata.size} bytes |\n`
    section += `| 라인 수 | ${metadata.lines} |\n`
    section += `| 해시 | \`${metadata.hash.substring(0, 16)}...\` |\n`
    section += `| 최종 수정 | ${metadata.lastModified.toLocaleString()} |\n\n`

    return section
  }

  /**
   * 메서드 메타데이터 섹션 생성
   */
  private generateMethodMetadataSection(metadata: MethodMetadata): string {
    let section = `## 🔧 메서드 정보\n\n`

    section += `### 시그니처\n\n`
    section += `\`\`\`typescript\n${metadata.signature}\n\`\`\`\n\n`

    section += `| 속성 | 값 |\n`
    section += `|------|----|\n`
    section += `| 이름 | \`${metadata.name}\` |\n`
    section += `| 타입 | ${metadata.type} |\n`
    section += `| 내보내기 | ${metadata.exported ? '✅' : '❌'} |\n`
    section += `| 시작 라인 | ${metadata.startLine} |\n`
    section += `| 종료 라인 | ${metadata.endLine} |\n`
    section += `| 해시 | \`${metadata.hash.substring(0, 16)}...\` |\n\n`

    return section
  }



  /**
   * 소스 코드 섹션 생성
   */
  private generateSourceCodeSection(node: MarkdownNode): string {
    if (!node.content) return ''

    const language = node.type === 'file' ? (node.metadata as FileMetadata).language.toLowerCase() : 'typescript'

    return `## 💻 소스 코드\n\n\`\`\`${language}\n${node.content}\n\`\`\`\n\n`
  }

  /**
   * ID 기반 링크 생성
   */
  private generateIdLink(targetId: NodeId, currentNodeId?: NodeId): string {
    // 단순한 파일 경로 기반 링크 생성 (ID는 상대 경로로 사용됨)
    const safeName = String(targetId).replace(/[\/\\]/g, '-').replace(/\./g, '-')
    return `[${targetId}](${safeName}.md)`
  }


  /**
   * 인덱스 파일 생성
   */
  private async generateIndexFiles(nodes: MarkdownNode[]): Promise<void> {
    // 역할별 인덱스 생성
    const roleGroups = new Map<string, MarkdownNode[]>()

    for (const node of nodes) {
      const role = node.role
      if (!roleGroups.has(role)) {
        roleGroups.set(role, [])
      }
      roleGroups.get(role)!.push(node)
    }

    // 각 역할별 인덱스 파일 생성
    for (const [role, roleNodes] of roleGroups) {
      const indexContent = this.generateRoleIndexContent(role, roleNodes)
      const indexPath = join(this.config.outputDirectory, role.toLowerCase().replace('_', '-'), 'README.md')

      await mkdir(dirname(indexPath), { recursive: true })
      await writeFile(indexPath, indexContent, 'utf-8')
    }

    // 전체 프로젝트 인덱스 생성
    const projectIndex = this.generateProjectIndexContent(nodes, roleGroups)
    const projectIndexPath = join(this.config.outputDirectory, 'README.md')
    await writeFile(projectIndexPath, projectIndex, 'utf-8')
  }

  /**
   * 역할별 인덱스 컨텐츠 생성
   */
  private generateRoleIndexContent(role: string, nodes: MarkdownNode[]): string {
    const displayName = RoleClassifier.getRoleDisplayName(role as CodeRole)

    let content = `# ${displayName}\n\n`
    content += `총 ${nodes.length}개의 ${role} 항목\n\n`

    // 파일과 메서드 분리
    const files = nodes.filter((n) => n.type === 'file')
    const methods = nodes.filter((n) => n.type === 'method')

    if (files.length > 0) {
      content += `## 📁 파일 (${files.length}개)\n\n`
      for (const file of files.sort((a, b) => a.title.localeCompare(b.title))) {
        content += `- [${file.title}](files/${file.id}.md)\n`
      }
      content += `\n`
    }

    if (methods.length > 0) {
      content += `## 🔧 메서드 (${methods.length}개)\n\n`
      for (const method of methods.sort((a, b) => a.title.localeCompare(b.title))) {
        content += `- [${method.title}](methods/${method.id}.md)\n`
      }
      content += `\n`
    }

    return content
  }

  /**
   * 프로젝트 전체 인덱스 컨텐츠 생성
   */
  private generateProjectIndexContent(nodes: MarkdownNode[], roleGroups: Map<string, MarkdownNode[]>): string {
    let content = `# 프로젝트 의존성 문서\n\n`
    content += `총 ${nodes.length}개의 코드 엔티티 문서화\n\n`

    // 역할별 통계
    content += `## 📊 역할별 통계\n\n`
    for (const [role, roleNodes] of roleGroups) {
      const displayName = RoleClassifier.getRoleDisplayName(role as CodeRole)
      content += `- **${displayName}**: ${roleNodes.length}개 ([보기](${role.toLowerCase().replace('_', '-')}/README.md))\n`
    }
    content += `\n`

    // 생성 정보
    content += `## ℹ️ 생성 정보\n\n`
    content += `- 생성 시간: ${new Date().toLocaleString()}\n`
    content += `- 생성 도구: deps-cli v2.0.0\n`
    content += `- 구조적 마크다운 매핑 시스템\n\n`

    return content
  }

  /**
   * 메트릭 생성
   */
  private generateMetrics(node: MarkdownNode): Record<string, string | number> {
    const metrics: Record<string, string | number> = {}

    if (node.type === 'file') {
      const fileMeta = node.metadata as FileMetadata
      metrics['파일 크기'] = `${fileMeta.size} bytes`
      metrics['라인 수'] = fileMeta.lines
      metrics['의존성 수'] = node.dependencies.length
      metrics['의존자 수'] = node.dependents.length
    } else {
      const methodMeta = node.metadata as MethodMetadata
      metrics['메서드 길이'] = `${methodMeta.endLine - methodMeta.startLine + 1} 라인`
      metrics['복잡도'] = methodMeta.complexity || 'N/A'
      metrics['의존성 수'] = node.dependencies.length
      metrics['의존자 수'] = node.dependents.length
    }

    return metrics
  }

  /**
   * 객체를 YAML 형식으로 변환 (간단한 구현)
   */
  private objectToYaml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent)
    let yaml = ''

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue

      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n${this.objectToYaml(item, indent + 2)}`
          } else {
            yaml += `${spaces}  - ${item}\n`
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n${this.objectToYaml(value, indent + 1)}`
      } else {
        const yamlValue = typeof value === 'string' ? `"${value}"` : value
        yaml += `${spaces}${key}: ${yamlValue}\n`
      }
    }

    return yaml
  }
}
