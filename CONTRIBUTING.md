# 기여 가이드

## 🤝 프로젝트 기여하기

deps-cli 프로젝트에 기여해 주셔서 감사합니다! 이 가이드는 효과적인 기여를 위한 규칙과 절차를 안내합니다.

## 📋 기여 방법

### 1. 이슈 보고

버그나 기능 요청이 있다면 GitHub Issues를 통해 보고해 주세요.

**버그 리포트 템플릿:**
```markdown
## 버그 설명
[버그에 대한 명확하고 간결한 설명]

## 재현 단계
1. '...'로 이동
2. '...'를 클릭
3. 아래로 스크롤하여 '...'를 확인
4. 오류 확인

## 예상 동작
[예상했던 동작에 대한 설명]

## 실제 동작
[실제 발생한 동작에 대한 설명]

## 환경 정보
- OS: [예: macOS 13.0]
- Node.js 버전: [예: 18.16.0]
- deps-cli 버전: [예: 1.0.0]

## 추가 컨텍스트
[스크린샷, 로그 등 추가 정보]
```

**기능 요청 템플릿:**
```markdown
## 기능 설명
[원하는 기능에 대한 명확하고 간결한 설명]

## 해결하고자 하는 문제
[이 기능이 해결하는 문제나 개선점]

## 제안하는 해결책
[구현 방법에 대한 제안]

## 대안
[고려한 다른 해결책들]

## 추가 컨텍스트
[추가 정보나 스크린샷]
```

### 2. Pull Request 프로세스

1. **Fork & Clone**
   ```bash
   git clone https://github.com/[your-username]/deps-cli.git
   cd deps-cli
   ```

2. **개발 환경 설정**
   ```bash
   npm install
   npm run build
   npm test
   ```

3. **브랜치 생성**
   ```bash
   git checkout -b feature/amazing-feature
   # 또는
   git checkout -b fix/bug-description
   ```

4. **변경사항 구현**
   - 코딩 스타일 가이드 준수
   - 테스트 코드 작성
   - 문서 업데이트

5. **테스트 실행**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

6. **커밋 & 푸시**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   git push origin feature/amazing-feature
   ```

7. **Pull Request 생성**
   - 명확한 제목과 설명 작성
   - 관련 이슈 번호 참조
   - 변경사항 요약 제공

## 📝 코딩 스타일

### TypeScript 가이드라인

#### 1. 타입 정의
```typescript
// ✅ 좋은 예시
interface FileMetadata {
  readonly fileId: string
  readonly filePath: string
  readonly dependencies: ReadonlyArray<DependencyReference>
}

// ❌ 피해야 할 예시
interface FileMetadata {
  fileId: any
  filePath: string
  dependencies: any[]
}
```

#### 2. 함수 시그니처
```typescript
// ✅ 좋은 예시
async function analyzeFile(
  filePath: string,
  options: AnalysisOptions = {}
): Promise<FileAnalysisResult> {
  // 구현
}

// ❌ 피해야 할 예시
function analyzeFile(filePath: any, options?: any): any {
  // 구현
}
```

#### 3. 에러 처리
```typescript
// ✅ Effect.js 패턴 사용
import { Effect } from 'effect'

const analyzeFileEffect = (filePath: string) =>
  Effect.tryPromise({
    try: () => fs.readFile(filePath, 'utf-8'),
    catch: (error) => new FileReadError(error)
  })

// ❌ 전통적인 try-catch (피해야 함)
async function analyzeFile(filePath: string) {
  try {
    const content = await fs.readFile(filePath)
    return content
  } catch (error) {
    console.error(error) // 부적절한 에러 처리
  }
}
```

### 코딩 컨벤션

#### 1. 네이밍 규칙
```typescript
// 인터페이스: PascalCase
interface DependencyReference {}

// 타입: PascalCase
type FileType = 'code' | 'test' | 'docs'

// 함수/변수: camelCase
const analyzeProjectFiles = () => {}

// 상수: UPPER_SNAKE_CASE
const DEFAULT_CONFIDENCE_THRESHOLD = 80

