import type { Command } from 'commander'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { EnhancedDependencyAnalyzer } from '../analyzers/EnhancedDependencyAnalyzer.js'
import type {
  CollectionOptions,
  NamespaceCollectionConfig,
  NamespaceCollectionRule,
} from '../types/NamespaceCollection.js'
import { DependencyDataCollector } from '../utils/DependencyDataCollector.js'
import { DocumentPathGenerator } from '../utils/DocumentPathGenerator.js'
import { ModularCollectionManager } from '../utils/ModularCollectionManager.js'
import { NamespaceDataFilter } from '../utils/NamespaceDataFilter.js'
import { SimpleMirrorManager } from '../utils/SimpleMirrorManager.js'
import { wrapAction } from './CommandRegistry.js'

/**
 * 네임스페이스 기반 데이터 수집 관련 커맨드들을 등록하는 함수
 */
export const registerNamespaceCollectionCommands = (program: Command): void => {
  registerCollectDataCommand(program)
  registerGeneratePathsCommand(program)
  registerListCollectionRulesCommand(program)
  registerCreateCollectionRuleCommand(program)
  registerUpdateCollectionRuleCommand(program)
  registerListModulesCommand(program)
  registerModularCollectCommand(program)
  registerUpdateAllCommand(program)
}

/**
 * 데이터 수집 커맨드
 */
const registerCollectDataCommand = (program: Command): void => {
  program
    .command('collect-data')
    .description('🔍 의존성 분석 데이터를 기반으로 네임스페이스별 키워드/파일 경로 데이터를 수집합니다')
    .option('--namespace <name>', '특정 네임스페이스만 수집 (지정하지 않으면 모든 네임스페이스)')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--target <path>', '분석할 대상 경로', '.')
    .option('--output <file>', '결과 저장 파일 경로')
    .option('--format <format>', '출력 형식 (json|summary|paths-only)', 'summary')
    .option('--incremental', '증분 수집 모드 (변경된 파일만 분석)')
    .action(
      wrapAction(async (options) => {
        const analyzer = new EnhancedDependencyAnalyzer('.', { debug: false })
        const collector = new DependencyDataCollector(process.cwd(), { debug: false })
        const filter = new NamespaceDataFilter()

        console.log('🔍 의존성 분석 시작...')
        const dependencyGraph = await analyzer.buildProjectDependencyGraph()
        console.log(`📊 분석 완료: ${dependencyGraph.nodes.size}개 파일, ${dependencyGraph.edges.length}개 의존성`)

        console.log('📋 수집 규칙 로드 중...')
        const config = await loadCollectionConfig(options.config)

        const rules = options.namespace
          ? [createRuleFromConfig(options.namespace, config)]
          : createAllRulesFromConfig(config)

        console.log(`🎯 ${rules.length}개 네임스페이스 처리 중...`)

        const results = collector.collectForAllNamespaces(dependencyGraph, rules)

        // 필터링 및 정제
        const filteredResults = results.map((result) => filter.removeDuplicates(result))

        // 결과 출력
        await outputResults(filteredResults, options)

        console.log('✅ 데이터 수집 완료')
      })
    )
}

/**
 * 문서 경로 생성 커맨드
 */
