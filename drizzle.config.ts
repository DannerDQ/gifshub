import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Unpooled: migrations need a direct session, not PgBouncer.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
});