// 클래스: PascalCase
class MetadataExtractor {}
```

#### 2. 파일 구조
```typescript
// 1. 외부 라이브러리 import
import { Effect } from 'effect'
import * as fs from 'fs/promises'

// 2. 내부 모듈 import
import { FileAnalysisResult } from '../types/index.js'
import { ProjectRootDetector } from '../utils/index.js'

// 3. 타입 정의
interface LocalInterface {}

// 4. 상수
const LOCAL_CONSTANT = 'value'

// 5. 구현
export class ImplementationClass {}
```

#### 3. JSDoc 주석
```typescript
/**
 * 프로젝트의 의존성을 분석하고 메타데이터를 추출합니다.
 *
 * @param projectRoot - 분석할 프로젝트의 루트 디렉토리
 * @param options - 분석 옵션 설정
 * @returns 추출된 프로젝트 메타데이터
 *
 * @example
 * ```typescript
 * const extractor = new MetadataExtractor('/project/root')
 * const metadata = await extractor.extractMetadata(analysisResult)
 * ```
 */
async function extractProjectMetadata(
  projectRoot: string,
  options: ExtractionOptions
): Promise<ProjectReferenceData> {
  // 구현
}
```

## 🧪 테스트 가이드

### 테스트 구조

```
test/
├── unit/                    # 단위 테스트
│   ├── analyzers/
│   ├── utils/
│   └── types/
├── integration/             # 통합 테스트
│   ├── cli/
│   └── scenarios/
├── fixtures/                # 테스트 데이터
│   ├── sample-projects/
│   └── expected-results/
└── helpers/                 # 테스트 유틸리티
```

### 테스트 작성 예시

#### 단위 테스트
```typescript
// test/unit/analyzers/CodeDependencyAnalyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CodeDependencyAnalyzer } from '../../../src/analyzers/CodeDependencyAnalyzer.js'

describe('CodeDependencyAnalyzer', () => {
  let analyzer: CodeDependencyAnalyzer

  beforeEach(() => {
    analyzer = new CodeDependencyAnalyzer('/test/project')
  })

  describe('analyze', () => {
    it('should extract TypeScript imports correctly', async () => {
      // Given
      const sampleFile = 'test/fixtures/sample.ts'

      // When
      const result = await analyzer.analyze(sampleFile)

      // Then
      expect(result.dependencies.internal).toHaveLength(2)
      expect(result.dependencies.external).toHaveLength(1)
      expect(result.dependencies.internal[0].source).toBe('./utils/helper')
    })

    it('should handle files with no dependencies', async () => {
      // Given
      const emptyFile = 'test/fixtures/empty.ts'

      // When
      const result = await analyzer.analyze(emptyFile)

      // Then
      expect(result.dependencies.internal).toHaveLength(0)
      expect(result.dependencies.external).toHaveLength(0)
    })
  })
})
```

#### 통합 테스트
```typescript
// test/integration/cli/classify-command.test.ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import * as fs from 'fs/promises'

describe('classify command integration', () => {
  it('should analyze sample project correctly', async () => {
    // Given
    const projectPath = 'test/fixtures/sample-project'
    const outputDir = 'test/temp/output'

    // When
    execSync(
      `node dist/bin.cjs classify ${projectPath} --output-dir ${outputDir}`,
      { encoding: 'utf-8' }
    )

    // Then
    const metadataExists = await fs.access(`${outputDir}/analysis-result-metadata.json`)
      .then(() => true)
      .catch(() => false)

    expect(metadataExists).toBe(true)

    const metadata = JSON.parse(
      await fs.readFile(`${outputDir}/analysis-result-metadata.json`, 'utf-8')
    )

    expect(metadata.files).toBeDefined()
    expect(metadata.files.length).toBeGreaterThan(0)
  })
})
```

### 테스트 픽스처 관리

```typescript
// test/helpers/fixture-manager.ts
export class FixtureManager {
  static async createSampleProject(name: string): Promise<string> {
    const projectPath = `test/temp/${name}`

    await fs.mkdir(projectPath, { recursive: true })

    // 샘플 파일들 생성
    await fs.writeFile(
      `${projectPath}/main.ts`,
      `import { helper } from './utils/helper'\nexport const main = () => helper()`
    )

    await fs.writeFile(
      `${projectPath}/utils/helper.ts`,
      `export const helper = (value: string) => value.toUpperCase()`
    )

    return projectPath
  }

