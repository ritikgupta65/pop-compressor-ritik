/* ============================ helpers ============================ */
export const MAX = 20;
export const kb = n => n < 1024 ? n + ' B'
  : n < 1048576 ? (n/1024).toFixed(n/1024 < 10 ? 1 : 0) + ' KB'
  : (n/1048576).toFixed(2) + ' MB';
export const extOf = t => t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg';
export const stem = n => n.replace(/\.[^.]+$/, '');
export const pctOf = it => Math.max(0, Math.round((1 - it.out.size / it.size) * 100));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const outName = it => stem(it.name) + '-min.' + extOf(it.outType || it.type);

export const DEFAULT_OPTS = { fmt:'auto', mode:'auto', target:70, quality:82, colors:256, dither:70, maxw:0 };

// quality floor slider (0-100) → PSNR target in dB
export const dbOf = t => 24 + (t / 100) * 26;          // 24 dB (small) .. 50 dB (near identical)
export const gradeOf = db => db === Infinity ? 'lossless'
  : db >= 46 ? 'near identical' : db >= 40 ? 'very high'
  : db >= 34 ? 'high' : db >= 29 ? 'medium' : 'smallest';

// what the inline slider controls depends on mode — one knob, right meaning
export function knobSpec(opts){
  if (opts.fmt !== 'auto') return { key:'quality', min:20, max:100, step:1, label:'Quality', fmt:v => v + '%' };
  if (opts.mode === 'lossless') return null;
  if (opts.mode === 'manual')   return { key:'colors', min:2, max:256, step:2, label:'Colors', fmt:v => v + '' };
  return { key:'target', min:0, max:100, step:5, label:'Quality floor', fmt:v => gradeOf(dbOf(v)) };
}

export function download(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
