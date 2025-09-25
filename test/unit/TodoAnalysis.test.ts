/**
 * TODO 주석 분석 기능 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CodeDependencyAnalyzer } from '../../src/analyzers/CodeDependencyAnalyzer.js'

describe('TODO 주석 분석 기능', () => {
  let analyzer: CodeDependencyAnalyzer

  beforeEach(() => {
    analyzer = new CodeDependencyAnalyzer('test-project')
  })

  describe('기본 TODO 주석 감지', () => {
    it('단일 TODO 주석을 올바르게 감지해야 함', async () => {
      const content = `
function testFunction() {
  // TODO: 이 함수를 최적화해야 함
  return "test"
}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(1)
      expect(result.todoAnalysis.items[0].type).toBe('TODO')
      expect(result.todoAnalysis.items[0].content).toBe('이 함수를 최적화해야 함')
      expect(result.todoAnalysis.items[0].line).toBe(3)
    })

    it('다양한 TODO 타입을 감지해야 함', async () => {
      const content = `
// TODO: 할 일
// FIXME: 수정 필요
// HACK: 임시 해결책
// XXX: 위험한 코드
// BUG: 버그 수정 필요
// NOTE: 참고사항
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(6)
      expect(result.todoAnalysis.byType.TODO).toBe(1)
      expect(result.todoAnalysis.byType.FIXME).toBe(1)
      expect(result.todoAnalysis.byType.HACK).toBe(1)
      expect(result.todoAnalysis.byType.XXX).toBe(1)
      expect(result.todoAnalysis.byType.BUG).toBe(1)
      expect(result.todoAnalysis.byType.NOTE).toBe(1)
    })

    it('다양한 주석 형식을 지원해야 함', async () => {
      const content = `
// TODO: JavaScript 스타일 주석
/* TODO: 블록 주석 스타일 */
* TODO: JSDoc 스타일 주석
# TODO: Shell/Python 스타일 주석
<!-- TODO: HTML 주석 스타일 -->
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(5)
      result.todoAnalysis.items.forEach(item => {
        expect(item.type).toBe('TODO')
        expect(item.content).toMatch(/스타일/)
      })
    })
  })

  describe('메타데이터 추출', () => {
    it('우선순위를 올바르게 추출해야 함', async () => {
      const content = `
// TODO (high): 높은 우선순위 작업
// TODO (critical): 중요한 작업
// TODO (low): 낮은 우선순위 작업
// TODO: medium 우선순위 작업 (기본값)
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(4)
      expect(result.todoAnalysis.byPriority.high).toBe(1)
      expect(result.todoAnalysis.byPriority.critical).toBe(1)
      expect(result.todoAnalysis.byPriority.low).toBe(1)
      expect(result.todoAnalysis.byPriority.medium).toBe(1)
      expect(result.todoAnalysis.highPriorityTodos).toHaveLength(2) // high + critical
    })

    it('작성자 정보를 추출해야 함', async () => {
      const content = `
// TODO (@john): 존이 해야 할 작업
// TODO: 작업 내용 @jane
// FIXME (@developer-123): 개발자가 수정해야 함
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      const authors = result.todoAnalysis.items.map(item => item.author).filter(Boolean)
      expect(authors).toContain('john')
      expect(authors).toContain('jane')
      expect(authors).toContain('developer-123')
    })

    it('날짜 정보를 추출해야 함', async () => {
      const content = `
// TODO (2024-01-15): 2024년 1월 15일 작업
// FIXME: 01/20/2024에 수정 필요
// TODO: 이전 날짜 2023-12-01 작업
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      const dates = result.todoAnalysis.items.map(item => item.date).filter(Boolean)
      expect(dates).toContain('2024-01-15')
      expect(dates).toContain('01/20/2024')
      expect(dates).toContain('2023-12-01')

      // 가장 오래된 TODO 검증
      expect(result.todoAnalysis.oldestTodo?.date).toBe('2023-12-01')
    })

    it('카테고리 정보를 추출해야 함', async () => {
      const content = `
// TODO [performance]: 성능 최적화
// FIXME [security]: 보안 이슈
// TODO [ui]: UI 개선
// TODO [performance]: 또 다른 성능 작업
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.byCategory.performance).toBe(2)
      expect(result.todoAnalysis.byCategory.security).toBe(1)
      expect(result.todoAnalysis.byCategory.ui).toBe(1)
    })
  })

  describe('멀티라인 주석 처리', () => {
    it('연속된 주석을 멀티라인으로 처리해야 함', async () => {
      const content = `
function test() {
  // TODO: 이 함수를 리팩토링해야 함
  //       다음과 같은 이유로:
  //       1. 코드가 너무 복잡함
  //       2. 성능이 느림
  return "test"
}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(1)
      const todo = result.todoAnalysis.items[0]
      expect(todo.isMultiline).toBe(true)
      expect(todo.content).toContain('다음과 같은 이유로')
      expect(todo.content).toContain('1. 코드가 너무 복잡함')
      expect(todo.content).toContain('2. 성능이 느림')
    })

    it('독립적인 TODO는 멀티라인으로 처리하지 않아야 함', async () => {
      const content = `
// TODO: 첫 번째 작업
// TODO: 두 번째 작업
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(2)
      result.todoAnalysis.items.forEach(item => {
        expect(item.isMultiline).toBe(false)
      })
    })
  })

  describe('컨텍스트 추출', () => {
    it('주변 코드 컨텍스트를 포함해야 함', async () => {
      const content = `
function calculateTotal(items) {
  let sum = 0
  // TODO: 성능 최적화 필요
  for (const item of items) {
    sum += item.price
  }
  return sum
}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      const todo = result.todoAnalysis.items[0]
      expect(todo.context).toContain('let sum = 0')
      expect(todo.context).toContain('TODO: 성능 최적화 필요')
      expect(todo.context).toContain('for (const item of items)')
    })
  })

  describe('통계 및 메트릭스', () => {
    it('평균 단어 수를 정확히 계산해야 함', async () => {
      const content = `
// TODO: 단일 단어
// FIXME: 두 개 단어
// TODO: 이것은 정말로 다섯 개의 단어
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      // "단일 단어" = 2, "두 개 단어" = 3, "이것은 정말로 다섯 개의 단어" = 5
      // 총 10개, 평균 3.33
      expect(result.todoAnalysis.averageWordsPerTodo).toBeCloseTo(3.33, 2)
    })

    it('빈 TODO는 적절히 처리해야 함', async () => {
      const content = `
// TODO:
// FIXME:
function test() {}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(2)
      result.todoAnalysis.items.forEach(item => {
        expect(item.content).toBe('')
      })
    })
  })

  describe('복합 시나리오', () => {
    it('복잡한 TODO 주석을 올바르게 분석해야 함', async () => {
      const content = `
/**
 * User service for handling user operations
 */
class UserService {
  // TODO (@john, 2024-02-01, high) [security]: Implement proper authentication
  //       - Add JWT token validation
  //       - Check user permissions
  //       - Log security events
  authenticate(user) {
    // FIXME [performance]: This query is too slow
    return this.database.findUser(user.id)
  }

  // NOTE: This method needs documentation
  updateUser(userData) {
    // HACK [temp-fix]: Quick fix for null values
    if (!userData) return null
    return this.database.update(userData)
  }
}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(4)

      // TODO 항목 상세 검증
      const todoItem = result.todoAnalysis.items.find(item =>
        item.type === 'TODO' && item.content.includes('authentication')
      )
      expect(todoItem?.author).toBe('john')
      expect(todoItem?.date).toBe('2024-02-01')
      expect(todoItem?.priority).toBe('high')
      expect(todoItem?.category).toBe('security')
      expect(todoItem?.isMultiline).toBe(true)

      // 통계 검증
      expect(result.todoAnalysis.byType.TODO).toBe(1)
      expect(result.todoAnalysis.byType.FIXME).toBe(1)
      expect(result.todoAnalysis.byType.NOTE).toBe(1)
      expect(result.todoAnalysis.byType.HACK).toBe(1)

      expect(result.todoAnalysis.byPriority.high).toBe(1)
      expect(result.todoAnalysis.byPriority.medium).toBe(3) // 기본값

      expect(result.todoAnalysis.byCategory.security).toBe(1)
      expect(result.todoAnalysis.byCategory.performance).toBe(1)
      expect(result.todoAnalysis.byCategory['temp-fix']).toBe(1)

      expect(result.todoAnalysis.highPriorityTodos).toHaveLength(1)
    })

    it('TODO가 없는 파일도 적절히 처리해야 함', async () => {
      const content = `
function cleanCode() {
  return "완벽한 코드"
}

class PerfectClass {
  method() {
    return true
  }
}
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(0)
      expect(result.todoAnalysis.items).toHaveLength(0)
      expect(result.todoAnalysis.averageWordsPerTodo).toBe(0)
      expect(result.todoAnalysis.oldestTodo).toBeUndefined()
      expect(result.todoAnalysis.highPriorityTodos).toHaveLength(0)
    })
  })

  describe('에지 케이스', () => {
    it('잘못된 형식의 TODO도 기본적으로 감지해야 함', async () => {
      const content = `
// TODO 콜론 없는 형식
//TODO:스페이스 없는 형식
// TODO(잘못된 메타데이터) 내용
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBeGreaterThan(0)
      // 기본적인 감지는 되어야 하지만, 메타데이터는 제대로 추출되지 않을 수 있음
    })

    it('대소문자 구분 없이 TODO를 감지해야 함', async () => {
      const content = `
// todo: 소문자
// Todo: 첫 글자만 대문자
// TODO: 모두 대문자
// tOdO: 혼합
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      expect(result.todoAnalysis.totalCount).toBe(4)
      result.todoAnalysis.items.forEach(item => {
        expect(item.type).toBe('TODO')
      })
    })

    it('코드 내부의 문자열에 있는 TODO는 무시해야 함', async () => {
      const content = `
const message = "TODO: 이것은 문자열 안의 내용"
const template = \`
  TODO: 템플릿 리터럴 안의 내용
\`
// TODO: 실제 주석
`
      const result = await analyzer.analyzeCodeFile(content, 'test.ts')

      // 실제 주석만 감지되어야 함
      expect(result.todoAnalysis.totalCount).toBe(1)
      expect(result.todoAnalysis.items[0].content).toBe('실제 주석')
    })
  })
})