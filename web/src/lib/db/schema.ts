import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull().default("#2563eb"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  searchText: text("search_text").notNull().default(""),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const projectMembers = sqliteTable("project_members", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "editor", "viewer"] })
    .notNull()
    .default("editor"),
  color: text("color").notNull().default("#eab308"),
  joinedAt: integer("joined_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const joinRequests = sqliteTable("join_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  message: text("message").default(""),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("editor"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id),
  acceptedAt: integer("accepted_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const commits = sqliteTable("commits", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull().default("Update"),
  snapshot: blob("snapshot", { mode: "buffer" }),
  plainText: text("plain_text").default(""),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const documents = sqliteTable("documents", {
  name: text("name").primaryKey(),
  data: blob("data", { mode: "buffer" }).notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type Commit = typeof commits.$inferSelect;
