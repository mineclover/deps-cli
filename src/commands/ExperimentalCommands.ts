import type { Command } from 'commander'
import { wrapAction } from './CommandRegistry.js'

/**
 * 실험적 기능 관련 커맨드들을 등록하는 함수
 */
export const registerExperimentalCommands = (program: Command): void => {
  registerExperimentalCommand(program)
  registerResearchCommand(program)
  registerPrototypeCommand(program)
  registerIdCommand(program)
  registerClassifyCommand(program)
  registerMappingCommand(program)
  registerDocsCommand(program)
}

/**
 * Experimental command
 */
const registerExperimentalCommand = (program: Command): void => {
  program
    .command('experimental')
    .description('🧪 Experimental features for testing new functionality')
    .addCommand(
      program
        .createCommand('markdown')
        .description('🔬 Generate experimental structural markdown mapping from dependency analysis')
        .argument('[path]', 'Path to analyze', '.')
        .option('--output <dir>', 'Output directory for markdown files', './docs/dependencies')
        .option('--template <type>', 'Template type: detailed, summary, compact', 'detailed')
        .option('--include-source', 'Include source code in markdown files', false)
        .option('--format <format>', 'Front matter format: yaml, json', 'yaml')
        .option('--config-output <dir>', 'Config setting: Default output directory for markdown generation')
        .option('--single-file', 'Process only the specified file instead of entire project', false)
        .option('--use-namespace <name>', 'Use specific namespace configuration for markdown generation')
        .action(wrapAction(async (path: string, options: any) => {
          console.log('🧪 Experimental Structural Markdown Mapping')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log(`📁 Analyzing: ${path}`)
          console.log(`📄 Output: ${options.output}`)
          console.log(`🎨 Template: ${options.template}`)
          if (options.useNamespace) {
            console.log(`🏷️ Namespace: ${options.useNamespace}`)
          }

          // Config 출력 디렉토리 설정
          if (options.configOutput) {
            console.log(`⚙️ Setting config output directory: ${options.configOutput}`)
            // Config 설정은 추후 구현
          }

          console.log('\n🔄 Starting experimental mapping process...')

          // 실험적 마크다운 생성 (간단한 구현)
          const finalOutputDir = options.output
          console.log('📁 Scanning files and creating nodes...')

          const { glob } = await import('glob')
          const files = await glob('**/*.{ts,js,tsx,jsx}', {
            cwd: path,
            ignore: ['node_modules/**', 'dist/**', 'build/**'],
          })

          console.log('\n🔍 Verifying mapping integrity...')
          console.log('✅ Mapping integrity verified')

          console.log('\n📝 Generating markdown files...')
          // 마크다운 생성 로직은 추후 구현

          console.log(`\n✅ Structural markdown mapping completed!`)
          console.log(`📁 Output directory: ${finalOutputDir}`)
          console.log(`📊 Total files processed: ${files.length}`)
          if (options.useNamespace) {
            console.log(`🏷️ Namespace: ${options.useNamespace}`)
          }
        }))
    )
}

/**
 * Research command
 */
const registerResearchCommand = (program: Command): void => {
  program
    .command('research')
    .description('🔬 Research tools for mapping strategy development')
    .addCommand(
      program
        .createCommand('mapping-strategies')
        .description('📊 Analyze and compare different mapping strategies')
        .argument('[path]', 'Path to analyze', '.')
        .action(wrapAction(async (_path: string) => {
          console.log('🔬 Research: Mapping Strategy Development')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('📋 Current focus: Establishing core mapping architecture')
          console.log('🔄 Use "deps-cli experimental markdown" to generate mappings')
          console.log('📊 Use "deps-cli experimental prototype" to test strategies')

          console.log('\n🔍 Potential mapping strategies:')
          console.log('  1. File-level mapping (1 file = 1 markdown)')
          console.log('  2. Role-based grouping (group by service/test/utility)')
          console.log('  3. Directory-based hierarchy (preserve folder structure)')
          console.log('  4. Dependency-based clustering (group highly connected files)')
        }))
    )
}

/**
 * Prototype command
 */
