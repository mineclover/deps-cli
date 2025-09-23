/**
 * 테스트 파일의 의존성을 분석하여 테스트 대상과 유틸리티를 구분하는 분석기
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type { TestDependency } from "../types/DependencyClassification.js"

export interface TestAnalysisResult {
  testTargets: Array<TestDependency> // 테스트 대상 코드
  testUtilities: Array<TestDependency> // 테스트 유틸리티
  testSetup: Array<TestDependency> // 테스트 설정/목업
  testMetadata: {
    framework: string // jest, vitest, mocha 등
    testType: "unit" | "integration" | "e2e" | "component"
    asyncTests: number
    mockCount: number
    assertionCount: number
  }
}

export class TestDependencyAnalyzer {
  private testFrameworkPatterns = {
    jest: ["@jest", "jest"],
    vitest: ["vitest", "@vitest"],
    mocha: ["mocha", "chai"],
    cypress: ["cypress", "@cypress"],
    playwright: ["@playwright", "playwright"]
  }

  private testUtilityPatterns = [
    "@testing-library",
    "enzyme",
    "sinon",
    "nock",
    "supertest",
    "msw"
  ]

  private mockPatterns = [
    "jest.mock",
    "vi.mock",
    "sinon.stub",
    "sinon.spy",
    "cy.intercept"
  ]

  constructor() {}

  async analyzeTestFile(filePath: string): Promise<TestAnalysisResult> {
    const content = await fs.promises.readFile(filePath, "utf-8")
    const dependencies = await this.extractDependencies(content, filePath)

    return {
      testTargets: this.classifyTestTargets(dependencies, content),
      testUtilities: this.classifyTestUtilities(dependencies, content),
      testSetup: this.classifyTestSetup(dependencies, content),
      testMetadata: this.analyzeTestMetadata(content, dependencies)
    }
  }

  private async extractDependencies(content: string, _filePath: string): Promise<Array<any>> {
    const dependencies: Array<any> = []

    // Import/require 문 파싱
    const importRegex = /(?:import|from)\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\)/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1] || match[2]
      if (source) {
        dependencies.push({
          source,
          line: this.getLineNumber(content, match.index),
          importType: match[0].startsWith("import") ? "import" : "require"
        })
      }
    }

    // Dynamic import 파싱
    const dynamicImportRegex = /import\(['"`]([^'"`]+)['"`]\)/g
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dependencies.push({
        source: match[1],
        line: this.getLineNumber(content, match.index),
        importType: "dynamic"
      })
    }

    return dependencies
  }

  private classifyTestTargets(dependencies: Array<any>, content: string): Array<TestDependency> {
    const testTargets: Array<TestDependency> = []

    for (const dep of dependencies) {
      // 상대 경로이면서 테스트 유틸리티가 아닌 경우 테스트 대상으로 분류
      if (this.isRelativePath(dep.source) && !this.isTestUtility(dep.source)) {
        const targetInfo = this.analyzeTestTarget(dep, content)

        testTargets.push({
          source: dep.source,
          resolvedPath: this.resolvePath(dep.source),
          exists: this.checkFileExists(dep.source),
          line: dep.line,
          confidence: this.calculateTargetConfidence(dep, content),
          type: "test-target",
          testType: this.inferTestType(content),
          targetFunction: targetInfo.function,
          targetClass: targetInfo.class,
          mockType: this.detectMockType(dep, content),
          isAsync: this.isAsyncTest(dep, content)
        })
      }
    }

    return testTargets
  }

  private classifyTestUtilities(dependencies: Array<any>, content: string): Array<TestDependency> {
    const testUtilities: Array<TestDependency> = []

    for (const dep of dependencies) {
      if (this.isTestUtility(dep.source) || this.isTestFramework(dep.source)) {
        testUtilities.push({
          source: dep.source,
          resolvedPath: null, // 외부 패키지이므로 null
          exists: true,
          line: dep.line,
          confidence: 0.9,
          type: "test-utility",
          testType: this.inferTestType(content),
          mockType: this.detectMockType(dep, content),
          isAsync: this.isAsyncTest(dep, content)
        })
      }
    }

    return testUtilities
  }

  private classifyTestSetup(dependencies: Array<any>, content: string): Array<TestDependency> {
    const testSetup: Array<TestDependency> = []

    // 설정 파일들을 찾기
    const setupPatterns = [
      "setupTests",
      "test-utils",
      "test-setup",
      "__mocks__",
      "fixtures"
    ]

    for (const dep of dependencies) {
      if (setupPatterns.some((pattern) => dep.source.includes(pattern))) {
        testSetup.push({
          source: dep.source,
          resolvedPath: this.resolvePath(dep.source),
          exists: this.checkFileExists(dep.source),
          line: dep.line,
          confidence: 0.8,
          type: "test-setup",
          testType: this.inferTestType(content),
          mockType: this.detectMockType(dep, content),
          isAsync: false
        })
      }
    }

    return testSetup
  }

  private analyzeTestTarget(dep: any, content: string): { function?: string; class?: string } {
    const result: { function?: string; class?: string } = {}

    // 테스트 대상 함수/클래스 추출
    const describeRegex = /describe\(['"`]([^'"`]+)['"`]/g
    const testRegex = /(?:it|test)\(['"`]([^'"`]+)['"`]/g

    let match
    while ((match = describeRegex.exec(content)) !== null) {
      result.class = match[1]
    }

    while ((match = testRegex.exec(content)) !== null) {
      const testName = match[1]
      // 함수명 추출 시도
      const functionMatch = testName.match(/(\w+)\s*\(/)
      if (functionMatch) {
        result.function = functionMatch[1]
      }
    }

    return result
  }

  private analyzeTestMetadata(content: string, dependencies: Array<any>) {
    return {
      framework: this.detectTestFramework(dependencies),
      testType: this.inferTestType(content),
      asyncTests: this.countAsyncTests(content),
      mockCount: this.countMocks(content),
      assertionCount: this.countAssertions(content)
    }
  }

  private detectTestFramework(dependencies: Array<any>): string {
    for (const [framework, patterns] of Object.entries(this.testFrameworkPatterns)) {
      if (dependencies.some((dep) => patterns.some((pattern) => dep.source.includes(pattern)))) {
        return framework
      }
    }
    return "unknown"
  }

  private inferTestType(content: string): "unit" | "integration" | "e2e" | "component" {
    if (content.includes("cy.") || content.includes("playwright")) return "e2e"
    if (content.includes("render") || content.includes("mount")) return "component"
    if (content.includes("request") || content.includes("supertest")) return "integration"
    return "unit"
  }

  private isTestUtility(source: string): boolean {
    return this.testUtilityPatterns.some((pattern) => source.includes(pattern))
  }

  private isTestFramework(source: string): boolean {
    return Object.values(this.testFrameworkPatterns)
      .flat()
      .some((pattern) => source.includes(pattern))
  }

  private isRelativePath(source: string): boolean {
    return source.startsWith("./") || source.startsWith("../")
  }

  private detectMockType(dep: any, content: string): "jest" | "sinon" | "manual" | "none" {
    if (content.includes("jest.mock")) return "jest"
    if (content.includes("sinon.")) return "sinon"
    if (content.includes("__mocks__")) return "manual"
    return "none"
  }

  private isAsyncTest(dep: any, content: string): boolean {
    return content.includes("async ") || content.includes("await ") || content.includes(".then(")
  }

  private calculateTargetConfidence(dep: any, content: string): number {
    let confidence = 0.5

    // 파일이 실제로 존재하면 +0.3
    if (this.checkFileExists(dep.source)) confidence += 0.3

    // 테스트에서 실제로 사용되는 패턴이 있으면 +0.2
    const sourceName = path.basename(dep.source, path.extname(dep.source))
    if (content.includes(sourceName)) confidence += 0.2

    return Math.min(confidence, 1.0)
  }

  private countAsyncTests(content: string): number {
    const asyncRegex = /(?:it|test)\([^,]+,\s*async/g
    return (content.match(asyncRegex) || []).length
  }

  private countMocks(content: string): number {
    let count = 0
    this.mockPatterns.forEach((pattern) => {
      const regex = new RegExp(pattern, "g")
      count += (content.match(regex) || []).length
    })
    return count
  }

  private countAssertions(content: string): number {
    const assertionPatterns = ["expect\\(", "assert\\.", "should\\.", "chai\\."]
    let count = 0
    assertionPatterns.forEach((pattern) => {
      const regex = new RegExp(pattern, "g")
      count += (content.match(regex) || []).length
    })
    return count
  }

  private resolvePath(source: string): string | null {
    // 실제 경로 해결 로직 (간단한 버전)
    try {
      return path.resolve(source)
    } catch {
      return null
    }
  }

  private checkFileExists(source: string): boolean {
    try {
      return fs.existsSync(this.resolvePath(source) || source)
    } catch {
      return false
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split("\n").length
  }
}

// 테스트 의존성 시각화를 위한 유틸리티
export class TestDependencyVisualizer {
  static generateTestGraph(testResults: Map<string, TestAnalysisResult>): any {
    const graph = {
      nodes: [] as Array<any>,
      edges: [] as Array<any>
    }

    for (const [testFile, result] of testResults.entries()) {
      // 테스트 파일 노드
      graph.nodes.push({
        id: testFile,
        type: "test",
        label: path.basename(testFile),
        metadata: result.testMetadata
      })

      // 테스트 대상 연결
      result.testTargets.forEach((target) => {
        graph.nodes.push({
          id: target.source,
          type: "code",
          label: path.basename(target.source)
        })

        graph.edges.push({
          from: testFile,
          to: target.source,
          type: "tests",
          confidence: target.confidence
        })
      })
    }

    return graph
  }

  static generateCoverageReport(testResults: Map<string, TestAnalysisResult>, allFiles: Array<string>): any {
    const testedFiles = new Set<string>()

    for (const result of testResults.values()) {
      result.testTargets.forEach((target) => {
        if (target.exists) {
          testedFiles.add(target.resolvedPath || target.source)
        }
      })
    }

    const codeFiles = allFiles.filter((file) =>
      !file.includes(".test.") &&
      !file.includes(".spec.") &&
      (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx"))
    )

    return {
      totalFiles: codeFiles.length,
      testedFiles: testedFiles.size,
      coverage: testedFiles.size / codeFiles.length,
      uncoveredFiles: codeFiles.filter((file) => !testedFiles.has(file))
    }
  }
}
