import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Not found</h1>
      <p className="text-[var(--text-muted)] mb-6">
        This page or project does not exist (or the database has no record for
        that slug).
      </p>
      <Link
        href="/dashboard"
        className="text-[var(--primary)] font-medium hover:underline"
      >
        Go to dashboard →
      </Link>
    </div>
  );
}
