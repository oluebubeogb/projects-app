import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">Admin only</h1>
        <p className="text-sm text-[var(--hq-muted)]">
          Your account does not have the platform admin role.
        </p>
        <p className="text-xs text-[var(--hq-muted)] mt-4">
          Promote a user via SQL:{" "}
          <code className="text-[var(--hq-accent)]">
            UPDATE users SET role=&apos;admin&apos; WHERE email=&apos;you@example.com&apos;;
          </code>
        </p>
      </div>
    );
  }

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
      }}
    >
      {children}
    </AdminShell>
  );
}
