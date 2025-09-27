#!/usr/bin/env node

// 완전 미러링 시스템 테스트
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';

async function testMirrorSystem() {
  console.log('🪞 Testing Complete Mirror Path Mapping System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const mapper = new MirrorPathMapper(projectRoot, './docs');

  // 까다로운 파일명들 테스트
  const testFiles = [
    'src/utils/my-helper.ts',
    'src/utils/my_helper.ts',
    'src/utils/user-profile-service.ts',
    'src/utils/user_profile_service.ts',
    'test/components/ui-button.spec.ts',
    'test/components/ui_button.spec.ts',
    'src/types/mapping-types.d.ts',
    'src/very/deeply/nested/file-with-many_separators.test.tsx',
    'README.md',
    'package.json'
  ];

  console.log('\n📁 미러링 매핑 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const documentPath = mapper.getDocumentPath(fullPath);
    const relativeDocPath = documentPath.replace(projectRoot + '/', '');

    console.log(`📄 ${filePath}`);
    console.log(`   → ${relativeDocPath}`);
    console.log('');
  });

  console.log('🔄 역매핑 테스트 (100% 정확성 검증):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let allPerfect = true;

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const verification = mapper.verifyMapping(fullPath);

    console.log(`📄 ${filePath}`);
    console.log(`   원본: ${verification.sourceFile.replace(projectRoot + '/', '')}`);
    console.log(`   문서: ${verification.documentFile.replace(projectRoot + '/', '')}`);
    console.log(`   복원: ${verification.reversedSource.replace(projectRoot + '/', '')}`);
    console.log(`   정확: ${verification.perfectMatch ? '✅ PERFECT' : '❌ ERROR'}`);

    if (!verification.perfectMatch) {
      allPerfect = false;
    }
    console.log('');
  });

  console.log(`🎯 전체 정확도: ${allPerfect ? '✅ 100% PERFECT' : '❌ ERRORS FOUND'}`);

  console.log('\n📊 매핑 정보 상세:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sampleFile = `${projectRoot}/src/utils/my_complex-file.ts`;
  const info = mapper.getMappingInfo(sampleFile);

  console.log(`원본 파일:     ${info.sourceFile.replace(projectRoot, '.')}`);
  console.log(`문서 파일:     ${info.documentFile.replace(projectRoot, '.')}`);
  console.log(`상대 경로:     ${info.relativePath}`);
  console.log(`원본 존재:     ${info.sourceExists ? '✅' : '❌'}`);
  console.log(`문서 존재:     ${info.documentExists ? '✅' : '❌'}`);

  console.log('\n🏗️ 메서드/클래스 문서 경로:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sampleSource = `${projectRoot}/src/utils/PathMapper.ts`;
  const methodDoc = mapper.getMethodDocumentPath(sampleSource, 'getMarkdownPath');
  const classDoc = mapper.getClassDocumentPath(sampleSource, 'PathMapper');

  console.log(`소스:         ${sampleSource.replace(projectRoot, '.')}`);
  console.log(`메서드 문서:  ${methodDoc.replace(projectRoot, '.')}`);
  console.log(`클래스 문서:  ${classDoc.replace(projectRoot, '.')}`);

  console.log('\n📦 배치 매핑 샘플:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const fullPaths = testFiles.slice(0, 5).map(f => `${projectRoot}/${f}`);
  const batchMapping = mapper.getBatchMapping(fullPaths);

  console.log(`총 ${batchMapping.size}개 파일 매핑:`);
  batchMapping.forEach((documentPath, sourcePath) => {
    const relativeSource = sourcePath.replace(projectRoot + '/', '');
    const relativeDoc = documentPath.replace(projectRoot + '/', '');
    console.log(`  ${relativeSource.padEnd(30)} → ${relativeDoc}`);
  });

  console.log('\n✅ 미러링 시스템 테스트 완료');
  console.log('🎯 핵심: 변환 없음, 100% 가역성, 무제한 파일명 지원!');
}

testMirrorSystem().catch(console.error);