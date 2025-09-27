/**
 * Analysis Result Types for Effect CLI
 *
 * This file contains TypeScript type definitions for the analysis results
 * returned by @context-action/dependency-linker
 */

// Re-export the main types from dependency-linker
export type { AnalysisResult, BatchResult, BatchSummary } from '@context-action/dependency-linker'

/**
 * File index for multi-file output
 */
export interface FileIndex {
  timestamp: string
  totalFiles: number
  files: Array<{
    originalPath: string
    resultFile: string
    success: boolean
    dependencyCount: number
  }>
}

/**
 * Analysis summary for CLI output
 */
export interface AnalysisSummary {
  totalFiles: number
  successfulFiles: number
  failedFiles: number
  totalDependencies: number
  externalDependencies: number
  internalDependencies: number
  analysisTime: number
}

/**
 * Filter options for file analysis
 */
export interface FilterOptions {
  include?: string
  exclude?: string
  maxDepth?: number
  extensions?: Array<string>
  concurrency: number
}

/**
 * Output format types
 */
export type OutputFormat = 'json' | 'summary' | 'table' | 'csv'

/**
 * Analysis preset types
 */
export type AnalysisPreset = 'fast' | 'balanced' | 'comprehensive'

/**
 * Dependency Graph Types (from EnhancedDependencyAnalyzer)
 */
export interface DependencyEdge {
  from: string
  to: string
  importedMembers: string[]
  line?: number
}

export interface DependencyGraph {
  nodes: Set<string>
  edges: Array<DependencyEdge>
  exportMap: Map<string, any>
  importMap: Map<string, any>
  entryPoints: Array<string>
}