const registerGeneratePathsCommand = (program: Command): void => {
  program
    .command('generate-paths')
    .description('📝 수집된 데이터를 기반으로 네임스페이스별 문서 경로를 생성합니다')
    .option('--namespace <name>', '특정 네임스페이스만 처리')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--target <path>', '분석할 대상 경로', '.')
    .option('--output <file>', '경로 목록 저장 파일')
    .option('--resolve-conflicts', '경로 충돌 자동 해결')
    .action(
      wrapAction(async (options) => {
        const analyzer = new EnhancedDependencyAnalyzer('.', { debug: false })
        const collector = new DependencyDataCollector(process.cwd(), { debug: false })
        const filter = new NamespaceDataFilter()
        const pathGenerator = new DocumentPathGenerator()

        console.log('🔍 의존성 분석 및 데이터 수집 중...')
        const dependencyGraph = await analyzer.buildProjectDependencyGraph()
        const config = await loadCollectionConfig(options.config)

        const rules = options.namespace
          ? [createRuleFromConfig(options.namespace, config)]
          : createAllRulesFromConfig(config)

        const results = collector.collectForAllNamespaces(dependencyGraph, rules)
        const filteredResults = results.map((result) => filter.removeDuplicates(result))

        console.log('📝 문서 경로 생성 중...')

        // 새로운 전략 기반 경로 생성 사용
        let allPaths: any[] = []
        for (const result of filteredResults) {
          const rule = rules.find((r) => r.namespace === result.namespace)
          if (rule) {
            const paths = pathGenerator.generatePathsWithStrategy(result, rule)
            allPaths.push(...paths)
          }
        }

        if (options.resolveConflicts) {
          console.log('🔄 경로 충돌 해결 중...')
          allPaths = pathGenerator.resolveDuplicatePaths(allPaths)
        }

        // 결과 출력
        await outputPaths(allPaths, options)

        console.log(`✅ ${allPaths.length}개 문서 경로 생성 완료`)
      })
    )
}

/**
 * 수집 규칙 목록 조회 커맨드
 */
const registerListCollectionRulesCommand = (program: Command): void => {
  program
    .command('list-collection-rules')
    .description('📋 설정된 네임스페이스 수집 규칙들을 조회합니다')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--detailed', '상세 정보 포함')
    .action(
      wrapAction(async (options) => {
        try {
          const config = await loadCollectionConfig(options.config)

          console.log('📋 네임스페이스 수집 규칙 목록')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const namespaces = Object.keys(config.namespaces)

          if (namespaces.length === 0) {
            console.log('❌ 설정된 수집 규칙이 없습니다')
            console.log('💡 create-collection-rule 명령어로 새 규칙을 생성하세요')
            return
          }

          console.log(`📁 총 ${namespaces.length}개 네임스페이스`)

          for (const [i, namespace] of namespaces.entries()) {
            const rule = config.namespaces[namespace]
            console.log(`\\n${i + 1}. ${namespace}`)

            if (options.detailed) {
              console.log(`   📝 설명: ${rule.description || '(없음)'}`)
              console.log(`   🔍 키워드: ${rule.keywords.join(', ')}`)
              console.log(`   📁 파일 패턴: ${rule.filePaths.join(', ')}`)
              console.log(`   🚫 제외 패턴: ${rule.excludePatterns.join(', ')}`)
              console.log(`   📄 문서 경로: ${rule.documentPath || rule.documentPathTemplate || '(설정되지 않음)'}`)
              console.log(`   📋 문서 전략: ${rule.documentStrategy || 'file-mirror'}`)
              if (rule.enableMirrorTracking !== undefined) {
                console.log(`   🔄 미러링 추적: ${rule.enableMirrorTracking ? '활성화' : '비활성화'}`)
              }
              if (rule.autoBackupDeadFiles !== undefined) {
                console.log(`   📦 자동 백업: ${rule.autoBackupDeadFiles ? '활성화' : '비활성화'}`)
              }
            } else {
              console.log(`   키워드 ${rule.keywords.length}개, 파일패턴 ${rule.filePaths.length}개`)
            }
          }
        } catch (error) {
          console.error('❌ 수집 규칙 조회 실패:', error)
        }
      })
    )
}

/**
 * 수집 규칙 생성 커맨드
 */
