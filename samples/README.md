# Sample Commands & Examples

이 디렉토리는 Effect CLI 프레임워크 사용법을 보여주는 **샘플 코드**들을 포함합니다.

## 📂 구조

### `commands/` - CLI 명령어 샘플들
Effect CLI 패턴과 기법들을 보여주는 다양한 명령어 예시:

- **기본 패턴**: `ListCommand.ts`, `CatCommand.ts`, `FindCommand.ts`
- **고급 패턴**: `SampleCommand.ts`, `EnhancedListCommand.ts`
- **통합 예시**: `Phase3_5_RuntimeIntegrationExample.ts`

### `services/` - 서비스 구현 샘플들
실제 프로덕션에서 사용할 수 있는 서비스 구현 예시들 (추후 이동 예정)

### `integrations/` - 통합 예시들
다양한 시스템과의 통합 방법을 보여주는 예시들

## ⚠️ 중요 사항

이 디렉토리의 모든 코드는 **학습 및 참고용 샘플**입니다:

- ✅ **학습**: Effect CLI 패턴과 기법 이해
- ✅ **참고**: 새로운 명령어 작성 시 템플릿
- ✅ **테스팅**: 프레임워크 기능 검증
- ❌ **프로덕션**: 실제 서비스에서 직접 사용 금지

## 🚀 실제 개발

실제 CLI 명령어는 `src/commands/`에 구현하세요:

```typescript
// src/commands/YourCommand.ts
import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

export const yourCommand = Command.make("your-command", {
  // your args
}).pipe(
  Command.withDescription("Your command description"),
  Command.withHandler(() =>
    Effect.gen(function* () {
      // your implementation
    })
  )
)
```

## 📚 학습 순서

1. **기본**: `ListCommand.ts` - 기본 CLI 구조
2. **중급**: `SampleCommand.ts` - 옵션과 포맷팅
3. **고급**: `EnhancedListCommand.ts` - 복잡한 로직
4. **통합**: `Phase3_5_RuntimeIntegrationExample.ts` - 전체 시스템

## 🔧 실행 방법

샘플 명령어들은 현재 메인 CLI에서 제외되어 있습니다. 개별적으로 실행하려면:

```bash
# 개별 샘플 실행
pnpm tsx samples/commands/ListCommand.ts

# 또는 메인 CLI에 임시로 추가하여 테스트
```

## 🎯 Core vs Sample

| 위치 | 용도 | 포함 내용 |
|------|------|----------|
| `src/commands/` | **메인 기능** | 큐 관리, 기본 템플릿 |
| `samples/commands/` | **학습용 샘플** | 다양한 CLI 패턴 예시 |
| `docs/testing/` | **개발 가이드** | TDD 가이드라인 및 규칙 |