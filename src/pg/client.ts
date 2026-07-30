import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema.js";

export const db = drizzle(
  process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom",
  { schema },
);