  static async cleanup(projectPath: string): Promise<void> {
    await fs.rm(projectPath, { recursive: true, force: true })
  }
}
```

## 📚 문서화 가이드

### 문서 업데이트

코드 변경 시 관련 문서도 함께 업데이트해야 합니다:

1. **README.md** - 주요 기능 변경 시
2. **API.md** - API 변경 시
3. **EXAMPLES.md** - 사용법 변경 시
4. **ARCHITECTURE.md** - 아키텍처 변경 시

### 문서 작성 가이드

```markdown
## 섹션 제목

간단한 개요 문장.

### 하위 섹션

상세한 설명과 예시를 포함합니다.

```typescript
// 코드 예시는 실행 가능해야 함
const example = new ExampleClass()
const result = await example.process()
```

**중요한 정보는 굵게 표시**하고, `코드 조각`은 백틱으로 감쌉니다.

> 참고: 추가 정보나 팁은 인용문으로 표시합니다.
```

## 🔄 릴리스 프로세스

### 브랜치 전략

- `main`: 안정 버전
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정
- `release/*`: 릴리스 준비

### 버전 관리

[Semantic Versioning](https://semver.org/)을 따릅니다:

- `MAJOR`: 호환되지 않는 API 변경
- `MINOR`: 하위 호환되는 기능 추가
- `PATCH`: 하위 호환되는 버그 수정

### 커밋 메시지 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 사용합니다:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**타입:**
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 스타일 변경 (기능 변경 없음)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드 프로세스 또는 도구 변경

**예시:**
```
feat(analyzer): add TypeScript decorator support

- Add support for parsing TypeScript decorators
- Update AST traversal logic for decorator patterns
- Add tests for decorator dependency extraction

Closes #123
```

## 🐛 디버깅 가이드

### 로그 레벨 설정

```bash
# 디버그 모드로 실행
DEBUG=deps-cli:* node dist/bin.cjs classify .

# 특정 모듈만 디버깅
DEBUG=deps-cli:analyzer node dist/bin.cjs classify .
```

### 테스트 디버깅

```bash
# 특정 테스트만 실행
npm test -- --run --reporter=verbose test/unit/analyzers/CodeDependencyAnalyzer.test.ts

# 커버리지와 함께 실행
npm run test:coverage
```

### 프로파일링

```bash
# 성능 프로파일링
node --prof dist/bin.cjs classify large-project/
node --prof-process isolate-*.log > processed.txt
```

## 🚀 배포 가이드

### 로컬 빌드 테스트

```bash
# 전체 빌드 프로세스
npm run clean
npm install
npm run build
npm test
npm run lint
npm run typecheck

# 패키지 테스트
npm pack
```

### npm 배포 준비

```bash
# 버전 업데이트
npm version patch # 또는 minor, major

# 배포 (메인테이너만)
npm publish
```

## 📞 도움 요청

### 소통 채널

- **GitHub Issues**: 버그 리포트, 기능 요청
- **GitHub Discussions**: 일반적인 질문, 아이디어 논의
- **Email**: 보안 관련 이슈

### 질문하기 전 체크리스트

1. 문서를 읽어보셨나요?
2. 기존 이슈에서 검색해보셨나요?
3. 최신 버전을 사용하고 계신가요?
4. 재현 가능한 예시를 준비하셨나요?

## 🏆 기여자 인정

모든 기여자는 다음과 같이 인정받습니다:

1. **README.md 기여자 섹션**에 이름 추가
2. **릴리스 노트**에 기여 내용 명시
3. **GitHub Contributors** 통계에 반영

## 📄 라이선스

기여하신 코드는 프로젝트의 MIT 라이선스 하에 배포됩니다. 기여 시 이에 동의하는 것으로 간주됩니다.

---

**즐거운 코딩 되세요!** 🎉

질문이나 도움이 필요하면 언제든지 이슈를 생성하거나 메인테이너에게 연락해 주세요.