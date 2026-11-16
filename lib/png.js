/* encodeIndexedPNG → real colorType-3 PNG, 1/2/4/8 bpp, PLTE + tRNS
   deflate is injected: CompressionStream in browser, zlib in node */

/* ---------------------- indexed PNG writer ---------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(bytes){
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, body){
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

// pack indices into scanlines at the smallest legal bit depth, filter 0
function packRows(idx, w, h, depth){
  const per = 8 / depth;
  const stride = Math.ceil(w / per);
  const raw = new Uint8Array((stride + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++){
    raw[o++] = 0;                        // filter: none (palette rows gain nothing from filters)
    if (depth === 8){
      raw.set(idx.subarray(y * w, y * w + w), o);
      o += stride;
    } else {
      for (let x = 0; x < w; x++){
        const bit = (x % per) * depth;
        raw[o + ((x / per) | 0)] |= idx[y * w + x] << (8 - depth - bit);
      }
      o += stride;
    }
  }
  return raw;
}

export async function encodeIndexedPNG(w, h, indices, palette, deflate){
  const n = palette.length;
  const depth = n <= 2 ? 1 : n <= 4 ? 2 : n <= 16 ? 4 : 8;

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = depth; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const plte = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++){ plte[i*3] = palette[i][0]; plte[i*3+1] = palette[i][1]; plte[i*3+2] = palette[i][2]; }

  // tRNS only needs to cover up to the last non-opaque entry
  let last = -1;
  for (let i = 0; i < n; i++) if (palette[i][3] < 255) last = i;
  const trns = last >= 0 ? new Uint8Array(last + 1).map((_, i) => palette[i][3]) : null;

  const idat = await deflate(packRows(indices, w, h, depth));

  const parts = [
    new Uint8Array([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    ...(trns ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0))
  ];
  const size = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(size);
  let off = 0;
  for (const p of parts){ png.set(p, off); off += p.length; }
  return png;
}

/* ------------------ lossless truecolor encoder ------------------
   Same pixels out as in. Savings come from picking the best filter
   per scanline and letting DEFLATE work on the residuals, plus
   dropping the alpha channel when nothing is transparent.        */
function pickFilters(px, w, h, bpp){
  const stride = w * bpp;
  const raw = new Uint8Array((stride + 1) * h);
  const cand = new Uint8Array(stride * 5);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride), o = 0;

  for (let y = 0; y < h; y++){
    cur.set(px.subarray(y * stride, y * stride + stride));
    let bestType = 0, bestCost = Infinity;

    for (let t = 0; t < 5; t++){
      let cost = 0;
      const base = t * stride;
      for (let i = 0; i < stride; i++){
        const a = i >= bpp ? cur[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let v;
        if (t === 0) v = cur[i];
        else if (t === 1) v = cur[i] - a;
        else if (t === 2) v = cur[i] - b;
        else if (t === 3) v = cur[i] - ((a + b) >> 1);
        else {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = cur[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        v &= 255;
        cand[base + i] = v;
        cost += v < 128 ? v : 256 - v;      // minimum sum of absolute differences
      }
      if (cost < bestCost){ bestCost = cost; bestType = t; }
    }
    raw[o++] = bestType;
    raw.set(cand.subarray(bestType * stride, bestType * stride + stride), o);
    o += stride;
    const swap = prev; prev = cur; cur = swap;
  }
  return raw;
}

export async function encodeTruecolorPNG(w, h, rgba, deflate){
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255){ opaque = false; break; }
  const bpp = opaque ? 3 : 4;

  let px;
  if (opaque){
    px = new Uint8Array(w * h * 3);
    for (let s = 0, d = 0; s < rgba.length; s += 4, d += 3){
      px[d] = rgba[s]; px[d+1] = rgba[s+1]; px[d+2] = rgba[s+2];
    }
  } else {
    px = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer ? rgba.buffer.slice(0) : rgba);
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = await deflate(pickFilters(px, w, h, bpp));
  const parts = [
    new Uint8Array([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))
  ];
  const size = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(size);
  let off = 0;
  for (const p of parts){ png.set(p, off); off += p.length; }
  return png;
}

/* ---- error of a palette result against the source, in dB ---- */
export function measure(orig, indices, palette){
  let se = 0, n = 0, worst = 0, aErr = 0;
  for (let p = 0, i = 0; p < indices.length; p++, i += 4){
    const q = palette[indices[p]];
    const oa = orig[i+3] < 8 ? 0 : orig[i+3];
    aErr = Math.max(aErr, Math.abs(oa - q[3]));
    if (oa <= 8) continue;
    let px = 0;
    for (let k = 0; k < 3; k++){ const d = orig[i+k] - q[k]; se += d*d; px += d*d; }
    if (px > worst) worst = px;
    n++;
  }
  if (!n) return { psnr: Infinity, worst: 0, aErr };
  const mse = se / (n * 3);
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10(65025 / mse), worst: Math.sqrt(worst / 3), aErr };
}
