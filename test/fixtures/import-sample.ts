// Sample file that imports from other files

import { TestClass, testFunction } from './sample.js'

export class ExtendedClass extends TestClass {
  constructor(name: string, private id: number) {
    super(name)
  }

  public getId(): number {
    return this.id
  }

  public getGreeting(): string {
    return testFunction(this.getName())
  }
}