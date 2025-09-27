import { describe, expect, it } from 'vitest'
import { MirrorPathMapper } from '../src/utils/MirrorPathMapper.js'

describe('MirrorPathMapper', () => {
  const projectRoot = '/Users/test/my-project'
  const docsRoot = './docs'

  describe('basic path mapping', () => {
    it('should always return the same document path for the same source file', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      // 여러 번 호출해도 동일한 결과
      const path1 = mapper.getDocumentPath(sourceFile)
      const path2 = mapper.getDocumentPath(sourceFile)
      const path3 = mapper.getDocumentPath(sourceFile)

      expect(path1).toBe(path2)
      expect(path2).toBe(path3)
      expect(path1).toContain('src/utils/helper.ts.md')
    })

    it('should provide perfect reverse mapping', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
    })

    it('should handle root-level files', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/index.ts'

      const documentPath = mapper.getDocumentPath(sourceFile)
      expect(documentPath).toContain('index.ts.md')

      const reversedPath = mapper.getSourcePath(documentPath)
      expect(reversedPath).toBe(sourceFile)
    })
  })

  describe('mapping information', () => {
    it('should provide complete mapping information', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/api/client.ts'

      const info = mapper.getMappingInfo(sourceFile)

      expect(info.sourceFile).toBe(sourceFile)
      expect(info.relativePath).toBe('src/api/client.ts')
      expect(info.documentFile).toContain('src/api/client.ts.md')
      expect(typeof info.sourceExists).toBe('boolean')
      expect(typeof info.documentExists).toBe('boolean')
    })

    it('should provide relative mapping information', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const info = mapper.getRelativeMapping(sourceFile)

      expect(info.sourceFile).toBe('src/utils/helper.ts')
      expect(info.markdownFile).toContain('src/utils/helper.ts.md')
      expect(info.fileId).toBe('src-utils-helper-ts')
    })
  })

  describe('batch mapping', () => {
    it('should map multiple files consistently', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFiles = [
        '/Users/test/my-project/src/utils/helper.ts',
        '/Users/test/my-project/src/components/Button.tsx',
        '/Users/test/my-project/test/unit/helper.test.ts'
      ]

      const mapping = mapper.getBatchMapping(sourceFiles)

      expect(mapping.size).toBe(3)
      expect(mapping.get('/Users/test/my-project/src/utils/helper.ts')).toContain('src/utils/helper.ts.md')
      expect(mapping.get('/Users/test/my-project/src/components/Button.tsx')).toContain('src/components/Button.tsx.md')
      expect(mapping.get('/Users/test/my-project/test/unit/helper.test.ts')).toContain('test/unit/helper.test.ts.md')
    })
  })

  describe('mapping verification', () => {
    it('should verify mapping integrity', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const verification = mapper.verifyMapping(sourceFile)

      expect(verification.valid).toBe(true)
      expect(verification.sourceFile).toBe(sourceFile)
      expect(verification.documentFile).toContain('src/utils/helper.ts.md')
      expect(verification.perfectMatch).toBe(true)
    })
  })

  describe('deterministic behavior', () => {
    it('should be completely deterministic across instances', () => {
      const sourceFile = '/Users/test/my-project/src/hooks/useApi.ts'

      // 다른 인스턴스들
      const mapper1 = new MirrorPathMapper(projectRoot, docsRoot)
      const mapper2 = new MirrorPathMapper(projectRoot, docsRoot)
      const mapper3 = new MirrorPathMapper(projectRoot, docsRoot)

      const path1 = mapper1.getDocumentPath(sourceFile)
      const path2 = mapper2.getDocumentPath(sourceFile)
      const path3 = mapper3.getDocumentPath(sourceFile)

      expect(path1).toBe(path2)
      expect(path2).toBe(path3)
      expect(path1).toContain('src/hooks/useApi.ts.md')
    })

    it('should be consistent with different docs root paths', () => {
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const mapper1 = new MirrorPathMapper(projectRoot, './docs')
      const mapper2 = new MirrorPathMapper(projectRoot, '/different/docs/path')

      const info1 = mapper1.getMappingInfo(sourceFile)
      const info2 = mapper2.getMappingInfo(sourceFile)

      // 상대 경로는 동일해야 함 (docs root와 무관)
      expect(info1.relativePath).toBe(info2.relativePath)
      expect(info1.relativePath).toBe('src/utils/helper.ts')

      // 하지만 전체 문서 경로는 다름
      expect(info1.documentFile).not.toBe(info2.documentFile)
    })
  })

  describe('special characters and edge cases', () => {
    it('should handle files with underscores', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/my_helper.ts'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
      expect(documentPath).toContain('src/utils/my_helper.ts.md')
    })

    it('should handle files with hyphens', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/my-helper.ts'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
      expect(documentPath).toContain('src/utils/my-helper.ts.md')
    })

    it('should handle files with multiple dots', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.test.ts'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
      expect(documentPath).toContain('src/utils/helper.test.ts.md')
    })

    it('should handle deeply nested files', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/components/ui/forms/input/TextInput.tsx'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
      expect(documentPath).toContain('src/components/ui/forms/input/TextInput.tsx.md')
    })

    it('should handle complex filenames with mixed separators', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/components/complex_file-name.with.dots.tsx'

      const documentPath = mapper.getDocumentPath(sourceFile)
      const reversedPath = mapper.getSourcePath(documentPath)

      expect(reversedPath).toBe(sourceFile)
      expect(documentPath).toContain('src/components/complex_file-name.with.dots.tsx.md')
    })
  })

  describe('method and class documentation paths', () => {
    it('should generate method documentation paths', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'
      const methodName = 'calculateSum'

      const methodPath = mapper.getMethodDocumentPath(sourceFile, methodName)

      expect(methodPath).toContain('methods/src/utils/helper/calculateSum.md')
    })

    it('should generate class documentation paths', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/Helper.ts'
      const className = 'Helper'

      const classPath = mapper.getClassDocumentPath(sourceFile, className)

      expect(classPath).toContain('classes/src/utils/Helper/Helper.md')
    })

    it('should generate library documentation paths', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const libraryName = 'lodash'

      const libraryPath = mapper.getLibraryDocumentPath(libraryName)

      expect(libraryPath).toContain('libraries/lodash.md')
    })

    it('should handle scoped package names for library paths', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const libraryName = '@types/node'

      const libraryPath = mapper.getLibraryDocumentPath(libraryName)

      expect(libraryPath).toContain('libraries/_types_node.md')
    })

    it('should generate module documentation paths', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const modulePath = 'src/utils/index.ts'

      const moduleDocPath = mapper.getModuleDocumentPath(modulePath)

      expect(moduleDocPath).toContain('modules/src/utils/index.md')
    })
  })

  describe('legacy PathMapper compatibility', () => {
    it('should provide getMarkdownPath compatibility method', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const markdownPath = mapper.getMarkdownPath(sourceFile)

      expect(markdownPath).toContain('src/utils/helper.ts.md')
      expect(markdownPath).toBe(mapper.getDocumentPath(sourceFile))
    })

    it('should provide findConsistentPath compatibility method', () => {
      const mapper = new MirrorPathMapper(projectRoot, docsRoot)
      const sourceFile = '/Users/test/my-project/src/utils/helper.ts'

      const result = mapper.findConsistentPath(sourceFile)

      expect(result.found).toBe(true)
      expect(result.markdownPath).toContain('src/utils/helper.ts.md')
      expect(result.fileId).toBe('src-utils-helper-ts')
      expect(result.message).toContain('미러링 매핑')
    })
  })

  describe('project mapping generation', () => {
    it('should generate project mapping table', () => {
      // 실제 존재하는 프로젝트 루트 사용
      const realProjectRoot = process.cwd()
      const mapper = new MirrorPathMapper(realProjectRoot, docsRoot)

      const mappingTable = mapper.generateProjectMappingTable()

      expect(typeof mappingTable).toBe('object')
      expect(mappingTable.totalFiles).toBeGreaterThan(0)
      expect(Array.isArray(mappingTable.mappings)).toBe(true)
      expect(mappingTable.mappings.length).toBe(mappingTable.totalFiles)
    })
  })
})