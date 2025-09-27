#!/usr/bin/env node

import { PredictableIdGenerator } from './dist/utils/PredictableIdGenerator.js';

// 내부 toKebabCase 메서드 테스트
console.log('Debug kebab-case conversion:');

const testStrings = [
  'my_helper',
  'my-helper',
  'user_profile_service',
  'user-profile-service'
];

// PredictableIdGenerator의 toKebabCase는 private이므로 직접 테스트 할 수 없음
// 대신 전체 파일 ID 생성을 통해 간접적으로 확인

testStrings.forEach(str => {
  const testPath = `/project/src/utils/${str}.ts`;
  const fileId = PredictableIdGenerator.generateProjectBasedFileId(testPath, '/project');
  console.log(`"${str}" → "${fileId}"`);
});