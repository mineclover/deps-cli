# Effect.js Patterns

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > API Reference > Effect Patterns

프로젝트에서 사용하는 Effect.js 핵심 패턴들입니다.

## 🔄 Effect.gen Pattern

### 기본 사용법
```typescript
const operation = Effect.gen(function* () {
  const fs = yield* FileSystem
  const content = yield* fs.readFile("config.json")
  return JSON.parse(content)
})
```

### 타입 안전성
- `yield*` 표현식의 결과 타입 자동 추론
- 서비스 의존성 주입 시 타입 안전성 보장
- 에러 타입 자동 전파

## 🏷️ Service Pattern

### 서비스 정의
```typescript
export interface FileSystem {
  readonly listDirectory: (path: string) => Effect<readonly FileInfo[], PlatformError>
  readonly readFileContent: (filePath: string) => Effect<string, PlatformError>
}

export const FileSystem = Context.GenericTag<FileSystem>("FileSystem")
```

### 서비스 구현
```typescript
export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* () {
    return FileSystem.of({
      listDirectory: (path) => Effect.gen(function* () {
        // 실제 구현
      }),
      readFileContent: (filePath) => Effect.gen(function* () {
        // 실제 구현  
      })
    })
  })
)
```

### 서비스 사용
```typescript
Effect.gen(function* () {
  const fs = yield* FileSystem
  const files = yield* fs.listDirectory("/path")
  return files
})
```

## 🎯 CLI Integration

### Command Handler
```typescript
Command.withHandler(({ file, verbose, format }) =>
  Effect.gen(function* () {
    // 핸들러 파라미터 타입 자동 추론
    // file: string, verbose: boolean, format: "json" | "table"
    
    if (verbose) {
      yield* Effect.log(`Processing ${file}`)
    }
    
    const fs = yield* FileSystem
    const content = yield* fs.readFileContent(file)
    
    return formatOutput(content, format)
  })
)
```

## 🚨 Error Handling

### 타입 안전한 에러
```typescript
class FileNotFoundError extends Data.TaggedError("FileNotFoundError")<{
  readonly path: string
  readonly error: unknown
}> {}

const readFile = (path: string) => 
  Effect.tryPromise({
    try: () => fs.readFile(path, "utf-8"),
    catch: (error) => new FileNotFoundError({ path, error })
  })
```

### 에러 복구
```typescript
Effect.gen(function* () {
  const content = yield* readFile(path).pipe(
    Effect.catchTag("FileNotFoundError", () => 
      Effect.succeed("Default content")
    )
  )
  return content
})
```

## 🔗 Effect Composition

### 순차 실행
```typescript
Effect.gen(function* () {
  const file1 = yield* readFile("file1.txt")
  const file2 = yield* readFile("file2.txt")
  return { file1, file2 }
})
```

### 병렬 실행
```typescript
Effect.gen(function* () {
  const [file1, file2] = yield* Effect.all([
    readFile("file1.txt"),
    readFile("file2.txt")
  ], { concurrency: 2 })
  return { file1, file2 }
})
```

### 배열 처리
```typescript
Effect.gen(function* () {
  const files = ["file1.txt", "file2.txt", "file3.txt"]
  
  // 순차 처리
  const results = yield* Effect.forEach(files, readFile)
  
  // 병렬 처리
  const parallelResults = yield* Effect.forEach(
    files, 
    readFile, 
    { concurrency: 3 }
  )
  
  return { results, parallelResults }
})
```

---
**📚 관련 문서**:
- [Type Safety](../development/TYPE_SAFETY.md) - 타입 안전성 상세
- [Service API](SERVICE_API.md) - 서비스 API 레퍼런스
- **Notion DB**: [Effect.js 상세 문서](https://www.notion.so/graph-mcp/26b48583746080afb3add6b97e6b6c5e)