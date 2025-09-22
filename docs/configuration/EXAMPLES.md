# Example Commands Configuration

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Configuration > Examples

예제 명령어 설정 및 관리 가이드입니다.

## ⚙️ 설정 방법

### 전체 제어

**src/examples/config.ts**:
```typescript
// 모든 예제 비활성화
export const ENABLE_EXAMPLES = false;

// 개별 예제 제어
export const ExampleConfig = {
  LIST_COMMAND: true,
  CAT_COMMAND: false,
  FIND_COMMAND: true,
  SAMPLE_COMMAND: false,
  ADVANCED_COMMAND: true,
} as const;
```

### 환경별 제어

```typescript
// 프로덕션에서 자동 비활성화
export const ENABLE_EXAMPLES = process.env.NODE_ENV !== 'production';
```

## 📋 사용 패턴

### 패턴 1: 설정 기반 사용
```typescript
import { exampleCommands } from "./examples/index.js"
Command.withSubcommands([...exampleCommands, ...myCommands])
```

### 패턴 2: 선택적 사용  
```typescript
import { listCommand, sampleCommand } from "./examples/index.js"
Command.withSubcommands([listCommand, sampleCommand])
```

### 패턴 3: 프로덕션 제외
```typescript
Command.withSubcommands([...productionCommands]) // 예제 제외
```

## 🔧 새 예제 추가

1. **예제 파일 생성**: `src/examples/MyExampleCommand.ts`
2. **설정 추가**: `config.ts`에 토글 추가  
3. **인덱스 등록**: `index.ts`에서 export
4. **조건부 로딩**: `getEnabledCommands()`에 추가

---
**📚 관련 문서**: 
- [Production 배포](PRODUCTION.md) - 프로덕션에서 예제 제거
- [Command Development](../development/COMMAND_DEVELOPMENT.md) - 새 명령어 개발