import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = path.dirname(fileURLToPath(import.meta.url));

/** Testes unitários: rápidos, sem banco nem servidor (`pnpm test`). Ficam ao lado do código, em `*.test.ts`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(raiz, "src"),
      "server-only": path.resolve(raiz, "tests/stubs/server-only.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
