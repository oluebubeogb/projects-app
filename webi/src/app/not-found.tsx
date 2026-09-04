import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Not found</h1>
      <p className="text-[var(--text-muted)] mb-4">
        This URL did not match any Next.js page (or a page called notFound()).
      </p>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Try projects under <code className="text-xs">/project/your-slug</code>
        — not <code className="text-xs">/p/...</code> if you are on the latest
        deploy.
      </p>
      <div className="flex flex-col gap-2 items-center text-sm">
        <Link
          href="/api/debug/db?key=projects-debug"
          className="text-[var(--primary)] hover:underline"
        >
          Open DB diagnostics
        </Link>
        <Link
          href="/api/projects/by-slug?slug=the-end-of-learning"
          className="text-[var(--primary)] hover:underline"
        >
          Lookup slug the-end-of-learning via API
        </Link>
        <Link href="/dashboard" className="text-[var(--primary)] hover:underline">
          Go to dashboard →
        </Link>
      </div>
    </div>
  );
}
