# @context-action/deps-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@context-action/deps-cli.svg)](https://www.npmjs.com/package/@context-action/deps-cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![AST-based](https://img.shields.io/badge/Analysis-AST%20Based-brightgreen.svg)](#)
[![Accuracy](https://img.shields.io/badge/Accuracy-99%25%2B-success.svg)](#)

**Enhanced Dependency Analysis CLI tool with 99%+ accuracy - AST-based TypeScript/JavaScript dependency analyzer**

AST 기반 고정밀도 의존성 분석으로 TypeScript/JavaScript 프로젝트의 복잡한 의존성 관계를 정확하게 파악하는 현대적 CLI 도구입니다.

## ✨ 핵심 특징

### 🎯 **99%+ 정확도**
- **AST 기반 분석**: 정규식 대신 Abstract Syntax Tree 사용
- **TypeScript 완벽 지원**: `.js` import → `.ts` 파일 매칭
- **False positive 제거**: 실제 사용되지 않는 파일만 정확히 탐지

### ⚡ **극강의 성능**
- **0.4초**: 30+ 파일 프로젝트 전체 분석
- **메모리 캐싱**: 동일 세션 내 중복 파싱 제거
- **확장성**: 대규모 프로젝트도 빠른 처리

### 🔧 **5가지 핵심 분석**
- **전체 분석**: 프로젝트 의존성 그래프 구축
- **파일 사용처**: 특정 파일을 import하는 모든 파일 찾기
- **메서드 사용처**: 특정 메서드를 호출하는 모든 위치 찾기
- **미사용 파일**: 어디서도 import되지 않는 파일 탐지
- **미사용 메서드**: 어디서도 호출되지 않는 메서드 탐지

## 🚀 빠른 시작

### 📋 사용법 요약

| 방법 | 명령어 | 장점 |
|------|--------|------|
| **npx (권장)** | `npx @context-action/deps-cli` | 설치 불필요, 항상 최신 버전 |
| **글로벌 설치** | `npm install -g` → `deps-cli` 또는 `ctx-deps` | 짧은 명령어 사용 가능 |
| **로컬 설치** | `npm install --save-dev` → npm scripts | 프로젝트별 버전 관리 |

> ⚠️ **주의**: `npx deps-cli`이나 `npx ctx-deps`는 **작동하지 않습니다**!
>
> - `npx deps-cli` → 다른 패키지 실행됨 (중국어 의존성 업데이트 도구)
> - `npx ctx-deps` → 404 에러 (패키지 없음)
>
> **올바른 사용법**:
> - ✅ **npx**: `npx @context-action/deps-cli`
> - ✅ **짧은 명령어**: 글로벌 설치 후 `deps-cli` 또는 `ctx-deps`

### npx로 바로 사용 (권장)

```bash
# 전체 프로젝트 분석
npx @context-action/deps-cli analyze-enhanced .

# 미사용 파일 찾기
npx @context-action/deps-cli find-unused-files-enhanced

# 특정 파일 사용처 찾기
npx @context-action/deps-cli find-usages-enhanced src/utils/helper.ts

# 특정 메서드 사용처 찾기
npx @context-action/deps-cli find-method-usages-enhanced UserService getUserById

# 미사용 메서드 찾기
npx @context-action/deps-cli find-unused-methods-enhanced
```

### 글로벌 설치

```bash
# 설치
npm install -g @context-action/deps-cli

# 사용 (짧은 명령어 사용 가능)
deps-cli analyze-enhanced .
ctx-deps find-unused-files-enhanced
```

> ⚠️ **중요**: `npx ctx-deps`는 작동하지 않습니다!
> 짧은 명령어를 사용하려면 반드시 글로벌 설치(`-g`) 후 사용하세요.

### 로컬 개발용 설치

```bash
# 프로젝트에 설치
npm install --save-dev @context-action/deps-cli

# package.json scripts에 추가
{
  "scripts": {
    "analyze": "deps-cli analyze-enhanced .",
    "find-unused": "deps-cli find-unused-files-enhanced"
  }
}

# npm 스크립트로 실행
npm run analyze
```

## 📋 명령어 완전 가이드

| 명령어 | 용도 | 실행 시간 | 정확도 |
|--------|------|-----------|--------|
| `analyze-enhanced` | 전체 의존성 분석 | ~0.4초 | 99%+ |
| `find-usages-enhanced` | 파일 사용처 찾기 | ~0.4초 | 100% |
| `find-method-usages-enhanced` | 메서드 사용처 찾기 | ~0.4초 | 99%+ |
| `find-unused-files-enhanced` | 미사용 파일 탐지 | ~0.4초 | 100% |
| `find-unused-methods-enhanced` | 미사용 메서드 탐지 | ~0.4초 | 99%+ |

### 고급 옵션

```bash
# JSON 형식 출력
npx @context-action/deps-cli analyze-enhanced . --format json

# 상세 출력
npx @context-action/deps-cli find-unused-files-enhanced --verbose

# 모든 옵션
npx @context-action/deps-cli <command> --help
```

## 📊 성능 비교

| 항목 | Legacy System | Enhanced System | 개선율 |
|------|---------------|-----------------|--------|
| **정확도** | 87% | **99%+** | +12% |
| **파일 탐지** | 부정확 | **100% 정확** | 완전 해결 |
| **분석 속도** | 40ms+ | **즉시** | 그래프 기반 |
| **아키텍처** | 정규식 | **AST 기반** | 현대적 |

자세한 성능 분석은 [성능 비교 문서](docs/ENHANCED_PERFORMANCE_COMPARISON.md)를 참조하세요.

## 🏗️ 아키텍처

```
Enhanced Dependency Analysis System
├── AST Parser          # TypeScript/JavaScript 구문 분석
├── Export Extractor    # Export 정보 정확 추출
├── Dependency Graph    # 파일 간 의존성 관계 구축
├── Entry Point Detector # 엔트리 포인트 자동 식별
└── Analysis Engine     # 5가지 분석 기능 제공
```

### 핵심 구성 요소

- **EnhancedDependencyAnalyzer**: 메인 분석 엔진
- **AST-based Parsing**: 정확한 구문 분석
- **Absolute Path Resolution**: 경로 해석 오류 방지
- **Memory Caching**: 동일 파일 재파싱 방지

## 📚 문서

- **[명령어 가이드](docs/DEPENDENCY_ANALYSIS_COMMANDS.md)**: 모든 명령어 상세 설명
- **[Enhanced 시스템](docs/ENHANCED_DEPENDENCY_ANALYSIS.md)**: 기술적 세부사항
- **[성능 분석](docs/ENHANCED_PERFORMANCE_COMPARISON.md)**: 정확도 및 성능 비교
- **[아키텍처](docs/ARCHITECTURE.md)**: 시스템 설계 문서

## 🧪 테스트

```bash
# 전체 테스트 실행
npm test

# Enhanced CLI 테스트만 실행
npm test enhanced-cli

# 테스트 커버리지
npm run test:coverage
```

**테스트 결과**: 30/30 통과 (100% 성공률)

## 🔧 개발

### 프로젝트 구조

```
src/
├── bin.ts                           # CLI 엔트리 포인트
├── analyzers/
│   └── EnhancedDependencyAnalyzer.ts # 메인 분석 엔진
├── config/                          # 설정 관리
├── adapters/                        # 환경 어댑터
└── types/                           # 타입 정의
```

### 빌드 & 개발

```bash
# 개발 모드
npm run dev

# 빌드
npm run build

# 린트
npm run lint

# 타입 체크
npm run type-check
```

## 🚀 마이그레이션 가이드

### Legacy → Enhanced 시스템

| Legacy 명령어 | Enhanced 명령어 | 개선사항 |
|---------------|-----------------|----------|
| `analyze` | `analyze-enhanced` | AST 기반, 99%+ 정확도 |
| `find-usages` | `find-usages-enhanced` | TypeScript 완벽 지원 |
| `find-unused-files` | `find-unused-files-enhanced` | False positive 제거 |
| `find-unused-methods` | `find-unused-methods-enhanced` | 정밀한 메서드 분석 |
| `check-exports` | *(통합됨)* | Enhanced 명령어에 포함 |

**Legacy 명령어는 v2.0.0에서 완전히 제거되었습니다.**

## 🤝 기여

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 관련 링크

- [Issues](https://github.com/username/deps-cli/issues)
- [Discussions](https://github.com/username/deps-cli/discussions)
- [Changelog](CHANGELOG.md)

---

**deps-cli v2.0.0** - AST 기반 99%+ 정확도 의존성 분석 시스템 🚀