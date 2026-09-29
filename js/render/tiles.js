// Процедурные тайлы 16×16 по палитрам глав. Цвет никогда не единственный носитель смысла:
// пустота, перегруз и закрытые ворота имеют собственный рисунок.
(function () {
  const NP = window.NP;
  const TS = 16;

  NP.PALETTES = {
    office:  { floor: '#8d8173', floor2: '#857a6c', carpet: '#6f5f55', carpet2: '#665750', top: '#3d3632', face: '#b8ab98', trim: '#8f836f',
      desk: '#6b4f3a', deskTop: '#8a6a4f', shelf: '#5a4a3c', plant: '#5c8a4f', pot: '#8a5a3c', counter: '#a3a29c', door: '#5b4636', sky: '#9fc4d8', city: '#6b7f94' },
    desktop: { floor: '#1e3a6e', floor2: '#23447f', grid: '#2e5aa6', top: '#0c1630', face: '#2b4f96', trim: '#5f8ae0', void: '#050914', star: '#6d8fd6',
      bridge: '#7fb3ff', bridge2: '#4f86e6', app: '#9dbcf0', appBar: '#3e6fd8', appFrame: '#dfeaff', port: '#ffd166' },
    network: { floor: '#10261c', floor2: '#133024', grid: '#1d4a33', top: '#06110c', face: '#1f5c3a', trim: '#3cff9a', gate: '#3cff9a', console: '#2a3a33', screen: '#3cff9a', port: '#ffd166' },
    cache:   { floor: '#1d1a33', floor2: '#221f3d', grid: '#2c2852', top: '#0d0b1a', face: '#3b3570', trim: '#8f7fe0', shelf: '#2e2a55', block1: '#7fe3ff', block2: '#b69cff', block3: '#ffd166',
      console: '#2a2745', screen: '#b69cff', door: '#4a4478', port: '#ffd166' },
    chase:   { floor: '#221428', floor2: '#281830', grid: '#3a1f3f', top: '#12070f', face: '#5a1f35', trim: '#ff5a5f', pillar: '#4a4468', pillarTop: '#6c64a0', door: '#4a4478', port: '#ffd166' },
    node:    { floor: '#2a2140', floor2: '#30264a', grid: '#3a2f58', top: '#120d1f', face: '#4b3a6e', trim: '#b69cff', console: '#2a2745', screen: '#b69cff', port: '#ffd166' },
  };

  function hash(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  function rect(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  // Рисование одного тайла. info: {tile, map, tx, ty, ch}
  function drawTile(g, P, tile, px, py, tx, ty, same) {
    const r = hash(tx, ty);
    switch (tile) {
      case 'floor': {
        rect(g, (tx + ty) % 2 ? P.floor : P.floor2 || P.floor, px, py, TS, TS);
        if (P.grid) { rect(g, P.grid, px, py, TS, 1); rect(g, P.grid, px, py, 1, TS); }
        if (r > 0.93 && P.star) rect(g, P.grid || P.floor2, px + 6, py + 6, 2, 2);
        break;
      }
      case 'carpet':
        rect(g, P.carpet, px, py, TS, TS);
        for (let i = 0; i < 4; i++) rect(g, P.carpet2, px + ((i * 5 + tx) % 16), py + i * 4 + 1, 2, 1);
        break;
      case 'top':
        rect(g, P.top, px, py, TS, TS);
        if (!same.down) rect(g, P.trim, px, py + TS - 2, TS, 2);
        break;
      case 'face':
        rect(g, P.face, px, py, TS, TS);
        rect(g, P.trim, px, py, TS, 2);
        rect(g, P.top, px, py + TS - 2, TS, 2);
        if (r > 0.7) rect(g, P.trim, px + 3 + Math.floor(r * 8), py + 5, 2, 5);
        break;
      case 'window': {
        rect(g, P.face, px, py, TS, TS);
        rect(g, P.trim, px, py, TS, 2);
        rect(g, P.sky, px + 1, py + 3, TS - 2, TS - 6);
        const bh = 3 + Math.floor(r * 7);
        rect(g, P.city, px + 2, py + TS - 3 - bh, 5, bh);
        rect(g, P.city, px + 8, py + TS - 3 - Math.floor(bh * 0.6), 6, Math.floor(bh * 0.6));
        rect(g, P.trim, px, py + TS - 3, TS, 3);
        if (!same.left) rect(g, P.trim, px, py, 1, TS);
        if (!same.right) rect(g, P.trim, px + TS - 1, py, 1, TS);
        break;
      }
      case 'desk':
        rect(g, P.desk, px, py, TS, TS);
        rect(g, P.deskTop, px, py, TS, same.up ? TS : 11);
        if (!same.up) rect(g, P.deskTop, px, py, TS, 11);
        if (!same.down) rect(g, '#3a2a20', px, py + TS - 2, TS, 2);
        if (!same.up) rect(g, '#a78565', px, py, TS, 1);
        break;
      case 'shelf':
        rect(g, P.shelf, px, py, TS, TS);
        for (let row = 0; row < 3; row++) {
          rect(g, '#00000055', px, py + row * 5 + 4, TS, 1);
          for (let k = 0; k < 4; k++) {
            const col = [P.block1, P.block2, P.block3, P.plant][Math.floor(hash(tx * 7 + k, ty * 3 + row) * 4)] || P.trim;
            if (hash(tx + k, ty + row * 9) > 0.35) rect(g, col || '#999', px + 1 + k * 4, py + row * 5, 3, 4);
          }
        }
        break;
      case 'plant':
        rect(g, P.floor, px, py, TS, TS);
        rect(g, P.pot, px + 4, py + 10, 8, 6);
        rect(g, P.plant, px + 2, py + 2, 12, 9);
        rect(g, '#7fb06a', px + 5, py + 1, 4, 4);
        break;
      case 'counter':
        rect(g, P.counter, px, py, TS, TS);
        rect(g, '#c9c8c2', px, py, TS, 4);
        rect(g, '#6d6c68', px, py + TS - 2, TS, 2);
        break;
      case 'door':
        rect(g, P.door, px, py, TS, TS);
        rect(g, '#00000044', px + 2, py + 2, TS - 4, TS - 2);
        rect(g, '#d8c7a8', px + (same.left ? 2 : 12), py + 8, 2, 2);
        break;
      case 'void': {
        rect(g, P.void, px, py, TS, TS);
        // Пустота отмечена рисунком «х»-точек, а не только тёмным цветом.
        if (r > 0.6) rect(g, P.star, px + Math.floor(r * 13), py + Math.floor(hash(ty, tx) * 13), 1, 1);
        if (!same.up) { rect(g, '#1a2c55', px, py, TS, 2); }
        break;
      }
      case 'bridge':
        rect(g, P.void, px, py, TS, TS);
        rect(g, P.bridge2, px + 2, py, 12, TS);
        rect(g, P.bridge, px + 3, py, 10, TS);
        for (let i = 0; i < 4; i++) rect(g, P.bridge2, px + 3, py + i * 4, 10, 1);
        break;
      case 'app': {
        rect(g, P.app, px, py, TS, TS);
        if (!same.up) { rect(g, P.appBar, px, py, TS, 6); rect(g, P.appFrame, px, py, TS, 1); }
        if (!same.left) rect(g, P.appFrame, px, py, 1, TS);
        if (!same.right) rect(g, P.appFrame, px + TS - 1, py, 1, TS);
        if (!same.down) rect(g, '#1a2c55', px, py + TS - 2, TS, 2);
        if (!same.up && !same.right) { rect(g, '#ff8a8a', px + 10, py + 2, 3, 2); }
        if (same.up && same.down) rect(g, '#7aa0e0', px + 3, py + 4 + Math.floor(r * 6), 10, 1);
        break;
      }
      case 'console':
        rect(g, P.floor, px, py, TS, TS);
        rect(g, P.console, px + 1, py + 2, 14, 13);
        rect(g, P.screen, px + 3, py + 4, 10, 6);
        rect(g, '#00000066', px + 3, py + 7, 10, 1);
        rect(g, '#00000088', px + 1, py + 14, 14, 1);
        break;
      case 'gate': {
        rect(g, (tx + ty) % 2 ? P.floor : P.floor2, px, py, TS, TS);
        rect(g, P.gate, px + 2, py, 2, TS);
        rect(g, P.gate, px + 7, py, 2, TS);
        rect(g, P.gate, px + 12, py, 2, TS);
        rect(g, '#0b1a12', px, py + 7, TS, 2);
        break;
      }
      case 'gateOpen':
        rect(g, (tx + ty) % 2 ? P.floor : P.floor2, px, py, TS, TS);
        rect(g, P.gate, px, py, 2, 2); rect(g, P.gate, px + 14, py + 14, 2, 2);
        break;
      case 'pillar':
        rect(g, P.floor, px, py, TS, TS);
        rect(g, P.pillar, px + 1, py + 2, 14, 14);
        rect(g, P.pillarTop, px + 1, py, 14, 5);
        rect(g, '#00000055', px + 1, py + 14, 14, 2);
        break;
      case 'rack':
        rect(g, '#1b1e2a', px, py, TS, TS);
        for (let i = 0; i < 4; i++) {
          rect(g, '#2d3246', px + 1, py + 1 + i * 4, 14, 3);
          rect(g, hash(tx + i, ty) > 0.5 ? '#3cff9a' : '#ffd166', px + 12, py + 2 + i * 4, 1, 1);
        }
        break;
      default:
        rect(g, '#ff00ff', px, py, TS, TS);
    }
  }

  // Разрешение символа карты с учётом условных тайлов (мосты, ворота, двери).
  NP.resolveTile = function (legend, ch) {
    let e = legend[ch];
    let guard = 0;
    while (e && e.if !== undefined && !NP.cond(e.if) && guard++ < 4) e = typeof e.else === 'string' ? legend[e.else] : e.else;
    return e || { tile: 'floor' };
  };

  NP.Tiles = {
    TS,
    // Предварительная отрисовка фона комнаты в offscreen-canvas.
    renderRoom(room) {
      const rows = room.map, h = rows.length, w = rows[0].length;
      const c = document.createElement('canvas');
      c.width = w * TS; c.height = h * TS;
      const g = c.getContext('2d');
      const P = NP.PALETTES[room.palette];
      const tileAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : NP.resolveTile(room.legend, rows[y][x]).tile);
      // За краем карты считаем тайл «таким же», чтобы не рисовать лишние кромки.
      const eq = (x, y, t) => { const o = tileAt(x, y); return o === null || o === t; };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = tileAt(x, y);
          const same = { up: eq(x, y - 1, t), down: eq(x, y + 1, t), left: eq(x - 1, y, t), right: eq(x + 1, y, t) };
          drawTile(g, P, t, x * TS, y * TS, x, y, same);
        }
      }
      return c;
    },
  };
})();
