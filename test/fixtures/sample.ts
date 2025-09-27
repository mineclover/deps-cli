// Sample TypeScript file for testing Enhanced system

export class TestClass {
  constructor(private name: string) {}

  public getName(): string {
    return this.name
  }

  public setName(name: string): void {
    this.name = name
  }
}

export function testFunction(input: string): string {
  return `Hello, ${input}!`
}

export const testConstant = 'test-value'
