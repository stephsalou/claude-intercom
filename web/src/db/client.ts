import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const client = postgres(
  process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom",
);

export const db = drizzle(client, { schema });
