import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Projects — Collaborative research & workspaces",
  description:
    "Create public or private projects and work together live. Real-time collaborative editing for research, teams, and universities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('hq-theme');
                  if (t === 'dark' || t === 'light') {
                    document.documentElement.setAttribute('data-theme', t);
                  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="relative z-[1] border-t border-[var(--hq-border)] py-6 text-center text-sm text-[var(--hq-muted)]">
          Projects · collaborative research workspace
        </footer>
      </body>
    </html>
  );
}
