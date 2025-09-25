/**
 * TODO 분석 기능 통합 테스트 - 실제 파일과 함께 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { CodeDependencyAnalyzer } from '../../src/analyzers/CodeDependencyAnalyzer.js'

describe('TODO 분석 통합 테스트', () => {
  let testProjectRoot: string
  let analyzer: CodeDependencyAnalyzer

  beforeEach(() => {
    testProjectRoot = path.join(process.cwd(), 'test-todo-project')

    if (!fs.existsSync(testProjectRoot)) {
      fs.mkdirSync(testProjectRoot, { recursive: true })
    }

    analyzer = new CodeDependencyAnalyzer(testProjectRoot)
  })

  afterEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true, force: true })
    }
  })

  describe('실제 파일에서 TODO 분석', () => {
    it('TypeScript 파일에서 TODO 주석을 정확히 분석해야 함', async () => {
      const testFile = path.join(testProjectRoot, 'UserService.ts')
      const content = `/**
 * User management service
 * TODO (@developer, 2024-02-01, high) [security]: 보안 강화 필요
 */
export class UserService {
  private users: User[] = []

  // FIXME [performance]: 데이터베이스 쿼리 최적화 필요
  async findUser(id: string) {
    // NOTE: 임시 구현
    return this.users.find(user => user.id === id)
  }

  // TODO [validation]: 입력 데이터 검증 추가
  //       - 이메일 형식 확인
  //       - 비밀번호 강도 검사
  async createUser(userData: CreateUserData) {
    // HACK: 빠른 수정을 위한 임시 코드
    const newUser = { ...userData, id: Date.now().toString() }
    this.users.push(newUser)
    return newUser
  }
}

interface User {
  id: string
  name: string
  email: string
}

interface CreateUserData {
  name: string
  email: string
}
`

      fs.writeFileSync(testFile, content)

      const result = await analyzer.analyzeCodeFile(testFile)

      // 기본 통계 확인
      expect(result.todoAnalysis.totalCount).toBe(5)
      expect(result.todoAnalysis.byType.TODO).toBe(2)
      expect(result.todoAnalysis.byType.FIXME).toBe(1)
      expect(result.todoAnalysis.byType.NOTE).toBe(1)
      expect(result.todoAnalysis.byType.HACK).toBe(1)

      // 우선순위별 분류
      expect(result.todoAnalysis.byPriority.high).toBe(1)
      expect(result.todoAnalysis.byPriority.medium).toBe(4)

      // 카테고리별 분류
      expect(result.todoAnalysis.byCategory.security).toBe(1)
      expect(result.todoAnalysis.byCategory.performance).toBe(1)
      expect(result.todoAnalysis.byCategory.validation).toBe(1)

      // 고우선순위 TODO 확인
      expect(result.todoAnalysis.highPriorityTodos).toHaveLength(1)
      const highPriorityTodo = result.todoAnalysis.highPriorityTodos[0]
      expect(highPriorityTodo.priority).toBe('high')
      expect(highPriorityTodo.author).toBe('developer')
      expect(highPriorityTodo.date).toBe('2024-02-01')
      expect(highPriorityTodo.category).toBe('security')

      // 멀티라인 TODO 확인
      const multilineTodo = result.todoAnalysis.items.find(item =>
        item.content.includes('입력 데이터 검증') && item.isMultiline
      )
      expect(multilineTodo).toBeDefined()
      expect(multilineTodo!.content).toContain('이메일 형식 확인')
      expect(multilineTodo!.content).toContain('비밀번호 강도 검사')

      // 가장 오래된 TODO
      expect(result.todoAnalysis.oldestTodo?.date).toBe('2024-02-01')
    })

    it('여러 파일의 TODO를 집계 분석할 수 있어야 함', async () => {
      // 여러 테스트 파일 생성
      const files = [
        {
          name: 'api.ts',
          content: `
// TODO [api]: REST API 엔드포인트 추가
// FIXME [auth]: 인증 미들웨어 수정 필요
export const apiRoutes = {};
`
        },
        {
          name: 'utils.ts',
          content: `
// TODO [utils]: 유틸리티 함수 최적화
// NOTE: 레거시 코드 정리 예정
export const helpers = {};
`
        },
        {
          name: 'components.tsx',
          content: `
// TODO [ui]: 접근성 개선 필요
// TODO [ui]: 반응형 디자인 적용
export const Button = () => null;
`
        }
      ]

      const results = []
      for (const file of files) {
        const filePath = path.join(testProjectRoot, file.name)
        fs.writeFileSync(filePath, file.content)
        results.push(await analyzer.analyzeCodeFile(filePath))
      }

      // 전체 통계 집계
      const totalTodos = results.reduce((sum, result) => sum + result.todoAnalysis.totalCount, 0)
      const allCategories = results.flatMap(result => Object.keys(result.todoAnalysis.byCategory))
      const uniqueCategories = [...new Set(allCategories)]

      expect(totalTodos).toBe(6) // 각 파일에 2개씩
      expect(uniqueCategories).toContain('api')
      expect(uniqueCategories).toContain('auth')
      expect(uniqueCategories).toContain('utils')
      expect(uniqueCategories).toContain('ui')
    })

    it('TODO가 없는 파일도 올바르게 처리해야 함', async () => {
      const testFile = path.join(testProjectRoot, 'clean.ts')
      const content = `
/**
 * 완전히 정리된 코드
 * 더 이상 할 일이 없음
 */
export class CleanService {
  getValue(): string {
    return "perfect code"
  }
}
`

      fs.writeFileSync(testFile, content)

      const result = await analyzer.analyzeCodeFile(testFile)

      expect(result.todoAnalysis.totalCount).toBe(0)
      expect(result.todoAnalysis.items).toHaveLength(0)
      expect(result.todoAnalysis.averageWordsPerTodo).toBe(0)
      expect(Object.keys(result.todoAnalysis.byType)).toHaveLength(0)
      expect(result.todoAnalysis.highPriorityTodos).toHaveLength(0)
      expect(result.todoAnalysis.oldestTodo).toBeUndefined()
    })
  })

  describe('다양한 파일 형식 지원', () => {
    it('JavaScript 파일의 TODO도 분석해야 함', async () => {
      const testFile = path.join(testProjectRoot, 'legacy.js')
      const content = `
// TODO: ES6로 리팩토링 필요
function oldFunction() {
  /* FIXME: 성능 이슈 */
  return "legacy";
}
`

      fs.writeFileSync(testFile, content)

      const result = await analyzer.analyzeCodeFile(testFile)

      expect(result.todoAnalysis.totalCount).toBe(2)
      expect(result.todoAnalysis.byType.TODO).toBe(1)
      expect(result.todoAnalysis.byType.FIXME).toBe(1)
    })

    it('JSX/TSX 파일의 TODO도 분석해야 함', async () => {
      const testFile = path.join(testProjectRoot, 'Component.tsx')
      const content = `
import React from 'react';

// TODO [ui]: Props 타입 정의 추가
// FIXME [a11y]: 접근성 속성 누락
export const MyComponent = ({ children }) => {
  return (
    <div>
      {/* NOTE: 임시 스타일링 */}
      {children}
    </div>
  );
};
`

      fs.writeFileSync(testFile, content)

      const result = await analyzer.analyzeCodeFile(testFile)

      // JSX 주석 {/* */}은 현재 지원하지 않으므로 2개만 감지됨
      expect(result.todoAnalysis.totalCount).toBe(2)
      expect(result.todoAnalysis.byCategory.ui).toBe(1)
      expect(result.todoAnalysis.byCategory.a11y).toBe(1)
    })
  })
})