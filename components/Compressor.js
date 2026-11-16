'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Header from './Header';
import ControlStrip from './ControlStrip';
import Totals from './Totals';
import EmptyState from './EmptyState';
import Card from './Card';
import Inspector from './Inspector';
import { createPortal } from '@/lib/portal';
import { encode, canDeflate } from '@/lib/encode';
import { MAX, DEFAULT_OPTS, knobSpec, pctOf, outName, download } from '@/lib/format';

/* Items and options live in refs and are mutated in place, the same way the
   original script did; `refresh()` re-renders after each change. This keeps
   the async encode queue reading live state instead of stale React copies. */
export default function Compressor() {
  const [, refresh] = useReducer(x => x + 1, 0);
  const items = useRef([]);
  const opts = useRef({ ...DEFAULT_OPTS });
  const seq = useRef(0);
  const busy = useRef(false);
  const current = useRef(null);
  const pending = useRef(new Map());
  const portal = useRef(null);
  const tiles = useRef(new Map());
  const fx = useRef(null);
  const main = useRef(null);
  const fileInput = useRef(null);

  const [view, setView] = useState('grid');
  const [noDeflate, setNoDeflate] = useState(false);
  const [inspect, setInspect] = useState(null);
  const token = useRef(0);

  /* ============================ files ============================ */
  async function add(list){
    const room = MAX - items.current.length;
    const incoming = [...list].filter(f => /image\/(png|jpeg|webp)/.test(f.type)).slice(0, Math.max(0, room));
    if (!incoming.length){ portal.current && portal.current.done(); return; }
    const o = opts.current;
    for (const f of incoming){
      const item = {
        id: ++seq.current, file: f, name: f.name, size: f.size, type: f.type, fresh: true,
        quality: o.quality, colors: o.colors, target: o.target,
        out: null, outType: null, url: null, note: '', quality_db: null, state: 'idle', bitmap: null
      };
      try {
        item.bitmap = await createImageBitmap(f);
        item.src = URL.createObjectURL(f);
        item.delay = Math.min(items.current.length * 45, 400);
        items.current.push(item);
      } catch { /* unreadable, skip */ }
    }
    portal.current && portal.current.done();
    refresh();
    runAll();
  }

  async function runAll(){
    if (busy.current) return;
    busy.current = true; refresh();
    for (const it of items.current){
      if (it.state === 'done') continue;
      it.state = 'work'; refresh();
      await new Promise(r => setTimeout(r, 16));
      try { await encode(it, opts.current); } catch (e){ it.state = 'error'; it.note = String(e.message || e); }
      refresh();
    }
    busy.current = false; refresh();
  }

  // re-encode a single item, debounced — this is what the inline sliders drive
  function requeue(it, delay = 380){
    clearTimeout(pending.current.get(it.id));
    pending.current.set(it.id, setTimeout(async () => {
      it.state = 'work'; refresh();
      try { await encode(it, opts.current); } catch { it.state = 'error'; }
      refresh();
    }, delay));
  }

  async function saveAll(){
    const done = items.current.filter(i => i.state === 'done');
    if (!done.length) return;
    let JSZip = null;
    try { JSZip = (await import('jszip')).default; } catch { /* fall back to single files */ }
    if (JSZip){
      const zip = new JSZip();
      for (const it of done) zip.file(outName(it), it.out);
      download(await zip.generateAsync({ type: 'blob' }), 'pop-compressed.zip');
    } else {
      for (const it of done){ download(it.out, outName(it)); await new Promise(r => setTimeout(r, 320)); }
    }
  }

  function invalidate(){
    for (const it of items.current){
      if (it.url) URL.revokeObjectURL(it.url);
      it.url = null; it.out = null; it.state = 'idle';
      it.skipped = false; it.note = ''; it.quality_db = null;
    }
    refresh();
    runAll();
  }

  function clear(){
    for (const it of items.current){ it.url && URL.revokeObjectURL(it.url); URL.revokeObjectURL(it.src); }
    items.current = []; refresh();
  }

  function remove(id){
    const list = items.current;
    const i = list.findIndex(x => x.id === id);
    if (i > -1){ list[i].url && URL.revokeObjectURL(list[i].url); URL.revokeObjectURL(list[i].src); list.splice(i, 1); }
    refresh();
  }

  function animateIn(files, x, y){
    const urls = files.slice(0, 10).map(f => URL.createObjectURL(f));
    portal.current && portal.current.swallow(urls, x, y);
    setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 6000);
    add(files);
  }

  const mainCenter = () => {
    const b = main.current.getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  };

  /* ============================ inspector ============================ */
  function open(id){
    const it = items.current.find(i => i.id === id);
    if (!it) return;
    current.current = it;
    const spec = knobSpec(opts.current);
    const done = it.state === 'done';
    setInspect({
      token: ++token.current, id,
      snap: {
        name: it.name,
        dims: `${it.bitmap.width} × ${it.bitmap.height}${it.note ? ' · ' + it.note : ''}`,
        before: it.src,
        after: it.url || it.src,
        done, size: it.size,
        outSize: done ? it.out.size : 0,
        pct: done ? pctOf(it) : 0,
        spec, value: spec ? it[spec.key] : 0
      }
    });
  }

  function inspectorKnob(v){
    const it = current.current;
    if (!it) return null;
    const spec = knobSpec(opts.current); if (!spec) return null;
    it[spec.key] = v;
    requeue(it, 420);
    return spec.fmt(it[spec.key]);
  }

  /* ============================ events ============================ */
  useEffect(() => {
    setNoDeflate(!canDeflate());
    portal.current = createPortal(fx.current, () => main.current);

    /* ---- drag & drop feeds the portal ---- */
    let depth = 0;
    const P = () => portal.current;
    const onEnter = e => { e.preventDefault(); depth++; document.body.classList.add('dragging'); P().hover(e.clientX, e.clientY); };
    const onOver = e => { e.preventDefault(); P().hover(e.clientX, e.clientY); };
    const onLeave = () => { if (--depth <= 0){ document.body.classList.remove('dragging'); P().leave(); } };
    const onDrop = e => {
      e.preventDefault(); depth = 0;
      document.body.classList.remove('dragging');
      const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
      if (!files.length){ P().leave(); return; }
      animateIn(files, e.clientX, e.clientY);
    };
    const onPaste = e => {
      const files = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (!files.length) return;
      animateIn(files, ...mainCenter());
    };
    addEventListener('dragenter', onEnter);
    addEventListener('dragover', onOver);
    addEventListener('dragleave', onLeave);
    addEventListener('drop', onDrop);
    addEventListener('paste', onPaste);
    return () => {
      removeEventListener('dragenter', onEnter);
      removeEventListener('dragover', onOver);
      removeEventListener('dragleave', onLeave);
      removeEventListener('drop', onDrop);
      removeEventListener('paste', onPaste);
      portal.current.destroy();
      portal.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = items.current;
  const o = opts.current;
  const done = list.filter(i => i.state === 'done').length;
  const left = list.length - done;
  const spec = knobSpec(o);
  const pick = () => fileInput.current.click();

  return (
    <>
      <canvas id="fx" ref={fx} aria-hidden="true"></canvas>

      <Header
        fmt={o.fmt} view={view} busy={busy.current} left={left} done={done} total={list.length}
        onFormat={f => { o.fmt = f; invalidate(); }}
        onView={setView}
        onPick={pick}
        onClear={clear}
        onRun={runAll}
        onSaveAll={saveAll}
      />
      <input type="file" ref={fileInput} accept="image/png,image/jpeg,image/webp" multiple hidden
        onChange={e => {
          const files = [...e.target.files];
          e.target.value = '';
          animateIn(files, ...mainCenter());
        }} />

      <div className="warn" hidden={!noDeflate}>This browser has no CompressionStream, so PNGs fall back to plain re-encoding and will save far less. Chrome, Edge, Safari 16.4+ or Firefox 113+ get the full encoder.</div>

      <ControlStrip
        opts={o}
        onMode={m => { o.mode = m; invalidate(); }}
        onLive={(key, v) => {
          o[key] = v;
          list.forEach(i => { if (key in i) i[key] = v; });
          refresh();
        }}
        onDither={v => { o.dither = v; refresh(); }}
        onCommit={() => invalidate()}
        onMaxWidth={v => { o.maxw = v; invalidate(); }}
      />

      <Totals items={list} busy={busy.current} />

      <main ref={main}>
        <EmptyState hidden={list.length > 0} onPick={pick} />
        <div id="grid" className={view} hidden={!list.length}>
          {list.map(it => (
            <Card
              key={it.id}
              it={it}
              spec={spec}
              shotRef={el => { if (el) tiles.current.set(it.id, el); else tiles.current.delete(it.id); }}
              onOpen={open}
              onSave={x => { if (x.out) download(x.out, outName(x)); }}
              onDelete={remove}
              onKnob={(x, v) => { if (!spec) return; x[spec.key] = v; refresh(); requeue(x); }}
            />
          ))}
        </div>
      </main>

      <Inspector
        session={inspect}
        getTile={id => tiles.current.get(id)}
        onKnob={inspectorKnob}
        onSave={() => { const it = current.current; if (it && it.out) download(it.out, outName(it)); }}
        onClosed={() => { setInspect(null); current.current = null; }}
      />
    </>
  );
}
