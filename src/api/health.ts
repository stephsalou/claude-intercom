import { sql } from "drizzle-orm";
import { valkey } from "../valkey/client.js";
import { db } from "../pg/client.js";

export interface HealthReport {
  status: "ok" | "degraded";
  valkey: "up" | "down";
  postgres: "up" | "down";
}

export async function checkHealth(): Promise<HealthReport> {
  const [valkeyUp, postgresUp] = await Promise.all([
    valkey
      .ping()
      .then(() => true)
      .catch(() => false),
    db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false),
  ]);
  return {
    status: valkeyUp && postgresUp ? "ok" : "degraded",
    valkey: valkeyUp ? "up" : "down",
    postgres: postgresUp ? "up" : "down",
  };
}

// Postgres only backs best-effort history — messaging keeps working without it, so a
// PG outage reports 200/"degraded" rather than 503, which would take a still-usable
// API out of rotation. Only a Valkey outage (no presence, no inbox) is a real 503.
export function healthStatusCode(report: HealthReport): number {
  return report.valkey === "up" ? 200 : 503;
}
