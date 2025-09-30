import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { globalConfig } from '../src/config/ConfigManager.js'
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const TEST_CONFIG = 'test-config.json'
const TEST_DIR = 'test-files'

describe('ConfigManager', () => {
  afterEach(() => {
    if (existsSync(TEST_CONFIG)) {
      unlinkSync(TEST_CONFIG)
    }
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('should create a new namespace', async () => {
    await globalConfig.setNamespaceConfig('dev', { filePatterns: ['*.ts'] }, TEST_CONFIG)

    const namespaces = await globalConfig.listNamespaces(TEST_CONFIG)
    expect(namespaces.namespaces).toContain('dev')
  })

  it('should list namespaces', async () => {
    await globalConfig.setNamespaceConfig('dev', {}, TEST_CONFIG)
    await globalConfig.setNamespaceConfig('prod', {}, TEST_CONFIG)

    const result = await globalConfig.listNamespaces(TEST_CONFIG)
    expect(result.namespaces).toHaveLength(2)
    expect(result.namespaces).toContain('dev')
    expect(result.namespaces).toContain('prod')
  })

  it('should load namespace config', async () => {
    const config = { filePatterns: ['*.ts'], excludePatterns: ['*.test.ts'] }
    await globalConfig.setNamespaceConfig('dev', config, TEST_CONFIG)

    const loaded = await globalConfig.loadNamespacedConfig(TEST_CONFIG, 'dev')
    expect(loaded).toEqual(config)
  })

  it('should delete namespace', async () => {
    await globalConfig.setNamespaceConfig('dev', {}, TEST_CONFIG)
    await globalConfig.deleteNamespace('dev', TEST_CONFIG)

    const namespaces = await globalConfig.listNamespaces(TEST_CONFIG)
    expect(namespaces.namespaces).not.toContain('dev')
  })

  it('should return empty config for non-existent file', async () => {
    const result = await globalConfig.listNamespaces('non-existent.json')
    expect(result.namespaces).toHaveLength(0)
  })

  describe('listFiles', () => {
    beforeEach(() => {
      // Create test directory with files
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true })
      }
      writeFileSync(join(TEST_DIR, 'file1.ts'), '')
      writeFileSync(join(TEST_DIR, 'file2.ts'), '')
      writeFileSync(join(TEST_DIR, 'file.js'), '')
      writeFileSync(join(TEST_DIR, 'test.test.ts'), '')
    })

    it('should list files matching patterns', async () => {
      await globalConfig.setNamespaceConfig('dev', {
        filePatterns: ['test-files/**/*.ts'],
        excludePatterns: []
      }, TEST_CONFIG)

      const files = await globalConfig.listFiles('dev', TEST_CONFIG)
      expect(files).toHaveLength(3)
      expect(files).toContain('test-files/file1.ts')
      expect(files).toContain('test-files/file2.ts')
      expect(files).toContain('test-files/test.test.ts')
    })

    it('should respect exclude patterns', async () => {
      await globalConfig.setNamespaceConfig('dev', {
        filePatterns: ['test-files/**/*.ts'],
        excludePatterns: ['**/*.test.ts']
      }, TEST_CONFIG)

      const files = await globalConfig.listFiles('dev', TEST_CONFIG)
      expect(files).toHaveLength(2)
      expect(files).toContain('test-files/file1.ts')
      expect(files).toContain('test-files/file2.ts')
      expect(files).not.toContain('test-files/test.test.ts')
    })

    it('should return empty array when no patterns defined', async () => {
      await globalConfig.setNamespaceConfig('empty', {}, TEST_CONFIG)

      const files = await globalConfig.listFiles('empty', TEST_CONFIG)
      expect(files).toHaveLength(0)
    })

    it('should return empty array when no files match', async () => {
      await globalConfig.setNamespaceConfig('no-match', {
        filePatterns: ['**/*.xyz']
      }, TEST_CONFIG)

      const files = await globalConfig.listFiles('no-match', TEST_CONFIG)
      expect(files).toHaveLength(0)
    })
  })

  describe('getNamespaceWithFiles', () => {
    beforeEach(() => {
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true })
      }
      writeFileSync(join(TEST_DIR, 'file1.ts'), '')
      writeFileSync(join(TEST_DIR, 'file2.ts'), '')
    })

    it('should return namespace metadata with files', async () => {
      const config = {
        filePatterns: ['test-files/**/*.ts'],
        excludePatterns: []
      }
      await globalConfig.setNamespaceConfig('demo', config, TEST_CONFIG)

      const result = await globalConfig.getNamespaceWithFiles('demo', TEST_CONFIG)

      expect(result.namespace).toBe('demo')
      expect(result.metadata).toEqual(config)
      expect(result.files).toHaveLength(2)
      expect(result.fileCount).toBe(2)
      expect(result.files).toContain('test-files/file1.ts')
      expect(result.files).toContain('test-files/file2.ts')
    })

    it('should include exclude patterns in metadata', async () => {
      const config = {
        filePatterns: ['test-files/**/*.ts'],
        excludePatterns: ['**/*.test.ts']
      }
      await globalConfig.setNamespaceConfig('with-excludes', config, TEST_CONFIG)

      const result = await globalConfig.getNamespaceWithFiles('with-excludes', TEST_CONFIG)

      expect(result.metadata.excludePatterns).toEqual(['**/*.test.ts'])
    })

    it('should return empty files array when no patterns defined', async () => {
      await globalConfig.setNamespaceConfig('empty', {}, TEST_CONFIG)

      const result = await globalConfig.getNamespaceWithFiles('empty', TEST_CONFIG)

      expect(result.files).toHaveLength(0)
      expect(result.fileCount).toBe(0)
    })
  })
})