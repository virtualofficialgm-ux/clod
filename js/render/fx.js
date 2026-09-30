// Частицы и мелкие «мультяшные» эффекты: пыль, искры, конфетти, кубики, облачка эмоций.
(function () {
  const NP = window.NP;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);

  function Particles(max) { this.p = []; this.max = max || 400; }
  Particles.prototype.emit = function (x, y, o) {
    o = o || {};
    const n = o.count || 8;
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const a = o.angle !== undefined ? o.angle + rnd(-(o.spread || 0.5), o.spread || 0.5) : rnd(0, Math.PI * 2);
      const sp = rnd(o.speed ? o.speed * 0.4 : 10, o.speed || 40);
      const life = rnd((o.life || 0.8) * 0.6, o.life || 0.8);
      this.p.push({
        x: x + rnd(-(o.jitter || 0), o.jitter || 0), y: y + rnd(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0),
        life, max: life, c: pick(o.color || '#ffffff'), s: o.size || 2, g: o.gravity || 0,
        drag: o.drag === undefined ? 1.5 : o.drag, floor: o.floor, glyph: o.glyph, spin: o.spin,
      });
    }
  };
  Particles.prototype.update = function (dt) {
    const out = [];
    for (const q of this.p) {
      q.life -= dt;
      if (q.life <= 0) continue;
      q.vy += q.g * dt;
      const d = Math.max(0, 1 - q.drag * dt);
      q.vx *= d; q.vy *= d;
      q.x += q.vx * dt; q.y += q.vy * dt;
      // Кубики отскакивают от «пола».
      if (q.floor !== undefined && q.y > q.floor) { q.y = q.floor; q.vy = -q.vy * 0.45; q.vx *= 0.7; }
      out.push(q);
    }
    this.p = out;
  };
  Particles.prototype.draw = function (g, cx, cy) {
    cx = cx || 0; cy = cy || 0;
    for (const q of this.p) {
      const k = q.life / q.max;
      g.globalAlpha = Math.min(1, k * 2);
      g.fillStyle = q.c;
      const s = q.spin ? Math.max(1, Math.round(q.s * (0.5 + 0.5 * Math.abs(Math.sin(q.life * 12))))) : q.s;
      if (q.glyph) { g.font = '8px monospace'; g.fillText(q.glyph, Math.round(q.x - cx), Math.round(q.y - cy)); }
      else g.fillRect(Math.round(q.x - cx - s / 2), Math.round(q.y - cy - s / 2), s, s);
    }
    g.globalAlpha = 1;
  };
  Particles.prototype.clear = function () { this.p = []; };

  // Облачко эмоции над персонажем: пиксельные глифы 5×5.
  const GLYPH = {
    '!': ['..X..', '..X..', '..X..', '.....', '..X..'],
    '?': ['.XXX.', '...X.', '..X..', '.....', '..X..'],
    '…': ['.....', '.....', '.....', '.....', 'X.X.X'],
    '♥': ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
    '♪': ['..XXX', '..X.X', '..X..', 'XXX..', 'XXX..'],
    '#': ['.X.X.', 'XXXXX', '.X.X.', 'XXXXX', '.X.X.'],
    '★': ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'],
  };
  function emote(g, x, y, glyph, t, scale) {
    const s = scale || 1;
    const pop = Math.min(1, t * 6);
    const bob = Math.round(Math.sin(t * 6) * 1) * s;
    const w = 11 * s, h = 10 * s;
    const bx = Math.round(x - w / 2), by = Math.round(y - h - 4 * s + bob - (1 - pop) * 6);
    g.globalAlpha = pop;
    g.fillStyle = '#10131b'; g.fillRect(bx - s, by - s, w + 2 * s, h + 2 * s);
    g.fillStyle = '#f4f1ea'; g.fillRect(bx, by, w, h);
    g.fillRect(bx + 3 * s, by + h, 2 * s, 2 * s); g.fillRect(bx + 2 * s, by + h + 2 * s, s, s);
    const rows = GLYPH[glyph] || GLYPH['!'];
    g.fillStyle = glyph === '♥' ? '#ff5a5f' : glyph === '!' ? '#ff5a5f' : '#1b1b24';
    rows.forEach((r, ry) => [...r].forEach((ch, rx) => { if (ch === 'X') g.fillRect(bx + (3 + rx) * s, by + (2 + ry) * s, s, s); }));
    g.globalAlpha = 1;
  }

  // Виньетка: затемнение краёв кадра (кэшируется).
  let vig = null;
  function vignette(g, strength) {
    if (!vig) {
      vig = document.createElement('canvas'); vig.width = 640; vig.height = 360;
      const c = vig.getContext('2d');
      const gr = c.createRadialGradient(320, 180, 140, 320, 180, 420);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
      c.fillStyle = gr; c.fillRect(0, 0, 640, 360);
    }
    g.globalAlpha = strength === undefined ? 0.6 : strength;
    g.drawImage(vig, 0, 0);
    g.globalAlpha = 1;
  }

  NP.FX = { Particles, emote, vignette, rnd, GLYPH };
})();
