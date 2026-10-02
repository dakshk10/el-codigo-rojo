import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_TOKEN: z.string().min(1).default("dev-admin-token"),
  EVENT_CODE: z.string().min(1).default("dev-event-code"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  GATEWAY_BASE_URL: z.string().default(""),
  GATEWAY_GAME_KEY: z.string().default("dev-gateway-key"),
  GATEWAY_LOG_PATH: z.string().default("logs/gateway-events.ndjson"),
});

function loadConfig() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  return parsed.data;
}

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = loadConfig();
