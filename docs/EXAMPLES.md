# 사용 예시 및 튜토리얼

## 개요

이 문서는 deps-cli의 다양한 사용 시나리오와 실전 예시를 제공합니다.

## 기본 사용법

### 1. 간단한 프로젝트 분석

```bash
# 현재 디렉토리 분석
node dist/bin.cjs classify .

# 특정 디렉토리 분석
node dist/bin.cjs classify src/
```

**결과:**
- `.deps-analysis/analysis-result-metadata.json` - 완전한 메타데이터
- `.deps-analysis/analysis-report.json` - 분석 요약
- `.deps-analysis/analysis-result-report.md` - 상세 리포트

### 2. 프로젝트 구조 예시

다음과 같은 프로젝트 구조를 가정합니다:

```
my-project/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Modal.tsx
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── api.ts
│   ├── __tests__/
│   │   ├── Button.test.tsx
│   │   └── Modal.test.tsx
│   └── main.ts
├── docs/
│   ├── README.md
│   └── API.md
└── package.json
```

## 실전 시나리오

### 시나리오 1: TypeScript 프로젝트 전체 분석

```bash
# TypeScript 파일만 분석
node dist/bin.cjs classify . \
  --include "**/*.ts,**/*.tsx" \
  --exclude "**/*.test.*,**/node_modules/**" \
  --output-name "typescript-analysis"
```

**분석 결과:**
```json
{
  "project": {
    "projectId": "my-project-abc123",
    "name": "my-project",
    "rootPath": "/Users/user/my-project"
  },
  "files": [
    {
      "fileId": "src/main.ts",
      "filePath": "/Users/user/my-project/src/main.ts",
      "relativePath": "src/main.ts",
      "fileType": "code",
      "dependencies": {
        "internal": [
          {
            "source": "./components/Button",
            "resolved": "src/components/Button.tsx",
            "type": "internal-module",
            "confidence": 95
          }
        ],
        "external": [
          {
            "source": "react",
            "resolved": "react",
            "type": "external-library",
            "confidence": 100
          }
        ]
      }
    }
  ]
}
```

### 시나리오 2: 테스트 커버리지 분석

```bash
# 테스트 파일과 대상 코드 관계 분석
node dist/bin.cjs classify . \
  --analysis-depth comprehensive \
  --generate-report \
  --output-name "test-coverage"
```

**생성된 리포트 예시:**
```markdown
# 테스트 커버리지 분석 리포트

## 테스트 현황
- 전체 코드 파일: 15개
- 테스트 파일: 8개
- 테스트 커버리지: 53%

## 테스트되지 않은 파일
- src/utils/advanced.ts
- src/components/Chart.tsx
- src/services/analytics.ts

## 테스트 의존성 분석
### Button.test.tsx
- **테스트 대상**: src/components/Button.tsx
- **테스트 유틸리티**: @testing-library/react, jest
- **신뢰도**: 98%
```

### 시나리오 3: 문서 링크 검증

```bash
# 마크다운 문서의 링크 유효성 검증
node dist/bin.cjs classify docs/ \
  --include "**/*.md" \
  --confidence-threshold 80 \
  --generate-viz \
  --output-name "docs-validation"
```

**문서 분석 결과:**
```json
{
  "fileId": "docs/README.md",
  "fileType": "docs",
  "dependencies": {
    "docs": {
      "references": [
        {
          "source": "[API 문서](./API.md)",
          "resolved": "docs/API.md",
          "type": "doc-reference",
          "confidence": 90
        }
      ],
      "links": [
        {
          "source": "https://github.com/user/repo",
          "resolved": "https://github.com/user/repo",
          "type": "doc-link",
          "confidence": 85
        }
      ]
    }
  }
}
```

### 시나리오 4: 모노레포 구조 분석

```bash
# 패키지별 의존성 관계 분석
node dist/bin.cjs classify . \
  --analysis-depth deep \
  --include "packages/**/*.ts" \
  --exclude "**/node_modules/**" \
  --generate-viz \
  --output-dir ./analysis-results \
  --output-name "monorepo-deps"
```

## 고급 사용법

### 1. 커스텀 필터링과 분석 깊이

```bash
# 대용량 파일 제외하고 신뢰도 높은 의존성만 분석
node dist/bin.cjs classify . \
  --max-file-size 1048576 \
  --confidence-threshold 90 \
  --analysis-depth minimal \
  --no-parallel
```

### 2. 증분 분석 활용

```bash
# 초기 전체 분석
node dist/bin.cjs classify . \
  --output-name "baseline" \
  --enable-cache

# 이후 변경분만 분석
node dist/bin.cjs classify . \
  --incremental \
  --output-name "incremental-update"
```

### 3. 여러 형식으로 결과 출력

```bash
# JSON + 시각화 + 압축
node dist/bin.cjs classify . \
  --format json \
  --generate-viz \
  --compression \
  --output-name "complete-analysis"
```

## 프로그래밍 방식 사용

### 1. 기본 API 사용

```typescript
import { UnifiedDependencyAnalyzer } from './src/analyzers/UnifiedDependencyAnalyzer.js'
import { MetadataExtractor } from './src/analyzers/MetadataExtractor.js'

async function analyzeProject() {
  const projectRoot = '/path/to/project'

  // 분석기 초기화
  const analyzer = new UnifiedDependencyAnalyzer(projectRoot)

  // 파일 목록 수집
  const files = [
    'src/main.ts',
    'src/components/Button.tsx',
    'src/__tests__/Button.test.tsx'
  ]

  // 분석 실행
  const result = await analyzer.analyzeProject(files)

  // 메타데이터 추출
  const extractor = new MetadataExtractor(projectRoot)
  const metadata = extractor.extractMetadata(result)

  return metadata
}
```

