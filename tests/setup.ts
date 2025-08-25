/**
 * Vitest Setup
 */

import '@testing-library/jest-dom'
// Global test environment setup
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
})