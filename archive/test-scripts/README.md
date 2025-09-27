# Archived Test Scripts

This directory contains old JavaScript test and debug scripts that were moved from the project root during cleanup.

## Files

### Mirror Scripts (Replaced by TypeScript versions)
- `simple-mirror.js` - Basic mirror mapping utility (now `src/scripts/simple-mirror.ts`)
- `simple-mirror-create.js` - Mirror creation utility (now `src/scripts/simple-mirror-create.ts`)

### Test Scripts
- `test-*.js` - Various testing scripts for different functionality
  - `test-integration.js` - Integration testing
  - `test-library-system.js` - Library system testing
  - `test-method-system.js` - Method analysis testing
  - `test-mirror*.js` - Mirror functionality testing
  - `test-path-mapper.js` - Path mapping testing
  - `test-reversible.js` - Reversible ID testing
  - `test-simple-mapping.js` - Simple mapping testing
  - `test-underscore.js` - Underscore handling testing

### Debug Scripts
- `debug-*.js` - Debugging utilities for various features
  - `debug-conversion.js` - Conversion debugging
  - `debug-direct.js` - Direct path debugging
  - `debug-kebab.js` - Kebab case debugging

### Demo Scripts
- `demo-library-system.js` - Library system demonstration

## Migration

These files have been archived as part of project cleanup. The core functionality has been:
1. Migrated to proper TypeScript implementations in `src/`
2. Integrated into the main CLI tool
3. Covered by proper unit tests in `test/`

## Date Archived
2025-09-28