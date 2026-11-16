import { kb } from '@/lib/format';

export default function Totals({ items, busy }) {
  const before = items.reduce((s, i) => s + i.size, 0);
  const after  = items.reduce((s, i) => s + (i.state === 'done' ? i.out.size : i.size), 0);
  const saved  = before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
  const done   = items.filter(i => i.state === 'done').length;
  const left   = items.length - done;

  const count = !items.length ? 'no files yet'
    : busy ? `working · ${done}/${items.length}`
    : left ? `${done}/${items.length} compressed`
    : `${items.length} file${items.length > 1 ? 's' : ''} done`;

  return (
    <div className="totals">
      <div className="big"><b>{saved + '%'}</b><i>smaller</i></div>
      <div className="flow">
        <div className="nums">
          <s>{kb(before)}</s><span>→</span><b>{kb(after)}</b><u>{before > after ? '· ' + kb(before - after) + ' saved' : ''}</u>
          <span className="count-txt">{count}</span>
        </div>
        <div className="track" aria-hidden="true">
          <i style={{ width: saved + '%' }}></i><u style={{ left: '25%' }}></u><u style={{ left: '50%' }}></u><u style={{ left: '75%' }}></u>
        </div>
      </div>
    </div>
  );
}
