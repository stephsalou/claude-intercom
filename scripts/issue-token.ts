import { issueToken } from "../src/valkey/tokenStore.js";

const workspace = process.argv[2];
if (!workspace) {
  console.error("Usage: bun scripts/issue-token.ts <workspace>");
  process.exit(1);
}

const token = await issueToken(workspace);
console.log(token);
process.exit(0);
