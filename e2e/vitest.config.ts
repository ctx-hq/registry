import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load e2e/.env.staging into process.env before tests run
try {
  const envPath = resolve(__dirname, ".env.staging");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
} catch {
  // .env.staging not found — rely on environment variables from CI
}

export default defineConfig({
  test: {
    include: ["e2e/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globals: true,
  },
});
