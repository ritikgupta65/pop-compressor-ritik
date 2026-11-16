'use client';
import Range from './Range';
import { gradeOf, dbOf } from '@/lib/format';

const MODES = ['lossless', 'auto', 'manual'];

export default function ControlStrip({ opts, onMode, onLive, onDither, onCommit, onMaxWidth }) {
  const png = opts.fmt === 'auto';
  const note =
    !png ? 'Re-encoded as ' + (opts.fmt === 'image/webp' ? 'WebP' : 'JPEG') + ' — lossy by nature.'
    : opts.mode === 'lossless' ? 'Pixel-for-pixel identical. Savings come from filtering, not colour loss.'
    : opts.mode === 'auto' ? 'Picks the smallest palette that clears your floor, else stays lossless.'
    : 'You set the palette. Watch the dB readout on each tile.';

  return (
    <div className="strip">
      <div className="ctl" hidden={!png}>
        <label>PNG mode</label>
        <div className="seg modes" role="group" aria-label="PNG mode">
          {MODES.map(m => (
            <button key={m} aria-pressed={String(opts.mode === m)} onClick={() => onMode(m)}>{m}</button>
          ))}
        </div>
      </div>
      <div className="ctl" hidden={!(png && opts.mode === 'auto')}>
        <label htmlFor="target">Quality floor</label>
        <Range id="target" min={0} max={100} step={5} value={opts.target} onInput={v => onLive('target', v)} onCommit={onCommit} />
        <output htmlFor="target">{gradeOf(dbOf(opts.target))}</output>
      </div>
      <div className="ctl narrow" hidden={!(png && opts.mode === 'manual')}>
        <label htmlFor="colors">Colors</label>
        <Range id="colors" min={2} max={256} step={2} value={opts.colors} onInput={v => onLive('colors', v)} onCommit={onCommit} />
        <output htmlFor="colors">{opts.colors + ''}</output>
      </div>
      <div className="ctl narrow" hidden={!(png && opts.mode === 'manual')}>
        <label htmlFor="dither">Dither</label>
        <Range id="dither" min={0} max={100} step={5} value={opts.dither} onInput={onDither} onCommit={onCommit} />
        <output htmlFor="dither">{opts.dither ? opts.dither + '%' : 'off'}</output>
      </div>
      <div className="ctl narrow" hidden={png}>
        <label htmlFor="quality">Quality</label>
        <Range id="quality" min={20} max={100} step={1} value={opts.quality} onInput={v => onLive('quality', v)} onCommit={onCommit} />
        <output htmlFor="quality">{opts.quality + '%'}</output>
      </div>
      <div className="ctl narrow">
        <label htmlFor="maxw">Max width</label>
        <select id="maxw" value={opts.maxw} onChange={e => onMaxWidth(+e.target.value)}>
          <option value="0">Original</option>
          <option value="2560">2560 px</option>
          <option value="1920">1920 px</option>
          <option value="1280">1280 px</option>
          <option value="800">800 px</option>
        </select>
      </div>
      <span className="hint" style={{ marginLeft: 'auto' }}>{note}</span>
    </div>
  );
}
