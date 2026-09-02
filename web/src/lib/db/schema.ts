import {
  pgTable,
  text,
  integer,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** bytea mapped to Node Buffer */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: unknown) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (typeof value === "string") return Buffer.from(value, "binary");
    return Buffer.from([]);
  },
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull().default("#2563eb"),
  /** platform role: user | admin */
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .default("user"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`extract(epoch from now())::int`),
});

export const projects = pgTable(
  "projects",
  {
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
    latestSnapshotHtml: text("latest_snapshot_html").default(""),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_projects_slug").on(t.slug)]
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
    role: text("role", { enum: ["owner", "admin", "editor", "viewer"] })
      .notNull()
      .default("editor"),
    color: text("color").notNull().default("#eab308"),
    joinedAt: integer("joined_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [
    uniqueIndex("project_members_project_user").on(t.projectId, t.userId),
    index("idx_members_project").on(t.projectId),
  ]
);

export const joinRequests = pgTable("join_requests", {
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
    .default(sql`extract(epoch from now())::int`),
});

export const invites = pgTable(
  "invites",
  {
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
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_invites_token").on(t.token)]
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
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_commits_project").on(t.projectId)]
);

export const documents = pgTable("documents", {
  name: text("name").primaryKey(),
  data: bytea("data").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`extract(epoch from now())::int`),
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
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
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
    type: text("type").notNull(), // invite | join_request | join_approved | commit | mention | system
    title: text("title").notNull(),
    body: text("body").default(""),
    link: text("link").default(""),
    meta: text("meta").default("{}"), // JSON
    readAt: integer("read_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_notifications_user").on(t.userId, t.createdAt)]
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Commit = typeof commits.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
