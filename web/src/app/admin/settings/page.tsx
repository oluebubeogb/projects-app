export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Settings</h1>
      <div className="hq-card p-4 space-y-3 text-sm">
        <div className="flex justify-between border-b border-[var(--hq-border)] pb-3">
          <span className="text-[var(--hq-muted)]">Database</span>
          <span>SQLite + FTS5</span>
        </div>
        <div className="flex justify-between border-b border-[var(--hq-border)] pb-3">
          <span className="text-[var(--hq-muted)]">Collab</span>
          <span>Hocuspocus / Yjs</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--hq-muted)]">Version</span>
          <span>3.0.0</span>
        </div>
      </div>
    </div>
  );
}