### 2. 타입별 분석

```typescript
async function analyzeByFileTypes() {
  const analyzer = new UnifiedDependencyAnalyzer('/project/root')

  // 타입별 분석
  const typeResults = await analyzer.analyzeByType([
    'src/**/*.ts',
    'src/**/*.test.ts',
    'docs/**/*.md'
  ])

  console.log('코드 파일:', typeResults.code.length)
  console.log('테스트 파일:', typeResults.test.length)
  console.log('문서 파일:', typeResults.docs.length)

  return typeResults
}
```

### 3. 특정 파일의 의존성 추적

```typescript
async function traceDependencies(targetFile: string) {
  const metadata = await analyzeProject()

  // 대상 파일 찾기
  const file = metadata.files.find(f => f.relativePath === targetFile)
  if (!file) return null

  // 의존성 추적
  const internalDeps = file.dependencies.internal
  const externalDeps = file.dependencies.external

  // 역방향 의존성 (이 파일을 참조하는 파일들)
  const dependents = file.dependents

  return {
    file: targetFile,
    dependencies: {
      internal: internalDeps.map(dep => dep.resolved),
      external: externalDeps.map(dep => dep.source)
    },
    dependents
  }
}
```

### 4. 참조 그래프 분석

```typescript
async function analyzeReferenceGraph() {
  const metadata = await analyzeProject()
  const graph = metadata.referenceGraph

  // 가장 많이 참조되는 파일 찾기
  const popularFiles = graph.nodes
    .map(node => ({
      file: node.label,
      incomingEdges: graph.edges.filter(edge => edge.target === node.id).length
    }))
    .sort((a, b) => b.incomingEdges - a.incomingEdges)
    .slice(0, 5)

  console.log('가장 많이 참조되는 파일들:', popularFiles)

  // 클러스터 분석
  const clusters = graph.clusters
  clusters.forEach(cluster => {
    console.log(`클러스터 ${cluster.id}:`)
    console.log(`  파일 수: ${cluster.files.length}`)
    console.log(`  특성: ${cluster.characteristics.join(', ')}`)
  })

  return { popularFiles, clusters }
}
```

## 실제 프로젝트 예시

### React 프로젝트 분석

```bash
# React 컴포넌트 의존성 분석
node dist/bin.cjs classify src/ \
  --include "**/*.tsx,**/*.ts" \
  --exclude "**/*.test.*" \
  --analysis-depth comprehensive \
  --generate-report \
  --output-name "react-components"
```

**예상 결과:**
- 컴포넌트 간 의존성 매핑
- 순환 의존성 탐지
- 사용되지 않는 컴포넌트 식별

### Node.js API 서버 분석

```bash
# Express 서버 의존성 분석
node dist/bin.cjs classify . \
  --include "src/**/*.js,src/**/*.ts" \
  --exclude "**/test/**" \
  --confidence-threshold 85 \
  --generate-viz \
  --output-name "api-server"
```

**분석 포인트:**
- 라우터와 미들웨어 의존성
- 데이터베이스 모델 사용 패턴
- 외부 API 호출 관계

### 라이브러리 프로젝트 분석

```bash
# 라이브러리 public API 분석
node dist/bin.cjs classify . \
  --include "src/**/*.ts" \
  --exclude "**/*.test.*,**/internal/**" \
  --analysis-depth deep \
  --generate-report \
  --output-name "library-api"
```

## 트러블슈팅

### 일반적인 문제와 해결책

#### 1. 메모리 부족 오류

```bash
# 파일 크기 제한으로 메모리 사용량 감소
node dist/bin.cjs classify . \
  --max-file-size 1048576 \
  --confidence-threshold 80 \
  --no-parallel
```

#### 2. 분석 속도가 느림

```bash
# 병렬 처리와 캐싱으로 속도 향상
node dist/bin.cjs classify . \
  --parallel \
  --enable-cache \
  --analysis-depth minimal
```

#### 3. 잘못된 의존성 탐지

```bash
# 신뢰도 임계값을 높여 정확도 향상
node dist/bin.cjs classify . \
  --confidence-threshold 90 \
  --analysis-depth comprehensive
```

### 디버깅 팁

```bash
# 상세 출력으로 분석 과정 확인
node dist/bin.cjs classify . \
  --verbose \
  --output-name "debug-analysis"
```

## 워크플로우 통합

### CI/CD 파이프라인

```yaml
# .github/workflows/dependency-analysis.yml
name: Dependency Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd deps-cli
          npm install
          npm run build

      - name: Run dependency analysis
        run: |
          node dist/bin.cjs classify . \
            --confidence-threshold 85 \
            --generate-report \
            --output-name "ci-analysis"

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: dependency-analysis
          path: .deps-analysis/
```

### 개발 환경 스크립트

```json
{
  "scripts": {
    "analyze": "node dist/bin.cjs classify .",
    "analyze:deep": "node dist/bin.cjs classify . --analysis-depth deep --generate-viz",
    "analyze:tests": "node dist/bin.cjs classify . --include '**/*.test.*' --output-name test-deps",
    "analyze:docs": "node dist/bin.cjs classify docs/ --include '**/*.md' --output-name doc-links"
  }
}
```

## 추가 리소스

- [CLI 옵션 전체 가이드](../ENHANCED_CLI_GUIDE.md)
- [API 문서](./API.md)
- [아키텍처 문서](../README.md#아키텍처)
- [문제 해결 가이드](../README.md#문제-해결)