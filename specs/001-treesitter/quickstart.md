# Quickstart: Using the Code Parser Module

This guide demonstrates how to use the new Code Parser module to analyze a TypeScript file.

## 1. Setup

First, get an instance of the `ICodeParser` service. The implementation will likely be provided through the dependency injection layer.

```typescript
import { ICodeParser } from './path/to/contracts/ICodeParser';

// Assuming a getParserService() function provides the service instance
const parser: ICodeParser = getParserService();
```

## 2. Parsing a Single File

To parse a single file, provide the file path and language.

```typescript
import { ParserInput, ParserOutput } from './path/to/contracts/ICodeParser';

async function analyzeFile(filePath: string) {
  const input: ParserInput = {
    filePath,
    language: 'typescript',
  };

  try {
    const output: ParserOutput = await parser.parse(input);
    console.log(`Successfully parsed ${output.filePath}.`);
    console.log('AST Root Node:', output.ast.rootNode.toString());
    // You can now walk the AST to find specific nodes
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
  }
}

analyzeFile('/path/to/your/file.ts');
```

## 3. Parsing Multiple Files

The `parseMany` method will handle parallelization for you.

```typescript
async function analyzeProject(filePaths: string[]) {
  const inputs: ParserInput[] = filePaths.map(filePath => ({
    filePath,
    language: 'typescript',
  }));

  const results = await parser.parseMany(inputs);

  for (const output of results) {
    console.log(`File: ${output.filePath}, Root node type: ${output.ast.rootNode.type}`);
  }
}

analyzeProject([
  '/path/to/your/file1.ts',
  '/path/to/your/file2.ts',
]);
```

## 4. Extracting Dependencies (Example)

This is an example of how the "Interpreter" module would use the parser's output AST to extract dependencies.

```typescript
import { Tree, SyntaxNode } from 'tree-sitter';

function findImports(ast: Tree): string[] {
  const imports: string[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        // The text includes the quotes, so we strip them
        imports.push(sourceNode.text.slice(1, -1));
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(ast.rootNode);
  return imports;
}

// Inside analyzeFile function from before...
const output: ParserOutput = await parser.parse(input);
const dependencies = findImports(output.ast);
console.log('Dependencies:', dependencies);
```
