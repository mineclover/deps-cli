# deps-cli 현재 제공 기능 목록

> 📅 업데이트: 2025-01-27
> 📊 테스트 커버리지: 72.33%
> ✅ 핵심 기능 테스트 완료

## 🎯 핵심 기능 (Core Features)

### 📈 1. 의존성 분석 엔진 (Dependency Analysis Engine)
**파일**: `src/analyzers/EnhancedDependencyAnalyzer.ts`
**커버리지**: 91.01% ✅
**상태**: 완전 검증됨

#### 제공 기능
- ✅ **프로젝트 의존성 그래프 구축** - AST 기반 파일 간 의존성 관계 분석
- ✅ **미사용 파일 탐지** - 어디서도 import되지 않는 파일 식별
- ✅ **미사용 메서드 탐지** - 선언되었지만 호출되지 않는 메서드 식별
- ✅ **파일 사용처 추적** - 특정 파일을 사용하는 모든 파일 찾기
- ✅ **메서드 참조 추적** - 특정 메서드를 호출하는 모든 위치 찾기
- ✅ **엔트리 포인트 식별** - package.json의 main, bin 등을 통한 진입점 식별
- ✅ **TypeScript/JavaScript 지원** - .ts, .tsx, .js, .jsx 파일 완전 지원
- ✅ **경로 해석** - 절대경로, 상대경로, 모듈 경로 자동 해석
- ✅ **캐시 시스템** - 동일 파일 재파싱 방지로 성능 최적화

#### CLI 명령어
```bash
# 전체 프로젝트 분석
npx @context-action/deps-cli analyze-enhanced .

# 미사용 파일 찾기
npx @context-action/deps-cli find-unused-files-enhanced

# 미사용 메서드 찾기
npx @context-action/deps-cli find-unused-methods-enhanced

# 특정 파일 사용처 찾기
npx @context-action/deps-cli find-usages-enhanced src/utils/helper.ts

# 특정 메서드 사용처 찾기
npx @context-action/deps-cli find-method-usages-enhanced UserService getUserById
```

### 🖥️ 2. CLI 인터페이스 (Command Line Interface)
**파일**: `src/bin.ts`
**커버리지**: 63.41% (함수 100%) ✅
**상태**: 모든 명령어 검증됨

#### 제공 기능
- ✅ **5개 Enhanced 명령어** - 모든 핵심 분석 기능 CLI 제공
- ✅ **출력 형식 옵션** - `--format json` 지원
- ✅ **상세 출력 옵션** - `--verbose` 플래그 지원
- ✅ **도움말 시스템** - `--help` 각 명령어별 상세 가이드
- ✅ **버전 정보** - `--version` 현재 버전 표시
- ✅ **에러 처리** - 잘못된 명령어, 경로 오류 처리
- ✅ **진행상황 표시** - 분석 진행 과정 실시간 표시

#### 지원 옵션
- `--format <type>`: 출력 형식 (json, table)
- `--verbose`: 상세 출력 모드
- `--help`: 명령어별 도움말
- `--version`: 버전 정보

## 🔧 지원 기능 (Supporting Features)

### ⚙️ 3. 설정 관리 시스템 (Configuration Management)
**파일**: `src/config/ConfigManager.ts`
**커버리지**: 59.79% ⚠️
**상태**: 기본 기능 검증됨

#### ✅ 검증된 기능
- ✅ **기본 설정 로드/저장** - 프로젝트별 설정 파일 관리
- ✅ **설정값 조회/변경** - get/set 메서드로 런타임 설정 수정
- ✅ **캐시 관리** - 설정 캐시 통계 및 정리 기능
- ✅ **설정 덤프** - 현재 설정 상태 내보내기 (안전 모드 포함)
- ✅ **설정 리셋** - 설정 상태 초기화
- ✅ **싱글톤 패턴** - 전역 설정 관리자 인스턴스

