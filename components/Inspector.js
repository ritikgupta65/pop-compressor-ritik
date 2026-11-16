'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { kb, clamp, prefersReducedMotion } from '@/lib/format';

/* session = { token, id, snap } while open; snap is taken when the
   inspector opens, exactly like the original single-shot fill.        */
export default function Inspector({ session, getTile, onKnob, onSave, onClosed }) {
  const panel = useRef(null), stack = useRef(null), handle = useRef(null);
  const afterWrap = useRef(null), afterImg = useRef(null);
  const [value, setValue] = useState(70);
  const [out, setOut] = useState('very high');
  const live = useRef(session);
  live.current = session;
  const dragging = useRef(false);

  const snap = session ? session.snap : null;

  const setSplit = pct => {
    if (!stack.current) return;
    pct = clamp(pct, 0, 100);
    handle.current.style.left = pct + '%';
    afterWrap.current.style.width = pct + '%';
    afterImg.current.style.width = stack.current.clientWidth + 'px';
  };

  const close = () => {
    if (prefersReducedMotion()){ onClosed(); return; }
    const anim = panel.current.animate(
      [{ opacity:1, transform:'none' }, { opacity:0, transform:'scale(.965) translateY(6px)' }],
      { duration:180, easing:'cubic-bezier(.4,0,1,1)' });
    anim.onfinish = () => onClosed();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // ease the panel out of the tile that was clicked
  useLayoutEffect(() => {
    if (!session) return;
    if (session.snap.spec){
      setValue(session.snap.value);
      setOut(session.snap.spec.fmt(session.snap.value));
    }
    setSplit(50);
    const tile = getTile(session.id);
    if (tile && !prefersReducedMotion()){
      const a = tile.getBoundingClientRect(), b = panel.current.getBoundingClientRect();
      panel.current.animate([
        { transformOrigin:'top left', opacity:0,
          transform:`translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})` },
        { transformOrigin:'top left', opacity:1, transform:'none' }
      ], { duration:320, easing:'cubic-bezier(.22,.85,.2,1)' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session && session.token]);

  useEffect(() => {
    const trackSplit = e => {
      const r = stack.current.getBoundingClientRect();
      setSplit(((e.clientX - r.left) / r.width) * 100);
    };
    const onMove = e => { if (dragging.current) trackSplit(e); };
    const onUp = () => { dragging.current = false; };
    const onResize = () => { if (live.current) setSplit(parseFloat(handle.current.style.left) || 50); };
    const onKey = e => { if (e.key === 'Escape' && live.current) closeRef.current(); };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
    };
  }, []);

  const onPointerDown = e => {
    dragging.current = true;
    const r = stack.current.getBoundingClientRect();
    setSplit(((e.clientX - r.left) / r.width) * 100);
  };

  const onSlide = e => {
    const v = +e.target.value;
    setValue(v);
    const text = onKnob(v);
    if (text != null) setOut(text);
  };

  return (
    <div className={'sheet' + (session ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Image inspector"
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="panel" ref={panel}>
        <div className="head">
          <span className="name">{snap ? snap.name : '—'}</span>
          <span className="hint">{snap ? snap.dims : ''}</span>
          <button className="btn ghost" onClick={close}>Close</button>
        </div>
        <div className="compare" onPointerDown={onPointerDown}>
          <div className="stack" ref={stack}>
            <img alt="Original" src={snap ? snap.before : undefined} onLoad={() => setSplit(50)} />
            <div className="after" ref={afterWrap}><img ref={afterImg} alt="Compressed" src={snap ? snap.after : undefined} /></div>
            <div className="handle" ref={handle} style={{ left: '50%' }}></div>
          </div>
          <span className="tag l">before</span>
          <span className="tag r">after</span>
        </div>
        <div className="foot">
          <div className="ctl" hidden={!(snap && snap.spec)}>
            <label htmlFor="is">{snap && snap.spec ? snap.spec.label : 'Quality'}</label>
            <input type="range" id="is"
              min={snap && snap.spec ? snap.spec.min : 0}
              max={snap && snap.spec ? snap.spec.max : 100}
              step={snap && snap.spec ? snap.spec.step : 5}
              value={value} onChange={onSlide} />
            <output>{out}</output>
          </div>
          <span className="sizes">
            {snap && (snap.done
              ? <><s>{kb(snap.size)}</s><span>→</span><b>{kb(snap.outSize)}</b><em>−{snap.pct}%</em></>
              : <b>{kb(snap.size)}</b>)}
          </span>
          <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={!snap || !snap.done} onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
