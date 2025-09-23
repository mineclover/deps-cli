/**
 * Effect 기반 메타데이터 서비스
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { MetadataExtractor } from '../analyzers/MetadataExtractor.js'
import type { ProjectReferenceData } from '../types/ReferenceMetadata.js'
import type { UnifiedAnalysisResult } from '../analyzers/UnifiedDependencyAnalyzer.js'

export interface MetadataService {
  readonly extractMetadata: (result: UnifiedAnalysisResult) => Effect.Effect<ProjectReferenceData, Error>
  readonly clearCache: () => Effect.Effect<void>
}

export const MetadataService = Context.GenericTag<MetadataService>("MetadataService")

export const MetadataServiceLive = Layer.effect(
  MetadataService,
  Effect.gen(function* () {
    const extractors = new Map<string, MetadataExtractor>()

    return {
      extractMetadata: (result: UnifiedAnalysisResult) =>
        Effect.gen(function* () {
          const projectRoot = result.graph.projectRoot || process.cwd()

          let extractor = extractors.get(projectRoot)
          if (!extractor) {
            extractor = new MetadataExtractor(projectRoot)
            extractors.set(projectRoot, extractor)
          }

          return extractor.extractMetadata(result)
        }),

      clearCache: () =>
        Effect.sync(() => {
          extractors.clear()
        })
    }
  })
)