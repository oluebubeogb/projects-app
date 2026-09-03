"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-6 text-center">Create account</h1>
      <form
        onSubmit={onSubmit}
        className="space-y-4 p-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            required
            minLength={5}
            maxLength={32}
            pattern="[a-zA-Z0-9_-]{5,32}"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="at least 5 characters"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Letters, numbers, - and _ only. Min 5 characters. Used in /u/username
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] disabled:opacity-60 transition-colors"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-center text-sm text-[var(--text-muted)] mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
