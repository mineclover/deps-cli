#!/usr/bin/env node

import { PredictableIdGenerator } from './dist/utils/PredictableIdGenerator.js';

// 실제 변환 과정 직접 테스트
const projectRoot = '/test';

console.log('🔍 Direct Conversion Test:');

const testCases = [
  'my-helper.ts',
  'my_helper.ts'
];

testCases.forEach(fileName => {
  const fullPath = `/test/src/utils/${fileName}`;
  const id = PredictableIdGenerator.generateReversibleFileId(fullPath, projectRoot);
  const reversed = PredictableIdGenerator.reverseFileId(id, projectRoot);

  console.log(`\n파일: ${fileName}`);
  console.log(`ID: ${id}`);
  console.log(`복원: ${reversed.replace(projectRoot + '/', '')}`);

  // ID에서 파일명 부분만 추출
  const idParts = id.split('-');
  const filenamePart = idParts[idParts.length - 1]; // 마지막 부분이 파일명
  console.log(`파일명 부분: ${filenamePart}`);

  // 역매핑 과정 단계별 추적
  console.log('역매핑 단계:');
  let step1 = filenamePart.replace(/dot/g, '.');
  console.log(`  1. dot → .: ${step1}`);

  let step2 = step1.replace(/y([a-z])/g, (match, p1) => p1.toUpperCase());
  console.log(`  2. camelCase 복원: ${step2}`);

  let step3 = step2.replace(/y/g, '');
  console.log(`  3. y 제거: ${step3}`);

  let step4 = step3.replace(/z/g, '_');
  console.log(`  4. z → _: ${step4}`);

  let step5 = step4.replace(/x/g, '-');
  console.log(`  5. x → -: ${step5}`);
});