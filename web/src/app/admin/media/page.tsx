export default function AdminMediaPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Media</h1>
      <p className="text-sm text-[var(--hq-muted)] mb-6">
        Media is scoped per project. Open a project editor and use the Media panel to upload.
      </p>
      <div className="hq-card p-6 text-sm text-[var(--hq-muted)]">
        Global media browser can be extended here. Files live under{" "}
        <code className="text-[var(--hq-accent)]">DATA_DIR/uploads</code>.
      </div>
    </div>
  );
}
