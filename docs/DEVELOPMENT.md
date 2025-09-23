# 개발자 가이드

deps-cli 프로젝트 개발 및 확장을 위한 완전한 가이드입니다.

## 🛠️ 개발 환경 설정

### 시스템 요구사항

- **Node.js**: 18.0.0 이상
- **npm**: 8.0.0 이상
- **TypeScript**: 5.0.0 이상
- **Git**: 2.30.0 이상

### 초기 설정

```bash
# 저장소 클론
git clone https://github.com/username/deps-cli.git
cd deps-cli

# 의존성 설치
npm install

# 개발 빌드
npm run build

# 테스트 실행
npm test
```

### 개발 워크플로우

```bash
# 개발 모드로 빌드 및 실행
npm run build:watch  # TypeScript 변경사항 자동 빌드

# CLI 테스트
node dist/bin.cjs classify .  # 현재 프로젝트 분석

# 타입 검사
npm run typecheck

# 테스트 실행
npm test

# 코드 포맷팅
npm run format

# 린팅
npm run lint

# 프로덕션 빌드
npm run build
```

### 개발 도구 설정

#### VS Code 설정

`.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.associations": {
    "*.cjs": "javascript"
  }
}
```

#### 권장 VS Code 확장

- TypeScript Importer
- ESLint
- Prettier
- Effect Snippets
- Auto Import - ES6, TS, JSX, TSX

## 📂 프로젝트 구조

```
deps-cli/
├── src/                          # 소스 코드
│   ├── analyzers/               # 의존성 분석기들
│   │   ├── CodeDependencyAnalyzer.ts
│   │   ├── TestDependencyAnalyzer.ts
│   │   ├── DocumentDependencyAnalyzer.ts
│   │   ├── UnifiedDependencyAnalyzer.ts
│   │   └── MetadataExtractor.ts
│   ├── commands/                # CLI 명령어
│   │   ├── ClassifyCommand.ts
│   │   └── AnalyzeCommand.ts
│   ├── types/                   # 타입 정의
│   │   ├── DependencyClassification.ts
│   │   ├── ReferenceMetadata.ts
│   │   └── index.ts
│   ├── utils/                   # 유틸리티
│   │   ├── ProjectRootDetector.ts
│   │   ├── IdGenerator.ts
│   │   └── index.ts
│   ├── layers/                  # Effect 레이어
│   │   └── index.ts
│   └── bin.ts                   # CLI 진입점
├── test/                        # 테스트
│   ├── unit/                    # 단위 테스트
│   ├── integration/             # 통합 테스트
│   ├── fixtures/                # 테스트 데이터
│   └── helpers/                 # 테스트 유틸리티
├── docs/                        # 문서
│   ├── API.md
│   ├── EXAMPLES.md
│   ├── ARCHITECTURE.md
│   └── guides/
├── examples/                    # 예시 파일들
│   ├── typescript/
│   ├── test-files/
│   └── markdown/
├── .deps-analysis/             # 분석 결과 (gitignore)
├── dist/                       # 빌드 결과 (gitignore)
└── coverage/                   # 테스트 커버리지 (gitignore)
```

## 🔧 빌드 시스템

### 빌드 스크립트

```json
{
  "scripts": {
    "build": "tsc && chmod +x dist/bin.cjs",
    "build:watch": "tsc --watch",
    "build:clean": "rm -rf dist && npm run build",
    "dev": "npm run build:watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write src/**/*.ts",
    "clean": "rm -rf dist coverage .deps-analysis"
  }
}
```

### TypeScript 설정

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

## 🧩 핵심 아키텍처 패턴

### Effect.js 패턴

deps-cli는 Effect.js를 사용하여 함수형 프로그래밍 패러다임을 구현합니다.

#### 기본 Effect 패턴

```typescript
import { Effect, pipe } from 'effect'

// 에러 타입 정의
class FileNotFoundError {
  readonly _tag = 'FileNotFoundError'
  constructor(readonly path: string) {}
}

class ParseError {
  readonly _tag = 'ParseError'
  constructor(readonly message: string) {}
}

// Effect를 사용한 안전한 파일 읽기
const readFileEffect = (path: string) =>
  Effect.tryPromise({
    try: () => fs.readFile(path, 'utf-8'),
    catch: () => new FileNotFoundError(path)
  })

// 파이프라인을 통한 데이터 변환
const processFile = (path: string) => pipe(
  readFileEffect(path),
  Effect.flatMap(content => parseContent(content)),
  Effect.map(parsed => analyzeContent(parsed)),
  Effect.catchTag('FileNotFoundError', error =>
    Effect.succeed({ error: `File not found: ${error.path}` })
  )
)
```

#### CLI 명령어 패턴

