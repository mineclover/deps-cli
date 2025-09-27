/**
 * 역할 기반 분류 시스템
 * 파일과 메서드의 역할을 자동으로 분류
 */

import { basename, dirname, extname } from 'node:path'
import { CodeRole, type FileMetadata, type MethodMetadata, type RoleClassificationRule } from '../types/MappingTypes.js'

export class RoleClassifier {
  private rules: RoleClassificationRule[] = []

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * 기본 분류 규칙 초기화
   */
  private initializeDefaultRules(): void {
    this.rules = [
      // 테스트 파일 (최고 우선순위)
      {
        pattern: /\.(test|spec)\.(ts|js|tsx|jsx)$/,
        role: CodeRole.TEST,
        priority: 100,
        conditions: {
          fileNamePattern: /\.(test|spec)\./,
        },
      },

      // 설정 파일
      {
        pattern: /(config|configuration|settings)\.(ts|js)$/i,
        role: CodeRole.CONFIG,
        priority: 90,
        conditions: {
          fileNamePattern: /(config|configuration|settings|\.config\.)/i,
        },
      },

      // 타입 정의 파일
      {
        pattern: /types?\.(ts|d\.ts)$/i,
        role: CodeRole.TYPE,
        priority: 85,
        conditions: {
          fileNamePattern: /(types?|\.d\.ts)/i,
          directoryPattern: /types?/i,
        },
      },

      // 어댑터 패턴
      {
        pattern: /adapter\.(ts|js)$/i,
        role: CodeRole.ADAPTER,
        priority: 80,
        conditions: {
          fileNamePattern: /adapter/i,
          directoryPattern: /adapters?/i,
        },
      },

      // 서비스 파일
      {
        pattern: /service\.(ts|js)$/i,
        role: CodeRole.SERVICE,
        priority: 75,
        conditions: {
          fileNamePattern: /service/i,
          directoryPattern: /services?/i,
        },
      },

      // 유틸리티 파일
      {
        pattern: /(util|utility|helper)\.(ts|js)$/i,
        role: CodeRole.UTILITY,
        priority: 70,
        conditions: {
          fileNamePattern: /(util|utility|helper)/i,
          directoryPattern: /(utils?|utilities|helpers?)/i,
        },
      },

      // React 컴포넌트
      {
        pattern: /\.(tsx|jsx)$/,
        role: CodeRole.COMPONENT,
        priority: 65,
        conditions: {
          fileNamePattern: /\.(tsx|jsx)$/,
          contentPattern: /import.*react/i,
        },
      },

      // React Hook
      {
        pattern: /use[A-Z].*\.(ts|js)$/,
        role: CodeRole.HOOK,
        priority: 68,
        conditions: {
          fileNamePattern: /^use[A-Z]/,
          directoryPattern: /hooks?/i,
        },
      },

      // 컨트롤러
      {
        pattern: /controller\.(ts|js)$/i,
        role: CodeRole.CONTROLLER,
        priority: 75,
        conditions: {
          fileNamePattern: /controller/i,
          directoryPattern: /controllers?/i,
        },
      },

      // 데이터 모델
      {
        pattern: /(model|entity|schema)\.(ts|js)$/i,
        role: CodeRole.MODEL,
        priority: 70,
        conditions: {
          fileNamePattern: /(model|entity|schema)/i,
          directoryPattern: /(models?|entities|schemas?)/i,
        },
      },

      // 데모/예제 파일
      {
        pattern: /.*$/,
        role: CodeRole.DEMO,
        priority: 30,
        conditions: {
          directoryPattern: /(demo|example|sample)/i,
        },
      },

      // 스크립트 파일
      {
        pattern: /.*$/,
        role: CodeRole.SCRIPT,
        priority: 50,
        conditions: {
          directoryPattern: /(scripts?|build|deploy)/i,
        },
      },

      // 스펙 파일
      {
        pattern: /.*$/,
        role: CodeRole.SPEC,
        priority: 40,
        conditions: {
          directoryPattern: /(specs?|specifications?)/i,
        },
      },

      // 엔트리 포인트 (index, main, bin 파일)
      {
        pattern: /(index|main|bin)\.(ts|js)$/i,
        role: CodeRole.ENTRY_POINT,
        priority: 95,
        conditions: {
          fileNamePattern: /^(index|main|bin)\./i,
        },
      },
    ]

    // 우선순위 순으로 정렬
    this.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 파일의 역할을 분류
   */
  classifyFile(metadata: FileMetadata, content?: string): CodeRole {
    const { relativePath } = metadata
    const fileName = basename(relativePath)
    const directory = dirname(relativePath)

    for (const rule of this.rules) {
      if (this.matchesRule(rule, relativePath, fileName, directory, content)) {
        return rule.role
      }
    }

    // 기본값: 서비스 코드로 분류
    return CodeRole.SERVICE
  }

  /**
   * 메서드의 역할을 분류 (파일 역할 기반)
   */
  classifyMethod(methodMetadata: MethodMetadata, fileMetadata: FileMetadata, content?: string): CodeRole {
    const fileRole = this.classifyFile(fileMetadata, content)

    // 메서드명 기반 세부 분류
    const { name, type } = methodMetadata

    // 테스트 메서드
    if (name.match(/^(test|it|describe|beforeEach|afterEach|setup|teardown)/i)) {
      return CodeRole.TEST
    }

    // 설정 관련 메서드
    if (name.match(/(config|configuration|settings?|init|setup)/i)) {
      return CodeRole.CONFIG
    }

    // 유틸리티 함수
    if (type === 'function' && name.match(/(helper?|util|format|parse|validate|transform)/i)) {
      return CodeRole.UTILITY
    }

    // Hook 패턴
    if (name.match(/^use[A-Z]/)) {
      return CodeRole.HOOK
    }

    // 기본적으로 파일의 역할을 따름
    return fileRole
  }

  /**
   * 규칙이 매치되는지 확인
   */
  private matchesRule(
    rule: RoleClassificationRule,
    fullPath: string,
    fileName: string,
    directory: string,
    content?: string
  ): boolean {
    // 기본 패턴 매치
    const patternMatch =
      typeof rule.pattern === 'string' ? fullPath.includes(rule.pattern) : rule.pattern.test(fullPath)

    if (!patternMatch) return false

    // 추가 조건 확인
    const { conditions } = rule
    if (!conditions) return true

    // 파일명 패턴 확인
    if (conditions.fileNamePattern && !conditions.fileNamePattern.test(fileName)) {
      return false
    }

    // 디렉토리 패턴 확인
    if (conditions.directoryPattern && !conditions.directoryPattern.test(directory)) {
      return false
    }

    // 컨텐츠 패턴 확인
    if (conditions.contentPattern && content && !conditions.contentPattern.test(content)) {
      return false
    }

    // import 패턴 확인 (컨텐츠가 있을 때만)
    if (conditions.importPattern && content) {
      const importLines = content
        .split('\n')
        .filter((line) => line.trim().startsWith('import'))
        .join('\n')

      if (!conditions.importPattern.test(importLines)) {
        return false
      }
    }

    return true
  }

  /**
   * 커스텀 분류 규칙 추가
   */
  addRule(rule: RoleClassificationRule): void {
    this.rules.push(rule)
    this.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 분류 규칙 제거
   */
  removeRule(pattern: string | RegExp): void {
    this.rules = this.rules.filter((rule) => rule.pattern.toString() !== pattern.toString())
  }

  /**
   * 현재 규칙 목록 반환
   */
  getRules(): RoleClassificationRule[] {
    return [...this.rules]
  }

  /**
   * 역할별 통계 계산
   */
  calculateRoleStatistics(files: FileMetadata[]): Map<CodeRole, number> {
    const statistics = new Map<CodeRole, number>()

    for (const file of files) {
      const role = this.classifyFile(file)
      statistics.set(role, (statistics.get(role) || 0) + 1)
    }

    return statistics
  }

  /**
   * 역할 이름을 사람이 읽기 쉬운 형태로 변환
   */
  static getRoleDisplayName(role: CodeRole): string {
    const displayNames: Record<CodeRole, string> = {
      [CodeRole.SERVICE]: '서비스 로직',
      [CodeRole.UTILITY]: '유틸리티',
      [CodeRole.TEST]: '테스트',
      [CodeRole.CONFIG]: '설정',
      [CodeRole.TYPE]: '타입 정의',
      [CodeRole.ADAPTER]: '어댑터',
      [CodeRole.CONTROLLER]: '컨트롤러',
      [CodeRole.MODEL]: '데이터 모델',
      [CodeRole.COMPONENT]: 'UI 컴포넌트',
      [CodeRole.HOOK]: 'React Hook',
      [CodeRole.DEMO]: '데모/예제',
      [CodeRole.SCRIPT]: '스크립트',
      [CodeRole.SPEC]: '스펙/문서',
      [CodeRole.ENTRY_POINT]: '엔트리 포인트',
    }

    return displayNames[role] || role
  }
}
