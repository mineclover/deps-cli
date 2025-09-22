# Project Structure

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Architecture > Project Structure

프로젝트의 디렉토리 구조와 각 파일의 역할을 설명합니다.

## 📁 디렉토리 구조

```
effect-cli/
├── docs/                    # 📚 문서
│   ├── INDEX.md            # 문서 인덱스
│   ├── architecture/       # 아키텍처 문서
│   ├── configuration/      # 설정 관련
│   ├── development/        # 개발 가이드
│   ├── api/               # API 레퍼런스
│   ├── guides/            # 튜토리얼
│   └── operations/        # 운영 가이드
│
├── src/                    # 🚀 소스 코드
│   ├── commands/          # 프로덕션 명령어
│   │   ├── index.ts       # 명령어 등록
│   │   └── MyCommand.ts   # 개별 명령어
│   │
│   ├── examples/          # 예제 명령어
│   │   ├── config.ts      # 예제 설정
│   │   ├── index.ts       # 예제 등록
│   │   ├── ListCommand.ts # 파일 목록
│   │   ├── CatCommand.ts  # 파일 읽기
│   │   ├── FindCommand.ts # 파일 검색
│   │   └── SampleCommand.ts # 종합 예제
│   │
│   ├── services/          # Effect 서비스
│   │   ├── FileSystem.ts  # 인터페이스
│   │   ├── FileSystemLive.ts # 구현체
│   │   └── FileSystemTest.ts # 테스트용
│   │
│   ├── Cli.ts            # CLI 메인 설정
│   └── bin.ts            # 실행 진입점
│
├── test/                  # 🧪 테스트
│   └── commands/         # 명령어 테스트
│
└── 설정 파일들            # ⚙️ 설정
    ├── package.json      # 패키지 설정
    ├── tsconfig.json     # TypeScript 설정
    ├── eslint.config.js  # ESLint 설정
    └── tsup.config.ts    # 빌드 설정
```

## 🔍 핵심 파일 역할

### CLI 핵심부

| 파일 | 역할 | 설명 |
|------|------|------|
| `src/Cli.ts` | CLI 설정 | 메인 CLI 구조 및 서브커맨드 등록 |
| `src/bin.ts` | 실행 진입점 | Node.js 환경 설정 및 Effect 실행 |

### 명령어 관리

| 디렉토리/파일 | 역할 | 설명 |
|---------------|------|------|
| `src/commands/` | 프로덕션 명령어 | 실제 배포될 명령어들 |
| `src/examples/` | 예제 명령어 | 학습용 예제 (설정으로 on/off) |
| `*/index.ts` | 명령어 등록 | 개별 명령어들을 묶어서 export |

### 서비스 레이어

| 파일 | 역할 | 설명 |
|------|------|------|
| `FileSystem.ts` | 서비스 인터페이스 | 파일시스템 작업 타입 정의 |
| `FileSystemLive.ts` | 실제 구현체 | Node.js 파일시스템 구현 |
| `FileSystemTest.ts` | 테스트 구현체 | 모의(mock) 파일시스템 |

## 🏗️ 설계 원칙

### 관심사 분리 (Separation of Concerns)
- **CLI**: 사용자 인터페이스와 인수 파싱
- **Commands**: 비즈니스 로직과 명령어 구현  
- **Services**: 외부 시스템과의 상호작용
- **Tests**: 각 레이어별 독립 테스트

### 의존성 방향 (Dependency Direction)
```
CLI → Commands → Services
```
- CLI는 Commands에 의존
- Commands는 Services 인터페이스에 의존
- Services는 독립적으로 구현

### 모듈화 (Modularization)
- **Production vs Examples**: 프로덕션과 예제 완전 분리
- **Individual Commands**: 각 명령어는 독립적 파일
- **Service Abstraction**: 구현체를 쉽게 교체 가능

## 🎯 확장 가이드

### 새 명령어 추가
1. `src/commands/NewCommand.ts` 생성
2. `src/commands/index.ts`에 등록
3. 테스트 파일 작성

### 새 서비스 추가
1. 인터페이스 정의 (`src/services/MyService.ts`)
2. 구현체 작성 (`src/services/MyServiceLive.ts`)
3. 테스트용 구현체 (`src/services/MyServiceTest.ts`)
4. `bin.ts`에서 Layer 제공

---
**📚 관련 문서**:
- [CLI Architecture](CLI_ARCHITECTURE.md) - CLI 아키텍처 상세
- [Service Pattern](SERVICE_PATTERN.md) - 서비스 패턴 설명