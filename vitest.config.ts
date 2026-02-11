import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/openclaw-api.ts"],
      thresholds: {
        lines: 95,
        branches: 88,
        functions: 94,
        statements: 95,
      },
    },
  },
});
