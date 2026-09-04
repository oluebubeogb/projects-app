import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { AmbientBackground } from "@/components/layout/AmbientBackground";

export const metadata: Metadata = {
  title: "Projects — a CISTECH workspace",
  description: "Create public or private projects and work together live. Real-time collaborative editing for research, teams, and universities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var t=localStorage.getItem('hq-theme');
          if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}
          else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}
          }catch(e){}})();` }} />
      </head>
      <body className="min-h-screen flex flex-col relative">
        <AmbientBackground />
        <div className="relative z-[1] flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--hq-border)] py-6 text-center text-sm text-[var(--hq-muted)] bg-[var(--hq-sidebar)]/60 backdrop-blur-sm">
            © 2026 CISTECH for Workplace
          </footer>
        </div>
      </body>
    </html>
  );
}
