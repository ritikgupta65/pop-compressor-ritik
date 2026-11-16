/* ===================================================================
   POP compress · core
   quantizeRGBA  → indices + RGBA palette (alpha is quantized too)
   =================================================================== */

export function quantizeRGBA(data, w, h, maxColors, dither){
  const px = w * h;

  /* ---- histogram ----
     Binning is what keeps this fast: an 8MP noise image has ~2M unique
     colours and median-cutting that directly took over three minutes.
     Buckets hold running sums, so centroids stay accurate even though
     the bucket key is coarse. Bin width adapts to how busy the image is. */
  let RB = 5, AB = 4, hist;                    // rgb bits, alpha bits
  const build = () => {
    const m = new Map();
    const rs = 8 - RB, as = 8 - AB;
    for (let i = 0; i < data.length; i += 4){
      const a = data[i+3] < 8 ? 0 : data[i+3];
      const key = a === 0 ? -1 :
        (((data[i] >> rs) << (RB + RB + AB)) | ((data[i+1] >> rs) << (RB + AB)) |
         ((data[i+2] >> rs) << AB) | (a >> as));
      let b = m.get(key);
      if (b) { b[0]+=data[i]; b[1]+=data[i+1]; b[2]+=data[i+2]; b[3]+=a; b[4]++; }
      else m.set(key, key === -1 ? [0,0,0,0,1] : [data[i],data[i+1],data[i+2],a,1]);
    }
    return m;
  };
  hist = build();
  if (hist.size > 50000){ RB = 4; AB = 3; hist = build(); }   // very busy image, coarsen

  const hasAlpha = hist.has(-1);
  const exact = hist.size <= 4096;              // few enough colours to map precisely
  const colors = [];
  for (const [key, b] of hist){
    if (key === -1) continue;
    colors.push([b[0]/b[4], b[1]/b[4], b[2]/b[4], b[3]/b[4], b[4]]);
  }

  /* ---- median cut over buckets ---- */
  const budget = Math.max(1, hasAlpha ? maxColors - 1 : maxColors);
  let boxes = colors.length ? [colors] : [];
  while (boxes.length && boxes.length < budget){
    let bi = -1, best = -1, axis = 0;
    for (let i = 0; i < boxes.length; i++){
      const b = boxes[i];
      if (b.length < 2) continue;
      const lo = [255,255,255,255], hi = [0,0,0,0];
      for (const c of b) for (let k = 0; k < 4; k++){
        if (c[k] < lo[k]) lo[k] = c[k];
        if (c[k] > hi[k]) hi[k] = c[k];
      }
      const wgt = [1, 1.25, 0.85, 1.6];       // green matters more, alpha most of all
      for (let k = 0; k < 4; k++){
        const spread = (hi[k] - lo[k]) * wgt[k];
        if (spread > best){ best = spread; bi = i; axis = k; }
      }
    }
    if (bi < 0 || best <= 0) break;
    const box = boxes[bi];
    box.sort((a, b) => a[axis] - b[axis]);
    const total = box.reduce((s, c) => s + c[4], 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++){
      acc += box[i][4];
      if (acc >= total / 2){ cut = i + 1; break; }
    }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }

  let pal = boxes.filter(b => b.length).map(b => {
    let r = 0, g = 0, bl = 0, a = 0, n = 0;
    for (const c of b){ r += c[0]*c[4]; g += c[1]*c[4]; bl += c[2]*c[4]; a += c[3]*c[4]; n += c[4]; }
    return [Math.round(r/n), Math.round(g/n), Math.round(bl/n), Math.round(a/n)];
  });
  if (hasAlpha && !pal.some(p => p[3] === 0)) pal.push([0,0,0,0]);
  if (!pal.length) pal = [[0,0,0,0]];
  pal.sort((x, y) => x[3] - y[3]);            // opaque entries last so tRNS truncates

  /* ---- nearest-palette lookup ----
     exact Map for simple images, coarse LUT for busy ones so the
     mapping pass stays linear instead of hammering 256 comparisons. */
  const search = (r, g, b, a) => {
    let bd = Infinity, bidx = 0;
    for (let i = 0; i < pal.length; i++){
      const p = pal[i];
      const da = a - p[3];
      let d = da * da * 3;
      if (a > 8 || p[3] > 8){
        const dr = r - p[0], dg = g - p[1], db = b - p[2];
        d += (dr*dr*0.30 + dg*dg*0.59 + db*db*0.11) * (a / 255);
      }
      if (d < bd){ bd = d; bidx = i; }
    }
    return bidx;
  };
  let nearest;
  if (exact){
    const cache = new Map();
    nearest = (r, g, b, a) => {
      const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
      let hit = cache.get(key);
      if (hit === undefined){ hit = search(r, g, b, a); cache.set(key, hit); }
      return hit;
    };
  } else {
    const lut = new Int16Array(1 << 18).fill(-1);   // 5:5:5:3
    nearest = (r, g, b, a) => {
      const k = ((r >> 3) << 13) | ((g >> 3) << 8) | ((b >> 3) << 3) | (a >> 5);
      let hit = lut[k];
      if (hit < 0){ hit = search(r, g, b, a); lut[k] = hit; }
      return hit;
    };
  }

  const idx = new Uint8Array(px);
  const amount = typeof dither === 'number' ? dither : (dither ? 0.85 : 0);

  if (!amount){
    for (let p = 0, i = 0; p < px; p++, i += 4)
      idx[p] = nearest(data[i], data[i+1], data[i+2], data[i+3] < 8 ? 0 : data[i+3]);
    return { indices: idx, palette: pal };
  }

  // Floyd-Steinberg, serpentine, error carried on RGB only
  const err = new Float32Array(px * 3);
  for (let y = 0; y < h; y++){
    const l2r = y % 2 === 0;
    for (let n = 0; n < w; n++){
      const x = l2r ? n : w - 1 - n;
      const i = (y * w + x) * 4, e = (y * w + x) * 3, p = y * w + x;
      const a = data[i+3] < 8 ? 0 : data[i+3];
      if (!a){ idx[p] = nearest(0,0,0,0); continue; }
      const r = Math.max(0, Math.min(255, data[i]   + err[e]));
      const g = Math.max(0, Math.min(255, data[i+1] + err[e+1]));
      const b = Math.max(0, Math.min(255, data[i+2] + err[e+2]));
      const k = nearest(r|0, g|0, b|0, a);
      idx[p] = k;
      const q = pal[k];
      const de = [(r - q[0]) * amount, (g - q[1]) * amount, (b - q[2]) * amount];
      const push = (dx, dy, f) => {
        const nx = x + (l2r ? dx : -dx), ny = y + dy;
        if (nx < 0 || nx >= w || ny >= h) return;
        const j = (ny * w + nx) * 3;
        err[j] += de[0]*f; err[j+1] += de[1]*f; err[j+2] += de[2]*f;
      };
      push(1,0,7/16); push(-1,1,3/16); push(0,1,5/16); push(1,1,1/16);
    }
  }
  return { indices: idx, palette: pal };
}
