# SimpleMirrorManager 사용 가이드

`SimpleMirrorManager`는 namespace를 기준으로 분석된 파일의 의존성 정보를 특정 폴더에 일관되게 저장하는 시스템입니다.

## 🏗️ 아키텍처

### 핵심 컴포넌트

1. **SimpleMirrorManager**: 메인 매니저 클래스
2. **MarkdownPathResolver**: 마크다운 저장 위치 찾기
3. **MarkdownGenerator**: 마크다운 생성
4. **MirrorPathMapper**: 기존 호환성 유지

### 기능 분리

- **마크다운 저장 위치 찾기**: `MarkdownPathResolver`
- **마크다운 생성**: `MarkdownGenerator`
- **통합 관리**: `SimpleMirrorManager`

## 🚀 CLI 사용법

### 기본 미러링

```bash
# 매핑만 보기
deps-cli mirror src/

# 마크다운 파일 생성
deps-cli mirror src/ --create

# namespace 사용
deps-cli mirror src/ --namespace core --create
```

### 새로운 마크다운 명령어

```bash
# 마크다운 경로 확인
deps-cli markdown path src/utils/Helper.ts

# 마크다운 생성
deps-cli markdown generate src/ --template detailed --include-source

# 매핑 검증
deps-cli markdown verify src/utils/Helper.ts
```

## 📦 Import 사용법

### 기본 사용

```typescript
import { SimpleMirrorManager } from 'deps-cli/utils'

const manager = new SimpleMirrorManager(process.cwd(), './docs', 'core')
```

### 기능별 사용

```typescript
import {
  MarkdownPathResolver,
  MarkdownGenerator,
  createMirrorManager
} from 'deps-cli/utils'

// 경로 해결기만 사용
const pathResolver = new MarkdownPathResolver(process.cwd(), './docs', 'core')
const markdownPath = pathResolver.getMarkdownPath('src/utils/Helper.ts')

// 마크다운 생성기만 사용
const generator = new MarkdownGenerator(process.cwd(), './docs', 'core')
const result = await generator.generateMarkdownFile('src/utils/Helper.ts', {
  template: 'detailed',
  includeSource: true
})
```

### 편의 함수 사용

```typescript
import {
  generateMarkdownForFile,
  generateMarkdownForFiles,
  getMarkdownPath
} from 'deps-cli/utils'

// 단일 파일 마크다운 생성
const markdownPath = await generateMarkdownForFile('src/utils/Helper.ts', {
  namespace: 'core',
  template: 'detailed',
  includeSource: true
})

// 배치 마크다운 생성
const result = await generateMarkdownForFiles(['src/utils/Helper.ts', 'src/services/UserService.ts'], {
  namespace: 'core',
  template: 'basic'
})

// 마크다운 경로 조회
const path = getMarkdownPath('src/utils/Helper.ts', { namespace: 'core' })
```

## 🎯 Namespace 기반 구조

### 기본 구조 (namespace 없음)
```
docs/
└── mirror/
    └── src/
        └── utils/
            └── Helper.ts.md
```

### Namespace 사용
```
project-root/
└── core/                    # namespace: 'core'
    └── src/
        └── utils/
            └── Helper.ts.md
```

## 📝 마크다운 템플릿

### Basic 템플릿
```markdown
# Helper.ts

## 📄 File Metadata

```json
{
  "path": "src/utils/Helper.ts",
  "size": 1024,
  "lines": 50,
  "extension": ".ts",
  "lastModified": "2024-01-01T00:00:00.000Z",
  "created": "2024-01-01T00:00:00.000Z",
  "namespace": "core"
}
```
```

