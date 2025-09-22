/**
 * @file Defines the public interface for the Code Parser service.
 */

import { Tree } from 'tree-sitter';

/**
 * Input for a parsing job.
 */
export interface ParserInput {
  filePath: string;
  language: 'typescript'; // Initially just typescript
}

/**
 * The result of a parsing job.
 */
export interface ParserOutput {
  filePath: string;
  ast: Tree;
}

/**
 * The CodeParser service is responsible for parsing source files into an AST.
 * It is designed to be run in a separate, parallel process.
 */
export interface ICodeParser {
  /**
   * Parses a single source code file and returns its AST.
   *
   * @param input - The input file to parse.
   * @returns A promise that resolves with the parser output.
   * @throws If the file cannot be read or if parsing fails catastrophically.
   */
  parse(input: ParserInput): Promise<ParserOutput>;

  /**
   * Parses multiple source code files in parallel.
   *
   * @param inputs - An array of input files to parse.
   * @returns A promise that resolves with an array of parser outputs.
   */
  parseMany(inputs: ParserInput[]): Promise<ParserOutput[]>;
}