const registerCreateCollectionRuleCommand = (program: Command): void => {
  program
    .command('create-collection-rule')
    .description('🆕 새로운 네임스페이스 수집 규칙을 생성합니다')
    .argument('<namespace>', '네임스페이스 이름')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--keywords <keywords>', '수집할 키워드들 (쉼표로 구분)', '')
    .option('--file-paths <paths>', '수집할 파일 경로 패턴들 (쉼표로 구분)', '')
    .option('--exclude <patterns>', '제외할 패턴들 (쉼표로 구분)', '**/*.test.ts,**/*.spec.ts')
    .option('--document-path <path>', '문서 루트 경로', 'docs/default')
    .option(
      '--document-strategy <strategy>',
      '문서 생성 전략 (file-mirror|method-mirror|library-structure|namespace-grouping)',
      'file-mirror'
    )
    .option('--enable-mirror-tracking', '미러링 추적 활성화')
    .option('--auto-backup', '죽은 파일 자동 백업 활성화')
    .option('--description <desc>', '규칙 설명')
    .action(
      wrapAction(async (namespace, options) => {
        try {
          const config = await loadCollectionConfig(options.config).catch(() => ({
            namespaces: {},
          }))

          const keywords = options.keywords ? options.keywords.split(',').map((k: string) => k.trim()) : []
          const filePaths = options.filePaths ? options.filePaths.split(',').map((p: string) => p.trim()) : []
          const excludePatterns = options.exclude.split(',').map((p: string) => p.trim())

          const newRule = {
            keywords,
            filePaths,
            excludePatterns,
            documentStrategy: options.documentStrategy || 'file-mirror',
            documentPath: options.documentPath || `docs/${namespace}`,
            enableMirrorTracking: options.enableMirrorTracking || true,
            autoBackupDeadFiles: options.autoBackup || true,
            description: options.description,
          } as Omit<NamespaceCollectionRule, 'namespace'>

          ;(config.namespaces as any)[namespace] = newRule

          await writeFile(options.config, JSON.stringify(config, null, 2))

          console.log(`✅ 네임스페이스 '${namespace}' 수집 규칙이 생성되었습니다`)
          console.log(`📁 설정 파일: ${options.config}`)
        } catch (error) {
          console.error('❌ 수집 규칙 생성 실패:', error)
        }
      })
    )
}

/**
 * 수집 규칙 수정 커맨드
 */
const registerUpdateCollectionRuleCommand = (program: Command): void => {
  program
    .command('update-collection-rule')
    .description('✏️ 기존 네임스페이스 수집 규칙을 수정합니다')
    .argument('<namespace>', '수정할 네임스페이스 이름')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--keywords <keywords>', '수집할 키워드들 (쉼표로 구분)')
    .option('--file-paths <paths>', '수집할 파일 경로 패턴들 (쉼표로 구분)')
    .option('--exclude <patterns>', '제외할 패턴들 (쉼표로 구분)')
    .option('--document-path <path>', '문서 루트 경로')
    .option(
      '--document-strategy <strategy>',
      '문서 생성 전략 (file-mirror|method-mirror|library-structure|namespace-grouping)'
    )
    .option('--enable-mirror-tracking <value>', '미러링 추적 활성화 (true|false)')
    .option('--auto-backup <value>', '죽은 파일 자동 백업 활성화 (true|false)')
    .option('--description <desc>', '규칙 설명')
    .action(
      wrapAction(async (namespace, options) => {
        try {
          const config = await loadCollectionConfig(options.config)

          if (!config.namespaces[namespace]) {
            console.error(`❌ 네임스페이스 '${namespace}'가 존재하지 않습니다`)
            return
          }

          const rule = config.namespaces[namespace]

          if (options.keywords) {
            rule.keywords = options.keywords.split(',').map((k: string) => k.trim())
          }
          if (options.filePaths) {
            rule.filePaths = options.filePaths.split(',').map((p: string) => p.trim())
          }
          if (options.exclude) {
            rule.excludePatterns = options.exclude.split(',').map((p: string) => p.trim())
          }
          if (options.documentPath) {
            rule.documentPath = options.documentPath
          }
          if (options.documentStrategy) {
            rule.documentStrategy = options.documentStrategy
          }
          if (options.enableMirrorTracking !== undefined) {
            rule.enableMirrorTracking = options.enableMirrorTracking === 'true'
          }
          if (options.autoBackup !== undefined) {
            rule.autoBackupDeadFiles = options.autoBackup === 'true'
          }
          if (options.description) {
            rule.description = options.description
          }

          await writeFile(options.config, JSON.stringify(config, null, 2))

          console.log(`✅ 네임스페이스 '${namespace}' 수집 규칙이 수정되었습니다`)
        } catch (error) {
          console.error('❌ 수집 규칙 수정 실패:', error)
        }
      })
    )
}

