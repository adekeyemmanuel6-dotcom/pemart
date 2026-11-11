import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // tsconfig keeps jsx:preserve for Next; tests need real JSX (email templates)
  ...({ oxc: { jsx: { runtime: 'automatic' } } } as object),
  test: { include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'], environment: 'node', fileParallelism: false },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.'), 'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts'), 'next/cache': path.resolve(import.meta.dirname, 'tests/helpers/next-cache.ts') } },
});
