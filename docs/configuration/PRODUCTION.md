# Production Deployment

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Configuration > Production

프로덕션 환경에서 예제 제거 및 배포 설정 가이드입니다.

## ⚡ Quick Setup

### 가장 간단한 방법 (권장)

**src/Cli.ts**에서 import 라인 하나만 제거:

```typescript
// 이 라인만 주석 처리 또는 제거
// import { advancedCommand, catCommand, findCommand, listCommand, sampleCommand } from "./examples/index.js"

const command = mainCommand.pipe(
  Command.withSubcommands([
    // 예제 커맨드들이 자동으로 제거됨
    // 여기에 production 커맨드들만 추가
  ])
)
```

**결과**: 모든 예제 명령어가 빌드에서 완전히 제외됨

## 🎯 배포 옵션

### 옵션 1: Import 제거 (최적화 🏆)
- **장점**: 번들 크기 최소화, 완전한 코드 제거
- **방법**: 위의 Quick Setup 참조

### 옵션 2: 설정 비활성화
```typescript
// src/examples/config.ts
export const ENABLE_EXAMPLES = false
```

### 옵션 3: 환경변수 기반
```typescript  
export const ENABLE_EXAMPLES = process.env.NODE_ENV !== 'production';
```

## 📦 빌드 & 검증

```bash
# 빌드
npm run build

# 검증 - 예제 명령어가 없어야 함
node dist/bin.js --help
```

## 🎉 Production 준비 완료!

---
**📚 관련 문서**:
- [Examples](EXAMPLES.md) - 예제 상세 관리
- [Build Deploy](../operations/BUILD_DEPLOY.md) - CI/CD 배포