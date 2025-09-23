#!/usr/bin/env node

/**
 * 의존성 관계 시각화 스크립트
 * 생성된 reference-metadata.json을 분석하여 의존성 관계를 시각화합니다.
 */

const fs = require('fs');
const path = require('path');

function loadMetadata() {
  const metadataPath = path.join(__dirname, '.deps-analysis', 'reference-metadata.json');
  if (!fs.existsSync(metadataPath)) {
    console.error('❌ 메타데이터 파일을 찾을 수 없습니다:', metadataPath);
    console.log('💡 먼저 "node dist/bin.cjs classify ." 명령을 실행하세요.');
    process.exit(1);
  }

  const data = fs.readFileSync(metadataPath, 'utf-8');
  return JSON.parse(data);
}

function analyzeDependencyPatterns(metadata) {
  const files = metadata.files;
  const analysis = {
    totalFiles: files.length,
    totalDependencies: 0,
    internalConnections: [],
    topDependencies: [],
    clusters: {},
    riskFactors: {}
  };

  // 파일별 의존성 분석
  files.forEach(file => {
    const internalDeps = file.dependencies.internal || [];
    const externalDeps = file.dependencies.external || [];
    const builtinDeps = file.dependencies.builtin || [];

    const totalDeps = internalDeps.length + externalDeps.length + builtinDeps.length;
    analysis.totalDependencies += totalDeps;

    // 내부 의존성 연결 추적
    internalDeps.forEach(dep => {
      analysis.internalConnections.push({
        from: file.fileId,
        fromPath: file.relativePath,
        to: dep.source,
        resolvedPath: dep.resolvedPath,
        confidence: dep.confidence
      });
    });

    // 상위 의존성 파일 추적
    analysis.topDependencies.push({
      fileId: file.fileId,
      path: file.relativePath,
      totalDeps,
      internalCount: internalDeps.length,
      externalCount: externalDeps.length,
      complexity: file.complexity || 1
    });

    // 클러스터 분석
    if (file.metadata && file.metadata.clusters) {
      file.metadata.clusters.forEach(cluster => {
        if (!analysis.clusters[cluster]) {
          analysis.clusters[cluster] = [];
        }
        analysis.clusters[cluster].push(file.relativePath);
      });
    }

    // 위험 요소 분석
    if (file.metadata && file.metadata.riskFactors) {
      file.metadata.riskFactors.forEach(risk => {
        if (!analysis.riskFactors[risk]) {
          analysis.riskFactors[risk] = 0;
        }
        analysis.riskFactors[risk]++;
      });
    }
  });

  // 상위 의존성 파일 정렬
  analysis.topDependencies.sort((a, b) => b.totalDeps - a.totalDeps);

  return analysis;
}

function generateReport(metadata, analysis) {
  console.log('🔍 DEPS-CLI 프로젝트 의존성 분석 리포트');
  console.log('=' .repeat(60));

  console.log(`\n📊 기본 통계:`);
  console.log(`  📁 총 파일: ${analysis.totalFiles}개`);
  console.log(`  🔗 총 의존성: ${analysis.totalDependencies}개`);
  console.log(`  📈 평균 의존성: ${(analysis.totalDependencies / analysis.totalFiles).toFixed(1)}개/파일`);

  console.log(`\n🏆 의존성이 많은 파일 TOP 10:`);
  analysis.topDependencies.slice(0, 10).forEach((file, index) => {
    const complexity = file.complexity > 2 ? '🔴' : file.complexity > 1.5 ? '🟡' : '🟢';
    console.log(`  ${index + 1}. ${file.path}`);
    console.log(`     ${complexity} 총 ${file.totalDeps}개 (내부: ${file.internalCount}, 외부: ${file.externalCount})`);
  });

  console.log(`\n🏗️ 코드 클러스터 분석:`);
  Object.entries(analysis.clusters).forEach(([cluster, files]) => {
    console.log(`  📦 ${cluster}: ${files.length}개 파일`);
    if (files.length <= 5) {
      files.forEach(file => console.log(`    • ${file}`));
    } else {
      files.slice(0, 3).forEach(file => console.log(`    • ${file}`));
      console.log(`    ... 그리고 ${files.length - 3}개 더`);
    }
  });

  if (Object.keys(analysis.riskFactors).length > 0) {
    console.log(`\n⚠️ 위험 요소 분석:`);
    Object.entries(analysis.riskFactors).forEach(([risk, count]) => {
      console.log(`  🚨 ${risk}: ${count}개 파일`);
    });
  }

  console.log(`\n🔗 내부 의존성 연결:`);
  const connections = analysis.internalConnections.slice(0, 10);
  if (connections.length > 0) {
    connections.forEach(conn => {
      console.log(`  ${conn.fromPath} → ${conn.to} (신뢰도: ${Math.round(conn.confidence * 100)}%)`);
    });
    if (analysis.internalConnections.length > 10) {
      console.log(`  ... 그리고 ${analysis.internalConnections.length - 10}개 연결 더`);
    }
  } else {
    console.log(`  현재 분석된 내부 연결이 없습니다.`);
  }

  console.log(`\n💾 상세 데이터:`);
  console.log(`  📄 완전한 메타데이터: .deps-analysis/reference-metadata.json`);
  console.log(`  📊 분석 리포트: demo-analysis-report.md`);
}

function generateMermaidDiagram(analysis) {
  console.log(`\n📈 Mermaid 다이어그램 (상위 의존성 관계):`);
  console.log('```mermaid');
  console.log('graph TD');

  // 상위 10개 파일만 표시
  const topFiles = analysis.topDependencies.slice(0, 10);
  const connections = analysis.internalConnections
    .filter(conn =>
      topFiles.some(f => f.fileId === conn.from) &&
      topFiles.some(f => f.path.includes(conn.to.replace(/\.\w+$/, '')))
    )
    .slice(0, 15);

  // 노드 정의
  topFiles.forEach(file => {
    const shortName = file.path.split('/').pop().replace(/\.\w+$/, '');
    const nodeId = file.fileId.replace(/[^a-zA-Z0-9]/g, '_');
    console.log(`  ${nodeId}["${shortName}<br/>deps: ${file.totalDeps}"]`);
  });

  // 연결 정의
  connections.forEach(conn => {
    const fromId = conn.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toShort = conn.to.split('/').pop().replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    console.log(`  ${fromId} --> ${toShort}`);
  });

  console.log('```');
}

// 메인 실행
function main() {
  try {
    const metadata = loadMetadata();
    const analysis = analyzeDependencyPatterns(metadata);

    generateReport(metadata, analysis);
    generateMermaidDiagram(analysis);

    console.log(`\n✅ 분석 완료!`);
    console.log(`🚀 다음 명령으로 다시 분석: node dist/bin.cjs classify .`);

  } catch (error) {
    console.error('❌ 분석 중 오류 발생:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}