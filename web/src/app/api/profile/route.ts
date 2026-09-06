import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import {
  getSessionUser,
  getAccessTokenFromCookies,
  updateAccountsProfile,
  ensureLocalUserFromAccounts,
  USE_ACCOUNTS,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
    const u = rows[0];
    if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? "",
        organization: (u as { organization?: string }).organization ?? "",
        location: (u as { location?: string }).location ?? "",
        phone: (u as { phone?: string }).phone ?? "",
        dateOfBirth: (u as { dateOfBirth?: string }).dateOfBirth ?? "",
        address: (u as { address?: string }).address ?? "",
      },
    });
  }

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const u = rows[0];
  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl ?? null,
      bio: u.bio ?? "",
      organization: (u as { organization?: string }).organization ?? "",
      location: (u as { location?: string }).location ?? "",
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    username?: string;
    bio?: string;
    organization?: string;
    location?: string;
    avatarColor?: string;
    avatarUrl?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const bio = (body.bio || "").trim().slice(0, 500);
  const organization = (body.organization || "").trim().slice(0, 120);
  const location = (body.location || "").trim().slice(0, 120);
  const avatarColor = (body.avatarColor || "#5C5DE2").slice(0, 32);
  const avatarUrl = (body.avatarUrl || "").trim().slice(0, 500) || null;
  const phone = (body.phone || "").trim().slice(0, 40);
  const dateOfBirth = (body.dateOfBirth || "").trim().slice(0, 12);
  const address = (body.address || "").trim().slice(0, 200);

  if (name.length < 2) {
    return NextResponse.json({ error: "Name too short" }, { status: 400 });
  }
  if (!/^[a-z0-9_-]{5,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 5–32 chars: letters, numbers, - _" },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, session.id)))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  // Write core profile to Accounts when linked
  if (USE_ACCOUNTS) {
    const token = await getAccessTokenFromCookies();
    if (token) {
      try {
        const profile = await updateAccountsProfile(token, {
          display_name: name,
          username,
          bio,
          school: organization,
          country: location,
          phone,
          date_of_birth: dateOfBirth,
          avatar_color: avatarColor,
          avatar_url: avatarUrl,
        });
        if (profile) {
          await ensureLocalUserFromAccounts(profile);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Accounts update failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  await db
    .update(users)
    .set({
      name,
      username,
      bio,
      organization,
      location,
      avatarColor,
      avatarUrl,
      phone,
      dateOfBirth,
      address,
    } as Record<string, unknown>)
    .where(eq(users.id, session.id));

  return NextResponse.json({ ok: true, username });
}
