#!/usr/bin/env node

// 초간단 미러링 위치 확인 도구
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const args = process.argv.slice(2);
const targetPath = args[0] || '.';

function scanFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];

  function walk(currentDir) {
    if (!existsSync(currentDir)) return;

    try {
      const items = readdirSync(currentDir);

      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // 제외할 디렉토리들
          if (!['node_modules', 'docs', 'dist', '.git'].some(excluded => item.includes(excluded))) {
            walk(fullPath);
          }
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 권한 오류 등 무시
    }
  }

  walk(resolve(dir));
  return files;
}

async function showMirrorMapping() {
  console.log('🪞 Simple File Mirror Mapping');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = process.cwd();
  const mapper = new MirrorPathMapper(projectRoot, './docs');

  console.log(`📁 Target: ${targetPath}`);
  console.log(`📄 Project Root: ${projectRoot}`);
  console.log('');

  if (existsSync(targetPath) && statSync(targetPath).isFile()) {
    // 단일 파일 처리
    const mirrorPath = mapper.getDocumentPath(resolve(targetPath));
    const relativePath = relative(projectRoot, resolve(targetPath));
    const relativeMirror = relative(projectRoot, mirrorPath);

    console.log('📄 Single File Mapping:');
    console.log(`   Source: ${relativePath}`);
    console.log(`   Mirror: ${relativeMirror}`);
  } else {
    // 디렉토리 처리
    const files = scanFiles(targetPath);
    console.log(`📋 Found ${files.length} files:`);
    console.log('');

    files.slice(0, 15).forEach(filePath => {
      const mirrorPath = mapper.getDocumentPath(filePath);
      const relativePath = relative(projectRoot, filePath);
      const relativeMirror = relative(projectRoot, mirrorPath);

      console.log(`📄 ${relativePath}`);
      console.log(`   → ${relativeMirror}`);
    });

    if (files.length > 15) {
      console.log(`   ... and ${files.length - 15} more files`);
    }
  }

  console.log('');
  console.log('✅ Mapping completed (no files created)');
}

showMirrorMapping().catch(console.error);