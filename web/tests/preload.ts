// Next.js's real "server-only" package unconditionally throws when imported
// outside webpack/turbopack (which alias it away at build time). Stub it out
// so bun:test can import server-side modules (db/client.ts etc.) directly.
import { plugin } from "bun";

plugin({
  name: "stub-server-only",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
