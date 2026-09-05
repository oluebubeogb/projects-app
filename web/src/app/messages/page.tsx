import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { ensureMigrated } from "@/lib/db";
import { MessagesClient } from "@/components/messages/MessagesClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ to?: string }> };

export default async function MessagesPage({ searchParams }: Props) {
  await ensureMigrated();
  const user = await getSessionUser();
  const { to } = await searchParams;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold mb-2">Messages</h1>
        <p className="text-sm text-[var(--hq-muted)] mb-4">
          Log in to send direct messages, voice notes, and start calls.
        </p>
        <Link href="/login?next=/messages" className="text-[var(--hq-accent)] underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Messages</h1>
      <p className="text-sm text-[var(--hq-muted)] mb-6">
        Direct messages with text, voice notes, images, files, stickers, voice calls, and screen share.
      </p>
      <MessagesClient initialTo={to} myId={user.id} />
    </div>
  );
}
