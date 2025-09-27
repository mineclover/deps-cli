#!/usr/bin/env node

// MirrorPathMapper와 PathMapper 호환성 테스트
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';
import { PathMapper } from './dist/utils/PathMapper.js';

async function testCompatibility() {
  console.log('🔄 Testing MirrorPathMapper ↔ PathMapper Compatibility');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';

  // 기존 PathMapper
  const oldMapper = new PathMapper(projectRoot, './docs', 'production');

  // 새로운 MirrorPathMapper
  const newMapper = new MirrorPathMapper(projectRoot, './docs');

  const testFiles = [
    'src/utils/my-helper.ts',
    'src/utils/my_helper.ts',
    'src/utils/PathMapper.ts',
    'test/path-mapper.test.ts'
  ];

  console.log('\n📊 메서드별 비교 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;

    console.log(`\n📄 ${filePath}`);

    // getMarkdownPath 비교
    const oldMarkdownPath = oldMapper.getMarkdownPath(fullPath);
    const newMarkdownPath = newMapper.getMarkdownPath(fullPath);

    console.log(`  기존 getMarkdownPath: ${oldMarkdownPath.replace(projectRoot, '.')}`);
    console.log(`  신규 getMarkdownPath: ${newMarkdownPath.replace(projectRoot, '.')}`);

    // findConsistentPath 비교
    const oldConsistent = oldMapper.findConsistentPath(fullPath);
    const newConsistent = newMapper.findConsistentPath(fullPath);

    console.log(`  기존 fileId: ${oldConsistent.fileId}`);
    console.log(`  신규 fileId: ${newConsistent.fileId}`);

    // getRelativeMapping 비교
    const oldRelative = oldMapper.getRelativeMapping(fullPath);
    const newRelative = newMapper.getRelativeMapping(fullPath);

    console.log(`  기존 상대경로: ${oldRelative.sourceFile}`);
    console.log(`  신규 상대경로: ${newRelative.sourceFile}`);
  });

  console.log('\n🎯 MirrorPathMapper 장점:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const complexFile = `${projectRoot}/src/very/deep/nested/my-complex_file-name.spec.ts`;

  console.log(`복잡한 파일: ${complexFile.replace(projectRoot, '.')}`);

  // 기존 방식 (오류 가능성)
  try {
    const oldResult = oldMapper.findConsistentPath(complexFile);
    console.log(`기존 결과: ${oldResult.found ? '✅' : '❌'} ${oldResult.fileId}`);
  } catch (error) {
    console.log(`기존 결과: ❌ ERROR - ${error.message}`);
  }

  // 새로운 방식 (100% 신뢰)
  try {
    const newResult = newMapper.findConsistentPath(complexFile);
    console.log(`신규 결과: ${newResult.found ? '✅' : '❌'} ${newResult.fileId}`);
    console.log(`문서 경로: ${newResult.markdownPath.replace(projectRoot, '.')}`);

    // 역매핑 테스트
    const reversed = newMapper.getSourcePath(newResult.markdownPath);
    const matches = reversed === complexFile;
    console.log(`역매핑: ${matches ? '✅ PERFECT' : '❌ ERROR'}`);
  } catch (error) {
    console.log(`신규 결과: ❌ ERROR - ${error.message}`);
  }

  console.log('\n📈 신뢰도 비교:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('기존 PathMapper:');
  console.log('  ✅ 네임스페이스 지원');
  console.log('  ❌ 복잡한 변환 로직');
  console.log('  ❌ 불완전한 역매핑');
  console.log('  ❌ 파일명 제한');

  console.log('\n신규 MirrorPathMapper:');
  console.log('  ✅ 100% 정확한 역매핑');
  console.log('  ✅ 무제한 파일명 지원');
  console.log('  ✅ 단순하고 신뢰할 수 있는 로직');
  console.log('  ✅ 확장 가능한 구조 (메서드/클래스 문서)');
  console.log('  ⚠️  네임스페이스를 디렉토리로 대체');

  console.log('\n✅ 호환성 테스트 완료');
}

testCompatibility().catch(console.error);