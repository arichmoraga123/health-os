import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("DATABASE_URL is missing. DB calls will fail until configured.");
}

const sql = neon(databaseUrl || "postgresql://local:local@localhost:5432/health_os");

export const db = drizzle(sql, { schema });
