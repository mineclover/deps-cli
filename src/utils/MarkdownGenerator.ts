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
import { IdRegistry } from './IdRegistry.js'
import { RoleClassifier } from './RoleClassifier.js'

export class MarkdownGenerator {
  private config: MarkdownGenerationConfig
  private idRegistry: IdRegistry

  constructor(config: MarkdownGenerationConfig, idRegistry?: IdRegistry) {
    this.config = config
    this.idRegistry = idRegistry || new IdRegistry()
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
    // 출력 디렉토리 생성
    await mkdir(this.config.outputDirectory, { recursive: true })

    console.log(`📝 Generating ${nodes.length} markdown files...`)

    // 각 노드별 마크다운 파일 생성 (일관된 위치)
    for (const node of nodes) {
      const markdown = await this.generateNodeMarkdown(node)

      // ID 레지스트리 기반 일관된 경로 사용
      const filePath = this.idRegistry.getMarkdownPath(node.id, this.config.outputDirectory)

      // 디렉토리 생성
      await mkdir(dirname(filePath), { recursive: true })

      // 마크다운 파일 저장
      await writeFile(filePath, markdown, 'utf-8')

      console.log(`  ✅ Generated: ${filePath}`)
    }

    // 인덱스 파일 생성
    await this.generateIndexFiles(nodes)

    console.log(`✅ All markdown files generated successfully!`)
  }

  /**
   * YAML/JSON Front Matter 생성
   */
  private generateFrontMatter(node: MarkdownNode): string {
    const { metadata, role, dependencies, dependents } = node

    const frontMatterData = {
      id: node.id,
      title: node.title,
      type: node.type,
      role: role,
      lastUpdated: new Date().toISOString(),
      ...(node.type === 'file' && {
        file: {
          path: (metadata as FileMetadata).relativePath,
          language: (metadata as FileMetadata).language,
          size: (metadata as FileMetadata).size,
          lines: (metadata as FileMetadata).lines,
          hash: (metadata as FileMetadata).hash,
        },
      }),
      ...(node.type === 'method' && {
        method: {
          name: (metadata as MethodMetadata).name,
          signature: (metadata as MethodMetadata).signature,
          type: (metadata as MethodMetadata).type,
          exported: (metadata as MethodMetadata).exported,
          startLine: (metadata as MethodMetadata).startLine,
          endLine: (metadata as MethodMetadata).endLine,
          hash: (metadata as MethodMetadata).hash,
        },
      }),
      dependencies: dependencies.map((dep) => ({
        id: dep.toId,
        type: dep.type,
        members: dep.importedMembers,
      })),
      dependents: dependents.map((dep) => ({
        id: dep.fromId,
        type: dep.type,
        members: dep.importedMembers,
      })),
      metrics: this.config.includeMetrics ? this.generateMetrics(node) : undefined,
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
    const { type, role, metadata, dependencies, dependents } = node

    let content = `# ${node.title}\n\n`

    // 개요 섹션
    content += this.generateOverviewSection(node)

    // 역할 정보
    content += `## 🏷️ 역할\n\n`
    content += `**${RoleClassifier.getRoleDisplayName(role)}** (\`${role}\`)\n\n`

    // 메타데이터 섹션
    if (type === 'file') {
      content += this.generateFileMetadataSection(metadata as FileMetadata)
    } else {
      content += this.generateMethodMetadataSection(metadata as MethodMetadata)
    }

    // 의존성 관계 섹션
    if (dependencies.length > 0 || dependents.length > 0) {
      content += this.generateDependencySection(dependencies, dependents, node.id)
    }

    // 메트릭 섹션
    if (this.config.includeMetrics) {
      content += this.generateMetricsSection(node)
    }

    // 소스 코드 섹션 (옵션)
    if (this.config.includeSourceCode && node.content) {
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
   * 의존성 관계 섹션 생성 (현재 노드 ID 전달)
   */
  private generateDependencySection(
    dependencies: DependencyMapping[],
    dependents: DependencyMapping[],
    currentNodeId: NodeId
  ): string {
    let section = `## 🔗 의존성 관계\n\n`

    if (dependencies.length > 0) {
      section += `### 📥 의존하는 항목 (Dependencies)\n\n`
      for (const dep of dependencies) {
        const link = this.generateIdLink(dep.toId, currentNodeId)
        const members = dep.importedMembers ? ` (${dep.importedMembers.join(', ')})` : ''
        section += `- ${link} - \`${dep.type}\`${members}\n`
      }
      section += `\n`
    }

    if (dependents.length > 0) {
      section += `### 📤 이것에 의존하는 항목 (Dependents)\n\n`
      for (const dep of dependents) {
        const link = this.generateIdLink(dep.fromId, currentNodeId)
        const members = dep.importedMembers ? ` (${dep.importedMembers.join(', ')})` : ''
        section += `- ${link} - \`${dep.type}\`${members}\n`
      }
      section += `\n`
    }

    return section
  }

  /**
   * 메트릭 섹션 생성
   */
  private generateMetricsSection(node: MarkdownNode): string {
    const metrics = this.generateMetrics(node)

    let section = `## 📊 메트릭\n\n`
    section += `| 메트릭 | 값 |\n`
    section += `|--------|----|\n`

    for (const [key, value] of Object.entries(metrics)) {
      section += `| ${key} | ${value} |\n`
    }

    section += `\n`
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
    try {
      if (currentNodeId) {
        return this.idRegistry.generateIdLink(targetId, currentNodeId, this.config.outputDirectory)
      } else {
        // 현재 노드 ID가 없는 경우 기본 링크 생성
        return `[${targetId}](${targetId}.md)`
      }
    } catch (error) {
      // 레지스트리에서 찾지 못한 경우 기본 링크 생성
      console.warn(`⚠️ ID not found in registry: ${targetId}`)
      return `[${targetId}](${targetId}.md)`
    }
  }

  /**
   * 마크다운 파일 경로 생성 (ID 레지스트리 사용으로 삭제 예정)
   * @deprecated Use idRegistry.getMarkdownPath() instead
   */
  private getMarkdownFilePath(node: MarkdownNode): string {
    // ID 레지스트리를 통한 일관된 경로 사용
    return this.idRegistry.getMarkdownPath(node.id, this.config.outputDirectory)
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
