"use client";
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)" }}>
      <div className="absolute inset-0 ambient-base" />
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      <div className="ambient-orb ambient-orb-c" />
      <div className="ambient-orb ambient-orb-d" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.07] dark:opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="edu-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5C5DE2" /><stop offset="100%" stopColor="#20A653" />
          </linearGradient>
        </defs>
        <path d="M-50 180 Q 200 40 450 200 T 950 160" fill="none" stroke="url(#edu-line)" strokeWidth="1.2" className="ambient-path" />
        <path d="M-20 420 Q 300 280 600 440 T 1100 380" fill="none" stroke="url(#edu-line)" strokeWidth="1" className="ambient-path ambient-path-delay" />
        <circle cx="18%" cy="28%" r="3" fill="#5C5DE2" className="ambient-dot" />
        <circle cx="72%" cy="22%" r="2.5" fill="#20A653" className="ambient-dot ambient-dot-delay" />
        <circle cx="55%" cy="68%" r="2" fill="#5C5DE2" className="ambient-dot ambient-dot-delay-2" />
        <circle cx="30%" cy="75%" r="2.5" fill="#20A653" className="ambient-dot" />
      </svg>
    </div>
  );
}
