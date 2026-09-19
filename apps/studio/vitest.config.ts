import { defineConfig } from "vitest/config";
import { minimumCoverage } from "../../scripts/coverage-policy";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "app/test-support/**", "app/+types/**"],
      thresholds: {
        branches: minimumCoverage,
        functions: minimumCoverage,
        lines: minimumCoverage,
        statements: minimumCoverage,
      },
    },
  },
});
