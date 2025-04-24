// Global type definitions for Jest testing

declare global {
  // Jest globals
  const jest: any;
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: (...args: any[]) => any, timeout?: number) => void;
  const test: typeof it;
  const expect: any;
  const beforeAll: (fn: () => any, timeout?: number) => void;
  const beforeEach: (fn: () => any, timeout?: number) => void;
  const afterAll: (fn: () => any, timeout?: number) => void;
  const afterEach: (fn: () => any, timeout?: number) => void;
}

// This makes the file a module, which is required to use 'declare global'
export {}; 