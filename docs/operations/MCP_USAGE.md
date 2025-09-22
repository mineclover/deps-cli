# MCP (Model Context Protocol) Usage Guide

> 🔗 **문서 위치**: [INDEX.md](../INDEX.md) > Operations > MCP Usage

Claude Code의 Notion MCP 도구를 사용한 문서화 워크플로우 완전 가이드입니다.

## 🎯 개요

이 가이드는 **범용 MCP 도구 사용법**으로, Effect.js뿐만 아니라 모든 기술 문서화 프로젝트에서 재사용할 수 있습니다.

### MCP 도구의 장점
- **구조화된 문서화**: 데이터베이스 기반 체계적 관리
- **관계 매핑**: 문서간 연결 및 참조 관계 자동 관리
- **검색 최적화**: 의미적 검색과 태그 기반 분류
- **협업 지원**: 실시간 편집과 댓글 시스템

## 🗄️ Notion 데이터베이스 구조

### 기본 정보
- **데이터베이스 ID**: `26b48583746080afb3add6b97e6b6c5e`
- **데이터 소스 ID**: `26b48583-7460-8042-96e5-000b7b41e4a4` (페이지 생성 시 사용)
- **접근 URL**: https://www.notion.so/26b48583746080afb3add6b97e6b6c5e

### 스키마 구조
| 속성 | 타입 | 용도 |
|------|------|------|
| `name` | title | 메서드/개념의 이름 |
| `namespace` | text | 네임스페이스 (예: Effect, @effect/cli) |
| `import` | text | import 구문 |
| `description` | text | 상세 설명 |
| `type` | select | 분류 (함수, 생성자, 유틸리티 등) |
| `상위 항목` | relation | 상위 개념과의 관계 |
| `하위 항목` | relation | 하위 예제/관련 항목 |
| `use` | relation | 이 개념을 사용하는 다른 개념들 |
| `be used` | relation | 이 개념이 사용하는 다른 개념들 |

## 🔧 MCP 도구 워크플로우

### 1. 메인 개념 페이지 생성

**목적**: 핵심 개념/메서드를 설명하는 상위 페이지

**Claude Code MCP 사용법**:
```json
{
  \"tool\": \"mcp__notion__notion-create-pages\",
  \"parameters\": {
    \"parent\": {\"data_source_id\": \"26b48583-7460-8042-96e5-000b7b41e4a4\"},
    \"pages\": [{
      \"content\": \"```typescript\\n// 코드 예제와 설명\\n```\\n\\n## 주요 특징\\n\\n- **특징 1**: 상세 설명\\n- **특징 2**: 추가 설명\",
      \"properties\": {
        \"name\": \"개념/메서드 이름\",
        \"namespace\": \"네임스페이스\",
        \"import\": \"import 구문\",
        \"description\": \"상세한 설명과 사용 목적\",
        \"type\": \"분류\"
      }
    }]
  }
}
```

**핵심 속성 설정**:
- `name`: 정확한 이름 (예: \"Effect.gen\", \"Command.make\")
- `namespace`: 소속 네임스페이스 (Effect, @effect/cli 등)
- `import`: 정확한 import 구문 
- `description`: 목적과 특징을 포함한 상세 설명
- `type`: 메서드 분류 (함수, 생성자, 유틸리티 등)

### 2. 코드 예제 페이지 생성 및 연결

**목적**: 실제 사용 예시를 담는 하위 페이지

```json
{
  \"tool\": \"mcp__notion__notion-create-pages\",
  \"parameters\": {
    \"parent\": {\"data_source_id\": \"26b48583-7460-8042-96e5-000b7b41e4a4\"},
    \"pages\": [{
      \"content\": \"```typescript\\n// From: 실제 파일 경로\\n// 실제 프로젝트 코드 예제\\n```\\n\\n## 이 예제의 특징\\n\\n- **타입 안전성**: 구체적 설명\\n- **패턴 활용**: 사용된 패턴 설명\",
      \"properties\": {
        \"name\": \"예제 기능 요약\",
        \"상위 항목\": \"https://www.notion.so/상위페이지URL\"
      }
    }]
  }
}
```

**⚠️ 상위 페이지 연결 중요사항**:
- **속성 이름**: `상위 항목` (데이터베이스 스키마에 정의된 relation)
- **값 형식**: **전체 Notion URL 문자열** 직접 입력
- **URL 형식**: `https://www.notion.so/[32자-page-id]` (대시 제거)
- **주의**: `relation: [{ id: pageId }]` 형식 아님!

### 3. 기존 문서 검색 및 조회

**전체 데이터베이스 조회**:
```json
{
  \"tool\": \"mcp__notion__fetch\",
  \"parameters\": {
    \"id\": \"26b48583746080afb3add6b97e6b6c5e\"
  }
}
```

