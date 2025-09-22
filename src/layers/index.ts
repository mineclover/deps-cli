/**
 * Layer Composition Strategy
 *
 * Hierarchical layer composition for the Effect CLI with queue system integration.
 * Provides different layer configurations for production, development, and testing.
 *
 * Phase 3.3: CLI Layer Integration
 *
 * @version 2.0.0 (Queue Enhanced)
 * @created 2025-01-12
 */

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import { mergeAll, provide } from "effect/Layer"

// Queue System Layers (Phase 1 + Phase 2)
import { BasicQueueSystemLayer, QueueSystemLayer, StabilityQueueSystemLayer } from "../services/Queue/index.js"

// Queue Integration Layer (Phase 3)
import { TransparentQueueAdapterLive } from "../services/Queue/TransparentQueueAdapter.js"

// User Experience Enhancement Layer (Phase 3.4)
import { UserExperienceEnhancerLive } from "../services/UserExperience/index.js"

// Original Service Layer (to be enhanced with queue integration)
import { FileSystemLive } from "../services/FileSystemLive.js"

// ============================================================================
// PRODUCTION LAYERS
// ============================================================================

/**
 * Production CLI Layer with complete queue system integration
 *
 * Includes:
 * - Complete queue system (Phase 1 Foundation + Phase 2 Stability)
 * - Transparent queue adapter for seamless integration
 * - Original services enhanced with queue functionality
 * - Node.js platform context
 */
export const ProductionCliLayer = mergeAll(
  // Platform foundation
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  // Complete queue system (Phases 1 + 2)
  QueueSystemLayer,
  // Transparent queue integration (Phase 3)
  TransparentQueueAdapterLive.pipe(
    provide(QueueSystemLayer)
  ),
  // Original services (FileSystem remains available for non-queue operations if needed)
  FileSystemLive
)

/**
 * Enhanced Production Layer with all Phase 3 features
 *
 * This is the recommended layer for production CLI usage.
 * Includes all queue features, stability monitoring, and user experience enhancements.
 */
export const EnhancedProductionCliLayer = mergeAll(
  ProductionCliLayer,
  // User Experience Enhancement (Phase 3.4)
  UserExperienceEnhancerLive.pipe(
    provide(QueueSystemLayer)
  )
)

// ============================================================================
// DEVELOPMENT LAYERS
// ============================================================================

/**
 * Development CLI Layer for testing and development
 *
 * Uses lighter queue configuration and enables additional debugging features.
 */
export const DevelopmentCliLayer = mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  // Basic queue system for development
  BasicQueueSystemLayer,
  // Queue integration
  TransparentQueueAdapterLive.pipe(
    provide(BasicQueueSystemLayer)
  ),
  // Original services
  FileSystemLive
)

/**
 * Stability Testing Layer
 *
 * Includes full stability features for testing Phase 2 functionality
 */
export const StabilityTestingLayer = mergeAll(
  NodeContext.layer,
  // Full stability queue system
  StabilityQueueSystemLayer,
  // Queue integration
  TransparentQueueAdapterLive.pipe(
    provide(StabilityQueueSystemLayer)
  ),
  // Original services
  FileSystemLive
)

// ============================================================================
// TESTING LAYERS
// ============================================================================

/**
 * Unit Test Layer
 *
 * Lightweight layer for unit testing individual components.
 * Does not require database or file system access.
 */
export const UnitTestLayer = mergeAll(
  // Test queue system (would use mocked implementations)
  BasicQueueSystemLayer,
  // Queue integration
  TransparentQueueAdapterLive.pipe(
    provide(BasicQueueSystemLayer)
  )
  // Note: FileSystemLive would be replaced with FileSystemTest in actual testing
)

/**
 * Integration Test Layer
 *
 * Full integration layer for end-to-end testing of CLI functionality.
 */
export const IntegrationTestLayer = mergeAll(
  NodeContext.layer,
  // Complete queue system
  QueueSystemLayer,
  // Queue integration
  TransparentQueueAdapterLive.pipe(
    provide(QueueSystemLayer)
  ),
  // Real services for integration testing
  FileSystemLive
)

// ============================================================================
// SPECIALIZED LAYERS
// ============================================================================

/**
 * Queue-Only Layer
 *
 * Just the queue system without CLI integration.
 * Useful for queue system testing and standalone queue operations.
 */
export const QueueOnlyLayer = mergeAll(
  NodeContext.layer,
  QueueSystemLayer
)

/**
 * Minimal CLI Layer
 *
 * CLI without queue integration - fallback for environments where
 * queue system cannot be initialized.
 */
export const MinimalCliLayer = mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  FileSystemLive
)

// ============================================================================
// LAYER SELECTION UTILITIES
// ============================================================================

/**
 * Environment-based layer selection
 */
export const getLayerForEnvironment = (env: string = process.env.NODE_ENV || "production") => {
  switch (env) {
    case "development":
      return DevelopmentCliLayer
    case "test":
      return IntegrationTestLayer
    case "stability":
      return StabilityTestingLayer
    case "minimal":
      return MinimalCliLayer
    default:
      return ProductionCliLayer
  }
}

/**
 * Feature-based layer selection
 */
export interface LayerFeatures {
  readonly queue: boolean
  readonly stability: boolean
  readonly transparency: boolean
  readonly userExperience: boolean
}

export const getLayerForFeatures = (features: Partial<LayerFeatures>) => {
  const fullFeatures: LayerFeatures = {
    queue: true,
    stability: true,
    transparency: true,
    userExperience: true,
    ...features
  }

  if (!fullFeatures.queue) {
    return MinimalCliLayer
  }

  let layer = fullFeatures.stability ? StabilityQueueSystemLayer : BasicQueueSystemLayer

  if (fullFeatures.transparency) {
    layer = mergeAll(
      layer,
      TransparentQueueAdapterLive.pipe(provide(layer))
    )
  }

  return mergeAll(
    NodeContext.layer,
    layer,
    FileSystemLive
  )
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

/**
 * Default layer - Production CLI with all features enabled
 */
export const DefaultCliLayer = ProductionCliLayer

/**
 * Recommended layer for most use cases
 */
export const RecommendedLayer = EnhancedProductionCliLayer
