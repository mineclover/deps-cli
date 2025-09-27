#!/usr/bin/env node

// PathMapper 테스트 스크립트
import { PathMapper } from './dist/utils/PathMapper.js';

async function testPathMapper() {
  console.log('🗺️ Testing PathMapper - 정확한 마크다운 파일 찾기');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const testFiles = [
    'src/utils/PredictableIdGenerator.ts',
    'src/mapping/StructuralMappingEngine.ts',
    'src/types/MappingTypes.ts',
    'test/path-mapper.test.ts',
    'README.md'
  ];

  // 1. Production namespace 테스트
  console.log('\n📊 Production Namespace 매핑:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const prodMapper = new PathMapper(projectRoot, './docs', 'production');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const result = prodMapper.findConsistentPath(fullPath);

    console.log(`📁 ${filePath}`);
    console.log(`   → ${result.fileId}.md`);
    console.log(`   🗂️ ${result.markdownPath.replace(projectRoot, '.')}`);
    console.log('');
  });

  // 2. 다른 namespace와 비교
  console.log('🔄 Namespace 비교 (동일 파일, 다른 namespace):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testFile = `${projectRoot}/src/utils/PredictableIdGenerator.ts`;
  const namespaces = ['production', 'test', 'development', 'staging'];

  namespaces.forEach(namespace => {
    const mapper = new PathMapper(projectRoot, './docs', namespace);
    const result = mapper.findConsistentPath(testFile);
    console.log(`${namespace.padEnd(12)}: ${result.fileId}`);
  });

  // 3. 일관성 테스트
  console.log('\n🔁 일관성 테스트 (같은 파일, 여러 번 호출):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testFilePath = `${projectRoot}/src/utils/PredictableIdGenerator.ts`;
  const mapper = new PathMapper(projectRoot, './docs', 'production');

  const results = [];
  for (let i = 0; i < 5; i++) {
    const result = mapper.findConsistentPath(testFilePath);
    results.push(result.fileId);
  }

  const allSame = results.every(id => id === results[0]);
  console.log(`첫 번째 결과: ${results[0]}`);
  console.log(`5번 호출 결과 동일: ${allSame ? '✅ YES' : '❌ NO'}`);

  if (!allSame) {
    console.log('결과들:', results);
  }

  // 4. 배치 매핑 테스트
  console.log('\n📦 배치 매핑 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const fullPaths = testFiles.map(f => `${projectRoot}/${f}`);
  const batchMapping = prodMapper.getBatchMapping(fullPaths);

  console.log(`총 ${batchMapping.size}개 파일 매핑:`);
  batchMapping.forEach((markdownPath, sourcePath) => {
    const relativePath = sourcePath.replace(projectRoot + '/', '');
    const relativeMarkdown = markdownPath.replace(projectRoot, '.');
    console.log(`  ${relativePath.padEnd(35)} → ${relativeMarkdown}`);
  });

  // 5. 매핑 정보 상세 테스트
  console.log('\n📋 상세 매핑 정보:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const detailFile = `${projectRoot}/src/utils/PredictableIdGenerator.ts`;
  const info = prodMapper.getMappingInfo(detailFile);

  console.log(`원본 파일:    ${info.sourceFile.replace(projectRoot, '.')}`);
  console.log(`마크다운:     ${info.markdownFile.replace(projectRoot, '.')}`);
  console.log(`파일 ID:      ${info.fileId}`);
  console.log(`네임스페이스: ${info.namespace}`);
  console.log(`파일 존재:    ${info.exists ? '✅' : '❌'}`);

  // 6. 프로젝트 전체 매핑 테이블 (샘플)
  console.log('\n🗂️ 프로젝트 매핑 테이블 (샘플):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const table = prodMapper.generateProjectMappingTable();
    console.log(`총 발견된 파일: ${table.totalFiles}개`);
    console.log(`네임스페이스: ${table.namespace}`);

    // 처음 5개만 표시
    console.log('\n처음 5개 매핑:');
    table.mappings.slice(0, 5).forEach(mapping => {
      console.log(`  ${mapping.sourceFile.padEnd(30)} → ${mapping.fileId}`);
    });

    if (table.mappings.length > 5) {
      console.log(`  ... 그 외 ${table.mappings.length - 5}개`);
    }
  } catch (error) {
    console.log('❌ 프로젝트 테이블 생성 실패:', error.message);
  }

  console.log('\n✅ PathMapper 테스트 완료');
  console.log('🎯 핵심: 언제나 동일한 마크다운 파일을 정확하게 찾아갈 수 있습니다!');
}

testPathMapper().catch(console.error);