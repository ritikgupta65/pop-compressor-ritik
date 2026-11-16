/* ============================ encode ============================ */
import { quantizeRGBA } from './quantize';
import { encodeIndexedPNG, encodeTruecolorPNG, measure } from './png';
import { dbOf } from './format';

export const canDeflate = () => typeof CompressionStream !== 'undefined';
async function deflate(bytes){
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const toBlob = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));

function frame(item, opts){
  const src = item.bitmap;
  let w = src.width, h = src.height;
  if (opts.maxw && w > opts.maxw){ h = Math.max(1, Math.round(h * opts.maxw / w)); w = opts.maxw; }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return { cv, ctx, w, h };
}

async function pngLossless(w, h, data){
  if (!canDeflate()) return null;
  const bytes = await encodeTruecolorPNG(w, h, new Uint8Array(data.buffer.slice(0)), deflate);
  return { blob: new Blob([bytes], { type:'image/png' }), quality: Infinity, note: 'lossless' };
}

async function pngPalette(w, h, data, colors, dither){
  const q = quantizeRGBA(Uint8ClampedArray.from(data), w, h, colors, dither);
  const m = measure(data, q.indices, q.palette);
  const bytes = await encodeIndexedPNG(w, h, q.indices, q.palette, deflate);
  return {
    blob: new Blob([bytes], { type:'image/png' }),
    quality: m.psnr, palette: q.palette.length,
    note: `${q.palette.length} colors · ${m.psnr === Infinity ? 'lossless' : m.psnr.toFixed(1) + ' dB'}`
  };
}

/* auto: find the smallest palette that still clears the quality floor,
   and fall back to true lossless when no palette can.                */
async function pngAuto(item, w, h, data){
  const floor = dbOf(item.target);
  const sizes = [16, 24, 32, 48, 64, 96, 128, 160, 192, 224, 256];
  let lo = 0, hi = sizes.length - 1, hit = null;
  while (lo <= hi){
    const mid = (lo + hi) >> 1;
    const r = await pngPalette(w, h, data, sizes[mid], 0);
    if (r.quality >= floor){ hit = r; hi = mid - 1; } else lo = mid + 1;
  }
  const loss = await pngLossless(w, h, data);
  const pool = [hit, loss].filter(Boolean);
  if (!pool.length) return null;
  pool.sort((a, b) => a.blob.size - b.blob.size);
  return pool[0];
}

export async function encode(item, opts){
  const target = opts.fmt === 'auto' ? item.type : opts.fmt;

  if (target === 'image/png'){
    const { cv, ctx, w, h } = frame(item, opts);
    const data = ctx.getImageData(0, 0, w, h).data;
    let best = null;

    if (!canDeflate()){
      best = { blob: await toBlob(cv, 'image/png'), quality: Infinity, note: 'browser fallback' };
    } else if (opts.mode === 'lossless'){
      best = await pngLossless(w, h, data);
    } else if (opts.mode === 'auto'){
      best = await pngAuto(item, w, h, data);
    } else {
      const tries = [await pngPalette(w, h, data, item.colors, opts.dither / 100)];
      if (opts.dither) tries.push(await pngPalette(w, h, data, item.colors, 0));
      tries.sort((a, b) => a.blob.size - b.blob.size);
      best = tries[0];
    }
    finish(item, best.blob, best.note, best.quality, opts);
    return;
  }

  // lossy targets
  const { cv, ctx, w, h } = frame(item, opts);
  let blob;
  const q = (opts.mode === 'lossless' ? 100 : item.quality) / 100;
  if (target === 'image/jpeg'){
    const px = ctx.getImageData(0, 0, w, h);
    const flat = document.createElement('canvas');
    flat.width = w; flat.height = h;
    const f = flat.getContext('2d');
    f.fillStyle = '#fff'; f.fillRect(0, 0, w, h);
    f.putImageData(px, 0, 0);
    f.globalCompositeOperation = 'destination-over';
    f.fillStyle = '#fff'; f.fillRect(0, 0, w, h);
    blob = await toBlob(flat, 'image/jpeg', q);
  } else {
    blob = await toBlob(cv, target, q);
    if (!blob || blob.type !== target) blob = await toBlob(cv, 'image/jpeg', q);
  }
  if (!blob) throw new Error('encode failed');
  finish(item, blob, `q${Math.round(q * 100)}`, null, opts);
}

function finish(item, blob, note, quality, opts){
  const sameShape = blob.type === item.type && !opts.maxw;
  if (sameShape && blob.size >= item.size){
    item.out = item.file; item.outType = item.type;
    item.skipped = true; item.note = 'original was already smaller'; item.quality_db = Infinity;
  } else {
    item.out = blob; item.outType = blob.type;
    item.skipped = false; item.note = note; item.quality_db = quality;
  }
  item.state = 'done';
  if (item.url) URL.revokeObjectURL(item.url);
  item.url = URL.createObjectURL(item.out);
}
