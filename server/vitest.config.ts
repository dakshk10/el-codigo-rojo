import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: "postgresql://test:test@localhost/test",
      ADMIN_TOKEN: "test-admin-token",
      EVENT_CODE: "test-event-code",
      NODE_ENV: "test",
    },
  },
});
