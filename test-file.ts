// Test file for Git hook validation
import { globalConfig } from './src/config/ConfigManager.js'

export function testFunction() {
  console.log('Testing Git hooks with deps-cli')
  return globalConfig.isConfigLoaded()
}