### Detailed 템플릿
```markdown
---
title: "Helper.ts"
path: "src/utils/Helper.ts"
size: 1024
lines: 50
extension: ".ts"
lastModified: "2024-01-01T00:00:00.000Z"
namespace: "core"
---

# Helper.ts

## 📄 File Information

- **Path**: `src/utils/Helper.ts`
- **Size**: 1024 bytes
- **Lines**: 50
- **Extension**: `.ts`
- **Last Modified**: 1/1/2024, 12:00:00 AM
- **Namespace**: `core`

## 📝 Source Code

```typescript
// 실제 소스 코드가 여기에 포함됩니다
```
```

## 🔧 고급 사용법

### 커스텀 설정

```typescript
import { SimpleMirrorManager } from 'deps-cli/utils'

const manager = new SimpleMirrorManager(process.cwd(), './docs', 'production')

// 경로 해결기 접근
const pathResolver = manager.getPathResolver()
const mappingInfo = pathResolver.getMappingInfo('src/utils/Helper.ts')

// 마크다운 생성기 접근
const generator = manager.getMarkdownGenerator()
const result = await generator.generateMarkdownFile('src/utils/Helper.ts', {
  template: 'detailed',
  includeSource: true,
  namespace: 'production'
})
```

### 배치 처리

```typescript
import { generateMarkdownForFiles } from 'deps-cli/utils'

const filePaths = [
  'src/utils/Helper.ts',
  'src/services/UserService.ts',
  'src/components/Button.tsx'
]

const result = await generateMarkdownForFiles(filePaths, {
  namespace: 'core',
  template: 'detailed',
  includeSource: true,
  maxFiles: 10
})

console.log(`Generated ${result.processed} markdown files`)
```

## 🎨 확장 가능성

### 새로운 템플릿 추가

```typescript
import { MarkdownGenerator } from 'deps-cli/utils'

class CustomMarkdownGenerator extends MarkdownGenerator {
  generateCustomMarkdown(metadata: FileMetadata): MarkdownContent {
    // 커스텀 마크다운 생성 로직
    return {
      title: metadata.path,
      metadata,
      content: `# Custom: ${metadata.path}\n\nCustom content here...`
    }
  }
}
```

### 커스텀 경로 해결

```typescript
import { MarkdownPathResolver } from 'deps-cli/utils'

class CustomPathResolver extends MarkdownPathResolver {
  getMarkdownPath(sourceFilePath: string): string {
    // 커스텀 경로 로직
    const basePath = this.getBasePath()
    const customPath = sourceFilePath.replace('src/', 'docs/')
    return resolve(basePath, customPath + '.md')
  }
}
```

## 🔍 디버깅 및 검증

### 매핑 검증

```typescript
import { createPathResolver } from 'deps-cli/utils'

const resolver = createPathResolver(process.cwd(), './docs', 'core')
const verification = resolver.verifyMapping('src/utils/Helper.ts')

console.log('Valid:', verification.valid)
console.log('Perfect match:', verification.perfectMatch)
```

### 배치 매핑

```typescript
import { createPathResolver } from 'deps-cli/utils'

const resolver = createPathResolver(process.cwd(), './docs', 'core')
const mapping = resolver.getBatchMapping([
  'src/utils/Helper.ts',
  'src/services/UserService.ts'
])

mapping.forEach((markdownPath, sourcePath) => {
  console.log(`${sourcePath} → ${markdownPath}`)
})
```

## 📊 성능 최적화

### 대용량 파일 처리

```typescript
import { generateMarkdownForFiles } from 'deps-cli/utils'

// 청크 단위로 처리
const chunkSize = 50
const chunks = []
for (let i = 0; i < filePaths.length; i += chunkSize) {
  chunks.push(filePaths.slice(i, i + chunkSize))
}

for (const chunk of chunks) {
  const result = await generateMarkdownForFiles(chunk, {
    namespace: 'core',
    template: 'basic'
  })
  console.log(`Processed ${result.processed} files`)
}
```

이제 `SimpleMirrorManager`는 CLI와 import 모두에서 사용할 수 있으며, 마크다운 저장 위치 찾기와 마크다운 생성 기능이 명확하게 분리되었습니다.