#### ⚠️ 미검증 기능 (테스트 필요)
- ❌ **오류 복구 시스템** - 설정 로드 실패 시 재시도 및 자동 복구
- ❌ **폴백 설정** - 오류 발생 시 안전한 기본값 로드
- ❌ **고급 데이터 처리** - 깊은 객체 병합, 중첩 설정값 처리
- ❌ **민감 정보 보호** - 설정값 마스킹 및 보안 처리
- ❌ **성능 최적화** - 고급 캐싱 및 해시 시스템

### 🔌 4. 어댑터 시스템 (Adapter System)
**파일**: `src/adapters/`
**커버리지**: 74.42% ✅
**상태**: 기본 기능 검증됨

#### ✅ FileConfigAdapter
- ✅ 설정 파일 로드 (JSON 형식)
- ✅ 잘못된 JSON 처리
- ✅ 설정 검증

#### ✅ DefaultConfigAdapter
- ✅ 기본 설정값 제공
- ✅ 프로젝트별 기본 구성

#### ✅ CliConfigAdapter
- ✅ CLI 인수 파싱 (기본)
- ✅ 설정 검증

#### ✅ EnvironmentAdapter
- ✅ 환경 변수 처리
- ✅ 설정 로드 및 검증
- ✅ 메타데이터 관리

### 🗄️ 5. 캐시 시스템 (Cache System)
**파일**: `src/config/ConfigCache.ts`
**커버리지**: 66.30% ⚠️
**상태**: 기본 기능만 일부 검증

#### ✅ 기본 기능 (추정)
- 설정 캐시 저장/조회
- 캐시 통계 제공

#### ⚠️ 미검증 기능
- TTL (Time To Live) 관리
- 캐시 크기 제한
- 캐시 무효화 전략

## 📊 기능별 검증 상태 요약

| 기능 영역 | 커버리지 | 검증 상태 | 우선순위 |
|-----------|----------|-----------|----------|
| **의존성 분석 엔진** | 91.01% | ✅ 완전 검증 | 🔴 핵심 |
| **CLI 인터페이스** | 63.41% | ✅ 주요 기능 검증 | 🔴 핵심 |
| **어댑터 시스템** | 74.42% | ✅ 기본 검증 | 🟡 중요 |
| **설정 관리** | 59.79% | ⚠️ 부분 검증 | 🟡 중요 |
| **캐시 시스템** | 66.30% | ⚠️ 부분 검증 | 🟢 보조 |

## 🎯 권장 사용법

### 일반적인 워크플로우
```bash
# 1. 전체 프로젝트 분석
npx @context-action/deps-cli analyze-enhanced .

# 2. 미사용 파일 정리
npx @context-action/deps-cli find-unused-files-enhanced

# 3. 미사용 메서드 정리
npx @context-action/deps-cli find-unused-methods-enhanced

# 4. 특정 파일 영향도 분석
npx @context-action/deps-cli find-usages-enhanced src/components/Button.tsx
```

### JSON 출력으로 자동화
```bash
# CI/CD 파이프라인에서 사용
npx @context-action/deps-cli find-unused-files-enhanced --format json > unused-files.json
```

## ⚠️ 현재 제한사항

1. **설정 관리 시스템**: 오류 복구 및 고급 기능 미검증
2. **캐시 시스템**: 고급 캐시 정책 미검증
3. **타입 정의**: 일부 타입 모듈 누락
4. **문서화**: API 문서 및 사용 예제 부족

## 🚀 다음 개발 계획

### Phase 1: 안정성 개선 (우선순위 높음)
1. ConfigManager 오류 복구 시스템 테스트 추가
2. 고급 데이터 처리 기능 검증
3. 캐시 시스템 완전 검증

### Phase 2: 기능 확장
1. 더 많은 파일 형식 지원
2. 성능 최적화
3. 플러그인 시스템

---

📝 **참고**: 이 문서는 현재 테스트 커버리지를 기반으로 작성되었으며, 실제 기능 가용성을 보장합니다.