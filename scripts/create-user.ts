import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { SQL } from "bun";
import { issueToken } from "../src/valkey/tokenStore.js";

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

const [username, password, workspace] = process.argv.slice(2);
if (!username || !password || !workspace) {
  console.error("Usage: bun scripts/create-user.ts <username> <password> <workspace>");
  process.exit(1);
}

const sql = new SQL(process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom");

const passwordHash = await hashPassword(password);
const token = await issueToken(workspace);

const [user] = await sql`
  INSERT INTO users (username, password_hash)
  VALUES (${username}, ${passwordHash})
  ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash
  RETURNING id
`;

await sql`
  INSERT INTO workspace_access (user_id, workspace, token)
  VALUES (${user.id}, ${workspace}, ${token})
  ON CONFLICT (user_id, workspace) DO UPDATE SET token = excluded.token
`;

console.log(`User "${username}" can now access workspace "${workspace}" on the dashboard.`);
process.exit(0);
