import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/settings/profile");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  const user = rows[0];
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Edit profile</h1>
      <p className="text-sm text-[var(--hq-muted)] mb-8">
        Update how you appear across projects, forums, and messages.
      </p>
      <ProfileEditForm
        initial={{
          name: user.name,
          username: user.username,
          bio: (user as { bio?: string | null }).bio || "",
          organization: (user as { organization?: string | null }).organization || "",
          location: (user as { location?: string | null }).location || "",
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl || "",
          phone: (user as { phone?: string | null }).phone || "",
          dateOfBirth: (user as { dateOfBirth?: string | null }).dateOfBirth || "",
          address: (user as { address?: string | null }).address || "",
        }}
      />
    </div>
  );
}
