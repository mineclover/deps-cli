# deps-cli 프로젝트 개요

## 프로젝트 목적
Effect CLI 기반의 코드 분석 및 의존성 관리 도구. 다음 다이어그램에 따른 구현:
- 명령어 처리 → 병렬화 → 단일 코드 파서 → AST → 데이터 추출 → 해석
- 의존성 분석 및 노션 업로드 기능

## 기술 스택
- **기본 프레임워크**: Effect.js + TypeScript
- **CLI**: @effect/cli
- **빌드**: tsup, pnpm
- **테스트**: vitest
- **Lint/Format**: eslint, prettier
- **새로 추가**: @context-action/dependency-linker, tree-sitter

## 현재 구조
```
src/
├── bin.ts                 # CLI 진입점 (레이어 조건부 로딩)
├── Cli.ts                # 메인 CLI 구성
├── commands/             # CLI 명령어들
│   ├── index.ts         # 명령어 배열 관리
│   ├── GreetCommand.ts  # 템플릿 명령어
│   └── Queue*.ts        # 큐 관리 명령어들
├── services/            # 핵심 서비스들
│   ├── CodeParser/      # 이미 구현된 코드 파서
│   │   ├── ICodeParser.ts        # 파서 인터페이스
│   │   ├── CodeParser.ts         # 메인 파서 구현
│   │   └── NamedImportExtractor.ts # import 추출기
│   ├── Queue/           # 큐 시스템 (병렬처리용)
│   └── FileSystem.ts    # 파일시스템 서비스
└── layers/             # Effect 레이어들
```

## 구현 상태
- ✅ Effect CLI 기본 구조
- ✅ CodeParser 서비스 (단일/병렬 파싱)
- ✅ Queue 시스템 (병렬화 지원)
- ✅ 명령어 처리 체계
- 🔄 dependency-linker 통합 필요
- ❌ AST 기반 의존성 추출
- ❌ 노션 업로드 기능

## 특징
- 조건부 레이어 로딩 (성능 최적화)
- Effect.js의 병렬처리 활용
- TypeScript 기반 타입 안전성