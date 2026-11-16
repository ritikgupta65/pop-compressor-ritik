/* ===================================================================
   portal · drag-and-drop vortex
   follows the pointer inside the drop area, then swallows the files
   =================================================================== */
export function createPortal(cv, getArea){
  // canvas is passed in
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACCENT = [61, 123, 250]; // #3d7bfa — keep in sync with $accent
  const rgba = (a, l = 1) => `rgba(${ACCENT.map(c => Math.min(255, Math.round(c * l))).join(',')},${a})`;

  let W = 0, H = 0, raf = null, last = 0;
  const P = {
    x: 0, y: 0, tx: 0, ty: 0,     // position, eased toward target
    open: 0, want: 0,             // 0..1 aperture
    spin: 0, pulse: 0,
    phase: 'idle',                // idle | hover | suck | collapse
    shock: 0,
    sprites: [], motes: []
  };
  const R = () => Math.min(150, Math.max(84, Math.min(W, H) * 0.16)); // portal radius

  function size(){
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', size); size();

  // swirling motes that stream inward forever while the portal is open
  function seed(){
    P.motes.length = 0;
    for (let i = 0; i < 96; i++) P.motes.push({
      a: Math.random() * Math.PI * 2,
      r: 0.45 + Math.random() * 1.9,       // in portal radii
      sp: 0.7 + Math.random() * 1.5,
      z: 0.4 + Math.random() * 0.8,
      w: Math.random() * 0.5 + 0.5
    });
  }
  seed();

  function clampToArea(x, y){
    const el = getArea();
    if (!el) return [x, y];
    const b = el.getBoundingClientRect(), pad = R() * 0.75;
    return [
      Math.min(b.right - pad, Math.max(b.left + pad, x)),
      Math.min(b.bottom - pad, Math.max(b.top + pad, y))
    ];
  }

  function start(){ if (!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }

  /* ---- public ---- */
  function hover(x, y){
    const [cx, cy] = clampToArea(x, y);
    if (P.phase === 'idle'){ P.x = cx; P.y = cy; }   // no fly-in from a stale spot
    P.tx = cx; P.ty = cy;
    P.phase = 'suck' === P.phase ? P.phase : 'hover';
    P.want = 1;
    cv.style.opacity = 1;
    if (reduce){ paintStatic(); return; }
    start();
  }
  function leave(){
    if (P.phase === 'suck' || P.phase === 'collapse') return;
    P.want = 0; P.phase = 'idle';
    if (reduce) cv.style.opacity = 0;
  }
  // swallow: thumbnails spiral in. urls may be empty — motes still surge.
  function swallow(urls, x, y){
    const [cx, cy] = clampToArea(x ?? P.x ?? W / 2, y ?? P.y ?? H / 2);
    if (P.phase === 'idle'){ P.x = cx; P.y = cy; }
    P.tx = cx; P.ty = cy;
    P.phase = 'suck'; P.want = 1; P.pulse = 1;
    cv.style.opacity = 1;
    if (reduce){ setTimeout(() => { P.phase = 'idle'; P.want = 0; cv.style.opacity = 0; }, 160); return; }
    P.sprites = (urls || []).slice(0, 10).map((u, i) => {
      const img = new Image(); img.src = u;
      return {
        img, a: (i / Math.max(1, urls.length)) * Math.PI * 2 + Math.random(),
        r: 2.5 + Math.random() * 1.1, spin: (Math.random() - 0.5) * 4,
        rot: (Math.random() - 0.5) * 0.6, t: 0, delay: i * 0.05
      };
    });
    if (!P.sprites.length) P.sprites = [];
    start();
  }
  function done(){ if (P.phase === 'suck'){ P.phase = 'collapse'; P.shock = 0.001; } }

  /* ---- draw ---- */
  function core(r, open){
    // throat: dark hole with a hot rim
    const g = ctx.createRadialGradient(P.x, P.y, r * 0.05, P.x, P.y, r);
    g.addColorStop(0, 'rgba(6,7,9,0.96)');
    g.addColorStop(0.55, 'rgba(10,11,14,0.72)');
    g.addColorStop(0.86, rgba(0.20 * open, 1));
    g.addColorStop(1, rgba(0, 1));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.fill();
  }
  function rings(r, open){
    // three ellipses at different tilts, rotating at different rates
    for (let i = 0; i < 3; i++){
      const k = 1 - i * 0.17;
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.rotate(P.spin * (i % 2 ? -0.6 : 1) + i * 0.7);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * k, r * k * (0.34 + i * 0.13), 0, 0, 7);
      ctx.strokeStyle = rgba((0.5 - i * 0.13) * open);
      ctx.lineWidth = 1.4 - i * 0.3;
      ctx.stroke();
      ctx.restore();
    }
    // aperture ring + soft bloom
    ctx.beginPath(); ctx.arc(P.x, P.y, r * (0.99 + P.pulse * 0.12), 0, 7);
    ctx.strokeStyle = rgba(0.85 * open); ctx.lineWidth = 2 + P.pulse * 2; ctx.stroke();
    const bloom = ctx.createRadialGradient(P.x, P.y, r * 0.8, P.x, P.y, r * (1.9 + P.pulse));
    bloom.addColorStop(0, rgba(0.16 * open));
    bloom.addColorStop(1, rgba(0));
    ctx.fillStyle = bloom;
    ctx.beginPath(); ctx.arc(P.x, P.y, r * (1.9 + P.pulse), 0, 7); ctx.fill();
  }
  function motes(r, open, dt, surge){
    ctx.lineCap = 'round';
    for (const m of P.motes){
      m.a += (0.5 + m.sp * 0.6) * dt * (1 + surge * 1.6) / Math.max(0.35, m.r);
      m.r -= dt * m.sp * (0.28 + surge * 1.5);
      if (m.r < 0.12){ m.r = 1.7 + Math.random() * 1.5; m.a = Math.random() * 7; }
      const rr = m.r * r;
      const x = P.x + Math.cos(m.a) * rr;
      const y = P.y + Math.sin(m.a) * rr * 0.62;   // squash: the portal lies at an angle
      const tail = 0.16 + surge * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(P.x + Math.cos(m.a - tail) * rr * 0.94, P.y + Math.sin(m.a - tail) * rr * 0.58);
      ctx.strokeStyle = rgba(Math.min(0.85, (1.5 - m.r) * 0.5) * open * m.w, 1.1);
      ctx.lineWidth = m.z * (1 + surge);
      ctx.stroke();
    }
  }
  function sprites(r, dt){
    for (const s of P.sprites){
      if (s.delay > 0){ s.delay -= dt; continue; }
      s.t += dt;
      s.a += dt * (1.6 + s.spin * 0.4);
      s.r -= dt * (0.9 + s.t * 1.5);
      if (s.r < 0.02) continue;
      const rr = s.r * r;
      const x = P.x + Math.cos(s.a) * rr, y = P.y + Math.sin(s.a) * rr * 0.7;
      const sc = Math.max(0, Math.min(1, s.r / 2.4));
      const box = r * 0.62 * sc;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.r * 0.7));
      ctx.translate(x, y);
      ctx.rotate(s.a * 0.25 + s.rot * (1 - sc) * 6);
      if (s.img.complete && s.img.naturalWidth){
        const ar = s.img.naturalWidth / s.img.naturalHeight;
        const w = ar >= 1 ? box : box * ar, h = ar >= 1 ? box / ar : box;
        ctx.drawImage(s.img, -w / 2, -h / 2, w, h);
        ctx.strokeStyle = rgba(0.5); ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = rgba(0.5);
        ctx.fillRect(-box / 2, -box / 2, box, box);
      }
      ctx.restore();
    }
    P.sprites = P.sprites.filter(s => s.r > 0.02);
  }
  function paintStatic(){
    ctx.clearRect(0, 0, W, H);
    const r = R();
    core(r, 1); rings(r, 1);
  }

  function tick(now){
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);

    // ease position and aperture
    P.x += (P.tx - P.x) * Math.min(1, dt * 11);
    P.y += (P.ty - P.y) * Math.min(1, dt * 11);
    P.open += (P.want - P.open) * Math.min(1, dt * (P.want ? 9 : 6));
    P.pulse *= 1 - Math.min(1, dt * 5);
    P.spin += dt * (0.55 + (P.phase === 'suck' ? 2.6 : 0));

    const surge = P.phase === 'suck' ? 1 : P.phase === 'collapse' ? 0.4 : 0;
    const r = R() * (0.9 + P.open * 0.1) * (P.phase === 'collapse' ? Math.max(0, 1 - P.shock * 1.5) : 1);

    if (P.open > 0.01){
      motes(r, P.open, dt, surge);
      core(r, P.open);
      rings(r, P.open);
      if (P.sprites.length) sprites(r, dt);
    }

    if (P.phase === 'collapse'){
      P.shock += dt * 1.9;
      const sr = r * (1 + P.shock * 2.6);
      ctx.beginPath(); ctx.arc(P.x, P.y, sr, 0, 7);
      ctx.strokeStyle = rgba(Math.max(0, 0.55 - P.shock * 0.55));
      ctx.lineWidth = 3 * Math.max(0, 1 - P.shock);
      ctx.stroke();
      P.want = 0;
      if (P.shock > 1 && P.open < 0.02){ P.phase = 'idle'; P.sprites.length = 0; seed(); }
    }

    if (P.phase === 'idle' && P.open < 0.02 && !P.sprites.length){
      ctx.clearRect(0, 0, W, H);
      cv.style.opacity = 0;
      raf = null; return;
    }
    raf = requestAnimationFrame(tick);
  }


  function destroy(){
    removeEventListener('resize', size);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  return { hover, leave, swallow, done, destroy };
}
