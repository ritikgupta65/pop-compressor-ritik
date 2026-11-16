'use client';

const FORMATS = [['auto', 'keep'], ['image/webp', 'webp'], ['image/jpeg', 'jpeg']];

export default function Header({ fmt, view, busy, left, done, total, onFormat, onView, onPick, onClear, onRun, onSaveAll }) {
  return (
    <header>
      <div className="brand"><b>P<em>O</em>P</b><span>compress</span></div>

      <div className="seg tabs" role="group" aria-label="Output format">
        {FORMATS.map(([value, label]) => (
          <button key={value} aria-pressed={String(fmt === value)} onClick={() => onFormat(value)}>{label}</button>
        ))}
      </div>

      <div className="seg views" role="group" aria-label="Layout">
        <button aria-pressed={String(view === 'grid')} title="Grid view" aria-label="Grid view" onClick={() => onView('grid')}>
          <svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
        </button>
        <button aria-pressed={String(view === 'list')} title="List view" aria-label="List view" onClick={() => onView('list')}>
          <svg viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="6.5" width="14" height="3" rx="1"/><rect x="1" y="11" width="14" height="3" rx="1"/></svg>
        </button>
      </div>

      <button className="btn" onClick={onPick}>Add files</button>
      <button className="btn ghost" disabled={busy || !total} onClick={onClear}>Clear</button>
      <button className="btn primary" disabled={busy || !left} onClick={onRun}>Compress<span className="count">{left}</span></button>
      <button className="btn" disabled={busy || !done} onClick={onSaveAll}>Save all<span className="count">{done}</span></button>
    </header>
  );
}
