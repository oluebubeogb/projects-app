import {
  pgTable,
  text,
  integer,
  timestamp,
  bytea,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const visibilityEnum = pgEnum("visibility", ["public", "private"]);
export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);
export const joinStatusEnum = pgEnum("join_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarColor: text("avatar_color").notNull().default("#2563eb"),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_users_email").on(t.email)]
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    searchText: text("search_text").notNull().default(""),
    latestSnapshotHtml: text("latest_snapshot_html").default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_projects_slug").on(t.slug),
    index("idx_projects_owner").on(t.ownerId),
    index("idx_projects_visibility").on(t.visibility),
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("editor"),
    color: text("color").notNull().default("#eab308"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_project_member").on(t.projectId, t.userId),
    index("idx_members_project").on(t.projectId),
    index("idx_members_user").on(t.userId),
  ]
);

export const joinRequests = pgTable(
  "join_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: joinStatusEnum("status").notNull().default("pending"),
    message: text("message").default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_join_requests_project").on(t.projectId),
    index("idx_join_requests_user").on(t.userId),
  ]
);

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRoleEnum("role").notNull().default("editor"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_invites_token").on(t.token),
    index("idx_invites_project").on(t.projectId),
  ]
);

export const commits = pgTable(
  "commits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    message: text("message").notNull().default("Update"),
    snapshot: bytea("snapshot"),
    plainText: text("plain_text").default(""),
    html: text("html").default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_commits_project").on(t.projectId)]
);

// Optional fallback; primary Yjs state lives in Redis for performance
export const documents = pgTable("documents", {
  name: text("name").primaryKey(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull().default(0),
    path: text("path").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_media_project").on(t.projectId)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").default(""),
    link: text("link").default(""),
    meta: text("meta").default("{}"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_notifications_user").on(t.userId, t.createdAt)]
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type Commit = typeof commits.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
