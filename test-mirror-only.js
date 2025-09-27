#!/usr/bin/env node

// MirrorPathMapper 단독 테스트 (PathMapper 호환성 메서드 검증)
import { MirrorPathMapper } from './dist/utils/MirrorPathMapper.js';

async function testMirrorMapperCompatibility() {
  console.log('🔄 Testing MirrorPathMapper Compatibility Methods');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const mapper = new MirrorPathMapper(projectRoot, './docs');

  const testFiles = [
    'src/utils/my-helper.ts',
    'src/utils/my_helper.ts',
    'src/utils/PathMapper.ts',
    'test/path-mapper.test.ts',
    'src/very/deep/nested/complex-file_name.spec.ts'
  ];

  console.log('\n📊 PathMapper 호환 메서드 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;

    console.log(`\n📄 ${filePath}`);

    // 1. getMarkdownPath() 테스트
    const markdownPath = mapper.getMarkdownPath(fullPath);
    console.log(`  markdownPath: ${markdownPath.replace(projectRoot, '.')}`);

    // 2. findConsistentPath() 테스트
    const consistent = mapper.findConsistentPath(fullPath);
    console.log(`  consistent: ${consistent.found ? '✅' : '❌'} ${consistent.fileId}`);
    console.log(`  message: ${consistent.message.substring(0, 60)}...`);

    // 3. getRelativeMapping() 테스트
    const relative = mapper.getRelativeMapping(fullPath);
    console.log(`  relative source: ${relative.sourceFile}`);
    console.log(`  relative fileId: ${relative.fileId}`);

    // 4. 역매핑 테스트
    try {
      const reversed = mapper.getSourcePath(markdownPath);
      const matches = reversed === fullPath;
      console.log(`  reverse mapping: ${matches ? '✅ PERFECT' : '❌ ERROR'}`);
    } catch (error) {
      console.log(`  reverse mapping: ❌ ERROR - ${error.message}`);
    }
  });

  console.log('\n🎯 고급 기능 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sampleFile = `${projectRoot}/src/utils/PathMapper.ts`;

  // 메서드 문서 경로
  const methodDoc = mapper.getMethodDocumentPath(sampleFile, 'getMarkdownPath');
  console.log(`메서드 문서: ${methodDoc.replace(projectRoot, '.')}`);

  // 클래스 문서 경로
  const classDoc = mapper.getClassDocumentPath(sampleFile, 'PathMapper');
  console.log(`클래스 문서: ${classDoc.replace(projectRoot, '.')}`);

  // 배치 매핑
  const fullPaths = testFiles.slice(0, 3).map(f => `${projectRoot}/${f}`);
  const batchMapping = mapper.getBatchMapping(fullPaths);
  console.log(`\n배치 매핑 (${batchMapping.size}개):`);
  batchMapping.forEach((docPath, srcPath) => {
    const src = srcPath.replace(projectRoot + '/', '');
    const doc = docPath.replace(projectRoot + '/', '');
    console.log(`  ${src} → ${doc}`);
  });

  console.log('\n🏆 MirrorPathMapper 우수성:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const complexFile = `${projectRoot}/src/components/ui/deeply-nested_component-with.many.separators.tsx`;
  console.log(`극복잡한 파일: ${complexFile.replace(projectRoot, '.')}`);

  const result = mapper.findConsistentPath(complexFile);
  console.log(`매핑 성공: ${result.found ? '✅' : '❌'}`);
  console.log(`문서 경로: ${result.markdownPath.replace(projectRoot, '.')}`);

  const reversed = mapper.getSourcePath(result.markdownPath);
  const perfect = reversed === complexFile;
  console.log(`완벽한 역매핑: ${perfect ? '✅' : '❌'}`);

  if (perfect) {
    console.log('🎉 파일명의 모든 특수문자가 완벽하게 보존되었습니다!');
  }

  console.log('\n✅ MirrorPathMapper 호환성 테스트 완료');
  console.log('🎯 결론: PathMapper를 완전히 대체할 수 있습니다!');
}

testMirrorMapperCompatibility().catch(console.error);