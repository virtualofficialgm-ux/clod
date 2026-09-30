// Фоны и «актёры» кампании: запуск капсулы, аэродром, мэрия, телеэфир пришельцев, штаб,
// ночная улица с Пожирателем, корабль-матка, табло раундов, обнулённый и спасённый город.
(function () {
  const NP = window.NP;
  const St = NP.Stage;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const text = (g, s, x, y, size, col, align) => { g.font = 'bold ' + size + 'px monospace'; g.fillStyle = col; g.textAlign = align || 'center'; g.fillText(s, x, y); g.textAlign = 'left'; };

  function sky(g, top, bottom) {
    const gr = g.createLinearGradient(0, -100, 0, 360); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(-300, -200, 1240, 760);
  }
  function stars(g, n, h) { for (let i = 0; i < n; i++) R(g, i % 7 ? '#5a5f90' : '#ffffff', ((i * 97) % 940) - 150, (i * 41) % (h || 160), 1, 1); }
  function skyline(g, S, t, col, win) {
    for (let i = 0; i < 16; i++) {
      const x = i * 50 - 60, h = 90 + ((i * 53) % 130), bite = ((S.vars.bites || {})[i] || 0) * h;
      R(g, col || '#1b2033', x, 330 - h + bite, 46, h - bite);
      if (win !== false) for (let wy = 330 - h + bite + 8; wy < 318; wy += 14) for (let wx = x + 5; wx < x + 40; wx += 11) if ((wx * 3 + wy) % 7) R(g, '#ffd98a', wx, wy, 5, 6);
    }
  }

  // ---------------------------------------------------------------- Фоны
  St.BG.launch = (g, t, S) => {
    sky(g, '#1a1030', '#ff9f43');
    stars(g, 30, 90);
    R(g, '#2a2033', -300, 300, 1240, 100);
    R(g, '#3a2f45', 250, 150, 20, 150); R(g, '#3a2f45', 370, 150, 20, 150);
    for (let y = 160; y < 300; y += 20) R(g, '#3a2f45', 250, y, 140, 3);
    text(g, 'КАПСУЛА-96', 320, 330, 14, '#ffd166');
  };
  St.BG.base = (g, t, S) => {
    sky(g, '#05030f', '#1a1030');
    stars(g, 60, 200);
    R(g, '#14121c', -300, 300, 1240, 100);
    for (let x = -300; x < 940; x += 30) R(g, Math.floor(t * 4 + x / 30) % 4 ? '#ffd166' : '#5a4a1a', x, 318, 4, 2);
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 200, bite = ((S.vars.bites || {})[i] || 0) * 70;
      R(g, '#2a2f3f', x, 230 + bite, 150, 70 - bite);
      g.fillStyle = '#343a4f'; g.beginPath(); g.ellipse(x + 75, 230 + bite, 75, Math.max(0, 22 - bite / 3), 0, Math.PI, 0); g.fill();
      R(g, '#10131b', x + 45, 260 + Math.min(bite, 40), 60, 40 - Math.min(bite, 40));
      text(g, 'АНГАР ' + (i + 1), x + 75, 252 + bite, 9, '#9aa3b2');
    }
    // Самолёт у ангара
    if (!S.vars.jetGone) { R(g, '#6b7280', 300, 294, 60, 6); R(g, '#6b7280', 320, 286, 14, 22); R(g, '#9aa3b2', 352, 292, 10, 4); }
    // Лучи кораблей
    if (S.vars.beam) {
      for (const id in S.actors) {
        const a = S.actors[id];
        if (a.kind !== 'ship' || Math.floor(t * 3 + a.x) % 3) continue;
        g.fillStyle = 'rgba(127,227,255,0.35)'; g.fillRect(a.x - 4, a.y + 10, 8, 300 - a.y);
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(a.x - 1, a.y + 10, 2, 300 - a.y);
      }
    }
  };
  St.BG.mayor = (g, t, S) => {
    R(g, '#2a1f1a', -300, -200, 1240, 760);
    R(g, '#4a3428', -300, 40, 1240, 230);
    for (let x = -300; x < 940; x += 40) R(g, '#3f2c22', x, 40, 2, 230);
    // Окно с ночным городом
    R(g, '#6b5040', 380, 60, 200, 140); R(g, '#0a0c18', 388, 68, 184, 124);
    for (let i = 0; i < 8; i++) { const h = 30 + ((i * 37) % 70); R(g, '#1b2033', 390 + i * 23, 192 - h, 20, h); if (i % 2) R(g, '#ffd98a', 396 + i * 23, 192 - h + 8, 3, 4); }
    if (S.vars.redSky && Math.floor(t * 3) % 2) R(g, 'rgba(255,60,80,0.2)', 388, 68, 184, 124);
    // Флаг города и портрет
    R(g, '#2a3a6a', 60, 70, 60, 40); R(g, '#ffd166', 60, 84, 60, 12); R(g, '#8a6a4f', 58, 66, 3, 120);
    R(g, '#8a6a4f', 160, 70, 60, 70); R(g, '#2f2a26', 166, 76, 48, 58); R(g, '#efc3a0', 182, 86, 16, 18); R(g, '#2a3a6a', 176, 106, 28, 28);
    // Телевизор с новостями
    R(g, '#1b1b24', 250, 80, 100, 70); R(g, S.vars.news ? '#301018' : '#1c2c4a', 256, 86, 88, 56);
    if (S.vars.news) { text(g, 'СРОЧНО', 300, 104, 10, '#ff5a5f'); for (let i = 0; i < 6; i++) R(g, '#7fe3ff', 262 + ((i * 17 + Math.floor(t * 30)) % 76), 116 + (i % 3) * 6, 4, 3); }
    // Стол мэра
    R(g, '#5a3a22', -300, 270, 1240, 120); R(g, '#7a5232', 100, 240, 440, 30); R(g, '#3a2414', 100, 268, 440, 8);
    R(g, '#e9e2d6', 140, 228, 40, 12); R(g, '#1b1b24', 460, 222, 30, 18);
  };
  St.BG.tv = (g, t, S) => {
    R(g, '#07060e', -300, -200, 1240, 760);
    // Корпус старого телевизора
    R(g, '#3a2a1a', 90, 20, 460, 320); R(g, '#5a4028', 100, 30, 440, 300);
    R(g, '#101018', 120, 46, 330, 266);
    const bars = ['#ffffff', '#ffd166', '#7fe3ff', '#6fe3a1', '#ff5a8a', '#ff5a5f', '#4d7bff'];
    if (S.vars.bars) bars.forEach((c, i) => R(g, c, 120 + i * 47, 46, 47, 266));
    else {
      R(g, '#1a0d2a', 120, 46, 330, 266);
      for (let i = 0; i < 8; i++) R(g, 'rgba(182,156,255,0.08)', 120, 46 + ((i * 40 + t * 60) % 266), 330, 6);
    }
    for (let i = 0; i < 2; i++) { R(g, '#2a1a0a', 470, 70 + i * 50, 50, 36); R(g, '#8a6a3a', 488, 80 + i * 50, 14, 14); }
    for (let i = 0; i < 6; i++) R(g, '#2a1a0a', 470, 190 + i * 10, 50, 4);
    text(g, S.vars.tvLabel || 'КАНАЛ ПРИШЕЛЬЦЕВ', 285, 330, 10, '#b69cff');
  };
  St.FRONT.tv = (g, t, S) => {
    // Помехи и полосы ЭЛТ поверх ведущего.
    for (let y = 46; y < 312; y += 3) R(g, 'rgba(0,0,0,0.18)', 120, y, 330, 1);
    if (S.vars.static && !NP.Settings.values.reduceFlash) for (let i = 0; i < 300; i++) R(g, Math.random() < 0.5 ? '#fff' : '#888', 120 + Math.random() * 330, 46 + Math.random() * 266, 2, 2);
  };
  St.BG.lab = (g, t, S) => {
    R(g, '#141820', -300, -200, 1240, 760);
    R(g, '#1e2430', -300, 40, 1240, 240);
    for (let x = -300; x < 940; x += 80) { R(g, '#2a3242', x, 40, 6, 240); R(g, '#2a3242', x, 40, 80, 4); }
    // Стойки с лучевыми ружьями
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 60;
      R(g, '#3a4254', x, 110, 44, 90);
      for (let k = 0; k < 3; k++) { R(g, '#ffd166', x + 6, 120 + k * 26, 32, 6); R(g, '#7fe3ff', x + 34, 121 + k * 26, 6, 4); }
    }
    // Мониторы с шаблонами игр
    for (let i = 0; i < 3; i++) {
      const x = 360 + i * 90;
      R(g, '#0a0c12', x, 80, 76, 56); R(g, '#3a4254', x - 3, 77, 82, 3);
      for (let k = 0; k < 8; k++) R(g, ['#3cff9a', '#ffd166', '#ff5a5f'][i], x + 6 + ((k * 9 + Math.floor(t * 12 + i * 5)) % 64), 88 + (k % 5) * 9, 4, 4);
    }
    R(g, '#232a36', -300, 280, 1240, 100);
    R(g, '#4a5268', 300, 250, 240, 12); R(g, '#3a4254', 310, 262, 10, 40); R(g, '#3a4254', 520, 262, 10, 40);
    if (Math.random() < 0.3) S.fx.emit(420, 250, { count: 2, color: ['#ffd166', '#ffffff'], speed: 60, life: 0.4, size: 2, gravity: 200 });
    if (S.vars.beamDown) {
      g.fillStyle = 'rgba(127,227,255,' + (0.25 + 0.15 * Math.sin(t * 20)) + ')'; g.fillRect(S.vars.beamX - 26, -200, 52, 490);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(S.vars.beamX - 4, -200, 8, 490);
    }
  };
  St.BG.street = (g, t, S) => {
    sky(g, '#05060f', '#1a1030');
    stars(g, 40, 100);
    for (let i = 0; i < 10; i++) {
      const x = i * 80 - 80;
      R(g, ['#241a30', '#1d2436', '#2a1f24'][i % 3], x, 60, 76, 200);
      for (let wy = 70; wy < 240; wy += 18) for (let wx = x + 8; wx < x + 70; wx += 16) R(g, (wx + wy + i) % 5 ? '#ffd98a' : '#3a3050', wx, wy, 8, 10);
    }
    R(g, '#12141f', -300, 260, 1240, 140);
    for (let x = -300; x < 940; x += 50) R(g, '#4a4f65', x + ((t * 40) % 50), 300, 26, 3);
    for (let i = 0; i < 6; i++) { const x = 40 + i * 110; R(g, '#3a3f55', x, 180, 3, 80); R(g, '#ffd166', x - 4, 176, 11, 5); g.fillStyle = 'rgba(255,209,102,0.08)'; g.beginPath(); g.moveTo(x - 4, 181); g.lineTo(x + 7, 181); g.lineTo(x + 40, 262); g.lineTo(x - 36, 262); g.fill(); }
    // Машины, которые ещё не съедены
    (S.vars.cars || []).forEach((c) => { if (!c.eaten) { R(g, c.col, c.x, 272, 44, 14); R(g, '#10131b', c.x + 10, 264, 24, 9); R(g, '#1b1b24', c.x + 6, 284, 8, 6); R(g, '#1b1b24', c.x + 30, 284, 8, 6); } });
  };
  St.BG.mother = (g, t, S) => {
    R(g, '#0a0616', -300, -200, 1240, 760);
    for (let i = 0; i < 14; i++) { R(g, 'rgba(182,156,255,0.08)', i * 60 - 200, -200, 3, 760); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#1a1030'; g.beginPath(); g.arc(i * 120 - 20, 30, 20, 0, Math.PI * 2); g.fill(); R(g, '#fff', i * 120 - 24, 26, 1, 1); }
    // Балки как на уровне
    for (let k = 0; k < 4; k++) {
      const y = 110 + k * 55, tilt = k % 2 ? 1 : -1;
      for (let x = -40; x < 680; x += 10) { const yy = y + tilt * (x - 320) * 0.03; R(g, '#d8434a', x, yy, 10, 6); R(g, '#7a1f28', x + 4, yy + 2, 2, 2); }
    }
    R(g, '#d8434a', 380, 70, 200, 6);
  };
  St.BG.score = (g, t, S) => {
    R(g, '#05050a', -300, -200, 1240, 760);
    for (let i = 0; i < 40; i++) R(g, i % 2 ? '#1a1024' : '#12081c', i * 20 - 80, 0, 10, 360);
    R(g, '#0b0914', 60, 60, 520, 220); g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.strokeRect(62, 62, 516, 216);
    // Лампочки по краю табло
    for (let i = 0; i < 26; i++) { const on = Math.floor(t * 8 + i) % 2; R(g, on ? '#ffd166' : '#5a4a1a', 70 + i * 20, 68, 6, 6); R(g, on ? '#5a4a1a' : '#ffd166', 70 + i * 20, 266, 6, 6); }
    text(g, 'ЗЕМЛЯ', 190, 110, 20, '#7fe3ff'); text(g, 'ПРИШЕЛЬЦЫ', 450, 110, 20, '#ff5a5f');
    const blink = S.vars.flip && Math.floor(t * 6) % 2;
    text(g, String(S.vars.h), 190, 220, 96, S.vars.flip === 'h' && blink ? '#ffffff' : '#7fe3ff');
    text(g, ':', 320, 210, 80, '#ffd166');
    text(g, String(S.vars.a), 450, 220, 96, S.vars.flip === 'a' && blink ? '#ffffff' : '#ff5a5f');
    text(g, 'ДО ТРЁХ ПОРАЖЕНИЙ', 320, 258, 12, '#9aa3b2');
  };
  St.BG.zeroed = (g, t, S) => {
    sky(g, '#1a0508', '#3a0a14');
    for (let i = 0; i < 16; i++) { const x = i * 50 - 60; for (let k = 0; k < 8; k++) R(g, (i + k) % 2 ? '#ff5a5f' : '#5a1f35', x + (k * 7) % 40, 300 - k * 9 - (Math.sin(t * 2 + i + k) * 3), 8, 8); }
    R(g, '#12040a', -300, 322, 1240, 60);
  };
  St.BG.victory = (g, t, S) => {
    sky(g, '#05030f', '#1a1030');
    stars(g, 60, 200);
    skyline(g, S, t, '#1b2033');
    R(g, '#12141f', -300, 322, 1240, 60);
    if (Math.random() < 0.08) {
      const x = rnd(40, 600), y = rnd(40, 160), col = ['#ffd166', '#ff5a5f', '#6fe3a1', '#7fe3ff', '#b69cff'][Math.floor(rnd(0, 5))];
      S.fx.emit(x, y, { count: 50, color: [col, '#ffffff'], speed: 120, life: 1.4, size: 3, gravity: 50, drag: 1 });
      NP.Audio.sfx('beam');
    }
    // Кубики взлетают обратно и складываются в дома.
    if (S.vars.restore && Math.random() < 0.6) S.fx.emit(rnd(0, 640), 330, { count: 2, color: ['#ff5a5f', '#ffd166', '#7fe3ff'], speed: 120, angle: -Math.PI / 2, spread: 0.2, life: 1.2, size: 5, drag: 0.5 });
  };
  St.BG.cityNight = (g, t, S) => {
    sky(g, '#0a0c18', '#1a1030');
    stars(g, 50, 150);
    skyline(g, S, t);
    R(g, '#12141f', -300, 322, 1240, 60);
  };

  // ---------------------------------------------------------------- Актёры
  const SHIP = ['....XX....', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX', 'X.X.XX.X.X', '..X....X..'];
  St.KINDS.rocket = (g, a, t) => {
    const x = Math.round(a.x), y = Math.round(a.y);
    R(g, '#e9e2d6', x - 10, y - 70, 20, 70); R(g, '#ff5a5f', x - 10, y - 84, 20, 14); R(g, '#ff5a5f', x - 4, y - 92, 8, 8);
    R(g, '#9aa3b2', x - 18, y - 16, 8, 16); R(g, '#9aa3b2', x + 10, y - 16, 8, 16);
    R(g, '#2a3a6a', x - 6, y - 50, 12, 10); text(g, '96', x, y - 22, 9, '#2a3a6a');
    if (a.fire) { R(g, '#ffd166', x - 8, y, 16, 10 + Math.random() * 12); R(g, '#ff9f43', x - 5, y + 8, 10, 12 + Math.random() * 12); }
  };
  St.UPD.rocket = (a, dt, S) => { if (a.fire) S.fx.emit(a.x, a.y + 18, { count: 4, color: ['#c9c2b6', '#8a8f99', '#ffd166'], speed: 60, angle: Math.PI / 2, spread: 1.2, life: 2.2, size: 6, drag: 0.8 }); };
  St.KINDS.ship = (g, a, t) => {
    const s = a.scale;
    g.fillStyle = a.color || '#ff5a5f';
    SHIP.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect(Math.round(a.x - 5 * s + x * s), Math.round(a.y + y * s), s, s); }));
    R(g, '#ffffff', Math.round(a.x - 2 * s), Math.round(a.y + 2 * s), s, s);
  };
  St.UPD.ship = (a, dt, S) => {
    a.bx = a.bx === undefined ? a.x : a.bx;
    if (S.vars.swarm) { a.x = a.bx + Math.sin(S.t * 1.5 + a.bx * 0.02) * 40; }
    if (S.vars.beam && Math.random() < dt * 1.5) {
      const bi = Math.floor((a.x - 60) / 200);
      if (bi >= 0 && bi < 3) S.vars.bites[bi] = Math.min(1, (S.vars.bites[bi] || 0) + 0.12);
      S.fx.emit(a.x, 300, { count: 8, color: ['#7fe3ff', '#9aa3b2', '#ffffff'], speed: 90, angle: -Math.PI / 2, spread: 1, life: 1.4, size: 5, gravity: 200, floor: 318 });
      if (a.x > 290 && a.x < 370) S.vars.jetGone = 1;
    }
  };
  St.KINDS.eater = (g, a, t) => {
    const r = 18 * a.scale, mouth = Math.abs(Math.sin(t * 8)) * 0.9, ang = a.dir === 'left' ? Math.PI : 0;
    g.fillStyle = '#ffd166';
    g.beginPath(); g.moveTo(a.x, a.y - r); g.arc(a.x, a.y - r, r, ang + mouth / 2, ang + Math.PI * 2 - mouth / 2); g.closePath(); g.fill();
    R(g, '#1b1406', Math.round(a.x - (a.dir === 'left' ? r * 0.2 : -r * 0.1)), Math.round(a.y - r * 1.55), Math.round(r * 0.25), Math.round(r * 0.25));
  };
  St.UPD.eater = (a, dt, S) => {
    for (const c of S.vars.cars || []) {
      if (!c.eaten && Math.abs(c.x + 22 - a.x) < 20) { c.eaten = true; NP.Audio.sfx('hit'); S.shake = 0.2; S.fx.emit(c.x + 22, 278, { count: 30, color: [c.col, '#ffffff', '#1b1b24'], speed: 120, life: 1, size: 4, gravity: 220, floor: 300 }); }
    }
  };
  const APE = [
    '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbbffffffbbb..', '..bbfwkffkwfbb..', '..bbffffffffbb..', '...bbfmmmmfbb...',
    '.bbbbbffffbbbbb.', 'bbbbbbbbbbbbbbbb', 'bbffbbbbbbbbffbb', 'bbffbbbbbbbbffbb', 'bbbbbbffffbbbbbb', '.bbbbffffffbbbb.',
    '..bbbbbbbbbbbb..', '..bbbb....bbbb..', '.bbbbb....bbbbb.', '.bbbb......bbbb.',
  ];
  St.KINDS.ape = (g, a, t) => {
    const s = a.scale * 2, beat = Math.floor(t * 5) % 2;
    const img = NP.Arcade.sprite('ape', APE, { b: '#7a4a2a', f: '#d9a878', w: '#ffffff', k: '#1b1406', m: '#5a2a1a' });
    g.drawImage(img, Math.round(a.x - 8 * s), Math.round(a.y - 16 * s + (beat ? s : 0)), 16 * s, 16 * s);
    if (beat && a.anim !== 'fall') R(g, '#d9a878', Math.round(a.x - 4 * s), Math.round(a.y - 7 * s), 8 * s, s);
  };
  St.KINDS.trophy = (g, a, t) => {
    const cv = NP.Sprites.portraitImg('pix');
    const bob = Math.abs(Math.sin(t * 5)) * 6 * a.scale;
    g.drawImage(cv, Math.round(a.x - 8 * a.scale), Math.round(a.y - 16 * a.scale - bob), 16 * a.scale, 16 * a.scale);
  };
})();
