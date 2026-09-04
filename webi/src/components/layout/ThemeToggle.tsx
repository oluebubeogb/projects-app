"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") || "light";
    modTheme(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modTheme(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("hq-theme", next);
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    modTheme(theme === "light" ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to night mode" : "Switch to light mode"}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--hq-muted)] hover:text-[var(--hq-text)] hover:bg-[var(--hq-hover)] transition-colors"
      title={theme === "light" ? "Night mode" : "Light mode"}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
