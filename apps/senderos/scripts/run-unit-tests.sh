#!/usr/bin/env sh
set -eu

TEST_FILES=$(find ./src -name '*.test.ts' ! -path './src/integration/*.test.ts' | sort)

# shellcheck disable=SC2086
exec bun test --isolate $TEST_FILES
