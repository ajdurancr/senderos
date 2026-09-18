import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "app/components/**/*.{ts,tsx}",
        "app/features/mission-control/**/*.{ts,tsx}",
        "app/layouts/**/*.{ts,tsx}",
        "app/routes/home.tsx",
        "app/server/**/*.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
