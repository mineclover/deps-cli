import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { glob } from 'glob'

export interface NamespaceConfig {
  filePatterns?: string[]
  excludePatterns?: string[]
  [key: string]: any
}

export interface ConfigFile {
  default?: string
  namespaces: {
    [name: string]: NamespaceConfig
  }
}

class ConfigManager {
  async loadConfig(configPath: string): Promise<ConfigFile> {
    if (!existsSync(configPath)) {
      return { namespaces: {} }
    }
    const content = await readFile(configPath, 'utf-8')
    return JSON.parse(content)
  }

  async saveConfig(configPath: string, config: ConfigFile): Promise<void> {
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  async listNamespaces(configPath: string) {
    const config = await this.loadConfig(configPath)
    return {
      namespaces: Object.keys(config.namespaces),
      default: config.default
    }
  }

  async loadNamespacedConfig(configPath: string, namespace: string): Promise<NamespaceConfig> {
    const config = await this.loadConfig(configPath)
    return config.namespaces[namespace] || {}
  }

  async setNamespaceConfig(
    namespace: string,
    namespaceConfig: NamespaceConfig,
    configPath: string
  ): Promise<void> {
    const config = await this.loadConfig(configPath)
    config.namespaces[namespace] = namespaceConfig
    await this.saveConfig(configPath, config)
  }

  async deleteNamespace(namespace: string, configPath: string): Promise<void> {
    const config = await this.loadConfig(configPath)
    delete config.namespaces[namespace]
    if (config.default === namespace) {
      delete config.default
    }
    await this.saveConfig(configPath, config)
  }

  async listFiles(namespace: string, configPath: string, cwd: string = process.cwd()): Promise<string[]> {
    const config = await this.loadNamespacedConfig(configPath, namespace)

    if (!config.filePatterns || config.filePatterns.length === 0) {
      return []
    }

    const files = await glob(config.filePatterns, {
      cwd,
      ignore: config.excludePatterns || [],
      nodir: true,
      dot: false
    })

    return files.sort()
  }

  async getNamespaceWithFiles(namespace: string, configPath: string, cwd: string = process.cwd()) {
    const config = await this.loadNamespacedConfig(configPath, namespace)
    const files = await this.listFiles(namespace, configPath, cwd)

    return {
      namespace,
      metadata: config,
      files,
      fileCount: files.length
    }
  }
}

export const globalConfig = new ConfigManager()