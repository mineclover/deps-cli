#!/usr/bin/env node

// 초간단 파일 위치 매핑 테스트
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];

  function walkDir(currentDir) {
    const items = readdirSync(currentDir);

    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // docs, node_modules, dist 디렉토리는 제외
        if (!item.includes('node_modules') && !item.includes('docs') && !item.includes('dist')) {
          walkDir(fullPath);
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return files;
}

async function testSimpleMapping() {
  console.log('🗂️ 초간단 파일 위치 매핑 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = process.cwd();
  const mapper = new MirrorPathMapper(projectRoot, './docs');

  console.log('📁 프로젝트 루트:', projectRoot);
  console.log('📄 미러 루트:', resolve('./docs/mirror'));
  console.log('');

  // 모든 TypeScript/JavaScript 파일 찾기
  const allFiles = getAllFiles(projectRoot);

  console.log(`📋 총 ${allFiles.length}개 파일 발견:`);
  console.log('');

  // 각 파일의 미러링 위치만 출력
  for (const filePath of allFiles.slice(0, 10)) { // 처음 10개만
    const relativePath = filePath.replace(projectRoot + '/', '');
    const mirrorPath = mapper.getDocumentPath(filePath);
    const relativeOutput = mirrorPath.replace(projectRoot + '/', '');

    console.log(`📄 ${relativePath}`);
    console.log(`   → ${relativeOutput}`);
    console.log('');
  }

  if (allFiles.length > 10) {
    console.log(`... 그리고 ${allFiles.length - 10}개 더`);
  }

  console.log('✅ 파일 위치 매핑 완료');
  console.log('🎯 핵심: 파일 생성 없이 위치만 확인!');
}

testSimpleMapping().catch(console.error);