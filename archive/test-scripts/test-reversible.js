#!/usr/bin/env node

// 역매핑 가능한 ID 시스템 테스트
import { PredictableIdGenerator } from './dist/utils/PredictableIdGenerator.js';

async function testReversibleMapping() {
  console.log('🔄 Testing Reversible ID Mapping System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const testFiles = [
    'src/utils/my-helper.ts',           // 하이픈 있음
    'src/utils/my_helper.ts',           // 언더스코어 있음
    'src/utils/user-profile-service.ts', // 여러 하이픈
    'src/utils/user_profile_service.ts', // 여러 언더스코어
    'test/components/ui-button.spec.ts', // 복합 패턴
    'test/components/ui_button.spec.ts'  // 복합 패턴 (언더스코어)
  ];

  console.log('\n📊 기존 방식 vs 역매핑 가능한 방식:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;

    const oldId = PredictableIdGenerator.generateProjectBasedFileId(fullPath, projectRoot);
    const newId = PredictableIdGenerator.generateReversibleFileId(fullPath, projectRoot);

    console.log(`📁 ${filePath}`);
    console.log(`   기존: ${oldId}`);
    console.log(`   신규: ${newId}`);
    console.log('');
  });

  console.log('🔄 역매핑 테스트:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  testFiles.forEach(filePath => {
    const fullPath = `${projectRoot}/${filePath}`;
    const reversibleId = PredictableIdGenerator.generateReversibleFileId(fullPath, projectRoot);
    const restored = PredictableIdGenerator.reverseFileId(reversibleId, projectRoot);
    const matches = restored === fullPath;

    console.log(`📁 원본: ${filePath}`);
    console.log(`   ID: ${reversibleId}`);
    console.log(`   복원: ${restored.replace(projectRoot + '/', '')}`);
    console.log(`   일치: ${matches ? '✅ YES' : '❌ NO'}`);
    console.log('');
  });

  console.log('🔍 구분자 분석:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const analysisFile = 'src/utils/my-complex_file-name.ts';
  const fullPath = `${projectRoot}/${analysisFile}`;
  const reversibleId = PredictableIdGenerator.generateReversibleFileId(fullPath, projectRoot);

  console.log(`원본 파일: ${analysisFile}`);
  console.log(`생성된 ID: ${reversibleId}`);
  console.log('');
  console.log('구분자 분석:');
  console.log('- 디렉토리 구분 (`/`): `-` (하이픈)');
  console.log('- 파일명 내 하이픈 (`-`): `_` (언더스코어)');
  console.log('- 파일명 내 언더스코어 (`_`): `__` (더블 언더스코어)');

  const restored = PredictableIdGenerator.reverseFileId(reversibleId, projectRoot);
  console.log(`\n역매핑 결과: ${restored.replace(projectRoot + '/', '')}`);
  console.log(`정확성: ${restored === fullPath ? '✅ 완벽' : '❌ 오류'}`);

  console.log('\n✅ 역매핑 시스템 테스트 완료');
}

testReversibleMapping().catch(console.error);