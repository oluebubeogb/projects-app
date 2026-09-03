import { redirect, notFound } from "next/navigation";
import { db, ensureMigrated } from "@/lib/db";
import { forums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export default async function ForumSlugRedirect({ params }: Props) {
  await ensureMigrated();
  const { slug } = await params;
  const token = decodeURIComponent(slug || "").trim();
  if (!token) notFound();
  const byId = await db.select({ id: forums.id }).from(forums).where(eq(forums.id, token)).limit(1);
  if (byId[0]) redirect(`/forums/${byId[0].id}`);
  const all = await db.select({ id: forums.id, title: forums.title }).from(forums).limit(200);
  const normalized = token.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const match = all.find((f) => {
    const t = (f.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return t === normalized || t.includes(normalized) || normalized.includes(t);
  });
  if (match) redirect(`/forums/${match.id}`);
  notFound();
}
