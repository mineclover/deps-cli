# deps-cli Project Guidelines

## Project Overview

deps-cli는 **namespace 기반의 파일 패턴 설정 관리 도구**입니다.
헤드리스 CLI 템플릿으로, 차후 다른 파일 대상 기능들을 구현할 때 **무슨 파일들이 대상이 되었는지 식별하고 주입하기 용이하게** 리스트업해주는 것이 주목적입니다.

Commander.js 기반으로 구축되었으며, glob 패턴 기반 파일 매칭과 JSON 설정 파일 관리를 제공합니다.

## Current Status (v2.0.0)

핵심 기능이 구현된 헤드리스 CLI 템플릿입니다:
- ✅ Namespace 관리 (생성/삭제/목록 조회)
- ✅ JSON 기반 설정 파일 관리
- ✅ Glob 패턴 기반 파일 매칭
- ✅ filePatterns/excludePatterns 지원
- ✅ Demo 명령어 (메타데이터 + 파일 목록 출력)

## Project Structure

```
deps-cli/
├── src/
│   ├── bin.ts                    # CLI 진입점
│   ├── config/
│   │   └── ConfigManager.ts      # 설정 파일 관리 + 파일 매칭
│   └── commands/
│       ├── CommandRegistry.ts    # 명령어 등록 시스템
│       └── NamespaceCommands.ts  # namespace 관련 명령어
├── test/
│   └── config-manager.test.ts    # ConfigManager 테스트
├── dist/                         # 빌드 결과물
├── README.md                     # 사용자 문서
└── package.json
```

## Development Guidelines

- TypeScript로 작성
- Commander.js 패턴 따르기
- glob 패키지로 파일 패턴 매칭
- 간단하고 명확한 코드 유지
- 테스트 필수 (vitest)

## Commands

### Namespace Management
- `list-namespaces` - 설정된 namespace 목록 표시
- `create-namespace <name>` - 새 namespace 생성
  - `--copy-from <namespace>` - 기존 namespace 설정 복사
- `delete-namespace <name>` - namespace 삭제

### File Operations
- `list-files <namespace>` - namespace 패턴에 매칭되는 파일 목록
- `demo <namespace>` - **메타데이터와 파일 목록을 함께 출력 (데모 기능)**
  - `--json` - JSON 형식으로 출력 (파이프라인 통합 용이)

## Key Concepts

### Namespace Configuration
각 namespace는 `deps-cli.config.json`에서 관리됩니다:

```json
{
  "namespaces": {
    "source": {
      "filePatterns": ["src/**/*.ts"],
      "excludePatterns": ["**/*.d.ts"]
    }
  }
}
```

### Demo Command Pattern
`demo` 명령어는 namespace 기반 파일 처리의 템플릿입니다:
- Namespace 메타데이터 (filePatterns, excludePatterns)
- 매칭된 파일 목록
- 파일 개수
- JSON/텍스트 형식 지원

이 패턴을 기반으로 추가 파일 처리 기능을 구현할 수 있습니다.

## Extending the Tool

새로운 파일 처리 명령어 추가 시:

```typescript
// ConfigManager의 getNamespaceWithFiles 사용
const result = await globalConfig.getNamespaceWithFiles(namespace, configPath)

// result.namespace - 네임스페이스 이름
// result.metadata - 설정 정보
// result.files - 매칭된 파일 배열
// result.fileCount - 파일 개수

// 파일 처리 로직 구현
result.files.forEach(file => {
  processFile(file, result.metadata)
})
```