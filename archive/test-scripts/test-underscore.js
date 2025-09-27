#!/usr/bin/env node

// 언더스코어 파일명 테스트
import { PathMapper } from './dist/utils/PathMapper.js';
import { PredictableIdGenerator } from './dist/utils/PredictableIdGenerator.js';

async function testUnderscoreHandling() {
  console.log('🔤 Testing Underscore Handling in File Names');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const testFiles = [
    'src/utils/my_helper.ts',           // 언더스코어 있음
    'src/utils/my-helper.ts',           // 하이픈 있음
    'src/utils/user_profile_service.ts', // 여러 언더스코어
    'src/utils/user-profile-service.ts', // 여러 하이픈
    'test/my_test_file.spec.ts',        // 확장자 여러 개 + 언더스코어
    'test/my-test-file.spec.ts'         // 확장자 여러 개 + 하이픈
  ];

  console.log('\n📊 파일 ID 생성 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const fileId = PredictableIdGenerator.generateProjectBasedFileId(fullPath, projectRoot);
    console.log(`📁 ${filePath}`);
    console.log(`   → ${fileId}`);
    console.log('');
  });

  console.log('🔄 PathMapper 매핑 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const mapper = new PathMapper(projectRoot, './docs', 'production');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const result = mapper.findConsistentPath(fullPath);

    console.log(`📁 ${filePath}`);
    console.log(`   → ${result.fileId}`);
    console.log(`   🗂️ ${result.markdownPath.replace(projectRoot, '.')}`);
    console.log('');
  });

  console.log('🔁 역매핑 테스트 (마크다운 → 원본 파일):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const markdownPath = mapper.getMarkdownPath(fullPath);
    const reversedPath = mapper.getSourcePath(markdownPath);
    const matches = reversedPath === fullPath;

    console.log(`📁 원본: ${filePath}`);
    console.log(`   마크다운: ${markdownPath.replace(projectRoot, '.')}`);
    console.log(`   역매핑: ${reversedPath?.replace(projectRoot + '/', '') || 'null'}`);
    console.log(`   일치: ${matches ? '✅' : '❌'}`);
    console.log('');
  });

  console.log('🏷️ ID 검증 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const fileId = PredictableIdGenerator.generateProjectBasedFileId(fullPath, projectRoot);
    const isValid = PredictableIdGenerator.isValidPredictableId(fileId);

    console.log(`ID: ${fileId}`);
    console.log(`검증: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log('');
  });

  console.log('✅ 언더스코어 처리 테스트 완료');
}

testUnderscoreHandling().catch(console.error);