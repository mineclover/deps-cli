# Effect.js API Guide

> 🔗 **문서 위치**: [INDEX.md](INDEX.md) > API Reference > Effect.js Guide

Effect.js API 문서화 가이드 및 프로젝트 특화 패턴 정리입니다.

## 📚 문서 관리 구조

### Notion 데이터베이스 (메인 저장소)
- **Notion DB**: https://www.notion.so/graph-mcp/26b48583746080afb3add6b97e6b6c5e
- **관리 내용**: 메서드별 상세 사용법, 타입 안전 패턴, 실제 코드 예제
- **조회 방법**: `context mcp` 명령어로 Context7 라이브러리 문서 검색 병행

### 로컬 문서 (프로세스 가이드)  
- **MCP 도구 사용법**: [MCP Usage Guide](operations/MCP_USAGE.md)
- **Effect 패턴**: [Effect Patterns](api/EFFECT_PATTERNS.md)
- **개발 워크플로우**: [Command Development](development/COMMAND_DEVELOPMENT.md)

## 🎯 프로젝트 특화 Effect.js 패턴

이 프로젝트에서 실제 사용하는 Effect.js 패턴들을 정리합니다.

### CLI Command Pattern
```typescript
// From: src/examples/ListCommand.ts
const listCommand = Command.make("ls", {
  path: pathArg,
  all: allOption,
  long: longOption
}).pipe(
  Command.withHandler(({ path, all, long }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const files = yield* fs.listDirectory(path)
      
      const filtered = all 
        ? files 
        : files.filter(file => !file.name.startsWith("."))
      
      yield* Effect.forEach(filtered, file => 
        Console.log(formatFileInfo(file, long))
      )
    })
  )
)
```

**핵심 특징**:
- CLI 핸들러 파라미터 타입 자동 추론
- FileSystem 서비스 주입 및 타입 안전성
- Effect.forEach를 통한 배열 처리

### Service Layer Pattern  
```typescript
// From: src/services/FileSystem.ts
export interface FileSystem {
  readonly listDirectory: (path: string) => Effect<readonly FileInfo[], PlatformError>
  readonly readFileContent: (filePath: string) => Effect<string, PlatformError>
}

export const FileSystem = Context.GenericTag<FileSystem>("FileSystem")

// From: src/services/FileSystemLive.ts  
export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* () {
    return FileSystem.of({
      listDirectory: (path) => Effect.gen(function* () {
        // Node.js 파일시스템 구현
      }),
      readFileContent: (filePath) => Effect.gen(function* () {
        // 파일 읽기 구현
      })
    })
  })
)
```

**핵심 특징**:
- Context.GenericTag를 통한 타입 안전한 의존성 주입
- Layer 시스템으로 서비스 구현체 분리
- 테스트용 구현체 쉽게 교체 가능

### Error Handling Pattern
```typescript
// From: src/examples/CatCommand.ts
Effect.gen(function* () {
  const content = yield* Effect.tryPromise({
    try: () => fs.readFile(filePath, "utf-8"),
    catch: (error) => new FileNotFoundError({ filePath, error })
  })
  
  return content.split('\n').slice(0, lines).join('\n')
}).pipe(
  Effect.catchTag("FileNotFoundError", (error) =>
    Console.error(`파일을 찾을 수 없습니다: ${error.filePath}`)
  )
)
```

**핵심 특징**:
- Data.TaggedError를 통한 명시적 에러 타입
- Effect.catchTag로 타입 안전한 에러 처리
- Promise를 Effect로 변환하는 패턴

## 📖 문서화 품질 기준

### Notion DB에 기록할 내용
1. **타입 시그니처**: 정확한 TypeScript 타입
2. **제네릭 추론**: 자동 타입 추론 동작 방식
3. **에러 타입**: 발생 가능한 에러들의 명시적 타입  
4. **의존성 타입**: 필요한 서비스/컨텍스트 타입
5. **실사용 예제**: 프로젝트 코드에서 발췌한 실제 예제

### 코드 예제 작성 규칙
- **정상 동작 보장**: 타입 에러 없이 정상 동작하는 코드만 업로드
- **출처 명시**: `// From: 파일경로` 형태로 출처 표시
- **빌드 검증**: `npm run check` 통과한 코드만 문서화
- **실제 테스트**: `npm run dev` 또는 `npm run test`로 동작 확인 후 업로드
- **컨텍스트 설명**: 해당 코드가 사용되는 상황 설명
- **타입 안전성**: 타입 추론과 안전성 특징 강조

## 🔄 업데이트 워크플로우

1. **새 Effect.js 패턴 발견** → Notion에 메서드 페이지 생성
2. **실제 코드 구현** → Notion에 프로젝트 특화 예제 페이지 추가
3. **패턴 정리** → 이 문서에 핵심 패턴 요약 업데이트
4. **MCP 도구 개선** → [MCP Usage Guide](operations/MCP_USAGE.md) 업데이트

## 🔍 검색 및 참조 방법

- **Context7**: `context mcp` 명령어로 공식 Effect 문서 검색
- **Notion 검색**: Notion DB 내에서 프로젝트 특화 패턴 검색  
- **로컬 패턴**: 이 문서에서 핵심 패턴 빠른 참조

---

**📚 관련 문서**:
- [Effect Patterns](api/EFFECT_PATTERNS.md) - 상세한 패턴 설명
- [MCP Usage](operations/MCP_USAGE.md) - Notion 문서화 도구 사용법
- [Command Development](development/COMMAND_DEVELOPMENT.md) - 명령어 개발 가이드