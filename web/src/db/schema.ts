import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

// A user can access several workspaces, and (in principle) a workspace could be
// shared by several users — hence a join table rather than a column on `users`.
export const workspaceAccess = pgTable(
  "workspace_access",
  {
    id: serial("id").primaryKey(),
    userId: serial("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").notNull(),
    token: text("token").notNull(),
    role: text("role").notNull().default("membre"), // 'admin' | 'membre' | 'lecture'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.workspace)],
);
