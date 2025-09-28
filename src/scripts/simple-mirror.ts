#!/usr/bin/env node

import { SimpleMirrorManager } from '../utils/SimpleMirrorManager.js'

async function main() {
  const args = process.argv.slice(2)
  const targetPath = args[0] || '.'

  const manager = new SimpleMirrorManager(process.cwd(), './docs')

  try {
    await manager.showMirrorMapping(targetPath, 15)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch(console.error)
