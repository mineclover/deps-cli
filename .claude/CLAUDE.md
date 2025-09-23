# deps-cli Project Guidelines

## Project Overview

deps-cli는 코드 분석 및 문서 관리를 위한 통합 CLI 도구입니다. Commander.js 기반으로 구축되었으며, TypeScript/JavaScript 프로젝트의 의존성을 분석하고 Notion과의 연동을 통한 문서 관리를 지원하는 것을 목표로 합니다.

## 개발 로드맵 및 현황 관리

### 📋 로드맵 문서
- **주요 문서**: `docs/ROADMAP.md` - 전체 개발 계획 및 현황
- **현재 상태**: Phase 0 완료 (핵심 분석 엔진)
- **다음 목표**: Phase 1 (설정 관리 시스템)

### 🎯 현재 구현 상태 (v1.0.0)
- ✅ TypeScript/JavaScript 코드 분석
- ✅ 의존성 추출 및 분류
- ✅ 병렬 처리 지원
- ✅ CLI 옵션 정리 완료
- ✅ 메타데이터 생성

### 🚀 향후 계획
1. **Phase 1**: 설정 관리 시스템 (Target: 2025-10-15)
2. **Phase 2**: 데이터 저장소 (Target: 2025-11-15)
3. **Phase 3**: Notion 연동 (Target: 2025-12-20)
4. **Phase 4**: 린트 시스템 (Target: 2026-01-15)

자세한 내용은 `docs/ROADMAP.md`를 참조하세요.

## Testing Conventions

- 테스트 작업 시 `@docs/testing/` 컨벤션을 따라 작업합니다
- 새로 발견된 문제에 의해 컨벤션이 제안해야 할 사례가 있을 경우 제안 문서를 작성합니다

## Project Structure

This is a Commander.js CLI project with the following key directories:
- `src/` - Source code
- `test/` - Test files
- `docs/` - Documentation (including ROADMAP.md)
- `.claude/` - Claude-specific configuration and commands

## 개발 가이드라인

### 새로운 기능 개발
1. `docs/ROADMAP.md`에서 현재 Phase 확인
2. 해당 Phase의 계획된 기능 범위 내에서 작업
3. 새로운 CLI 명령어 추가 시 Commander.js 패턴 따르기
4. 테스트 커버리지 유지