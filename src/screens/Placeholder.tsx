export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <main className="screen">
      <h1 className="t-title">{title}</h1>
      <div className="placeholder">
        <p className="t-meta">Arrives in {milestone}.</p>
      </div>
    </main>
  );
}
