# deps-cli

🎯 **Namespace-based file pattern configuration tool**

A headless CLI template for listing target files based on namespace configurations. This tool makes it easy to identify and inject file lists for processing by other tools or pipelines.

## Purpose

deps-cli serves as a foundation for file-based operations by providing:

- **Namespace-based file pattern management** - Define and manage file selection criteria per namespace
- **Headless file listing** - Generate lists of target files that can be piped to other tools
- **Easy integration** - Simple JSON-based configuration for automation and CI/CD workflows

This is primarily a template/foundation for building file processing tools where you need to consistently identify which files to operate on.

## Installation

```bash
npm install -g @context-action/deps-cli
```

Or use directly with npx:

```bash
npx @context-action/deps-cli
```

## Quick Start

### 1. Create a namespace

```bash
deps-cli create-namespace dev
```

### 2. Configure file patterns

Edit `deps-cli.config.json`:

```json
{
  "namespaces": {
    "dev": {
      "filePatterns": ["src/**/*.ts", "test/**/*.test.ts"],
      "excludePatterns": ["**/*.d.ts", "node_modules/**"]
    }
  }
}
```

### 3. Run demo command

```bash
deps-cli demo dev
```

Output:
```
🎯 Namespace Demo Output
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Namespace: dev

Metadata:
  File Patterns:
    - src/**/*.ts
    - test/**/*.test.ts
  Exclude Patterns:
    - **/*.d.ts
    - node_modules/**

Files (15):
  - src/bin.ts
  - src/config/ConfigManager.ts
  - src/commands/CommandRegistry.ts
  - test/config-manager.test.ts
  ...
```

## Commands

### Namespace Management

#### `list-namespaces`

Display all configured namespaces.

```bash
deps-cli list-namespaces
```

#### `create-namespace <name>`

Create a new namespace with default configuration.

```bash
deps-cli create-namespace production

# Copy settings from existing namespace
deps-cli create-namespace staging --copy-from production
```

#### `delete-namespace <name>`

Remove a namespace from configuration.

```bash
deps-cli delete-namespace dev
```

### File Operations

#### `demo <namespace>`

**Demo command**: Output namespace metadata along with the list of matched files. This is the primary example of how to consume namespace-based file lists.

```bash
# Human-readable output
deps-cli demo dev

# JSON output for piping to other tools
deps-cli demo dev --json

# Use custom config file
deps-cli demo dev --config ./custom-config.json

# Specify working directory
deps-cli demo dev --cwd /path/to/project
```

Example JSON output:
```json
{
  "namespace": "dev",
  "metadata": {
    "filePatterns": ["src/**/*.ts"],
    "excludePatterns": ["**/*.d.ts"]
  },
  "files": [
    "src/bin.ts",
    "src/config/ConfigManager.ts"
  ],
  "fileCount": 2
}
```

#### `list-files <namespace>`

List all files matching the namespace's file patterns (simple list only, no metadata).

```bash
deps-cli list-files dev

# Use custom config file
deps-cli list-files dev --config ./custom-config.json

# Specify working directory
deps-cli list-files dev --cwd /path/to/project
```

## Configuration

The configuration file (`deps-cli.config.json`) uses the following structure:

```json
{
  "default": "dev",
  "namespaces": {
    "dev": {
      "filePatterns": ["src/**/*.ts"],
      "excludePatterns": ["**/*.test.ts"]
    },
    "production": {
      "filePatterns": ["dist/**/*.js"],
      "excludePatterns": []
    }
  }
}
```

### Configuration Options

- **`default`** (optional): Default namespace to use
- **`namespaces`**: Object containing namespace configurations
  - **`filePatterns`**: Array of glob patterns to include
  - **`excludePatterns`**: Array of glob patterns to exclude

## Use Cases

### 1. CI/CD Pipeline Integration

```bash
# Get namespace metadata and files as JSON
RESULT=$(deps-cli demo linting --json)
echo $RESULT | jq '.files[]' | xargs eslint
```

### 2. Custom Build Scripts

```bash
# Process files based on namespace configuration
deps-cli demo changed-files --json | jq -r '.files[]' | xargs tsc
```

### 3. Testing Workflows

```bash
# Run tests only on specific file patterns
deps-cli demo unit-tests --json | jq -r '.files[]' | xargs jest
```

### 4. Documentation Generation

```bash
# Generate docs for specific namespaces with metadata
deps-cli demo api-docs --json > docs-input.json
# Your custom tool can now read namespace config and file list
```

### 5. Building Custom File Processing Tools

The `demo` command serves as a template for building your own file processing commands:

```typescript
// Your custom command can use the same pattern
const result = await globalConfig.getNamespaceWithFiles('my-namespace', configPath)

// Process files with full context
result.files.forEach(file => {
  // You have access to:
  // - result.namespace: which namespace is being processed
  // - result.metadata: the patterns and configuration
  // - result.files: the matched files
  // - result.fileCount: how many files

  processFile(file, result.metadata)
})
```

## API Usage

You can also use deps-cli programmatically:

```typescript
import { globalConfig } from '@context-action/deps-cli'

// Get namespace with metadata and files (recommended)
const result = await globalConfig.getNamespaceWithFiles('dev', 'deps-cli.config.json')
console.log(result)
// {
//   namespace: 'dev',
//   metadata: { filePatterns: [...], excludePatterns: [...] },
//   files: ['src/index.ts', 'src/utils.ts', ...],
//   fileCount: 10
// }

// List files only
const files = await globalConfig.listFiles('dev', 'deps-cli.config.json')
console.log(files) // ['src/index.ts', 'src/utils.ts', ...]

// Create namespace
await globalConfig.setNamespaceConfig('test', {
  filePatterns: ['**/*.test.ts'],
  excludePatterns: ['**/fixtures/**']
}, 'deps-cli.config.json')
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- list-namespaces

# Build
npm run build

# Run tests
npm test

# Type check
npm run check
```

## Project Structure

```
deps-cli/
├── src/
│   ├── bin.ts              # CLI entry point
│   ├── config/
│   │   └── ConfigManager.ts  # Configuration management
│   └── commands/
│       ├── CommandRegistry.ts    # Command registration system
│       └── NamespaceCommands.ts  # Namespace commands
├── test/                   # Test files
├── dist/                   # Build output
└── deps-cli.config.json    # Configuration file
```

## Requirements

- Node.js >= 18.0.0

## License

MIT

## Contributing

This is a minimal template designed to be extended. Feel free to:

- Add new commands for file processing
- Extend the configuration schema
- Build custom workflows on top of the file listing functionality

The core philosophy is to keep the base tool simple and focused on namespace-based file identification, making it easy to build more complex tools on top.