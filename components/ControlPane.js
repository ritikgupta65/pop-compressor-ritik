'use client';
import ControlStrip from './ControlStrip';

const FORMATS = [['auto', 'keep'], ['image/webp', 'webp'], ['image/jpeg', 'jpeg']];

export default function ControlPane({ opts, busy, left, onFormat, onRun, ...strip }) {
  return (
    <section className="pane control-pane" aria-label="Controls">
      <div className="pane-head">
        <span className="pane-label">Controls</span>
      </div>
      <div className="pane-body">
        <div className="ctl">
          <label>Output format</label>
          <div className="seg tabs" role="group" aria-label="Output format">
            {FORMATS.map(([value, label]) => (
              <button key={value} aria-pressed={String(opts.fmt === value)} onClick={() => onFormat(value)}>{label}</button>
            ))}
          </div>
        </div>
        <ControlStrip opts={opts} {...strip} />
      </div>
      <div className="pane-foot">
        <button className="btn primary wide" disabled={busy || !left} onClick={onRun}>Compress<span className="count">{left}</span></button>
      </div>
    </section>
  );
}
