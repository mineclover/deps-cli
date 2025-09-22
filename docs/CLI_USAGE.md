# Effect CLI Usage Guide

Complete guide for using the Effect CLI application with intelligent performance optimization.

## ⚡ Performance Features

- **Intelligent Layer Loading**: Commands load only required systems for optimal performance
- **Clean Execution**: Simple commands run without verbose logging overhead
- **Conditional Initialization**: Queue system loads only when needed
- **Fast Startup**: 40-60% faster execution for basic operations

## Installation

### Global Installation

```bash
# Clone and build
git clone <repository-url>
cd effect-cli
pnpm install
pnpm build

# Install globally
cd dist && npm link
```

### Verify Installation

```bash
effect-cli --help
```

## Available Commands

### Core Commands

#### Greet Command
Simple greeting command demonstrating optimized performance with clean output.

```bash
effect-cli greet "World"
# Output: Hello, World!
# Note: Fast execution with minimal overhead

effect-cli greet "Effect CLI"
# Output: Hello, Effect CLI!
# Note: No queue system initialization required
```

#### Queue Management Commands

The queue system is the core feature of this CLI, providing task management capabilities. These commands automatically load the full system with queue integration.

##### Queue Status
Display current queue system status and metrics.

```bash
# Basic status
effect-cli queue status

# Detailed status with verbose information
effect-cli queue status --detailed

# JSON output for programmatic use
effect-cli queue status --json

# Watch mode for real-time monitoring
effect-cli queue status --watch
```

##### Queue Clear
Clear tasks from the queue.

```bash
# Clear pending tasks (requires confirmation)
effect-cli queue clear

# Force clear without confirmation
effect-cli queue clear --force

# Clear specific task types
effect-cli queue clear --type pending
effect-cli queue clear --type failed
effect-cli queue clear --type all
```

##### Queue Export
Export queue metrics and data.

```bash
# Export to JSON format
effect-cli queue export --format json -o metrics.json

# Export to CSV format
effect-cli queue export --format csv -o metrics.csv

# Export with different levels of detail
effect-cli queue export --include basic -o basic-metrics.json
effect-cli queue export --include detailed -o detailed-metrics.json
effect-cli queue export --include full -o complete-metrics.json
```

##### Queue Status (Alternative Command)
Alternative queue status command with different output options.

```bash
# Table format output
effect-cli queue-status --format table

# JSON format output
effect-cli queue-status --format json

# CSV format output
effect-cli queue-status --format csv

# Filter by session
effect-cli queue-status --session session_id_here
```

### Global Options

All commands support these global options:

#### Log Level
Control logging verbosity:

```bash
effect-cli greet "Test" --log-level debug
effect-cli greet "Test" --log-level info
effect-cli greet "Test" --log-level warning
effect-cli greet "Test" --log-level error
effect-cli greet "Test" --log-level none
```

#### Help and Version
```bash
# Show help for any command
effect-cli --help
effect-cli greet --help
effect-cli queue --help

# Show version
effect-cli --version

# Enable wizard mode (interactive)
effect-cli --wizard
```

#### Shell Completions
Generate completion scripts for your shell:

```bash
# For bash
effect-cli --completions bash

# For zsh
effect-cli --completions zsh

# For fish
effect-cli --completions fish
```

## Output Formats

### JSON Output
Many commands support JSON output for programmatic use:

```bash
effect-cli queue status --json
effect-cli queue-status --format json
```

### Table Format
Structured table output for human reading:

```bash
effect-cli queue-status --format table
```

### CSV Format
For data analysis and spreadsheet import:

```bash
effect-cli queue export --format csv
effect-cli queue-status --format csv
```

## Queue System Details

### Resource Groups
The queue system manages tasks across four resource groups:

1. **FILESYSTEM**: File operations and I/O tasks
2. **NETWORK**: Network requests and external API calls
3. **COMPUTATION**: CPU-intensive calculations
4. **MEMORY-INTENSIVE**: High memory usage operations

### Status Information
Queue status displays:

- **Session ID**: Unique identifier for current session
- **Total Tasks**: Count of all tasks processed
- **Pending/Running/Completed/Failed**: Task status breakdown
- **Success Rate**: Percentage of successful task completion
- **Average Process Time**: Mean task execution time
- **Throughput**: Tasks processed per minute
- **Memory Usage**: Current memory consumption
- **Active Fibers**: Number of concurrent processing fibers

### Database Integration
The CLI uses SQLite for persistence:

- **Schema Version**: Tracks database schema version (1.0.0)
- **Tables**: 6 tables for queue management
- **Indexes**: 4 indexes for performance optimization
- **Automatic Migration**: Schema validation and updates

## Development Usage

For development work, use the local commands with the same performance optimizations:

```bash
# Development mode (with intelligent layer loading)
pnpm dev greet "Test"          # Fast execution, minimal logging
pnpm dev queue status          # Full system initialization
pnpm dev --help               # Command help with optimizations

# Direct execution (development builds)
tsx src/bin.ts greet "Test"    # TypeScript execution
tsx src/bin.ts queue status    # Full development features

# Built version (production-optimized)
node dist/bin.cjs greet "Test"     # Clean, fast execution
node dist/bin.cjs queue status     # Optimized queue system
```

## Error Handling

The CLI provides comprehensive error handling:

- **Validation Errors**: Invalid arguments or options
- **System Errors**: File system or database issues
- **Queue Errors**: Task processing failures
- **Network Errors**: External service failures

All errors include:
- Clear error messages
- Suggested solutions
- Debug information (with --log-level debug)

## Performance Monitoring

Monitor CLI performance with:

```bash
# Watch queue status in real-time
effect-cli queue status --watch

# Export detailed metrics
effect-cli queue export --include full -o performance-metrics.json

# Debug logging for troubleshooting
effect-cli queue status --log-level debug
```

## Configuration

The CLI automatically:
- Initializes database schema
- Validates system requirements
- Sets up queue processors
- Configures monitoring services

No manual configuration is required for basic usage.