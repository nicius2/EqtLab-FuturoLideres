import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = path.dirname(fileURLToPath(import.meta.url));

/** Testes de API: falam com o app já rodando (`API_URL`) e com o Postgres dele (`pnpm test:api`). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(raiz, "src") } },
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    testTimeout: 90_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    setupFiles: ["tests/api/setup.ts"],
  },
});
