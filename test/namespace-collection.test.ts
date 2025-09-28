import { describe, expect, it } from 'vitest'
import type { ProjectDependencyGraph } from '../src/analyzers/EnhancedDependencyAnalyzer.js'
import type { NamespaceCollectionRule } from '../src/types/NamespaceCollection.js'
import { DependencyDataCollector } from '../src/utils/DependencyDataCollector.js'
import { DocumentPathGenerator } from '../src/utils/DocumentPathGenerator.js'
import { NamespaceDataFilter } from '../src/utils/NamespaceDataFilter.js'

describe('NamespaceCollection System', () => {
  const mockDependencyGraph: ProjectDependencyGraph = {
    nodes: new Set([
      'src/analyzers/EnhancedDependencyAnalyzer.ts',
      'src/utils/DependencyDataCollector.ts',
      'src/commands/AnalysisCommands.ts',
    ]),
    edges: [],
    exportMap: new Map([
      [
        'src/analyzers/EnhancedDependencyAnalyzer.ts',
        {
          exportMethods: [
            {
              name: 'EnhancedDependencyAnalyzer',
              exportType: 'class',
              declarationType: 'named_export',
              location: { line: 1, column: 1 },
            },
          ],
          statistics: { totalExports: 1, functionExports: 0, classExports: 1, variableExports: 0, typeExports: 0 },
          classes: [],
        },
      ],
      [
        'src/utils/DependencyDataCollector.ts',
        {
          exportMethods: [
            {
              name: 'DependencyDataCollector',
              exportType: 'class',
              declarationType: 'named_export',
              location: { line: 1, column: 1 },
            },
          ],
          statistics: { totalExports: 1, functionExports: 0, classExports: 1, variableExports: 0, typeExports: 0 },
          classes: [],
        },
      ],
      [
        'src/commands/AnalysisCommands.ts',
        {
          exportMethods: [
            {
              name: 'registerAnalysisCommands',
              exportType: 'function',
              declarationType: 'named_export',
              location: { line: 1, column: 1 },
            },
          ],
          statistics: { totalExports: 1, functionExports: 1, classExports: 0, variableExports: 0, typeExports: 0 },
          classes: [],
        },
      ],
    ]),
    importMap: new Map(),
    entryPoints: [],
  }

  const mockRule: NamespaceCollectionRule = {
    namespace: 'file-mirror',
    keywords: ['Analyzer', 'Enhanced'],
    filePaths: ['src/analyzers/*.ts'],
    excludePatterns: ['**/*.test.ts'],
    documentStrategy: 'file-mirror',
    documentPath: 'docs/analyzers',
    enableMirrorTracking: true,
    autoBackupDeadFiles: true,
    description: '분석기 관련 컴포넌트',
  }

  describe('DependencyDataCollector', () => {
    it('should collect file path based data', () => {
      const collector = new DependencyDataCollector()
      const result = collector.collectForNamespace(mockDependencyGraph, mockRule)

      expect(result.namespace).toBe('file-mirror')
      expect(result.items.length).toBeGreaterThan(0)

      const fileItems = result.items.filter((item: any) => item.type === 'file')
      expect(fileItems.length).toBeGreaterThan(0)
    })

    it('should collect keyword based data', () => {
      const collector = new DependencyDataCollector()
      const result = collector.collectForNamespace(mockDependencyGraph, mockRule)

      const keywordItems = result.items.filter((item: any) => item.type === 'keyword')
      expect(keywordItems.length).toBeGreaterThan(0)

      const enhancedItems = keywordItems.filter((item: any) => item.value.includes('Enhanced'))
      expect(enhancedItems.length).toBeGreaterThan(0)
    })

    it('should respect exclude patterns', () => {
      const ruleWithTestExclusion: NamespaceCollectionRule = {
        ...mockRule,
        filePaths: ['**/*.ts'],
        excludePatterns: ['**/test/**', '**/*.test.ts'],
      }

      const collector = new DependencyDataCollector()
      const result = collector.collectForNamespace(mockDependencyGraph, ruleWithTestExclusion)

      const testFiles = result.items.filter(
        (item: any) => item.sourcePath.includes('test') || item.sourcePath.includes('.test.')
      )
      expect(testFiles.length).toBe(0)
    })
  })

  describe('NamespaceDataFilter', () => {
    it('should remove duplicates', () => {
      const mockResult = {
        namespace: 'test',
        items: [
          {
            type: 'keyword' as const,
            value: 'TestClass',
            sourcePath: '/test/file.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          {
            type: 'keyword' as const,
            value: 'TestClass',
            sourcePath: '/test/file.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
        ],
        collectedAt: new Date(),
        totalCount: 2,
      }

      const filter = new NamespaceDataFilter()
      const filtered = filter.removeDuplicates(mockResult)

      expect(filtered.items.length).toBe(1)
      expect(filtered.totalCount).toBe(1)
    })

    it('should filter by type', () => {
      const mockResult = {
        namespace: 'test',
        items: [
          {
            type: 'keyword' as const,
            value: 'TestClass',
            sourcePath: '/test/file.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          {
            type: 'file' as const,
            value: '/test/file.ts',
            sourcePath: '/test/file.ts',
            matchedPattern: '**/*.ts',
            metadata: {},
          },
        ],
        collectedAt: new Date(),
        totalCount: 2,
      }

      const filter = new NamespaceDataFilter()
      const keywordOnly = filter.filterByType(mockResult, ['keyword'])

      expect(keywordOnly.items.length).toBe(1)
      expect(keywordOnly.items[0].type).toBe('keyword')
    })

    it('should generate statistics', () => {
      const mockResult = {
        namespace: 'test',
        items: [
          {
            type: 'keyword' as const,
            value: 'TestClass',
            sourcePath: '/test/file1.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          {
            type: 'file' as const,
            value: '/test/file2.ts',
            sourcePath: '/test/file2.ts',
            matchedPattern: '**/*.ts',
            metadata: {},
          },
        ],
        collectedAt: new Date(),
        totalCount: 2,
      }

      const filter = new NamespaceDataFilter()
      const stats = filter.generateStatistics(mockResult)

      expect(stats.namespace).toBe('test')
      expect(stats.totalItems).toBe(2)
      expect(stats.typeDistribution.keyword).toBe(1)
      expect(stats.typeDistribution.file).toBe(1)
      expect(stats.sourceFileCount).toBe(2)
    })
  })

  describe('DocumentPathGenerator', () => {
    it('should generate document paths from collected data', () => {
      const mockResult = {
        namespace: 'file-mirror',
        items: [
          {
            type: 'keyword' as const,
            value: 'EnhancedDependencyAnalyzer',
            sourcePath: 'src/analyzers/EnhancedDependencyAnalyzer.ts',
            matchedPattern: 'Enhanced*',
            metadata: { exportType: 'class' },
          },
        ],
        collectedAt: new Date(),
        totalCount: 1,
      }

      const generator = new DocumentPathGenerator()
      const paths = generator.generateSimpleFileMirrorPaths(mockResult, 'docs/file-mirror')

      expect(paths.length).toBe(1)
      expect(paths[0].namespace).toBe('file-mirror')
      expect(paths[0].documentPath).toContain('docs/file-mirror/')
      expect(paths[0].documentPath).toContain('EnhancedDependencyAnalyzer')
      expect(paths[0].documentPath).toContain('.md')
    })

    it('should resolve duplicate paths', () => {
      const duplicatePaths = [
        {
          namespace: 'test',
          documentPath: 'test/same.md',
          sourceItem: {
            type: 'keyword' as const,
            value: 'Test1',
            sourcePath: '/test1.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          templateVariables: {},
        },
        {
          namespace: 'test',
          documentPath: 'test/same.md',
          sourceItem: {
            type: 'keyword' as const,
            value: 'Test2',
            sourcePath: '/test2.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          templateVariables: {},
        },
      ]

      const generator = new DocumentPathGenerator()
      const resolved = generator.resolveDuplicatePaths(duplicatePaths)

      expect(resolved.length).toBe(2)
      expect(resolved[0].documentPath).not.toBe(resolved[1].documentPath)
      expect(resolved.some((p: any) => p.documentPath.includes('_1'))).toBe(true)
      expect(resolved.some((p: any) => p.documentPath.includes('_2'))).toBe(true)
    })

    it('should group paths by directory', () => {
      const paths = [
        {
          namespace: 'test',
          documentPath: 'analyzers/classes/Test1.md',
          sourceItem: {
            type: 'keyword' as const,
            value: 'Test1',
            sourcePath: '/test1.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          templateVariables: {},
        },
        {
          namespace: 'test',
          documentPath: 'analyzers/functions/Test2.md',
          sourceItem: {
            type: 'keyword' as const,
            value: 'Test2',
            sourcePath: '/test2.ts',
            matchedPattern: 'Test*',
            metadata: {},
          },
          templateVariables: {},
        },
      ]

      const generator = new DocumentPathGenerator()
      const grouped = generator.groupPathsByDirectory(paths)

      expect(Object.keys(grouped).length).toBe(2)
      expect(grouped['analyzers/classes']).toBeDefined()
      expect(grouped['analyzers/functions']).toBeDefined()
      expect(grouped['analyzers/classes'].length).toBe(1)
      expect(grouped['analyzers/functions'].length).toBe(1)
    })
  })
})