**특정 페이지 상세 조회**:
```json
{
  \"tool\": \"mcp__notion__fetch\",
  \"parameters\": {
    \"id\": \"[page-id-or-full-url]\"
  }
}
```

**의미적 검색**:
```json
{
  \"tool\": \"mcp__notion__search\",
  \"parameters\": {
    \"query\": \"검색할 키워드나 개념\",
    \"data_source_url\": \"collection://26b48583-7460-8042-96e5-000b7b41e4a4\"
  }
}
```

### 4. 문서 업데이트 및 관리

**속성 업데이트**:
```json
{
  \"tool\": \"mcp__notion__notion-update-page\",
  \"parameters\": {
    \"data\": {
      \"page_id\": \"[page-id]\",
      \"command\": \"update_properties\",
      \"properties\": {
        \"description\": \"업데이트된 설명\",
        \"type\": \"새로운 분류\"
      }
    }
  }
}
```

**콘텐츠 전체 교체**:
```json
{
  \"tool\": \"mcp__notion__notion-update-page\",
  \"parameters\": {
    \"data\": {
      \"page_id\": \"[page-id]\",
      \"command\": \"replace_content\",
      \"new_str\": \"새로운 마크다운 콘텐츠\"
    }
  }
}
```

**부분 콘텐츠 교체**:
```json
{
  \"tool\": \"mcp__notion__notion-update-page\",
  \"parameters\": {
    \"data\": {
      \"page_id\": \"[page-id]\",
      \"command\": \"replace_content_range\",
      \"selection_with_ellipsis\": \"교체할 텍스트의 시작...끝부분\",
      \"new_str\": \"새로운 내용\"
    }
  }
}
```

## 🚨 문제 해결 및 디버깅

### 일반적인 에러와 해결법

#### 1. \"Invalid parent\" 에러
- **증상**: 페이지 생성 시 부모 설정 오류
- **원인**: `database_id` 사용 (잘못됨)
- **해결**: `data_source_id` 사용

#### 2. 관계 설정 실패
- **증상**: 상위 항목 연결이 안됨
- **원인**: 페이지 ID만 사용하거나 잘못된 형식
- **해결**: 전체 Notion URL 문자열 사용

#### 3. 속성 이름 불일치
- **증상**: 속성이 저장되지 않음
- **원인**: 데이터베이스 스키마와 다른 속성명 사용
- **해결**: 정확한 스키마 속성명 확인 후 사용

#### 4. 권한 문제
- **증상**: \"Insufficient permissions\" 에러
- **원인**: Notion 워크스페이스 접근 권한 부족
- **해결**: 워크스페이스에서 데이터베이스 권한 확인

### 디버깅 워크플로우

1. **스키마 확인**: `mcp__notion__fetch`로 데이터베이스 구조 파악
2. **기존 페이지 참조**: 올바른 설정 방법 확인
3. **단계적 접근**: 복잡한 관계 설정 전 단순 페이지부터
4. **응답 로그 확인**: 생성된 페이지 URL과 에러 메시지 분석

## 📋 모범 사례

### 문서화 품질 기준

1. **타입 시그니처**: 정확한 TypeScript 타입 포함
2. **실제 코드**: 프로젝트에서 발췌한 실제 예제 사용
3. **컨텍스트 정보**: `// From: 파일경로` 형태로 출처 명시
4. **특징 설명**: 타입 안전성, 에러 처리 등 핵심 특징 설명
5. **관계 매핑**: 관련 개념들과의 연결 관계 설정

### 효율적인 워크플로우

1. **계층적 접근**: 상위 개념 → 하위 예제 순서로 작성
2. **배치 작업**: 관련된 여러 페이지를 한 번에 생성
3. **검색 활용**: 기존 문서 중복 확인 후 작업
4. **관계 설정**: 생성 후 관련 페이지들과 링크 연결

## 🔄 다른 프로젝트 적용

이 MCP 워크플로우는 Effect.js 외에도 다음과 같은 프로젝트에 활용 가능:

- **React 컴포넌트 라이브러리** 문서화
- **Node.js API** 레퍼런스 구축  
- **TypeScript 유틸리티** 라이브러리 가이드
- **Design System** 컴포넌트 카탈로그
- **DevOps 도구** 사용법 정리

### 적용 시 변경사항
1. **데이터베이스 ID**: 새 프로젝트용 데이터베이스 생성
2. **스키마 조정**: 프로젝트 특성에 맞게 속성 수정
3. **네임스페이스**: 해당 기술 스택에 맞는 네임스페이스 사용
4. **분류 체계**: 프로젝트 특성에 맞는 타입 분류 정의

---

**📚 관련 문서**:
- [Effect.js Guide](../effect-js-guide.md) - Effect.js 특화 문서화
- [API Reference](../api/) - 기술 레퍼런스 구조
- **외부 링크**: [Notion MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)