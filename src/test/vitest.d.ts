/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

import { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare global {
  namespace Vi {
    interface JestAssertion<T = unknown>
      extends jest.Matchers<void, T>, TestingLibraryMatchers<T, void> {}
  }
}
