import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Тесты используют общую базу и откатывают транзакции — запускаем последовательно
    fileParallelism: false,
    testTimeout: 20000,
  },
});
