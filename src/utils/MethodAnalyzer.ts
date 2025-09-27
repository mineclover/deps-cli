/**
 * 메서드 분석 유틸리티
 * 소스 파일에서 메서드, 함수, 클래스 등을 추출하는 가벼운 시스템
 */

import { readFile } from 'node:fs/promises'
import type { FileId, MethodId, MethodMetadata } from '../types/MappingTypes.js'
import { IdGenerator } from './IdGenerator.js'

export interface MethodAnalysisResult {
  methods: MethodMetadata[]
  classes: string[]
  interfaces: string[]
  types: string[]
  exports: string[]
}

export class MethodAnalyzer {
  /**
   * 파일에서 메서드 정보 추출 (가벼운 정규식 기반)
   */
  static async analyzeFile(filePath: string, fileId: FileId): Promise<MethodAnalysisResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return MethodAnalyzer.analyzeContent(content, fileId)
    } catch (error) {
      console.warn(`메서드 분석 실패: ${filePath}`, error)
      return MethodAnalyzer.createEmptyResult()
    }
  }

  /**
   * 컨텐츠에서 메서드 정보 추출
   */
  static analyzeContent(content: string, fileId: FileId): MethodAnalysisResult {
    const lines = content.split('\n')
    const methods: MethodMetadata[] = []
    const classes: string[] = []
    const interfaces: string[] = []
    const types: string[] = []
    const exports: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1

      // 함수 감지 (function, arrow function, method)
      const functionMatch = MethodAnalyzer.detectFunction(line, lineNumber, fileId)
      if (functionMatch) {
        methods.push(functionMatch)
      }

      // 클래스 감지
      const classMatch = MethodAnalyzer.detectClass(line, lineNumber, fileId)
      if (classMatch) {
        methods.push(classMatch)
        classes.push(classMatch.name)
      }

      // 인터페이스 감지
      const interfaceMatch = MethodAnalyzer.detectInterface(line, lineNumber, fileId)
      if (interfaceMatch) {
        methods.push(interfaceMatch)
        interfaces.push(interfaceMatch.name)
      }

      // 타입 감지
      const typeMatch = MethodAnalyzer.detectType(line, lineNumber, fileId)
      if (typeMatch) {
        methods.push(typeMatch)
        types.push(typeMatch.name)
      }

      // export 감지
      const exportMatch = MethodAnalyzer.detectExport(line)
      if (exportMatch) {
        exports.push(exportMatch)
      }
    }

    return {
      methods,
      classes,
      interfaces,
      types,
      exports,
    }
  }

  /**
   * 함수 감지 (가벼운 패턴 매칭)
   */
  private static detectFunction(line: string, lineNumber: number, fileId: FileId): MethodMetadata | null {
    const trimmed = line.trim()

    // function declaration
    const funcDeclMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/)
    if (funcDeclMatch) {
      return MethodAnalyzer.createMethodMetadata(
        funcDeclMatch[1],
        trimmed,
        'function',
        lineNumber,
        fileId,
        trimmed.includes('export')
      )
    }

    // arrow function assignment
    const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/)
    if (arrowMatch) {
      return MethodAnalyzer.createMethodMetadata(
        arrowMatch[1],
        trimmed,
        'function',
        lineNumber,
        fileId,
        trimmed.includes('export')
      )
    }

    // method in class/object
    const methodMatch = trimmed.match(/^(?:public|private|protected|static)?\s*(?:async\s+)?(\w+)\s*\(/)
    if (methodMatch && !trimmed.includes('=')) {
      return MethodAnalyzer.createMethodMetadata(methodMatch[1], trimmed, 'method', lineNumber, fileId, false)
    }

    return null
  }

  /**
   * 클래스 감지
   */
  private static detectClass(line: string, lineNumber: number, fileId: FileId): MethodMetadata | null {
    const trimmed = line.trim()
    const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/)

    if (classMatch) {
      return MethodAnalyzer.createMethodMetadata(
        classMatch[1],
        trimmed,
        'class',
        lineNumber,
        fileId,
        trimmed.includes('export')
      )
    }

    return null
  }

  /**
   * 인터페이스 감지
   */
  private static detectInterface(line: string, lineNumber: number, fileId: FileId): MethodMetadata | null {
    const trimmed = line.trim()
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/)

    if (interfaceMatch) {
      return MethodAnalyzer.createMethodMetadata(
        interfaceMatch[1],
        trimmed,
        'interface',
        lineNumber,
        fileId,
        trimmed.includes('export')
      )
    }

    return null
  }

  /**
   * 타입 감지
   */
  private static detectType(line: string, lineNumber: number, fileId: FileId): MethodMetadata | null {
    const trimmed = line.trim()
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)/)

    if (typeMatch) {
      return MethodAnalyzer.createMethodMetadata(
        typeMatch[1],
        trimmed,
        'type',
        lineNumber,
        fileId,
        trimmed.includes('export')
      )
    }

    return null
  }

  /**
   * export 감지
   */
  private static detectExport(line: string): string | null {
    const trimmed = line.trim()

    // export { name }
    const namedExportMatch = trimmed.match(/export\s*\{\s*([^}]+)\s*\}/)
    if (namedExportMatch) {
      return namedExportMatch[1]
        .split(',')
        .map((s) => s.trim())
        .join(', ')
    }

    // export default
    if (trimmed.includes('export default')) {
      return 'default'
    }

    return null
  }

  /**
   * MethodMetadata 생성 헬퍼
   */
  private static createMethodMetadata(
    name: string,
    signature: string,
    type: MethodMetadata['type'],
    lineNumber: number,
    fileId: FileId,
    exported: boolean
  ): MethodMetadata {
    const methodId = IdGenerator.generateContentHash(`${fileId}::${name}::${signature}`) as MethodId

    return {
      id: methodId,
      name,
      signature,
      type,
      exported,
      startLine: lineNumber,
      endLine: lineNumber, // 실제 구현에서는 더 정확하게 계산 가능
      parentId: fileId,
      hash: IdGenerator.generateContentHash(signature),
    }
  }

  /**
   * 빈 결과 생성
   */
  private static createEmptyResult(): MethodAnalysisResult {
    return {
      methods: [],
      classes: [],
      interfaces: [],
      types: [],
      exports: [],
    }
  }

  /**
   * 메서드 시그니처 정규화
   */
  static normalizeSignature(signature: string): string {
    return signature
      .replace(/\s+/g, ' ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .replace(/\s*:\s*/g, ': ')
      .trim()
  }

  /**
   * 메서드 복잡도 추정 (선택적)
   */
  static estimateComplexity(content: string, startLine: number, endLine: number): number {
    const methodContent = content
      .split('\n')
      .slice(startLine - 1, endLine)
      .join('\n')

    // 간단한 복잡도 추정 (if, for, while, try, catch 등의 개수)
    const complexityPatterns = [
      /\bif\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\btry\s*\{/g,
      /\bcatch\s*\(/g,
      /\bswitch\s*\(/g,
      /&&|\|\|/g,
    ]

    let complexity = 1 // 기본 복잡도

    for (const pattern of complexityPatterns) {
      const matches = methodContent.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    }

    return complexity
  }
}