// Helper functions

async function loadCollectionConfig(configPath: string): Promise<NamespaceCollectionConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`설정 파일이 존재하지 않습니다: ${configPath}`)
  }

  const content = await readFile(configPath, 'utf-8')
  return JSON.parse(content)
}

function createRuleFromConfig(namespace: string, config: NamespaceCollectionConfig): NamespaceCollectionRule {
  const namespaceConfig = config.namespaces[namespace]
  if (!namespaceConfig) {
    throw new Error(`네임스페이스 '${namespace}'가 설정에 없습니다`)
  }

  return {
    namespace,
    ...namespaceConfig,
  }
}

function createAllRulesFromConfig(config: NamespaceCollectionConfig): NamespaceCollectionRule[] {
  return Object.entries(config.namespaces).map(([namespace, rule]) => ({
    namespace,
    ...rule,
  }))
}

async function outputResults(results: any[], options: any) {
  const output = {
    timestamp: new Date().toISOString(),
    totalNamespaces: results.length,
    results:
      options.format === 'summary'
        ? results.map((r) => ({
            namespace: r.namespace,
            totalItems: r.totalCount,
            collectedAt: r.collectedAt,
          }))
        : results,
  }

  if (options.output) {
    await writeFile(options.output, JSON.stringify(output, null, 2))
    console.log(`📁 결과 저장: ${options.output}`)
  } else {
    console.log(JSON.stringify(output, null, 2))
  }
}

async function outputPaths(paths: any[], options: any) {
  const output = {
    timestamp: new Date().toISOString(),
    totalPaths: paths.length,
    paths: paths.map((p) => ({
      namespace: p.namespace,
      documentPath: p.documentPath,
      sourceItem: {
        type: p.sourceItem.type,
        value: p.sourceItem.value,
        sourcePath: p.sourceItem.sourcePath,
      },
    })),
  }

  if (options.output) {
    await writeFile(options.output, JSON.stringify(output, null, 2))
    console.log(`📁 경로 목록 저장: ${options.output}`)
  } else {
    console.log(JSON.stringify(output, null, 2))
  }
}

/**
 * 수집 모듈 목록 조회 커맨드
 */
const registerListModulesCommand = (program: Command): void => {
  program
    .command('list-modules')
    .description('📋 사용 가능한 수집 모듈들을 조회합니다')
    .option('--detailed', '상세 정보 포함')
    .action(
      wrapAction(async (options) => {
        const manager = new ModularCollectionManager()
        await manager.registerDefaultModules()

        const modules = manager.listModules()

        console.log('📋 사용 가능한 수집 모듈 목록')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        if (modules.length === 0) {
          console.log('❌ 등록된 모듈이 없습니다')
          return
        }

        console.log(`📁 총 ${modules.length}개 모듈`)

        for (const [i, module] of modules.entries()) {
          console.log(`\\n${i + 1}. ${module.name} (${module.id})`)

          if (options.detailed) {
            console.log(`   📝 설명: ${module.description}`)
            console.log(`   🏷️ 버전: ${module.version}`)
            console.log(`   🎯 지원 타입: ${module.supportedTypes.join(', ')}`)
          } else {
            console.log(`   지원 타입: ${module.supportedTypes.length}개`)
          }
        }
      })
    )
}

/**
 * 모듈화된 데이터 수집 커맨드
 */
