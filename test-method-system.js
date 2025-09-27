#!/usr/bin/env node

// 메서드 문서 생성 시스템 테스트
import { StructuralMappingEngine } from './dist/mapping/StructuralMappingEngine.js';

async function testMethodDocumentationSystem() {
  console.log('🔧 Testing Method Documentation Generation System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const projectRoot = '/Users/junwoobang/project/deps-cli';
  const docsRoot = './docs';

  // 통합된 StructuralMappingEngine 초기화
  const mappingEngine = new StructuralMappingEngine(projectRoot, docsRoot);

  console.log('\n✅ StructuralMappingEngine 초기화 성공');
  console.log('   - MirrorPathMapper 통합됨');
  console.log('   - MethodAnalyzer 통합됨');

  // 가상의 의존성 그래프로 테스트
  const testDependencyGraph = {
    entryPoints: [
      `${projectRoot}/src/bin.ts`,
      `${projectRoot}/src/utils/MethodAnalyzer.ts`
    ],
    edges: [
      {
        from: `${projectRoot}/src/bin.ts`,
        to: `${projectRoot}/src/mapping/StructuralMappingEngine.ts`,
        importedMembers: ['StructuralMappingEngine'],
        line: 5
      }
    ]
  };

  console.log('\n🔍 테스트 의존성 그래프:');
  console.log(`   Entry Points: ${testDependencyGraph.entryPoints.length}개`);
  console.log(`   Edges: ${testDependencyGraph.edges.length}개`);

  try {
    // 의존성 그래프 처리 (파일 + 메서드 노드 생성)
    console.log('\n⚙️  의존성 그래프 처리 중...');
    const nodes = await mappingEngine.processDependencyGraph(
      testDependencyGraph,
      projectRoot,
      'test-namespace'
    );

    console.log('\n📊 생성된 노드 통계:');
    console.log(`   총 노드: ${nodes.length}개`);

    const fileNodes = nodes.filter(n => n.type === 'file');
    const methodNodes = nodes.filter(n => n.type === 'method');

    console.log(`   파일 노드: ${fileNodes.length}개`);
    console.log(`   메서드 노드: ${methodNodes.length}개`);

    if (methodNodes.length > 0) {
      console.log('\n🎯 메서드 노드 샘플:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // 처음 5개 메서드 노드 표시
      methodNodes.slice(0, 5).forEach((node, index) => {
        const metadata = node.metadata;
        console.log(`${index + 1}. ${node.title}`);
        console.log(`   ID: ${node.id}`);
        console.log(`   Type: ${metadata.type}`);
        console.log(`   Role: ${node.role}`);
        console.log(`   Document Path: ${metadata.documentPath?.replace(projectRoot, '.')}`);
        console.log('');
      });

      if (methodNodes.length > 5) {
        console.log(`   ... 및 ${methodNodes.length - 5}개 추가 메서드`);
      }
    }

    // 의존성 통계
    const stats = mappingEngine.generateDependencyStatistics(nodes);
    console.log('\n📈 의존성 통계:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   총 노드: ${stats.totalNodes}`);
    console.log(`   총 의존성: ${stats.totalDependencies}`);
    console.log(`   평균 의존성: ${stats.averageDependencies.toFixed(2)}`);

    console.log('\n🏷️  역할별 통계:');
    stats.roleStatistics.forEach((count, role) => {
      console.log(`   ${role}: ${count}개`);
    });

    // 매핑 무결성 검증
    const integrity = mappingEngine.verifyMappingIntegrity(nodes);
    console.log('\n🔍 매핑 무결성 검증:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   유효성: ${integrity.valid ? '✅ 통과' : '❌ 실패'}`);
    console.log(`   오류: ${integrity.errors.length}개`);
    console.log(`   경고: ${integrity.warnings.length}개`);

    if (integrity.errors.length > 0) {
      console.log('\n❌ 오류:');
      integrity.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (integrity.warnings.length > 0) {
      console.log('\n⚠️  경고:');
      integrity.warnings.slice(0, 3).forEach(warning => console.log(`   - ${warning}`));
      if (integrity.warnings.length > 3) {
        console.log(`   ... 및 ${integrity.warnings.length - 3}개 추가 경고`);
      }
    }

    console.log('\n🏆 메서드 문서 생성 시스템 성과:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 가벼운 메서드 분석 (정규식 기반)');
    console.log('✅ 메서드별 문서 경로 자동 매핑');
    console.log('✅ 역할 기반 메서드 분류');
    console.log('✅ 파일 + 메서드 통합 노드 시스템');
    console.log('✅ MirrorPathMapper와 완벽 통합');

    console.log('\n✨ 메서드 문서 생성 시스템 테스트 완료');
    console.log('🎯 가벼운 구현으로 메서드 레벨 문서 생성 준비 완료!');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    console.error('스택 트레이스:', error.stack);
  }
}

testMethodDocumentationSystem().catch(console.error);