#!/usr/bin/env node

import { DevTools } from "@effect/experimental"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { mergeAll } from "effect/Layer"
import * as Logger from "effect/Logger"
import { run } from "./Cli.js"
import { BasicQueueSystemLayer } from "./services/Queue/index.js"

/**
 * Phase 3.3: CLI Layer Integration
 *
 * CLI setup with controlled logging for production use
 * - Platform services with queue integration
 * - Configurable log levels for cleaner output
 */

const DevToolsLive = DevTools.layer()

// Log level configuration - only show warnings and errors by default in production
const isProduction = process.env.NODE_ENV === "production"
const isQuiet = process.env.LOG_LEVEL === "error" || (!process.env.LOG_LEVEL && isProduction)

const LoggerLayer = Logger.replace(
  Logger.defaultLogger,
  isQuiet
    ? Logger.none // No logging in production unless explicitly requested
    : Logger.stringLogger // Default logging for development
)

// Absolute minimal layer - just platform services without complex queue dependencies
const AppLayer = mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  LoggerLayer
)

// Check if command needs queue system
const needsQueueSystem = (argv: Array<string>) => {
  const commandKeywords = ["queue", "queue-status", "queue-demo"]
  return commandKeywords.some((keyword) => argv.includes(keyword))
}

// Simple layer for non-queue commands
const SimpleAppLayer = mergeAll(
  AppLayer
  // No DevTools or Queue system for simple commands
)

// Complete application layer with queue integration
const FullAppLayer = mergeAll(
  AppLayer,
  BasicQueueSystemLayer,
  DevToolsLive
)

// Choose layer based on command
const selectedLayer = needsQueueSystem(process.argv) ? FullAppLayer : SimpleAppLayer

run(process.argv).pipe(
  Effect.provide(selectedLayer) as any,
  NodeRuntime.runMain
)
