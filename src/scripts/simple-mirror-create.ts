#!/usr/bin/env node

import { SimpleMirrorManager } from '../utils/SimpleMirrorManager.js'

async function main() {
  const args = process.argv.slice(2)
  const targetPath = args[0] || '.'
  const shouldCreate = args.includes('--create')

  // namespace 옵션 파싱 (이름 또는 경로 지원)
  const namespaceIndex = args.indexOf('--namespace')
  const namespace = namespaceIndex !== -1 && args[namespaceIndex + 1] ? args[namespaceIndex + 1] : undefined

  const manager = new SimpleMirrorManager(process.cwd(), './docs', namespace)

  try {
    await manager.processFiles({
      targetPath,
      shouldCreate,
      namespace,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      maxDisplay: 20,
    })
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch(console.error)
