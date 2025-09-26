import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { EnhancedDependencyAnalyzer } from '../src/analyzers/EnhancedDependencyAnalyzer.js'

describe('EnhancedDependencyAnalyzer', () => {
  let analyzer: EnhancedDependencyAnalyzer
  let testProjectPath: string

  beforeEach(() => {
    testProjectPath = join(process.cwd(), 'test-temp-project')

    // 테스트 프로젝트 디렉토리 생성
    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true })
    }

    // src 디렉토리 생성
    const srcPath = join(testProjectPath, 'src')
    if (!existsSync(srcPath)) {
      mkdirSync(srcPath, { recursive: true })
    }

    analyzer = new EnhancedDependencyAnalyzer(testProjectPath)
  })

  afterEach(() => {
    // 테스트 후 정리
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
    analyzer.clearCache()
  })

  describe('기본 기능 테스트', () => {
    it('EnhancedDependencyAnalyzer 인스턴스가 생성되어야 함', () => {
      expect(analyzer).toBeDefined()
      expect(analyzer).toBeInstanceOf(EnhancedDependencyAnalyzer)
    })

    it('clearCache 메서드가 정상 작동해야 함', () => {
      analyzer.clearCache()
      expect(true).toBe(true) // 에러가 발생하지 않으면 성공
    })
  })

  describe('파일 처리 테스트', () => {
    beforeEach(() => {
      // 테스트용 파일들 생성
      writeFileSync(join(testProjectPath, 'src', 'index.ts'), `
import { UserService } from './UserService'
import { helper } from './utils/helper'

const userService = new UserService()
const result = helper.formatData()
console.log(result)
`)

      writeFileSync(join(testProjectPath, 'src', 'UserService.ts'), `
export class UserService {
  getUserById(id: string) {
    return { id, name: 'User' + id }
  }

  getAllUsers() {
    return []
  }
}
`)

      // utils 디렉토리 생성
      const utilsPath = join(testProjectPath, 'src', 'utils')
      if (!existsSync(utilsPath)) {
        mkdirSync(utilsPath, { recursive: true })
      }

      writeFileSync(join(testProjectPath, 'src', 'utils', 'helper.ts'), `
export const helper = {
  formatData() {
    return 'formatted data'
  },

  unusedMethod() {
    return 'never used'
  }
}
`)

      writeFileSync(join(testProjectPath, 'src', 'UnusedFile.ts'), `
export const unusedFunction = () => {
  return 'This file is never imported'
}
`)
    })

    it('buildProjectDependencyGraph를 통해 프로젝트의 모든 TypeScript 파일을 확인할 수 있어야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const files = Array.from(graph.nodes)

      expect(files.length).toBeGreaterThan(0)
      expect(files.some(file => file.includes('index.ts'))).toBe(true)
      expect(files.some(file => file.includes('UserService.ts'))).toBe(true)
      expect(files.some(file => file.includes('helper.ts'))).toBe(true)
      expect(files.some(file => file.includes('UnusedFile.ts'))).toBe(true)
    })

    it('buildProjectDependencyGraph가 의존성 그래프를 생성해야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()

      expect(graph).toBeDefined()
      expect(graph.nodes).toBeDefined()
      expect(graph.edges).toBeDefined()
      expect(graph.entryPoints).toBeDefined()
      expect(graph.exportMap).toBeDefined()
      expect(graph.importMap).toBeDefined()

      // 파일이 그래프에 포함되었는지 확인
      expect(graph.nodes.size).toBeGreaterThan(0)
    })

    it('findUnusedFilesFromGraph가 올바르게 작동해야 함', async () => {
      // package.json이 없는 경우 모든 파일이 엔트리 포인트로 간주되므로
      // 실제 프로젝트와 유사한 구조를 테스트하기 위해 package.json 생성
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-project',
        main: 'src/index.ts'
      }, null, 2))

      const graph = await analyzer.buildProjectDependencyGraph()
      const unusedFiles = analyzer.findUnusedFilesFromGraph(graph)

      expect(Array.isArray(unusedFiles)).toBe(true)
      // package.json이 있으면 엔트리 포인트가 명확해져서 미사용 파일 감지 가능
      // UnusedFile.ts는 어디서도 import되지 않으므로 미사용 파일에 포함되어야 함
      expect(unusedFiles.some(file => file.includes('UnusedFile.ts'))).toBe(true)
    })

    it('findFilesUsingTargetFromGraph가 특정 파일을 사용하는 파일들을 찾아야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const userServiceFile = Array.from(graph.nodes).find(file => file.includes('UserService.ts'))

      if (userServiceFile) {
        const usingFiles = await analyzer.findFilesUsingTargetFromGraph(graph, userServiceFile)

        expect(Array.isArray(usingFiles)).toBe(true)
        // index.ts가 UserService.ts를 import하므로 포함되어야 함
        expect(usingFiles.some(file => file.includes('index.ts'))).toBe(true)
      }
    })

    it('findUnusedMethodsFromGraph가 사용되지 않는 메서드를 찾아야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const unusedMethods = analyzer.findUnusedMethodsFromGraph(graph)

      expect(Array.isArray(unusedMethods)).toBe(true)
      // getAllUsers와 unusedMethod는 사용되지 않으므로 포함되어야 함
      expect(unusedMethods.some(method =>
        method.methodName === 'getAllUsers' || method.methodName === 'unusedMethod'
      )).toBe(true)
    })

    it('findFilesUsingMethodFromGraph가 특정 메서드를 사용하는 파일들을 찾아야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const files = await analyzer.findFilesUsingMethodFromGraph(graph, 'UserService', 'getUserById')

      expect(Array.isArray(files)).toBe(true)
      // getUserById는 사용되지 않으므로 빈 배열이어야 함
      expect(files.length).toBe(0)
    })
  })

  describe('경로 해석 테스트', () => {
    it('resolveImportPath가 상대 경로를 올바르게 해석해야 함', async () => {
      const basePath = join(testProjectPath, 'src', 'index.ts')
      const importPath = './UserService'

      const resolved = await analyzer.resolveImportPath(basePath, importPath)

      expect(resolved).toBeDefined()
      expect(resolved?.includes('UserService.ts')).toBe(true)
    })

    it('isNodeModule이 node_modules 경로를 올바르게 판단해야 함', () => {
      expect(analyzer.isNodeModule('fs')).toBe(true)
      expect(analyzer.isNodeModule('path')).toBe(true)
      expect(analyzer.isNodeModule('./relative-path')).toBe(false)
      expect(analyzer.isNodeModule('../parent-path')).toBe(false)
    })
  })

  describe('엔트리 포인트 식별 테스트', () => {
    beforeEach(() => {
      // package.json 생성
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-project',
        main: 'src/index.ts',
        bin: {
          'test-cli': 'src/cli.ts'
        }
      }, null, 2))

      writeFileSync(join(testProjectPath, 'src', 'cli.ts'), `
#!/usr/bin/env node
console.log('CLI entry point')
`)
    })

    it('identifyEntryPoints가 엔트리 포인트를 올바르게 식별해야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const entryPoints = graph.entryPoints

      expect(Array.isArray(entryPoints)).toBe(true)
      expect(entryPoints.length).toBeGreaterThan(0)

      // main과 bin에 정의된 파일들이 엔트리 포인트로 식별되어야 함
      expect(entryPoints.some(ep => ep.includes('index.ts'))).toBe(true)
      expect(entryPoints.some(ep => ep.includes('cli.ts'))).toBe(true)
    })
  })

  describe('메서드 참조 찾기 테스트', () => {
    beforeEach(() => {
      writeFileSync(join(testProjectPath, 'src', 'service-user.ts'), `
import { DataService } from './DataService'

export class ServiceUser {
  private dataService = new DataService()

  processData() {
    return this.dataService.getData()
  }
}
`)

      writeFileSync(join(testProjectPath, 'src', 'DataService.ts'), `
export class DataService {
  getData() {
    return { data: 'sample' }
  }

  saveData(data: any) {
    console.log('Saving:', data)
  }
}
`)
    })

    it('findMethodReferences가 메서드 참조를 찾아야 함', async () => {
      const graph = await analyzer.buildProjectDependencyGraph()
      const dataServiceFile = Array.from(graph.nodes).find(file => file.includes('DataService.ts'))

      if (dataServiceFile) {
        const references = await analyzer.findMethodReferences(dataServiceFile, 'getData')

        expect(Array.isArray(references)).toBe(true)
        // service-user.ts에서 getData 메서드를 호출하므로 참조가 있어야 함
        expect(references.some(ref => ref.file.includes('service-user.ts'))).toBe(true)
      }
    })
  })

  describe('캐시 기능 테스트', () => {
    beforeEach(() => {
      writeFileSync(join(testProjectPath, 'src', 'simple.ts'), `
export const simple = 'test'
`)
    })

    it('parseWithCache가 캐시를 사용해야 함', async () => {
      const filePath = join(testProjectPath, 'src', 'simple.ts')

      // 첫 번째 파싱
      const result1 = await analyzer.parseWithCache(filePath)
      expect(result1).toBeDefined()

      // 두 번째 파싱 (캐시 사용)
      const result2 = await analyzer.parseWithCache(filePath)
      expect(result2).toBeDefined()

      // 결과가 동일해야 함
      expect(result1).toBe(result2)
    })
  })
})