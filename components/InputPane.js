'use client';
import EmptyState from './EmptyState';
import { kb, MAX } from '@/lib/format';

const STATE = { idle: 'queued', work: 'working', done: 'done', error: 'failed' };

export default function InputPane({ items, busy, onPick, onClear, onOpen, onDelete }) {
  return (
    <section className="pane input-pane" aria-label="Input">
      <div className="pane-head">
        <span className="pane-label">Input</span>
        <span className="pane-count">{items.length}/{MAX}</span>
      </div>
      <div className="pane-body">
        <EmptyState compact={items.length > 0} onPick={onPick} />
        {items.length > 0 && (
          <ul className="files">
            {items.map(it => (
              <li key={it.id} className={'file ' + it.state}>
                <button className="thumb" title="Compare before and after" onClick={() => onOpen(it.id)}>
                  <img alt="" src={it.src} />
                </button>
                <div className="file-meta">
                  <span className="file-name" title={it.name}>{it.name}</span>
                  <span className="file-sub">{kb(it.size)} · {STATE[it.state] || it.state}</span>
                </div>
                <button className="btn ghost x" aria-label={'Remove ' + it.name} onClick={() => onDelete(it.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pane-foot">
        <button className="btn" onClick={onPick}>Add files</button>
        <button className="btn ghost" disabled={busy || !items.length} onClick={onClear}>Clear</button>
      </div>
    </section>
  );
}
