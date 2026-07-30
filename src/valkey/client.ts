import { Redis } from "iovalkey";

export const valkey = new Redis(process.env.VALKEY_URL ?? "redis://localhost:6379");