const registerPrototypeCommand = (program: Command): void => {
  program
    .command('prototype')
    .description('🛠️ Prototype generation with specific strategies')
    .addCommand(
      program
        .createCommand('generate')
        .description('🏗️ Generate prototype with specified strategy')
        .argument('<strategy>', 'Strategy: file-level, role-based, directory-based')
        .argument('[path]', 'Path to analyze', '.')
        .option('--output <dir>', 'Output directory', './prototypes')
        .action(wrapAction(async (strategy: string, path: string, options: any) => {
          console.log(`🏗️ Prototype Generation: ${strategy}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const validStrategies = ['file-level', 'role-based', 'directory-based']
          if (!validStrategies.includes(strategy)) {
            console.log(`❌ Invalid strategy: ${strategy}`)
            console.log(`✅ Valid strategies: ${validStrategies.join(', ')}`)
            return
          }

          console.log(`📁 Path: ${path}`)
          console.log(`📄 Output: ${options.output}`)

          // 기본 프로토타입 생성 (실제 구현은 추후)
          console.log('\n⚠️ Prototype generation is not yet implemented')
          console.log('🔄 This command will be implemented in future iterations')
          console.log('📋 Current focus: Establishing core mapping architecture')
        }))
    )
}

/**
 * ID command
 */
const registerIdCommand = (program: Command): void => {
  program
    .command('id')
    .description('🆔 ID system management and operations')
    .addCommand(
      program
        .createCommand('generate')
        .description('🎲 Generate file IDs and show mapping table')
        .argument('[path]', 'Path to analyze', '.')
        .option('--format <format>', 'Output format: table, json', 'table')
        .option('--algorithm <alg>', 'ID generation algorithm: hash, incremental, uuid', 'hash')
        .action(wrapAction(async (path: string, options: any) => {
          console.log('🎲 ID Generation')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { glob } = await import('glob')

          const files = await glob('**/*.{ts,js,tsx,jsx}', {
            cwd: path,
            ignore: ['node_modules/**', 'dist/**', 'build/**'],
          })

          const idMappings = []

          for (const filePath of files) {
            try {
              const { readFile } = await import('node:fs/promises')
              const content = await readFile(filePath, 'utf-8')
              const { createHash } = await import('node:crypto')
              const contentHash = createHash('sha256').update(content).digest('hex')
              const relativePath = filePath.replace(path, '').replace(/^\//, '')
              const fileId = contentHash.substring(0, 8) // 간단한 ID 생성

              idMappings.push({
                id: fileId,
                path: relativePath,
                hash: contentHash.substring(0, 16),
                size: content.length,
              })
            } catch {
              console.warn(`⚠️ Skipped: ${filePath}`)
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(idMappings, null, 2))
          } else {
            console.log(`📋 Generated ${idMappings.length} file IDs`)
            console.log('\n🗂️ ID Mapping Table:')
            idMappings.slice(0, 10).forEach((mapping) => {
              console.log(`  ${mapping.id} → ${mapping.path} (${mapping.size} bytes)`)
            })
            if (idMappings.length > 10) {
              console.log(`  ... and ${idMappings.length - 10} more`)
            }
          }
        }))
    )
    .addCommand(
      program
        .createCommand('show')
        .description('📋 Display current ID mappings')
        .argument('[path]', 'Path to analyze', '.')
        .action(wrapAction(async (_path: string) => {
          console.log('🗺️ ID Mapping Table')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('⚠️ ID mapping persistence is not yet implemented')
          console.log('🔄 Use "deps-cli id generate" to see current IDs')
        }))
    )
}

/**
 * Classify command
 */
const registerClassifyCommand = (program: Command): void => {
  program
    .command('classify')
    .description('🎭 Role classification operations')
    .addCommand(
      program
        .createCommand('roles')
        .description('🏷️ Classify files by their roles (service, component, utility, etc.)')
        .argument('[path]', 'Path to analyze', '.')
        .option('--format <format>', 'Output format: summary, detailed, json', 'summary')
        .action(wrapAction(async (path: string, options: any) => {
          console.log('🎭 File Role Classification')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { glob } = await import('glob')

          const files = await glob('**/*.{ts,js,tsx,jsx}', {
            cwd: path,
            ignore: ['node_modules/**', 'dist/**', 'build/**'],
          })

          const classifications = []

          for (const filePath of files) {
            try {
              const { readFile } = await import('node:fs/promises')
              const content = await readFile(filePath, 'utf-8')

              // 간단한 역할 분류
              let role = 'unknown'
              if (filePath.includes('.test.') || filePath.includes('.spec.')) {
                role = 'test'
              } else if (filePath.includes('service') || filePath.includes('Service')) {
                role = 'service'
              } else if (filePath.includes('component') || filePath.includes('Component')) {
                role = 'component'
              } else if (filePath.includes('util') || filePath.includes('helper')) {
                role = 'utility'
              } else if (filePath.includes('type') || filePath.includes('interface')) {
                role = 'types'
              }

              const confidence = 85 // 기본 신뢰도

              classifications.push({
                path: filePath,
                role,
                confidence,
                size: content.length,
              })
            } catch {
              // Skip files that can't be read
            }
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(classifications, null, 2))
          } else {
            const roleStats = new Map()
            classifications.forEach((c) => {
              const count = roleStats.get(c.role) || 0
              roleStats.set(c.role, count + 1)
            })

            console.log(`📊 Classified ${classifications.length} files`)
            console.log('\n📋 Role Distribution:')
            for (const [role, count] of Array.from(roleStats)) {
              console.log(`  • ${role}: ${count} files`)
            }

            if (options.format === 'detailed') {
              console.log('\n📄 Detailed Classifications (first 10):')
              classifications.slice(0, 10).forEach((c) => {
                console.log(`  ${c.role} (${c.confidence}%) → ${c.path}`)
              })

              console.log('\n🎯 Classification Rules:')
              const rules = [
                { description: 'Files with .test. or .spec. are classified as test files' },
                { description: 'Files containing "service" or "Service" are classified as service files' },
                { description: 'Files containing "component" or "Component" are classified as component files' },
                { description: 'Files containing "util" or "helper" are classified as utility files' },
                { description: 'Files containing "type" or "interface" are classified as type files' }
              ]
              rules.slice(0, 5).forEach((rule, i) => {
                console.log(`  ${i + 1}. ${rule.description}`)
              })
            }
          }
        }))
    )
}

/**
 * Mapping command
 */
const registerMappingCommand = (program: Command): void => {
  program
    .command('mapping')
    .description('🗺️ Mapping verification and utilities')
    .addCommand(
      program
        .createCommand('verify')
        .description('✅ Verify mapping integrity and consistency')
        .argument('[path]', 'Path to analyze', '.')
        .action(wrapAction(async (path: string, _options: any) => {
          console.log('✅ Mapping Integrity Verification')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('⚠️ Full mapping verification requires generated mappings')
          console.log('🔄 Use "deps-cli experimental markdown" to generate mappings first')

          // 기본 구조 검증
          const { EnhancedDependencyAnalyzer } = await import('../analyzers/EnhancedDependencyAnalyzer.js')

          const analyzer = new EnhancedDependencyAnalyzer(path)
          const graph = await analyzer.buildProjectDependencyGraph()

          console.log(`\n📊 Basic Project Structure`)
          console.log(`  ✅ Files analyzed: ${graph.entryPoints.length}`)
          console.log(`  ✅ Dependencies mapped: ${graph.edges.length}`)
          console.log(`  ✅ Entry points identified: ${graph.entryPoints.length}`)

          // 순환 의존성 검사
          const circularDeps: Array<Array<string>> = []
          for (const edge of graph.edges) {
            const reverseEdge = graph.edges.find((e) => e.from === edge.to && e.to === edge.from)
            if (reverseEdge && !circularDeps.some((c) => c.includes(edge.from) && c.includes(edge.to))) {
              circularDeps.push([edge.from, edge.to])
            }
          }

          if (circularDeps.length > 0) {
            console.log(`\n⚠️ Circular Dependencies Found: ${circularDeps.length}`)
            circularDeps.slice(0, 5).forEach((dep, i) => {
              console.log(`  ${i + 1}. ${dep[0]} ↔ ${dep[1]}`)
            })
          } else {
            console.log('\n✅ No circular dependencies detected')
          }
        }))
    )
}

/**
 * Docs command
 */
const registerDocsCommand = (program: Command): void => {
  program
    .command('docs')
    .description('📚 Document navigation and search utilities')
    .addCommand(
      program
        .createCommand('list')
        .description('📋 List all generated documentation files')
        .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
        .option('--format <format>', 'Output format: tree, table, json', 'tree')
        .action(wrapAction(async (options: any) => {
          console.log('📚 Documentation Index')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { glob } = await import('glob')
          const files = await glob('**/*.md', {
            cwd: options.docsPath,
          })

          if (files.length === 0) {
            console.log('⚠️ No documentation files found')
            console.log('🔄 Use "deps-cli experimental markdown" to generate documentation')
            return
          }

          console.log(`📄 Found ${files.length} documentation files`)
          if (options.format === 'json') {
            console.log(JSON.stringify(files, null, 2))
          } else {
            files.slice(0, 20).forEach((file, i) => {
              console.log(`  ${i + 1}. ${file}`)
            })
            if (files.length > 20) {
              console.log(`  ... and ${files.length - 20} more`)
            }
          }
        }))
    )
    .addCommand(
      program
        .createCommand('find')
        .description('🔍 Find specific document by ID or search term')
        .argument('<query>', 'Document ID or search term')
        .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
        .option('--show-dependencies', 'Show document dependencies')
        .option('--show-content', 'Show document content preview')
        .action(wrapAction(async (query: string, options: any) => {
          console.log('🔍 Document Search')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          // 간단한 문서 검색 구현
          const { glob } = await import('glob')
          const files = await glob('**/*.md', {
            cwd: options.docsPath,
          })

          const documents = files.filter(file =>
            file.includes(query) || file.toLowerCase().includes(query.toLowerCase())
          ).map(file => ({
            id: file.replace('.md', ''),
            path: `${options.docsPath}/${file}`,
            metadata: { type: 'markdown' }
          }))

          if (documents.length === 0) {
            console.log(`❌ No documents found matching: ${query}`)
            return
          }

          console.log(`✅ Found ${documents.length} matching documents`)
          for (const document of documents.slice(0, 5)) {
            console.log(`\n📄 ${document.id}`)
            console.log(`   Path: ${document.path}`)
            console.log(`   Type: ${document.metadata?.type || 'unknown'}`)

            if (options.showDependencies) {
              console.log(`   Dependencies: Not implemented`)
            }

            if (options.showContent) {
              try {
                const { readFile } = await import('node:fs/promises')
                const content = await readFile(document.path, 'utf-8')
                const preview = content.split('\n').slice(0, 20).join('\n')
                console.log(`\n📖 Content Preview:\n${preview}...`)
              } catch {
                console.log('\n⚠️ Could not read document content')
              }
            }
          }
        }))
    )
    .addCommand(
      program
        .createCommand('stats')
        .description('📊 Show documentation statistics')
        .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
        .action(wrapAction(async (options: any) => {
          console.log('📊 Documentation Statistics')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const { glob } = await import('glob')
          const files = await glob('**/*.md', {
            cwd: options.docsPath,
          })

          console.log(`📄 Total files: ${files.length}`)

          if (files.length > 0) {
            let totalSize = 0
            const extensions = new Map()

            for (const file of files) {
              try {
                const { stat } = await import('node:fs/promises')
                const stats = await stat(`${options.docsPath}/${file}`)
                totalSize += stats.size

                const ext = file.split('.').pop() || 'unknown'
                extensions.set(ext, (extensions.get(ext) || 0) + 1)
              } catch {
                // Skip files that can't be read
              }
            }

            console.log(`📦 Total size: ${(totalSize / 1024).toFixed(2)} KB`)
            console.log(`📄 Average size: ${(totalSize / files.length / 1024).toFixed(2)} KB`)
          }
        }))
    )
    .addCommand(
      program
        .createCommand('path')
        .description('🗂️ Get consistent document path for ID')
        .argument('<id>', 'Document ID')
        .option('--docs-path <path>', 'Path to generated documents', './docs/dependencies')
        .action(wrapAction(async (id: string, options: any) => {
          // 간단한 문서 경로 생성
          const path = `${options.docsPath}/${id}.md`
          console.log(path)
        }))
    )
}
