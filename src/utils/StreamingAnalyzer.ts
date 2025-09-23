/**
 * 메모리 효율적인 스트리밍 분석기
 */

import * as fs from 'node:fs'
import * as readline from 'node:readline'

export class StreamingAnalyzer {
  private maxFileSize = 10 * 1024 * 1024 // 10MB

  async analyzeFileStream(filePath: string): Promise<boolean> {
    const stats = await fs.promises.stat(filePath)

    // 큰 파일은 스트리밍으로 처리
    if (stats.size > this.maxFileSize) {
      return this.analyzeWithStreaming(filePath)
    }

    return false // 일반 분석 사용
  }

  private async analyzeWithStreaming(filePath: string): Promise<boolean> {
    const fileStream = fs.createReadStream(filePath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    let lineCount = 0
    for await (const line of rl) {
      lineCount++
      // 라인별 처리 로직
      if (lineCount > 10000) {
        console.warn(`⚠️ 파일이 너무 큽니다: ${filePath} (${lineCount} lines)`)
        break
      }
    }

    return true
  }
}