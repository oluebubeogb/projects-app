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
  /** unique handle: min 5 chars, letters, numbers, - _ */
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull().default("#5C5DE2"),
  /** optional profile picture path / url */
  avatarUrl: text("avatar_url"),
  /** short bio shown on profile */
  bio: text("bio").default(""),
  /** optional organization / affiliation */
  organization: text("organization").default(""),
  /** optional location / university */
  location: text("location").default(""),
  /** phone number */
  phone: text("phone").default(""),
  /** date of birth ISO date string YYYY-MM-DD */
  dateOfBirth: text("date_of_birth").default(""),
  /** postal / street address */
  address: text("address").default(""),
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

/* ---------- Forums & messaging ---------- */

export const forums = pgTable(
  "forums",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").default(""),
    /** public | private */
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    /** optional linked project */
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_forums_project").on(t.projectId)]
);

export const forumMembers = pgTable(
  "forum_members",
  {
    id: text("id").primaryKey(),
    forumId: text("forum_id")
      .notNull()
      .references(() => forums.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    lastReadAt: integer("last_read_at"),
    joinedAt: integer("joined_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [
    uniqueIndex("forum_members_forum_user").on(t.forumId, t.userId),
    index("idx_forum_members_forum").on(t.forumId),
  ]
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: text("id").primaryKey(),
    forumId: text("forum_id")
      .notNull()
      .references(() => forums.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull().default(""),
    /** text | voice | system | image | file */
    kind: text("kind", { enum: ["text", "voice", "system", "image", "file"] })
      .notNull()
      .default("text"),
    /** path to webp image or audio */
    mediaPath: text("media_path"),
    parentId: text("parent_id"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_forum_posts_forum").on(t.forumId)]
);

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  /** dm | group */
  kind: text("kind", { enum: ["dm", "group"] })
    .notNull()
    .default("dm"),
  title: text("title").default(""),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`extract(epoch from now())::int`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`extract(epoch from now())::int`),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: integer("last_read_at"),
  },
  (t) => [
    uniqueIndex("conv_members_conv_user").on(t.conversationId, t.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull().default(""),
    /** text | voice | system */
    kind: text("kind", { enum: ["text", "voice", "system", "image", "file"] })
      .notNull()
      .default("text"),
    mediaPath: text("media_path"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [index("idx_messages_conv").on(t.conversationId)]
);


export const callRooms = pgTable(
  "call_rooms",
  {
    id: text("id").primaryKey(),
    /** dm | forum | project */
    kind: text("kind", { enum: ["dm", "forum", "project"] })
      .notNull()
      .default("dm"),
    contextId: text("context_id"),
    hostId: text("host_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    closedAt: integer("closed_at"),
  },
  (t) => [index("idx_call_rooms_context").on(t.contextId)]
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Commit = typeof commits.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Forum = typeof forums.$inferSelect;
export type ForumMember = typeof forumMembers.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CallRoom = typeof callRooms.$inferSelect;
