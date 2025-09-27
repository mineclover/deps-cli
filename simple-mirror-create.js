#!/usr/bin/env node

// JSON 메타데이터 기반 간단 미러링 시스템
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, extname } from 'node:path';

const args = process.argv.slice(2);
const targetPath = args[0] || '.';
const shouldCreate = args.includes('--create');

// namespace 옵션 파싱 (이름 또는 경로 지원)
const namespaceIndex = args.indexOf('--namespace');
const namespace = namespaceIndex !== -1 && args[namespaceIndex + 1] ? args[namespaceIndex + 1] : undefined;

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

async function createFileMetadata(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const stats = await stat(filePath);
    const projectRoot = process.cwd();
    const relativePath = relative(projectRoot, filePath);

    return {
      path: relativePath,
      size: stats.size,
      lines: content.split('\n').length,
      extension: extname(filePath),
      lastModified: stats.mtime.toISOString(),
      created: new Date().toISOString(),
      ...(namespace && { namespace }),
    };
  } catch (error) {
    console.error(`메타데이터 생성 실패: ${filePath}`, error.message);
    return null;
  }
}

async function createSimpleMirror(filePath, mapper) {
  const metadata = await createFileMetadata(filePath);
  if (!metadata) return null;

  const mirrorPath = mapper.getDocumentPath(filePath);

  // JSON 메타데이터를 마크다운으로 저장
  const content = `# ${metadata.path}

## 📄 File Metadata

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`
`;

  // 디렉토리 생성
  await mkdir(dirname(mirrorPath), { recursive: true });

  // 파일 저장
  await writeFile(mirrorPath, content, 'utf-8');

  return mirrorPath;
}

async function processFiles() {
  console.log('🪞 Simple Mirror System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = process.cwd();
  const mapper = new MirrorPathMapper(projectRoot, './docs', namespace);

  console.log(`📁 Target: ${targetPath}`);
  console.log(`📄 Mode: ${shouldCreate ? 'CREATE FILES' : 'SHOW MAPPING ONLY'}`);
  if (namespace) {
    console.log(`🏷️ Namespace: ${namespace}`);
  }
  console.log('');

  let filesToProcess = [];

  if (existsSync(targetPath) && statSync(targetPath).isFile()) {
    // 단일 파일 처리
    filesToProcess = [resolve(targetPath)];
  } else {
    // 디렉토리 처리
    filesToProcess = scanFiles(targetPath);
  }

  console.log(`📋 Found ${filesToProcess.length} files:`);
  console.log('');

  let processed = 0;
  const maxDisplay = 20;

  for (const filePath of filesToProcess.slice(0, maxDisplay)) {
    const mirrorPath = mapper.getDocumentPath(filePath);
    const relativePath = relative(projectRoot, filePath);
    const relativeMirror = relative(projectRoot, mirrorPath);

    console.log(`📄 ${relativePath}`);
    console.log(`   → ${relativeMirror}`);

    if (shouldCreate) {
      try {
        const createdPath = await createSimpleMirror(filePath, mapper);
        if (createdPath) {
          console.log(`   ✅ Created`);
          processed++;
        } else {
          console.log(`   ❌ Failed`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('');
  }

  if (filesToProcess.length > maxDisplay) {
    console.log(`   ... and ${filesToProcess.length - maxDisplay} more files`);
  }

  console.log('');
  if (shouldCreate) {
    console.log(`✅ Created ${processed} mirror files`);
  } else {
    console.log('✅ Mapping completed (use --create to generate files)');
  }
  console.log('🎯 Files contain only JSON metadata');
}

processFiles().catch(console.error);