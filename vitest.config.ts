import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@extensions': path.resolve(__dirname, 'src/extensions')
    }
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "llm-context"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "dist/",
        "node_modules/",
        "llm-context/",
      ],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30,
      },
    },
    globals: true,
    environment: "node",
    hookTimeout: 10000,
    testTimeout: 60000,
    forceExit: true,
  },
});