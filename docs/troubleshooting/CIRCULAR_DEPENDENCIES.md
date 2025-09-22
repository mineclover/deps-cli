# 순환 의존성 해결 가이드

Effect CLI Queue System에서 발생한 순환 의존성 문제와 해결 방법을 문서화합니다.

## 🔄 발생한 순환 의존성 문제

### Phase 3.5에서 발견된 문제

```
TransparentQueueAdapter.ts ──> index.ts
        ↑                         ↓
        └─────────────────────────┘
```

**에러 메시지:**
```
Error: Service not found: @effect/platform/FileSystem
```

**원인:**
1. `TransparentQueueAdapter.ts`가 `./index.js`에서 imports
2. `index.ts`가 `TransparentQueueAdapter.ts`를 export  
3. 순환 참조로 인해 일부 모듈이 제대로 초기화되지 않음

## 🛠️ 해결 방법

### Before (문제 상황)
```typescript
// TransparentQueueAdapter.ts
import { 
  InternalQueue,
  queueFileOperation,
  queueNetworkOperation, 
  queueComputationTask,
  createTask
} from "./index.js" // ❌ 순환 참조 발생

// index.ts
export * from "./TransparentQueueAdapter.js" // ❌ 서로 참조
```

### After (해결 후)
```typescript
// TransparentQueueAdapter.ts  
import { InternalQueue } from "./types.js"           // ✅ 직접 import
import { createTask } from "./InternalQueueLive.js"  // ✅ 직접 import

// index.ts
export * from "./TransparentQueueAdapter.js" // ✅ 안전한 export
```

## 🎯 핵심 해결 원칙

### 1. **직접 Import 사용**
```typescript
// ❌ 나쁜 예: barrel export를 통한 import
import { ServiceA, ServiceB } from "./index.js"

// ✅ 좋은 예: 직접 import
import { ServiceA } from "./ServiceA.js" 
import { ServiceB } from "./ServiceB.js"
```

### 2. **Types와 Implementation 분리**
```typescript
// types.ts - 인터페이스만 정의
export interface InternalQueue {
  // interface definition
}

// ServiceImpl.ts - 구현만 정의  
import { InternalQueue } from "./types.js"
export const implementation = InternalQueue.of({...})

// index.ts - 안전한 re-export
export * from "./types.js"
export * from "./ServiceImpl.js"
```

### 3. **Dependency Graph 검증**
```bash
# 순환 의존성 검사 도구 사용
npx madge --circular --extensions ts,js src/services/Queue/
```

## 🔍 진단 방법

### 1. **에러 패턴 인식**
```
Service not found: [ServiceName]
│
├─ 레이어 제공 문제일 가능성: 60%
├─ 순환 의존성 문제일 가능성: 30% 
└─ Import 경로 문제일 가능성: 10%
```

### 2. **Import Graph 분석**
```typescript
// 순환 참조 탐지 스크립트
function findCircularDeps(startFile) {
  const visited = new Set()
  const recursionStack = new Set()
  
  function dfs(file) {
    if (recursionStack.has(file)) {
      throw new Error(`Circular dependency detected: ${file}`)
    }
    
    if (visited.has(file)) return
    
    visited.add(file)
    recursionStack.add(file)
    
    // Analyze imports...
    
    recursionStack.delete(file)
  }
  
  dfs(startFile)
}
```

## 🚨 예방 방법

### 1. **아키텍처 레벨 분리**
```
Layer 1: Types (interfaces, constants)
Layer 2: Core Services (implementations) 
Layer 3: High-level Services (compositions)
Layer 4: Integration (adapters, CLI)
```

### 2. **Import 규칙 설정**
```typescript
// eslint 규칙 예시
"import/no-cycle": ["error", { 
  "maxDepth": 3,
  "ignoreExternal": true 
}]
```

### 3. **정기적 의존성 검사**
```json
// package.json scripts
{
  "check-deps": "madge --circular src/",
  "pre-commit": "npm run check-deps && npm run test"
}
```

## 📝 Effect CLI 특화 주의사항

### 1. **Service Context 관리**
```typescript
// ✅ 안전한 패턴
export const MyService = Context.GenericTag<MyServiceInterface>("MyService")

// ❌ 위험한 패턴  
export const MyService = Context.GenericTag("MyService")
  .pipe(
    Service.implement(otherService => // 다른 서비스 참조 시 주의
      // 순환 참조 위험
    )
  )
```

### 2. **Layer Composition**
```typescript
// ✅ 의존성 순서 고려
const Layer1 = BasicServiceLayer
const Layer2 = AdvancedServiceLayer.pipe(Layer.provide(Layer1))
const Layer3 = IntegrationLayer.pipe(Layer.provide(Layer2))

// ❌ 순환 의존성 위험
const LayerA = ServiceALayer.pipe(Layer.provide(LayerB))
const LayerB = ServiceBLayer.pipe(Layer.provide(LayerA))
```

## ✅ 검증 체크리스트

커맨드 추가 전 확인사항:

- [ ] 새 서비스가 기존 barrel export(`./index.js`)를 import하지 않는가?
- [ ] 레이어 의존성이 단방향인가?
- [ ] 모든 필요한 서비스 레이어가 제공되었는가?
- [ ] Import 경로가 정확한가?
- [ ] 순환 의존성 검사를 통과했는가?

## 🔧 문제 해결 플로우

```
커맨드가 작동하지 않음
         ↓
"Service not found" 에러?
    ├─ YES → 레이어 제공 확인
    └─ NO → Import 경로 확인
         ↓
레이어가 올바르게 제공되었는가?
    ├─ YES → 순환 의존성 확인  
    └─ NO → bin.ts에 레이어 추가
         ↓
순환 의존성이 있는가?
    ├─ YES → 직접 import로 변경
    └─ NO → 다른 원인 조사
```

---

이 가이드를 따르면 Effect CLI에서 새로운 커맨드 추가 시 발생할 수 있는 순환 의존성 문제를 예방하고 해결할 수 있습니다.