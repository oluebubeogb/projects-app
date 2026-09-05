import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Floating soft orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[var(--hq-accent)]/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute bottom-10 left-1/4 w-48 h-48 rounded-full bg-cyan-400/10 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Animated 404 */}
      <div className="relative z-10 text-center select-none">
        <div className="relative inline-block">
          <h1 className="text-[clamp(6rem,18vw,9rem)] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[var(--hq-accent)] via-fuchsia-400 to-cyan-400 animate-[float_4s_ease-in-out_infinite]">
            404
          </h1>
          {/* Glitch layers */}
          <span
            aria-hidden
            className="absolute inset-0 text-[clamp(6rem,18vw,9rem)] font-black leading-none tracking-tighter text-[var(--hq-accent)]/30 animate-[glitch_2.5s_infinite] translate-x-[2px]"
          >
            404
          </span>
          <span
            aria-hidden
            className="absolute inset-0 text-[clamp(6rem,18vw,9rem)] font-black leading-none tracking-tighter text-cyan-400/20 animate-[glitch_2.5s_infinite_reverse] -translate-x-[2px]"
          >
            404
          </span>
        </div>

        <p className="mt-4 text-xl md:text-2xl font-semibold text-[var(--hq-text)]">
          Lost in the void?
        </p>
        <p className="mt-2 max-w-md mx-auto text-[var(--hq-muted)] text-sm md:text-base leading-relaxed">
          This page wandered off into another dimension. Maybe it joined a project, or got stuck in a forum thread. Either way — it is not here.
        </p>

        {/* Fun GIF-like CSS animation */}
        <div className="mt-8 mb-10 flex justify-center">
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--hq-accent)] to-fuchsia-500 opacity-20 animate-ping" />
            <div className="relative w-full h-full rounded-2xl bg-[var(--hq-surface)] border border-[var(--hq-border)] shadow-[var(--hq-shadow-md)] flex items-center justify-center overflow-hidden">
              <span className="text-5xl animate-[bounce_2s_ease-in-out_infinite]">🚀</span>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--hq-accent)] animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--hq-accent)] text-white text-sm font-medium hover:bg-[var(--hq-accent-hover)] transition-all shadow-lg shadow-[var(--hq-accent)]/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            Back to dashboard
          </Link>
          <Link
            href="/messages"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--hq-border)] bg-[var(--hq-surface)] text-sm font-medium text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors"
          >
            Messages
          </Link>
          <Link
            href="/forums"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--hq-border)] bg-[var(--hq-surface)] text-sm font-medium text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors"
          >
            Forums
          </Link>
        </div>

        <p className="mt-10 text-xs text-[var(--hq-muted-2)]">
          Error code: <code className="font-mono">404_NOT_FOUND</code> · You can always start something new.
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes glitch {
          0%, 90%, 100% { opacity: 0; transform: translate(0); }
          92% { opacity: 0.6; transform: translate(3px, -2px); }
          94% { opacity: 0.4; transform: translate(-3px, 1px); }
          96% { opacity: 0.7; transform: translate(2px, 2px); }
          98% { opacity: 0.3; transform: translate(-1px, -1px); }
        }
      `}</style>
    </div>
  );
}