```typescript
import { Command, Options, Args } from '@effect/cli'

// 옵션 정의
const outputDirOption = Options.directory('output-dir').pipe(
  Options.withDefault('.deps-analysis')
)

const verboseOption = Options.boolean('verbose').pipe(
  Options.withDefault(false)
)

// 인수 정의
const targetPathArg = Args.directory('target')

// 명령어 정의
const classifyCommand = Command.make('classify', {
  outputDir: outputDirOption,
  verbose: verboseOption
}, targetPathArg).pipe(
  Command.withHandler(({ outputDir, verbose }, targetPath) =>
    pipe(
      Effect.logInfo(`Analyzing ${targetPath}`),
      Effect.flatMap(() => analyzeProject(targetPath, { outputDir, verbose }))
    )
  )
)
```

## 🔍 분석기 개발

### 새로운 분석기 추가

1. **분석기 인터페이스 구현**

```typescript
// src/analyzers/CustomAnalyzer.ts
import { FileAnalyzer, FileAnalysisResult } from '../types/index.js'

export class CustomAnalyzer implements FileAnalyzer {
  constructor(private projectRoot: string) {}

  async analyze(filePath: string): Promise<FileAnalysisResult> {
    // 파일 내용 읽기
    const content = await fs.readFile(filePath, 'utf-8')

    // 커스텀 분석 로직
    const dependencies = this.extractDependencies(content)

    return {
      filePath,
      fileType: this.determineFileType(filePath),
      dependencies,
      metadata: {
        confidence: this.calculateConfidence(dependencies),
        analysisTimestamp: new Date().toISOString()
      }
    }
  }

  supportsFileType(filePath: string): boolean {
    return filePath.endsWith('.custom')
  }

  private extractDependencies(content: string): FileDependencies {
    // 구현...
  }
}
```

2. **통합 분석기에 등록**

```typescript
// src/analyzers/UnifiedDependencyAnalyzer.ts
import { CustomAnalyzer } from './CustomAnalyzer.js'

export class UnifiedDependencyAnalyzer {
  private analyzers: Map<string, FileAnalyzer> = new Map()

  constructor(projectRoot: string) {
    // 기존 분석기들 등록
    this.registerAnalyzer('code', new CodeDependencyAnalyzer(projectRoot))
    this.registerAnalyzer('test', new TestDependencyAnalyzer(projectRoot))
    this.registerAnalyzer('docs', new DocumentDependencyAnalyzer(projectRoot))

    // 새 분석기 등록
    this.registerAnalyzer('custom', new CustomAnalyzer(projectRoot))
  }

  registerAnalyzer(name: string, analyzer: FileAnalyzer): void {
    this.analyzers.set(name, analyzer)
  }
}
```

### 분석기 테스트

```typescript
// test/unit/analyzers/CustomAnalyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CustomAnalyzer } from '../../../src/analyzers/CustomAnalyzer.js'

describe('CustomAnalyzer', () => {
  let analyzer: CustomAnalyzer

  beforeEach(() => {
    analyzer = new CustomAnalyzer('/test/project')
  })

  it('should support .custom files', () => {
    expect(analyzer.supportsFileType('example.custom')).toBe(true)
    expect(analyzer.supportsFileType('example.ts')).toBe(false)
  })

  it('should extract dependencies correctly', async () => {
    // 테스트 구현...
  })
})
```

## 🎯 타입 시스템 확장

### 새로운 의존성 타입 추가

```typescript
// src/types/DependencyClassification.ts
export type DependencyType =
  | 'internal-module'
  | 'external-library'
  | 'builtin-module'
  | 'test-target'
  | 'test-utility'
  | 'test-setup'
  | 'doc-reference'
  | 'doc-link'
  | 'doc-asset'
  | 'custom-type'        // 새로운 타입 추가

// 타입별 분류 로직 확장
export function classifyDependency(
  source: string,
  resolved: string,
  context: AnalysisContext
): DependencyType {
  // 기존 분류 로직...

  // 새로운 타입 분류 로직
  if (isCustomType(source, resolved, context)) {
    return 'custom-type'
  }

  return 'external-library'
}
```

### 메타데이터 구조 확장

```typescript
// src/types/ReferenceMetadata.ts
export interface ExtendedFileMetadata extends FileMetadata {
  customFields?: {
    complexity: number
    maintainability: number
    riskFactors: string[]
    tags: string[]
  }
}

// 확장된 메타데이터 추출
export class EnhancedMetadataExtractor extends MetadataExtractor {
  protected enrichFileMetadata(file: FileMetadata): ExtendedFileMetadata {
    const baseMetadata = super.extractFileMetadata(file)

    return {
      ...baseMetadata,
      customFields: {
        complexity: this.calculateComplexity(file),
        maintainability: this.calculateMaintainability(file),
        riskFactors: this.identifyRiskFactors(file),
        tags: this.extractTags(file)
      }
    }
  }
}
```

## 🧪 테스트 전략

### 테스트 계층 구조

```
test/
├── unit/                    # 단위 테스트 (빠름, 격리됨)
├── integration/            # 통합 테스트 (중간, 실제 파일 시스템)
├── e2e/                   # End-to-End 테스트 (느림, 전체 워크플로우)
└── performance/           # 성능 테스트
```

### 단위 테스트 패턴