const registerModularCollectCommand = (program: Command): void => {
  program
    .command('collect-modular')
    .description('🔧 모듈화된 수집 시스템을 사용하여 데이터를 수집합니다')
    .option('--namespace <name>', '특정 네임스페이스만 수집')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--target <path>', '분석할 대상 경로', '.')
    .option('--output <file>', '결과 저장 파일 경로')
    .option('--format <format>', '출력 형식 (json|summary|detailed)', 'summary')
    .option('--modules <modules>', '사용할 모듈들 (쉼표로 구분)', '')
    .option('--strategy <strategy>', '모듈 선택 전략 (all|explicit|auto|priority)', 'auto')
    .option('--parallel', '모듈들을 병렬로 실행')
    .option('--fail-fast', '첫 번째 실패 시 중단')
    .option('--max-items <number>', '최대 수집 개수', '1000')
    .option('--debug', '디버그 모드')
    .action(
      wrapAction(async (options) => {
        const analyzer = new EnhancedDependencyAnalyzer('.', { debug: false })
        const manager = new ModularCollectionManager()
        const filter = new NamespaceDataFilter()

        // 기본 모듈들 등록
        await manager.registerDefaultModules()

        console.log('🔍 의존성 분석 시작...')
        const dependencyGraph = await analyzer.buildProjectDependencyGraph()
        console.log(`📊 분석 완료: ${dependencyGraph.nodes.size}개 파일, ${dependencyGraph.edges.length}개 의존성`)

        console.log('📋 수집 규칙 로드 중...')
        const config = await loadCollectionConfig(options.config)

        const rules = options.namespace
          ? [createRuleFromConfig(options.namespace, config)]
          : createAllRulesFromConfig(config)

        console.log(`🎯 ${rules.length}개 네임스페이스 처리 중...`)

        // 모듈 실행 설정
        const executionConfig = {
          strategy: options.strategy as any,
          selectedModules: options.modules ? options.modules.split(',').map((m: string) => m.trim()) : undefined,
          parallel: options.parallel || false,
          failFast: options.failFast || false,
        }

        // 모듈 옵션
        const moduleOptions = {
          debug: options.debug || false,
          maxItems: parseInt(options.maxItems) || 1000,
        }

        const results = []

        for (const rule of rules) {
          console.log(`🔧 ${rule.namespace} 네임스페이스 모듈화 수집 중...`)
          const result = await manager.collectForNamespace(dependencyGraph, rule, executionConfig, moduleOptions)

          // 필터링 및 정제
          const filteredResult = filter.removeDuplicates(result)
          results.push(filteredResult)
        }

        // 결과 출력
        await outputModularResults(results, options)

        console.log('✅ 모듈화된 데이터 수집 완료')
      })
    )
}

/**
 * 전체 네임스페이스 업데이트 명령어 등록
 */
