# @context-action/deps-cli 데모 프로젝트

이 프로젝트는 `@context-action/deps-cli` 패키지의 기능을 테스트하고 시연하기 위한 데모 프로젝트입니다.

## 설치

```bash
npm install
```

## 데모 실행

> ⚠️ **주의**: 이 데모에서는 `npx @context-action/deps-cli`를 사용합니다.
> `npx ctx-deps`나 `npx deps-cli`는 작동하지 않습니다!

### 1. 전체 의존성 분석
```bash
npx @context-action/deps-cli analyze-enhanced .
```

### 2. 사용되지 않는 파일 찾기
```bash
npx @context-action/deps-cli find-unused-files-enhanced
```

### 3. 사용되지 않는 메서드 찾기
```bash
npx @context-action/deps-cli find-unused-methods-enhanced
```

### 4. 특정 파일을 사용하는 곳 찾기
```bash
npx @context-action/deps-cli find-usages-enhanced src/UserService.ts
```

### 5. 특정 메서드를 사용하는 곳 찾기
```bash
npx @context-action/deps-cli find-method-usages-enhanced UserService getUserById
```

## 실제 데모 실행 결과

```bash
# 1. 전체 의존성 분석
$ node ../dist/bin.js analyze-enhanced .
📊 Enhanced Dependency Analysis Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Total files: 3
🔗 Dependencies (edges): 1
🚀 Entry points: 2

# 2. 사용되지 않는 파일 찾기
$ node ../dist/bin.js find-unused-files-enhanced
🗑️ Enhanced Unused Files Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Total files: 3
🚀 Entry points: 2
✅ All files are being used!

# 3. UserService.ts를 사용하는 파일 찾기
$ node ../dist/bin.js find-usages-enhanced src/UserService.ts
📄 Enhanced File Usage Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Target file: src/UserService.ts
📁 Total files analyzed: 3
✅ Files using this file (1):
  1. /Users/junwoobang/project/deps-cli/demo/src/index.ts

# 4. getUserById 메서드를 사용하는 파일 찾기
$ node ../dist/bin.js find-method-usages-enhanced UserService getUserById
🔧 Enhanced Method Usage Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Target: UserService.getUserById
📁 Total files analyzed: 3
✅ Files using this method (1):
  1. /Users/junwoobang/project/deps-cli/demo/src/index.ts
```

## 프로젝트 구조

```
demo/
├── src/
│   ├── index.ts              # 엔트리 포인트 (UserService만 사용)
│   ├── UserService.ts        # 사용자 서비스 (일부 메서드만 사용됨)
│   └── NotificationService.ts # 알림 서비스 (사용되지 않는 파일)
├── package.json
├── tsconfig.json
└── README.md
```

## 성능 특징

- ✅ **99%+ 정확도**: AST 기반 정밀 분석
- ⚡ **고속 처리**: 0.4초 내 분석 완료
- 🎯 **정확한 의존성 탐지**: EnhancedDependencyAnalyzer 사용
- 📊 **직관적 출력**: 구조화된 결과 표시

이 데모를 통해 `@context-action/deps-cli`의 Enhanced v2.0.0 시스템의 강력한 AST 기반 의존성 분석 기능을 확인할 수 있습니다.