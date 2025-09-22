/**
 * Enhanced List Command with Queue Integration
 * 
 * Transparent queue integration for directory listing operations.
 * Users experience identical behavior while benefiting from automatic
 * queue management, resource optimization, and system stability.
 * 
 * Phase 3.2: Queue-Enhanced Commands
 * 
 * @version 2.0.0 (Queue Enhanced)
 * @created 2025-01-12
 */

import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { filter } from "effect/Array"
import { log, error } from "effect/Console"
import * as Effect from "effect/Effect"

import { TransparentQueueAdapter, type FileInfo } from "../services/Queue/TransparentQueueAdapter.js"

// ============================================================================
// COMMAND ARGUMENTS AND OPTIONS
// ============================================================================

const pathArg = Args.directory({ name: "path" }).pipe(
  Args.withDefault(".")
)

const longOption = Options.boolean("long").pipe(
  Options.withAlias("l"),
  Options.withDescription("Use long listing format")
)

const allOption = Options.boolean("all").pipe(
  Options.withAlias("a"),
  Options.withDescription("Show hidden files")
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format file size for display
 */
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)}${units[unitIndex]}`
}

/**
 * Format file information for display
 */
const formatFileInfo = (file: FileInfo, long: boolean): string => {
  const prefix = file.isDirectory ? "📁" : "📄"
  const name = file.isDirectory ? `${file.name}/` : file.name

  if (long) {
    const size = formatFileSize(file.size)
    const type = file.isDirectory ? "DIR" : "FILE"
    const modTime = file.lastModified.toLocaleDateString()
    const permissions = file.permissions
    
    return `${prefix} ${type.padEnd(4)} ${size.padStart(8)} ${modTime.padStart(10)} ${permissions.padStart(10)} ${name}`
  }

  return `${prefix} ${name}`
}

/**
 * Show progress indicator for long operations
 */
const showProgress = (message: string) => 
  Effect.gen(function* () {
    process.stdout.write(`${message}... `)
  })

/**
 * Clear progress indicator
 */
const clearProgress = () =>
  Effect.gen(function* () {
    process.stdout.write('\r' + ' '.repeat(50) + '\r')
  })

// ============================================================================
// ENHANCED LIST COMMAND
// ============================================================================

/**
 * Enhanced directory listing command with transparent queue integration
 * 
 * Features:
 * - Automatic queue management for file system operations
 * - Resource group optimization (filesystem queue)
 * - Progress indication for large directories
 * - Enhanced error handling with queue context
 * - Identical user experience to original command
 */
export const enhancedListCommand = Command.make("ls", {
  path: pathArg,
  long: longOption,
  all: allOption
}).pipe(
  Command.withDescription("List directory contents (queue-enhanced for optimal performance)"),
  Command.withHandler(({ all, long, path }) =>
    Effect.gen(function* () {
      // Get transparently queued file system operations
      const adapter = yield* TransparentQueueAdapter
      const queuedFs = adapter.wrapFileSystem()

      yield* Effect.log(`📁 Listing directory: ${path}`)
      
      // Show progress for potentially long operations
      yield* showProgress("Scanning directory")

      try {
        // This call is automatically queued but appears transparent to the user
        const files = yield* queuedFs.listDirectory(path)
        
        yield* clearProgress()
        
        // Filter hidden files if not showing all
        const filteredFiles = all
          ? files
          : filter(files, (file) => !file.name.startsWith("."))

        if (filteredFiles.length === 0) {
          yield* log("📂 Empty directory")
          return
        }

        // Display header for long format
        if (long) {
          yield* log("Type Size     Modified   Permissions Name")
          yield* log("---- -------- ---------- ---------- ----")
        }

        // Display files
        yield* Effect.forEach(filteredFiles, (file) => 
          log(formatFileInfo(file, long))
        )

        // Summary statistics
        const dirCount = filter(filteredFiles, (f) => f.isDirectory).length
        const fileCount = filteredFiles.length - dirCount
        
        yield* log("")
        yield* log(`📊 Total: ${fileCount} files, ${dirCount} directories`)

        // Enhanced information in long mode
        if (long) {
          const totalSize = filteredFiles.reduce((sum, file) => sum + file.size, 0)
          yield* log(`💾 Total size: ${formatFileSize(totalSize)}`)
        }

        yield* Effect.log("✅ Directory listing completed")

      } catch (error) {
        yield* clearProgress()
        
        // Enhanced error handling with queue context
        if (error instanceof Error) {
          yield* error(`❌ Failed to list directory: ${error.message}`)
          
          // Provide helpful suggestions
          if (error.message.includes("permission")) {
            yield* error("💡 Try running with appropriate permissions or choose a different directory")
          } else if (error.message.includes("not found")) {
            yield* error("💡 Check if the directory path exists and is accessible")
          } else {
            yield* error("💡 Use 'queue status' to check if the system is experiencing issues")
          }
        } else {
          yield* error(`❌ Unexpected error: ${String(error)}`)
        }
        
        yield* Effect.log(`❌ Directory listing failed for: ${path}`)
      }
    })
  )
)

// ============================================================================
// COMPATIBILITY EXPORT
// ============================================================================

/**
 * Alias for backward compatibility
 * Existing imports will continue to work unchanged
 */
export const listCommand = enhancedListCommand