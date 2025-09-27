#!/usr/bin/env node

import { PredictableIdGenerator } from './dist/utils/PredictableIdGenerator.js';

// 변환 과정 디버깅
const testStrings = [
  'my-helper.ts',
  'my_helper.ts',
  'user-profile-service.ts',
  'user_profile_service.ts'
];

console.log('🔍 Debugging Conversion Process:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

testStrings.forEach(str => {
  console.log(`\n원본: "${str}"`);

  // 단계별 변환 과정을 시뮬레이션
  let step1 = str.replace(/([a-z])([A-Z])/g, '$1-$2'); // camelCase
  console.log(`camelCase: "${step1}"`);

  let step2 = step1.replace(/_/g, '__'); // 언더스코어 -> 더블
  console.log(`underscore: "${step2}"`);

  let step3 = step2.replace(/\./g, '_'); // 점 -> 언더스코어
  console.log(`dot: "${step3}"`);

  let step4 = step3.replace(/-/g, '_'); // 하이픈 -> 언더스코어
  console.log(`hyphen: "${step4}"`);

  let final = step4.toLowerCase();
  console.log(`최종: "${final}"`);

  // 실제 함수 결과와 비교
  const projectRoot = '/test';
  const fullPath = `/test/src/utils/${str}`;
  const actualId = PredictableIdGenerator.generateReversibleFileId(fullPath, projectRoot);
  console.log(`실제 ID: "${actualId}"`);
});