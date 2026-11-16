'use client';
import { useRef } from 'react';
import { kb, pctOf, prefersReducedMotion } from '@/lib/format';

function Chip({ it }) {
  const done = it.state === 'done';
  const cls = 'chip ' + (done ? (it.skipped ? '' : 'done') : it.state === 'work' ? 'work' : it.state === 'error' ? 'err' : '');
  return (
    <span className={cls}>
      {done
        ? (it.skipped ? 'already lean' : <b>−{pctOf(it)}%</b>)
        : it.state === 'work' ? <b>working</b> : it.state === 'error' ? 'failed' : 'queued'}
    </span>
  );
}

function Sizes({ it }) {
  if (it.state !== 'done') return <div className="sizes"><b>{kb(it.size)}</b></div>;
  return (
    <div className="sizes">
      <s>{kb(it.size)}</s><span>→</span><b>{kb(it.out.size)}</b>
      {!it.skipped && <em>{kb(it.size - it.out.size)} off</em>}
      {it.quality_db != null && (
        <span className="q">{it.quality_db === Infinity ? 'lossless' : it.quality_db.toFixed(0) + ' dB'}</span>
      )}
    </div>
  );
}

export default function Card({ it, spec, shotRef, onOpen, onSave, onDelete, onKnob }) {
  const el = useRef(null);
  const done = it.state === 'done';

  const remove = () => {
    if (el.current && !prefersReducedMotion()){
      el.current.animate([{ opacity:1, transform:'none' }, { opacity:0, transform:'scale(.92)' }],
        { duration:170, easing:'ease-in' }).onfinish = () => onDelete(it.id);
    } else onDelete(it.id);
  };

  const cls = 'card in' + (it.state === 'work' ? ' working' : '') + (done ? ' is-done' : '');
  const barWidth = (done ? Math.max(2, Math.round(it.out.size / it.size * 100)) : 100) + '%';

  return (
    <article ref={el} className={cls} data-id={it.id} style={{ animationDelay: it.delay + 'ms' }}>
      <button className="shot" ref={shotRef} title="Compare before and after" onClick={() => onOpen(it.id)}>
        <img alt="" loading="lazy" src={it.url || it.src} />
        <Chip it={it} />
      </button>
      <div className="meta">
        <div className="top">
          <div className="name" title={it.name + (it.note ? ' · ' + it.note : '')}>{it.name}</div>
          <Sizes it={it} />
        </div>
        <div className={'bar' + (done ? '' : ' idle')}><i style={{ width: barWidth }}></i></div>
        <div className="knob" hidden={!spec}>
          <label>{spec ? spec.label : ''}</label>
          {/* don't let a slider drag start a card press animation */}
          <input
            type="range"
            min={spec ? spec.min : 0}
            max={spec ? spec.max : 100}
            step={spec ? spec.step : 1}
            value={spec ? it[spec.key] : 0}
            onChange={e => onKnob(it, +e.target.value)}
            onPointerDown={e => e.stopPropagation()}
          />
          <output>{spec ? spec.fmt(it[spec.key]) : ''}</output>
        </div>
        <div className="row">
          <button className="btn" onClick={() => onOpen(it.id)}>Compare</button>
          <button className="btn" disabled={!done} onClick={() => onSave(it)}>Save</button>
          <button className="btn ghost x" aria-label="Remove" onClick={remove}>×</button>
        </div>
      </div>
    </article>
  );
}