const registerUpdateAllCommand = (program: Command): void => {
  program
    .command('update-all')
    .description('🚀 모든 네임스페이스에 대해 데이터 수집, 경로 생성 및 문서 생성을 일괄 실행합니다')
    .option('--config <file>', '수집 규칙 설정 파일 경로', 'deps-cli.json')
    .option('--target <path>', '분석할 대상 경로', '.')
    .option('--docs-root <path>', '문서 루트 경로', 'docs')
    .option('--dry-run', '실제 파일 생성 없이 계획만 표시')
    .option('--force', '기존 파일 덮어쓰기')
    .option('--verbose', '상세 로그 출력')
    .action(
      wrapAction(async (options) => {
        const analyzer = new EnhancedDependencyAnalyzer('.', { debug: false })
        const collector = new DependencyDataCollector(process.cwd(), { debug: false })
        const filter = new NamespaceDataFilter()
        const pathGenerator = new DocumentPathGenerator()
        const mirrorManager = new SimpleMirrorManager('.')

        console.log('🚀 전체 네임스페이스 업데이트 시작...\n')

        if (options.dryRun) {
          console.log('🔍 [DRY RUN] 실제 파일은 생성되지 않습니다\n')
        }

        // 1단계: 의존성 분석
        console.log('📊 1단계: 의존성 분석 중...')
        // buildProjectDependencyGraph()는 filePatterns을 첫 번째 매개변수로 받음
        const dependencyGraph = await analyzer.buildProjectDependencyGraph()
        console.log(`   ✅ ${dependencyGraph.nodes.size}개 파일, ${dependencyGraph.edges.length}개 의존성 분석 완료\n`)

        // 2단계: 설정 로드
        console.log('📋 2단계: 네임스페이스 설정 로드 중...')
        const config = await loadCollectionConfig(options.config)
        const rules = createAllRulesFromConfig(config)
        console.log(`   ✅ ${rules.length}개 네임스페이스 설정 로드 완료\n`)

        // 3단계: 데이터 수집
        console.log('🔍 3단계: 네임스페이스별 데이터 수집 중...')
        const results = collector.collectForAllNamespaces(dependencyGraph, rules)
        const filteredResults = results.map((result) => filter.removeDuplicates(result))

        filteredResults.forEach((result) => {
          const rule = rules.find((r) => r.namespace === result.namespace)
          const strategy = rule?.documentStrategy || 'file-mirror'
          console.log(`   📁 ${result.namespace} (${strategy}): ${result.totalCount}개 항목`)
        })
        console.log()

        // 4단계: 경로 생성
        console.log('📝 4단계: 문서 경로 생성 중...')
        const allPaths: any[] = []
        for (const result of filteredResults) {
          const rule = rules.find((r) => r.namespace === result.namespace)
          if (rule) {
            const paths = pathGenerator.generatePathsWithStrategy(result, rule)
            allPaths.push(...paths)
            if (options.verbose) {
              console.log(`   📄 ${rule.namespace}: ${paths.length}개 경로`)
            }
          }
        }
        console.log(`   ✅ 총 ${allPaths.length}개 문서 경로 생성 완료\n`)

        // 5단계: 문서 생성
        console.log('📚 5단계: 문서 파일 생성 중...')

        if (!options.dryRun) {
          const fs = await import('fs/promises')
          const path = await import('path')

          let createdCount = 0
          let skippedCount = 0

          for (const docPath of allPaths) {
            const fullPath = path.resolve(docPath.documentPath)
            const dir = path.dirname(fullPath)

            try {
              // 디렉토리 생성
              await fs.mkdir(dir, { recursive: true })

              // 파일 존재 확인
              const exists = await fs
                .access(fullPath)
                .then(() => true)
                .catch(() => false)

              if (exists && !options.force) {
                if (options.verbose) {
                  console.log(`   ⏭️  건너뜀: ${docPath.documentPath} (이미 존재)`)
                }
                skippedCount++
                continue
              }

              // 간단한 문서 생성 (나중에 각 전략별로 확장 가능)
              const rule = rules.find((r) => r.namespace === docPath.namespace)
              const strategy = rule?.documentStrategy || 'file-mirror'

              let content = ''
              if (strategy === 'file-mirror') {
                // 파일 미러링 전략
                content = await generateFileMirrorDoc(docPath, rule)
              } else if (strategy === 'method-mirror') {
                // 메서드 미러링 전략
                content = generateMethodMirrorDoc(docPath, rule)
              } else if (strategy === 'library-structure') {
                // 라이브러리 구조 전략
                content = generateLibraryStructureDoc(docPath, rule)
              } else if (strategy === 'namespace-grouping') {
                // 네임스페이스 그룹핑 전략
                content = generateNamespaceGroupingDoc(docPath, rule)
              }

              await fs.writeFile(fullPath, content, 'utf-8')

              if (options.verbose) {
                console.log(`   ✅ 생성: ${docPath.documentPath}`)
              }
              createdCount++
            } catch (error) {
              console.error(`   ❌ 실패: ${docPath.documentPath}`, error instanceof Error ? error.message : error)
            }
          }

          console.log(`   ✅ ${createdCount}개 파일 생성, ${skippedCount}개 파일 건너뜀\n`)
        } else {
          console.log('   🔍 [DRY RUN] 생성될 파일 목록:')
          allPaths.slice(0, 10).forEach((docPath) => {
            console.log(`   📄 ${docPath.documentPath}`)
          })
          if (allPaths.length > 10) {
            console.log(`   ... 및 ${allPaths.length - 10}개 추가 파일`)
          }
          console.log()
        }

        console.log('🎉 전체 네임스페이스 업데이트 완료!')
        console.log(`📊 요약:`)
        console.log(`   📁 네임스페이스: ${filteredResults.length}개`)
        console.log(`   📄 수집된 항목: ${filteredResults.reduce((sum, r) => sum + r.totalCount, 0)}개`)
        console.log(`   📚 생성된 경로: ${allPaths.length}개`)
      })
    )
}

