import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "projects-dev-secret-change-me-in-production"
);
const COOKIE_NAME = "projects_session";

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#db2777",
];

export function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) return null;

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = rows[0];
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      role: (user as { role?: string }).role || "user",
    };
  } catch {
    return null;
  }
}

export async function registerUser(
  email: string,
  name: string,
  password: string
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) throw new Error("Email already registered");

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const avatarColor = randomColor();

  await db.insert(users).values({
    id,
    email: email.toLowerCase(),
    name,
    passwordHash,
    avatarColor,
  });

  return { id, email: email.toLowerCase(), name, avatarColor, role: "user" as const };
}

export async function loginUser(email: string, password: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  const user = rows[0];
  if (!user) throw new Error("Invalid email or password");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarColor: user.avatarColor,
    role: (user as { role?: string }).role || "user",
  };
}

export async function verifyToken(token: string): Promise<{
  id: string;
  name: string;
  color: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = rows[0];
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      color: user.avatarColor,
    };
  } catch {
    return null;
  }
}

export async function createCollabToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(JWT_SECRET);
}
