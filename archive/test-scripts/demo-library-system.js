#!/usr/bin/env node

// 라이브러리 분석기 직접 테스트 (StructuralMappingEngine 없이)
import { LibraryAnalyzer } from './dist/utils/LibraryAnalyzer.js';

async function demoLibraryAnalyzer() {
  console.log('📚 LibraryAnalyzer 직접 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';

  try {
    console.log('\n🔍 프로젝트 분석 중...');
    const result = await LibraryAnalyzer.analyzeProject(projectRoot);

    console.log('\n📊 분석 결과:');
    console.log(`   총 라이브러리: ${result.libraries.length}개`);
    console.log(`   총 모듈: ${result.modules.length}개`);
    console.log(`   내부 모듈: ${result.internalModules.length}개`);
    console.log(`   외부 라이브러리: ${result.externalLibraries.length}개`);

    if (result.libraries.length > 0) {
      console.log('\n📚 라이브러리 샘플:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      result.libraries.slice(0, 5).forEach((lib, index) => {
        console.log(`${index + 1}. ${lib.name} (${lib.type})`);
        console.log(`   Version: ${lib.version || 'N/A'}`);
        console.log(`   Role: ${lib.role}`);
        console.log(`   Dependencies: ${lib.dependencies.length}개`);
        console.log('');
      });

      if (result.libraries.length > 5) {
        console.log(`   ... 및 ${result.libraries.length - 5}개 추가 라이브러리`);
      }
    }

    if (result.modules.length > 0) {
      console.log('\n🔧 모듈 샘플:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      result.modules.forEach((mod, index) => {
        console.log(`${index + 1}. ${mod.name} (${mod.type})`);
        console.log(`   Path: ${mod.path}`);
        console.log(`   Exports: ${mod.exports.length}개`);
        console.log(`   Imports: ${mod.imports.length}개`);
        console.log(`   Entry: ${mod.isEntry ? '✅' : '❌'}`);
        console.log('');
      });
    }

    // 의존성 그래프 생성
    console.log('\n🔄 의존성 그래프 생성:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const dependencyGraph = LibraryAnalyzer.generateLibraryDependencyGraph(
      result.libraries,
      result.modules
    );

    console.log(`   노드 수: ${dependencyGraph.size}개`);

    // 순환 의존성 검사
    const cycles = LibraryAnalyzer.detectCircularDependencies(dependencyGraph);
    console.log(`   순환 의존성: ${cycles.length}개`);

    if (cycles.length > 0) {
      console.log('\n⚠️  순환 의존성 발견:');
      cycles.slice(0, 3).forEach((cycle, index) => {
        console.log(`   ${index + 1}. ${cycle.join(' → ')}`);
      });
      if (cycles.length > 3) {
        console.log(`   ... 및 ${cycles.length - 3}개 추가 순환 의존성`);
      }
    }

    console.log('\n🏆 LibraryAnalyzer 핵심 기능:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ package.json 분석');
    console.log('✅ 내부/외부 라이브러리 분류');
    console.log('✅ 모듈 import/export 추출');
    console.log('✅ 의존성 그래프 생성');
    console.log('✅ 순환 의존성 검사');
    console.log('✅ 라이브러리 역할 자동 분류');

    console.log('\n✨ LibraryAnalyzer 테스트 완료');
    console.log('🎯 라이브러리/모듈 문서 생성 시스템의 핵심 분석 엔진이 준비되었습니다!');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    console.error('스택 트레이스:', error.stack);
  }
}

demoLibraryAnalyzer().catch(console.error);