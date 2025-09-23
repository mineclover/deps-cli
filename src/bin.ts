#!/usr/bin/env node

import { DevTools } from "@effect/experimental"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { mergeAll } from "effect/Layer"
import * as Logger from "effect/Logger"
import { simpleCommand } from "./Cli.js"
import * as Command from "@effect/cli/Command"

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

// Simple layer for analyze/classify commands
const SimpleAppLayer = mergeAll(
  NodeContext.layer,
  NodeFileSystem.layer,
  NodePath.layer,
  LoggerLayer
)

// Execute the CLI using correct Effect CLI pattern
const program = Command.run(simpleCommand, {
  name: "Effect CLI Application",
  version: "1.0.0"
})

program.pipe(
  Effect.provide(SimpleAppLayer),
  NodeRuntime.runMain
)
