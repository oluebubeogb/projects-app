/**
 * Project auth – integrates with central Collab Accounts.
 *
 * When ACCOUNTS_URL is set (default production):
 * - login / register call Accounts
 * - session cookie is the Accounts access_token (shared across tools)
 * - getSessionUser() validates via Accounts /auth/me and upserts local users row
 *
 * Local users.id is still the FK for projects, members, forums, etc.
 * accounts_id links to the central identity.
 */
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

/** Shared with Accounts / Teams when COOKIE_DOMAIN=.collab.name.ng */
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "access_token";
/** Legacy cookie still accepted during migration */
const LEGACY_COOKIE_NAME = "projects_session";

const ACCOUNTS_URL = (process.env.ACCOUNTS_URL || "").replace(/\/$/, "");
const USE_ACCOUNTS = Boolean(ACCOUNTS_URL) && process.env.USE_ACCOUNTS !== "false";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#db2777",
  "#5C5DE2",
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

type AccountsUser = {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  phone?: string | null;
  country?: string | null;
  school?: string | null;
  bio?: string;
  avatar_color?: string;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  role?: string;
};

type SessionUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  role: string;
  accountsId?: string | null;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    maxAge,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
}

/** Store Accounts access token (or legacy local JWT). */
export async function createSession(tokenOrUserId: string, isAccountsToken = USE_ACCOUNTS) {
  const cookieStore = await cookies();
  if (isAccountsToken) {
    cookieStore.set(COOKIE_NAME, tokenOrUserId, cookieOptions(60 * 60 * 24 * 30));
    // clear legacy
    cookieStore.delete(LEGACY_COOKIE_NAME);
    return;
  }
  // Legacy: sign local JWT from user id
  const token = await new SignJWT({ sub: tokenOrUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
  cookieStore.set(LEGACY_COOKIE_NAME, token, cookieOptions(60 * 60 * 24 * 30));
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
  if (COOKIE_DOMAIN) {
    cookieStore.set(COOKIE_NAME, "", { ...cookieOptions(0), domain: COOKIE_DOMAIN });
    cookieStore.set("refresh_token", "", { ...cookieOptions(0), domain: COOKIE_DOMAIN });
  }
}

async function accountsFetchMe(token: string): Promise<AccountsUser | null> {
  try {
    const res = await fetch(`${ACCOUNTS_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AccountsUser;
  } catch {
    return null;
  }
}

async function accountsLogin(email: string, password: string) {
  const res = await fetch(`${ACCOUNTS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : data.error || "Invalid email or password");
  }
  return data as { access_token: string; user: AccountsUser };
}

async function accountsSignup(payload: {
  email: string;
  password: string;
  display_name: string;
  username: string;
}) {
  const res = await fetch(`${ACCOUNTS_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.error || data.detail || "Registration failed";
    if (Array.isArray(data.detail)) {
      msg = data.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join("; ");
    }
    throw new Error(typeof msg === "string" ? msg : "Registration failed");
  }
  return data as { access_token: string; user: AccountsUser };
}

/**
 * Ensure a local Project users row exists for this Accounts profile.
 * Preserves local id (and thus all FKs) when matched by email or accounts_id.
 */
export async function ensureLocalUserFromAccounts(profile: AccountsUser): Promise<SessionUser> {
  const email = profile.email.toLowerCase();
  const accountsId = profile.id;
  const name = profile.display_name || email.split("@")[0];
  let username = (profile.username || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (username.length < 5) username = (username + "user").slice(0, 5);
  username = username.slice(0, 32);

  // Match existing local user
  const byAccounts = await db
    .select()
    .from(users)
    .where(eq(users.accountsId, accountsId))
    .limit(1);

  let row = byAccounts[0] as (typeof byAccounts)[0] | undefined;
  if (!row) {
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    row = byEmail[0];
  }

  if (row) {
    const nextUsername = row.username || username;
    const nextAvatarColor = profile.avatar_color || row.avatarColor;
    const nextAvatarUrl = profile.avatar_url ?? row.avatarUrl ?? null;
    await db
      .update(users)
      .set({
        accountsId,
        name,
        email,
        username: nextUsername,
        avatarColor: nextAvatarColor,
        avatarUrl: nextAvatarUrl,
        bio: profile.bio ?? row.bio ?? "",
        organization: profile.school ?? row.organization ?? "",
        location: profile.country ?? row.location ?? "",
        phone: profile.phone ?? row.phone ?? "",
        dateOfBirth: profile.date_of_birth ?? row.dateOfBirth ?? "",
      })
      .where(eq(users.id, row.id));

    return {
      id: row.id,
      email,
      name,
      username: nextUsername,
      avatarColor: nextAvatarColor,
      avatarUrl: nextAvatarUrl,
      role: row.role || "user",
      accountsId,
    };
  }

  // Create new local user — unique username
  let candidate = username;
  for (let i = 0; i < 20; i++) {
    const clash = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!clash[0]) break;
    candidate = `${username.slice(0, 28)}${i + 1}`;
  }

  const id = randomUUID();
  const avatarColor = profile.avatar_color || randomColor();
  const avatarUrl = profile.avatar_url || null;
  await db.insert(users).values({
    id,
    email,
    name,
    username: candidate,
    passwordHash: "", // auth is via Accounts
    avatarColor,
    avatarUrl,
    bio: profile.bio || "",
    organization: profile.school || "",
    location: profile.country || "",
    phone: profile.phone || "",
    dateOfBirth: profile.date_of_birth || "",
    accountsId,
  });

  return {
    id,
    email,
    name,
    username: candidate,
    avatarColor,
    avatarUrl,
    role: "user",
    accountsId,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(COOKIE_NAME)?.value ||
    cookieStore.get(LEGACY_COOKIE_NAME)?.value;
  if (!token) return null;

  if (USE_ACCOUNTS) {
    const profile = await accountsFetchMe(token);
    if (profile) {
      return ensureLocalUserFromAccounts(profile);
    }
    // Token might be legacy local JWT — fall through
  }

  // Legacy local JWT
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) return null;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl ?? null,
      role: (user as { role?: string }).role || "user",
      accountsId: (user as { accountsId?: string | null }).accountsId ?? null,
    };
  } catch {
    return null;
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{5,32}$/;

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 5) return "Username must be at least 5 characters";
  if (u.length > 32) return "Username must be at most 32 characters";
  if (!USERNAME_RE.test(u)) return "Username may only contain letters, numbers, - and _";
  return null;
}

export async function registerUser(
  email: string,
  name: string,
  password: string,
  username: string
) {
  const uname = username.trim().toLowerCase();
  const unameErr = validateUsername(uname);
  if (unameErr) throw new Error(unameErr);

  if (USE_ACCOUNTS) {
    const result = await accountsSignup({
      email: email.toLowerCase(),
      password,
      display_name: name,
      username: uname,
    });
    const sessionUser = await ensureLocalUserFromAccounts(result.user);
    await createSession(result.access_token, true);
    return sessionUser;
  }

  // Legacy local register
  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) throw new Error("Email already registered");
  const existingU = await db.select().from(users).where(eq(users.username, uname)).limit(1);
  if (existingU.length > 0) throw new Error("Username already taken");

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const avatarColor = randomColor();
  await db.insert(users).values({
    id,
    email: email.toLowerCase(),
    name,
    username: uname,
    passwordHash,
    avatarColor,
  });
  return {
    id,
    email: email.toLowerCase(),
    name,
    username: uname,
    avatarColor,
    avatarUrl: null as string | null,
    role: "user" as const,
  };
}

export async function loginUser(email: string, password: string) {
  if (USE_ACCOUNTS) {
    const result = await accountsLogin(email.toLowerCase(), password);
    const sessionUser = await ensureLocalUserFromAccounts(result.user);
    await createSession(result.access_token, true);
    return sessionUser;
  }

  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const user = rows[0];
  if (!user) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl ?? null,
    role: (user as { role?: string }).role || "user",
  };
}

/** Used by collab-token route — always local JWT for Hocuspocus */
export async function verifyToken(token: string): Promise<{
  id: string;
  name: string;
  color: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) return null;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
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

/** Proxy profile update to Accounts when linked */
export async function updateAccountsProfile(
  accessToken: string,
  patch: Record<string, string | null | undefined>
) {
  if (!USE_ACCOUNTS) return null;
  const body: Record<string, string> = {};
  if (patch.display_name != null) body.display_name = patch.display_name;
  if (patch.username != null) body.username = patch.username;
  if (patch.bio != null) body.bio = patch.bio;
  if (patch.school != null) body.school = patch.school;
  if (patch.country != null) body.country = patch.country;
  if (patch.phone != null) body.phone = patch.phone;
  if (patch.date_of_birth != null) body.date_of_birth = patch.date_of_birth;
  if (patch.avatar_color != null) body.avatar_color = patch.avatar_color;
  if (patch.avatar_url != null) body.avatar_url = patch.avatar_url;

  const res = await fetch(`${ACCOUNTS_URL}/auth/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Profile update failed");
  }
  return (await res.json()) as AccountsUser;
}

export async function getAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export { USE_ACCOUNTS, ACCOUNTS_URL, COOKIE_NAME };