```typescript
// 테스트 픽스처 생성
const createTestFile = (content: string, extension = '.ts') => {
  const filePath = `test-${Date.now()}${extension}`
  return { filePath, content }
}

// 모킹 패턴
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mocked content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}))

// 스냅샷 테스트
it('should generate expected metadata structure', async () => {
  const result = await extractor.extractMetadata(sampleResult)
  expect(result).toMatchSnapshot()
})
```

### 통합 테스트 패턴

```typescript
// 임시 프로젝트 생성
const createTempProject = async (structure: ProjectStructure) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deps-cli-test-'))

  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(tempDir, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }

  return tempDir
}

// 정리 함수
const cleanup = async (tempDir: string) => {
  await fs.rm(tempDir, { recursive: true, force: true })
}
```

## 🚀 성능 최적화

### 병렬 처리 패턴

```typescript
// 배치 처리
async function analyzeBatch<T>(
  items: T[],
  processor: (item: T) => Promise<ProcessedResult>,
  batchSize = 10
): Promise<ProcessedResult[]> {
  const results: ProcessedResult[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    )
    results.push(...batchResults)
  }

  return results
}
```

### 캐싱 전략

```typescript
// 메모리 캐시
class AnalysisCache {
  private cache = new Map<string, CacheEntry>()

  async get(key: string): Promise<AnalysisResult | null> {
    const entry = this.cache.get(key)
    if (!entry || this.isExpired(entry)) {
      return null
    }
    return entry.result
  }

  async set(key: string, result: AnalysisResult): Promise<void> {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: 1000 * 60 * 10 // 10분
    })
  }
}

// 파일 시스템 캐시
class PersistentCache {
  private cacheDir = '.deps-cache'

  async getCacheKey(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath)
    return crypto
      .createHash('sha1')
      .update(`${filePath}:${stats.mtime.getTime()}`)
      .digest('hex')
  }
}
```

## 📊 로깅 및 모니터링

### 구조화된 로깅

```typescript
import { Effect } from 'effect'

// 로그 레벨 정의
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 구조화된 로그 데이터
interface LogData {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  duration?: number
}

// Effect 로깅 패턴
const analyzeWithLogging = (filePath: string) => pipe(
  Effect.logInfo(`Starting analysis for ${filePath}`),
  Effect.flatMap(() => Effect.sync(() => performance.now())),
  Effect.flatMap(startTime => pipe(
    analyzeFile(filePath),
    Effect.tap(result => Effect.logInfo(`Analysis completed`, {
      filePath,
      dependencyCount: result.dependencies.length,
      duration: performance.now() - startTime
    }))
  ))
)
```

### 성능 메트릭

```typescript
// 메트릭 수집
class PerformanceMetrics {
  private metrics = new Map<string, number[]>()

  recordDuration(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }
    this.metrics.get(operation)!.push(duration)
  }

  getStats(operation: string) {
    const durations = this.metrics.get(operation) || []
    return {
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    }
  }
}
```

## 🔄 CI/CD 통합

### GitHub Actions 워크플로우

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test -- --coverage

      - name: Build
        run: npm run build

      - name: Integration test
        run: npm run test:integration
```

## 🛠️ 개발 워크플로우

### 일반적인 개발 사이클

1. **기능 브랜치 생성**
   ```bash
   git checkout -b feature/new-analyzer
   ```

2. **개발 모드 시작**
   ```bash
   npm run dev  # 타입스크립트 watch 모드
   ```

3. **테스트 주도 개발**
   ```bash
   npm run test:watch  # 테스트 watch 모드
   ```

4. **코드 검증**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

5. **빌드 및 통합 테스트**
   ```bash
   npm run build
   npm run test:integration
   ```

### 디버깅 도구

```typescript
// 디버그 로깅
import debug from 'debug'
const log = debug('deps-cli:analyzer')

// VS Code 디버깅 설정 (.vscode/launch.json)
{
  "type": "node",
  "request": "launch",
  "name": "Debug CLI",
  "program": "${workspaceFolder}/dist/bin.cjs",
  "args": ["classify", "test-project"],
  "console": "integratedTerminal",
  "env": {
    "DEBUG": "deps-cli:*"
  }
}
```

## 📋 체크리스트

### Pull Request 체크리스트

- [ ] 모든 테스트 통과
- [ ] 타입 검사 통과
- [ ] 린팅 규칙 준수
- [ ] 적절한 테스트 추가
- [ ] 문서 업데이트
- [ ] 커밋 메시지 컨벤션 준수
- [ ] 기능/버그 설명 명확
- [ ] 브레이킹 체인지 여부 표시

### 릴리스 체크리스트

- [ ] 모든 CI 검사 통과
- [ ] 버전 번호 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] 릴리스 노트 작성
- [ ] 태그 생성
- [ ] npm 배포
- [ ] GitHub 릴리스 생성

---

이 가이드는 deps-cli 프로젝트의 개발에 필요한 모든 정보를 제공합니다. 추가 질문이나 개선 제안이 있으면 언제든지 이슈를 생성해 주세요!