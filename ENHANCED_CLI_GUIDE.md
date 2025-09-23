# 고도화된 CLI 가이드

## 🚀 새로운 기능들

### 📁 출력 위치 및 파일명 커스터마이징

```bash
# 커스텀 출력 디렉토리 설정
node dist/bin.cjs classify . --output-dir ./custom-analysis

# 커스텀 파일명 설정
node dist/bin.cjs classify . --output-name "project-analysis"

# 결과: ./custom-analysis/project-analysis-metadata.json 생성
```

### 🔍 분석 깊이 및 필터링 옵션

```bash
# 분석 깊이 설정
node dist/bin.cjs classify . --analysis-depth comprehensive
# 옵션: minimal, standard, comprehensive, deep

# 파일 패턴 필터링
node dist/bin.cjs classify . --exclude "*.test.*,**/node_modules/**"
node dist/bin.cjs classify . --include "src/**/*.ts,examples/**"

# 파일 크기 필터링 (bytes)
node dist/bin.cjs classify . --min-file-size 100 --max-file-size 1048576

# 신뢰도 임계값 설정 (0-100%)
node dist/bin.cjs classify . --confidence-threshold 70
```

### 📊 리포트 및 시각화

```bash
# 상세 리포트 생성
node dist/bin.cjs classify . --generate-report

# 시각화 다이어그램 생성 (Mermaid, DOT)
node dist/bin.cjs classify . --generate-viz

# 둘 다 생성
node dist/bin.cjs classify . --generate-report --generate-viz
```

### ⚙️ 고급 성능 옵션

```bash
# 캐싱 비활성화
node dist/bin.cjs classify . --no-enable-cache

# 병렬 처리 비활성화
node dist/bin.cjs classify . --no-parallel

# 메타데이터 출력 비활성화
node dist/bin.cjs classify . --no-output-metadata
```

### 📝 출력 형식 및 압축

```bash
# 다양한 출력 형식
node dist/bin.cjs classify . --format json    # 기본값
node dist/bin.cjs classify . --format sqlite
node dist/bin.cjs classify . --format neo4j
node dist/bin.cjs classify . --format graphml

# 압축 활성화
node dist/bin.cjs classify . --compression

# 증분 분석 모드
node dist/bin.cjs classify . --incremental
```

## 🎯 사용 예시

### 전체 프로젝트 종합 분석

```bash
node dist/bin.cjs classify . \
  --output-dir ./analysis-results \
  --output-name "full-project-analysis" \
  --analysis-depth comprehensive \
  --generate-report \
  --generate-viz \
  --confidence-threshold 70 \
  --verbose
```

### 특정 디렉토리만 집중 분석

```bash
node dist/bin.cjs classify src/ \
  --include "**/*.ts" \
  --exclude "**/*.test.*" \
  --min-file-size 500 \
  --analysis-depth deep \
  --generate-report
```

### 테스트 파일만 분석

```bash
node dist/bin.cjs classify . \
  --node-type test \
  --include "**/*.test.*,**/*.spec.*" \
  --output-name "test-analysis" \
  --generate-viz
```

### 문서 파일 링크 검증

```bash
node dist/bin.cjs classify . \
  --node-type docs \
  --include "**/*.md" \
  --confidence-threshold 80 \
  --generate-report
```

## 📊 생성되는 파일들

### 기본 파일들
- `{output-name}-metadata.json`: 완전한 참조 메타데이터
- `analysis-report.json`: 분석 결과 요약
- `dependency-graph.json`: 의존성 그래프
- `nodes-{type}.json`: 타입별 노드 정보

### 리포트 옵션 활성화 시
- `{output-name}-report.md`: 상세 분석 리포트

### 시각화 옵션 활성화 시
- `{output-name}-diagram.mmd`: Mermaid 다이어그램
- `{output-name}-graph.dot`: Graphviz DOT 파일

## 💡 팁과 권장사항

### 성능 최적화
- 대용량 프로젝트: `--parallel --enable-cache` 활용
- 네트워크 환경: `--confidence-threshold 80` 이상 설정
- 메모리 절약: `--no-output-metadata` 또는 `--exclude "node_modules/**"`

### 효과적인 분석
- 초기 분석: `--analysis-depth standard --generate-report`
- 상세 분석: `--analysis-depth comprehensive --generate-viz`
- 문제 진단: `--analysis-depth deep --confidence-threshold 90`

### 필터링 패턴 예시
```bash
# TypeScript만 분석
--include "**/*.ts,**/*.tsx"

# 테스트 제외
--exclude "**/*.test.*,**/*.spec.*,**/test/**,**/tests/**"

# node_modules와 빌드 결과 제외
--exclude "**/node_modules/**,**/dist/**,**/build/**"

# 특정 디렉토리만
--include "src/**,lib/**" --exclude "**/examples/**"
```

## 🔧 문제 해결

### 옵션이 인식되지 않는 경우
현재 Effect CLI의 제한으로 일부 boolean 옵션들이 정상 작동하지 않을 수 있습니다. 이 경우:

1. 기본값으로 실행: `node dist/bin.cjs classify .`
2. 수동 설정으로 커스터마이징
3. 또는 visualize-dependencies.cjs 도구 활용

### 메모리 부족 시
```bash
# 파일 크기 제한
--max-file-size 1048576  # 1MB

# 신뢰도 임계값 증가
--confidence-threshold 80

# 특정 타입만 분석
--node-type code
```

---

*이 가이드는 deps-cli v1.0.0 기준으로 작성되었습니다.*