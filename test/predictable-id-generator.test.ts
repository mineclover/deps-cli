import { describe, expect, it } from 'vitest'
import { PredictableIdGenerator } from '../src/utils/PredictableIdGenerator.js'

describe('PredictableIdGenerator', () => {
  const projectRoot = '/Users/test/my-project'

  describe('generateProjectBasedFileId', () => {
    it('should generate predictable IDs based on project root', () => {
      const cases = [
        {
          filePath: '/Users/test/my-project/src/utils/IdGenerator.ts',
          expected: 'src-utils-id-generator-ts',
        },
        {
          filePath: '/Users/test/my-project/test/unit/helper.ts',
          expected: 'test-unit-helper-ts',
        },
        {
          filePath: '/Users/test/my-project/README.md',
          expected: 'readme-md',
        },
        {
          filePath: '/Users/test/my-project/src/components/ui/Button.tsx',
          expected: 'src-components-ui-button-tsx',
        },
      ]

      cases.forEach(({ filePath, expected }) => {
        const id = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)
        expect(id).toBe(expected)
      })
    })

    it('should be deterministic - same input always produces same output', () => {
      const filePath = '/Users/test/my-project/src/utils/helper.ts'

      const id1 = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)
      const id2 = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)
      const id3 = PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot)

      expect(id1).toBe(id2)
      expect(id2).toBe(id3)
      expect(id1).toBe('src-utils-helper-ts')
    })
  })

  describe('generateNamespacedFileId', () => {
    it('should generate namespace-unique IDs', () => {
      const filePath = '/Users/test/my-project/src/utils/IdGenerator.ts'

      const prodId = PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, 'production')

      const testId = PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, 'testing')

      expect(prodId).toBe('prod-src-utils-id-generator-ts')
      expect(testId).toBe('test-src-utils-id-generator-ts')
      expect(prodId).not.toBe(testId)
    })

    it('should handle custom namespaces', () => {
      const filePath = '/Users/test/my-project/src/config.ts'

      const customId = PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, 'my-custom-env')

      expect(customId).toBe('my-custom-env-src-config-ts')
    })
  })

  describe('generateSmartProjectId', () => {
    it('should apply smart directory rules', () => {
      const cases = [
        {
          filePath: '/Users/test/my-project/src/utils/helper.ts',
          expected: 'utils-helper-ts', // src 생략
        },
        {
          filePath: '/Users/test/my-project/test/unit/spec.ts',
          expected: 'test-unit-spec-ts', // test 접두사
        },
        {
          filePath: '/Users/test/my-project/docs/api/guide.md',
          expected: 'docs-api-guide-md', // docs 접두사
        },
        {
          filePath: '/Users/test/my-project/examples/basic.js',
          expected: 'ex-basic-js', // examples 축약
        },
        {
          filePath: '/Users/test/my-project/scripts/build.sh',
          expected: 'script-build-sh', // scripts 접두사
        },
        {
          filePath: '/Users/test/my-project/config/app.json',
          expected: 'cfg-app-json', // config 축약
        },
      ]

      cases.forEach(({ filePath, expected }) => {
        const id = PredictableIdGenerator.generateSmartProjectId(filePath, projectRoot)
        expect(id).toBe(expected)
      })
    })
  })

  describe('generatePredictableMethodId', () => {
    it('should generate method IDs based on file ID', () => {
      const fileId = 'src-utils-id-generator-ts'

      const cases = [
        {
          methodName: 'generateFileId',
          expected: 'src-utils-id-generator-ts--generate-file-id',
        },
        {
          methodName: 'validateInput',
          expected: 'src-utils-id-generator-ts--validate-input',
        },
        {
          methodName: 'constructor',
          expected: 'src-utils-id-generator-ts--constructor',
        },
      ]

      cases.forEach(({ methodName, expected }) => {
        const id = PredictableIdGenerator.generatePredictableMethodId(methodName, fileId as any)
        expect(id).toBe(expected)
      })
    })

    it('should include line numbers when provided', () => {
      const fileId = 'src-utils-helper-ts'
      const methodName = 'processData'
      const startLine = 42

      const id = PredictableIdGenerator.generatePredictableMethodId(methodName, fileId as any, startLine)

      expect(id).toBe('src-utils-helper-ts--process-data-l42')
    })
  })

  describe('extractFileContext', () => {
    it('should extract meaningful context from file paths', () => {
      const cases = [
        {
          filePath: '/Users/test/my-project/src/components/Button.tsx',
          expected: {
            category: 'src',
            subcategory: 'components',
            name: 'button',
            extension: 'tsx',
          },
        },
        {
          filePath: '/Users/test/my-project/test/unit/helper.spec.ts',
          expected: {
            category: 'test',
            subcategory: 'unit',
            name: 'helper-spec',
            extension: 'ts',
          },
        },
        {
          filePath: '/Users/test/my-project/README.md',
          expected: {
            category: 'root',
            subcategory: 'main',
            name: 'readme',
            extension: 'md',
          },
        },
      ]

      cases.forEach(({ filePath, expected }) => {
        const context = PredictableIdGenerator.extractFileContext(filePath, projectRoot)
        expect(context).toEqual(expected)
      })
    })
  })

  describe('isValidPredictableId', () => {
    it('should validate ID format correctly', () => {
      const validIds = [
        'src-utils-helper-ts',
        'test-unit-spec-js',
        'config-app-json',
        'readme-md',
        'a',
        'my-component-123',
      ]

      const invalidIds = [
        'src_utils_helper.ts', // 언더스코어와 점
        'src--utils--helper', // 연속 하이픈
        '-src-utils-helper', // 시작 하이픈
        'src-utils-helper-', // 끝 하이픈
        'Src-Utils-Helper', // 대문자
        '', // 빈 문자열
        'a'.repeat(101), // 너무 긴 ID
      ]

      validIds.forEach((id) => {
        expect(PredictableIdGenerator.isValidPredictableId(id)).toBe(true)
      })

      invalidIds.forEach((id) => {
        expect(PredictableIdGenerator.isValidPredictableId(id)).toBe(false)
      })
    })
  })

  describe('compareIdStrategies', () => {
    it('should compare different strategies for the same file', () => {
      const filePath = '/Users/test/my-project/src/components/ui/Button.tsx'
      const namespace = 'production'

      const comparison = PredictableIdGenerator.compareIdStrategies(filePath, projectRoot, namespace)

      expect(comparison.projectBased).toBe('src-components-ui-button-tsx')
      expect(comparison.namespaced).toBe('prod-src-components-ui-button-tsx')
      expect(comparison.hierarchical).toBe('src-components-ui-button-tsx')
      expect(comparison.smart).toBe('components-ui-button-tsx')
      expect(comparison.context).toEqual({
        category: 'src',
        subcategory: 'components',
        name: 'button',
        extension: 'tsx',
      })
    })
  })

  describe('generateBatchIds', () => {
    it('should generate IDs for multiple files without conflicts', () => {
      const filePaths = [
        '/Users/test/my-project/src/utils/helper.ts',
        '/Users/test/my-project/test/utils/helper.ts', // 같은 이름, 다른 경로
        '/Users/test/my-project/src/components/Button.tsx',
        '/Users/test/my-project/docs/README.md',
      ]

      const idMap = PredictableIdGenerator.generateBatchIds(filePaths, projectRoot, 'smart')

      const ids = Array.from(idMap.values())

      // 모든 ID가 유니크한지 확인
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)

      // 특정 ID 확인
      expect(idMap.get('/Users/test/my-project/src/utils/helper.ts')).toBe('utils-helper-ts')
      expect(idMap.get('/Users/test/my-project/src/components/Button.tsx')).toBe('components-button-tsx')
      expect(idMap.get('/Users/test/my-project/docs/README.md')).toBe('docs-readme-md')

      // 충돌하는 파일은 전체 경로 사용
      const conflictId = idMap.get('/Users/test/my-project/test/utils/helper.ts')
      expect(conflictId).toBe('test-utils-helper-ts')
    })
  })

  describe('deterministic behavior', () => {
    it('should always produce the same results for the same inputs', () => {
      const filePath = '/Users/test/my-project/src/components/MyComponent.tsx'
      const namespace = 'production'

      // 여러 번 실행해도 동일한 결과
      const results = Array.from({ length: 10 }, () => ({
        projectBased: PredictableIdGenerator.generateProjectBasedFileId(filePath, projectRoot),
        namespaced: PredictableIdGenerator.generateNamespacedFileId(filePath, projectRoot, namespace),
        smart: PredictableIdGenerator.generateSmartProjectId(filePath, projectRoot),
      }))

      // 모든 결과가 동일한지 확인
      const firstResult = results[0]
      results.forEach((result) => {
        expect(result).toEqual(firstResult)
      })

      // 예상 값 확인
      expect(firstResult.projectBased).toBe('src-components-my-component-tsx')
      expect(firstResult.namespaced).toBe('prod-src-components-my-component-tsx')
      expect(firstResult.smart).toBe('components-my-component-tsx')
    })
  })
})
