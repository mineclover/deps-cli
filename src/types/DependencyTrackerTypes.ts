// 의존성 추적을 위한 타입 정의

export interface FileUsage {
  filePath: string
  importedBy: FileReference[]
  exports: ExportInfo[]
  isUsed: boolean
}

export interface FileReference {
  filePath: string
  line: number
  importType: 'import' | 'require' | 'dynamic-import'
  importedMembers: string[]
  importStatement: string
}

export interface ExportInfo {
  name: string
  type: 'function' | 'class' | 'variable' | 'type' | 'default'
  isUsed: boolean
  usedBy: ExportReference[]
}

export interface ExportReference {
  filePath: string
  line: number
  memberName: string
  usageType: 'call' | 'access' | 'type-reference' | 'instantiation'
  context: string
}

export interface MethodUsage {
  methodSignature: string
  className?: string
  filePath: string
  isUsed: boolean
  usedBy: MethodReference[]
  visibility: 'public' | 'private' | 'protected'
  isStatic: boolean
  isAsync: boolean
}

export interface MethodReference {
  filePath: string
  line: number
  column: number
  callType: 'direct-call' | 'method-call' | 'property-access'
  context: string
}

export interface UnusedFile {
  filePath: string
  reason: string
  size: number
  lastModified: Date
  exports: string[]
}

export interface UnusedMethod {
  methodName: string
  className?: string
  filePath: string
  line: number
  visibility: 'public' | 'private' | 'protected'
  isStatic: boolean
  reason: string
  potentialImpact: 'low' | 'medium' | 'high'
}

export interface DependencyTrackingResult {
  projectRoot: string
  timestamp: Date
  analysisType: 'file-usage' | 'method-usage' | 'unused-files' | 'unused-methods'
  results: FileUsage[] | MethodUsage[] | UnusedFile[] | UnusedMethod[]
  metadata: {
    totalFiles: number
    totalMethods?: number
    analysisTime: number
    warnings: string[]
  }
}

export interface DependencyTrackerConfig {
  includeNodeModules: boolean
  includeTestFiles: boolean
  fileExtensions: string[]
  excludePatterns: string[]
  methodAnalysisDepth: number
}