# Phase 1 Data Models: Parser Module

## 1. ParserInput

Represents the input for a single parsing operation.

*   **filePath**: `string` - The absolute path to the file being parsed.
*   **language**: `string` - The language of the file (e.g., 'typescript').
*   **queries**: `string[]` - An array of tree-sitter queries to run against the document.

## 2. ParserOutput

Represents the result of a single parsing operation.

*   **filePath**: `string` - The absolute path to the parsed file.
*   **ast**: `object` - The root node of the tree-sitter Abstract Syntax Tree. This is the primary output.
*   **matches**: `object` - A dictionary where keys are query names (or indices) and values are the captures from the tree-sitter query.

## 3. Dependency

Represents a dependency extracted from a file.

*   **from**: `string` - The file containing the dependency declaration.
*   **to**: `string` - The module specifier of the dependency.
*   **type**: `'static' | 'dynamic'` - The type of import.

## 4. CodeConstruct

A generic representation of an identified piece of code from a query.

*   **filePath**: `string` - The file where the construct was found.
*   **type**: `string` - A user-defined type for the construct (e.g., 'function-call', 'class-definition').
*   **startPosition**: `{ row: number, column: number }`
*   **endPosition**: `{ row: number, column: number }`
*   **text**: `string` - The source text of the construct.