// 각 전략별 문서 생성 함수들
async function generateFileMirrorDoc(docPath: any, rule: any): Promise<string> {
  return `# ${docPath.sourceItem.value}

## 📄 File Mirror

**Namespace:** ${docPath.namespace}  
**Strategy:** file-mirror  
**Source:** \`${docPath.sourceItem.sourcePath}\`  
**Pattern:** \`${docPath.sourceItem.matchedPattern}\`

## 📋 File Information

- **Type:** ${docPath.sourceItem.type}
- **Value:** ${docPath.sourceItem.value}

## 🔍 Metadata

\`\`\`json
${JSON.stringify(docPath.sourceItem.metadata || {}, null, 2)}
\`\`\`

---
*Generated by deps-cli ${new Date().toISOString()}*
`
}

function generateMethodMirrorDoc(docPath: any, rule: any): string {
  return `# ${docPath.sourceItem.value}

## 🔧 Method Mirror

**Namespace:** ${docPath.namespace}  
**Strategy:** method-mirror  
**Source:** \`${docPath.sourceItem.sourcePath}\`  
**Pattern:** \`${docPath.sourceItem.matchedPattern}\`

## 📝 Method Information

- **Type:** ${docPath.sourceItem.type}
- **Value:** ${docPath.sourceItem.value}

## 🏗️ Structure

\`\`\`json
${JSON.stringify(docPath.sourceItem.metadata || {}, null, 2)}
\`\`\`

---
*Generated by deps-cli ${new Date().toISOString()}*
`
}

function generateLibraryStructureDoc(docPath: any, rule: any): string {
  return `# ${docPath.sourceItem.value}

## 📦 Library Structure

**Namespace:** ${docPath.namespace}  
**Strategy:** library-structure  
**Source:** \`${docPath.sourceItem.sourcePath}\`  
**Pattern:** \`${docPath.sourceItem.matchedPattern}\`

## 📚 Library Information

- **Type:** ${docPath.sourceItem.type}
- **Value:** ${docPath.sourceItem.value}

## 🔗 Dependencies

\`\`\`json
${JSON.stringify(docPath.sourceItem.metadata || {}, null, 2)}
\`\`\`

---
*Generated by deps-cli ${new Date().toISOString()}*
`
}

function generateNamespaceGroupingDoc(docPath: any, rule: any): string {
  return `# ${docPath.sourceItem.value}

## 🏷️ Namespace Grouping

**Namespace:** ${docPath.namespace}  
**Strategy:** namespace-grouping  
**Source:** \`${docPath.sourceItem.sourcePath}\`  
**Pattern:** \`${docPath.sourceItem.matchedPattern}\`

## 🗂️ Type Information

- **Type:** ${docPath.sourceItem.type}
- **Value:** ${docPath.sourceItem.value}

## 📊 Type Details

\`\`\`json
${JSON.stringify(docPath.sourceItem.metadata || {}, null, 2)}
\`\`\`

---
*Generated by deps-cli ${new Date().toISOString()}*
`
}

// Helper functions for modular collection

async function outputModularResults(results: any[], options: any) {
  const output = {
    timestamp: new Date().toISOString(),
    totalNamespaces: results.length,
    results:
      options.format === 'summary'
        ? results.map((r) => ({
            namespace: r.namespace,
            totalItems: r.totalCount,
            collectedAt: r.collectedAt,
            executionStats: r.metadata
              ? {
                  totalExecutionTime: r.metadata.totalExecutionTime,
                  successfulModules: r.metadata.successfulModules,
                  failedModules: r.metadata.failedModules,
                }
              : undefined,
          }))
        : options.format === 'detailed'
          ? results.map((r) => ({
              namespace: r.namespace,
              totalItems: r.totalCount,
              collectedAt: r.collectedAt,
              items: r.items,
              executionResults: r.metadata?.executionResults || [],
            }))
          : results,
  }

  if (options.output) {
    await writeFile(options.output, JSON.stringify(output, null, 2))
    console.log(`📁 결과 저장: ${options.output}`)
  } else {
    console.log(JSON.stringify(output, null, 2))
  }
}
