// Пиксельные спрайты и портреты задаются текстовыми сетками и палитрами.
// Временная графика вертикального среза: заменяется утверждённым артом без правки логики.
(function () {
  const NP = window.NP;

  const LEGS = {
    idle: ['..pppppppp..', '..ppp..ppp..', '..ppp..ppp..', '..kkk..kkk..'],
    w1: ['..pppppppp..', '..ppp..ppp..', '..ppp..kkk..', '..kkk.......'],
    w2: ['..pppppppp..', '..ppp..ppp..', '..kkk..ppp..', '.......kkk..'],
  };
  const SIDE_LEGS = {
    idle: ['....pppp....', '....pppp....', '....pppp....', '....kkkkk...'],
    w1: ['....pppp....', '...pp.pp....', '..pp...pp...', '.kk....kkk..'],
    w2: ['....pppp....', '....pppp....', '....pppp....', '....kkkkk...'],
  };
  const BODY = {
    down: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hsshsssh..', '..ssssssss..', '..ssesseSs..',
      '..ssssssss..', '...ssSSss...', '....ssss....', '..bbbttbbb..', '.bbbbttbbbb.', '.sbbbttbbbs.', '.BbbbtbbbbB.', '.sbbbbbbbbs.'],
    up: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..', '..hhhhhhhh..', '..hhhhhhhh..',
      '..shhhhhhs..', '...ssssss...', '....ssss....', '..bbbbbbbb..', '.bbbbbbbbbb.', '.sbbbbbbbbs.', '.BbbbbbbbbB.', '.sbbbbbbbbs.'],
    side: ['....hhhh....', '...hhhhhhh..', '..hhhhhhhhh.', '..hhhhssss..', '..hhhsssss..', '..hhsssses..',
      '...sssssss..', '....ssssS...', '.....ss.....', '....bbbb....', '...bbbbbb...', '...bbbsbb...', '...bbbsbb...', '....bbbb....'],
  };

  const PAL = {
    ilya: { h: '#3a2a22', s: '#e8b995', S: '#c99372', e: '#1b1b24', b: '#8fb3d4', B: '#6a8fb3', t: '#8c3b3b', p: '#3a3f4b', k: '#1e1f24', m: '#a8554f' },
    vera: { h: '#9c4a2c', s: '#efc3a0', S: '#cf9a78', e: '#1b1b24', b: '#6d9a6a', B: '#557d53', t: '#6d9a6a', p: '#4a3b4f', k: '#1e1f24', m: '#b0505a' },
  };

  const SPRITES = {
    process: ['.....a......', '.....a......', '..cccccccc..', '.cddddddddc.', '.cdeddddedc.', '.cddddddddc.', '.cddeeeeddc.',
      '.cddddddddc.', '..cccccccc..', '...cbbbbc...', '..cbbbbbbc..', '.cbbbbbbbbc.', '..cbbbbbbc..', '...cb..bc...', '...cc..cc...'],
    guard: ['.....rrrrrr.....', '...rrrrrrrrrr...', '..rrwwwwwwwwrr..', '.rrwwwwwwwwwwrr.', '.rwwwwkkkkwwwwr.', 'rrwwwkkkkkkwwwrr',
      'rrwwwkkppkkwwwrr', 'rrwwwkkppkkwwwrr', 'rrwwwkkkkkkwwwrr', '.rwwwwkkkkwwwwr.', '.rrwwwwwwwwwwrr.', '..rrwwwwwwwwrr..',
      '...rrrrrrrrrr...', '.....rrrrrr.....', '......r..r......', '.....r....r.....'],
    laptop: ['................', '..gggggggggggg..', '..gkkkkkkkkkkg..', '..gkkkkkkkkkkg..', '..gkkkkkkkkkkg..', '..gggggggggggg..',
      '.gggggggggggggg.', 'gGGGGGGGGGGGGGGg'],
    shard: ['...ww...', '..wccw..', '.wccccw.', 'wcclccw.', '.wccccw.', '..wccw..', '...ww...', '........'],
    node: ['..oooooo..', '.o......o.', 'o..llll..o', 'o.l....l.o', 'o.l.cc.l.o', 'o.l.cc.l.o', 'o.l....l.o', 'o..llll..o', '.o......o.', '..oooooo..'],
    terminal: ['.gggggggggggg.', 'gkkkkkkkkkkkkg', 'gkllkkkkkkkkkg', 'gkkkkllllkkkkg', 'gkllllkkkkkkkg', 'gkkkkkkkkkkkkg', 'gkkkkkkkkkkkkg',
      '.gggggggggggg.', '.....gggg.....', '...gggggggg...'],
    coffee: ['.gggggg.', 'gkkkkkkg', 'gkrrkkkg', 'gkkkkkkg', 'gggggggg', 'g.wwww.g', 'g.wwww.g', 'gggggggg'],
  };

  const PORTRAITS = {
    ilya: {
      rows: ['................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hsssshhssh...', '...ssssssssss...',
        '...seessseesS...', '...ssssssssss...', '...sssssSsssS...', '....ssmmmmss....', '.....ssssss.....', '......ssss......',
        '....bbbttbbb....', '..bbbbbttbbbbb..', '.bbbbbbttbbbbbb.', '.bbbbbbttbbbbbb.'],
      pal: PAL.ilya, bg: '#2a3140',
    },
    nul: {
      rows: ['................', '.gggggggggggggg.', '.gkkkkkkkkkkkkg.', '.gkkkkwwwwkkkkg.', '.gkkkwkkkkwkkkg.', '.gkkwkrkkrkwkkg.',
        '.gkkwkkkkkkwkkg.', '.gkkwkkkkkkwkkg.', '.gkkwkkrrkkwkkg.', '.gkkkwkkkkwkkkg.', '.gkkkkwwwwkkkkg.', '.gkkkkkkkkkkkkg.',
        '.gggggggggggggg.', '...gggggggggg...', '..gggggggggggg..', '................'],
      pal: { g: '#8a8f99', k: '#0a0b10', w: '#f4f1ea', r: '#ff4d57' }, bg: '#1a0d10',
    },
    mira: {
      rows: ['................', '.....llllll.....', '...llllllllll...', '..lllsssssslll..', '..llssssssssll..', '..lsseessseesl..',
        '..lssssssssssl..', '..lsssssSssssl..', '..llssmmmmssll..', '..lllssssssllll.', '..llll.ss.lllll.', '..lll.cccc.llll.',
        '..ll.cccccc.lll.', '....cccccccc....', '...cccccccccc...', '..cccccccccccc..'],
      pal: { l: '#4b3a6e', s: '#d9c4e8', S: '#b39cc9', e: '#221a33', m: '#9a5a8a', c: '#7fd0c8' }, bg: '#1b1530', glitch: true,
    },
    vera: {
      rows: ['................', '.....hhhhhh.....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhsssssssshh..', '..hseesssseesh..',
        '..hssssssssssh..', '..hsssSssssssh..', '..hhssmmmmsshh..', '..hhhssssssshhh.', '..hhhh.ss.hhhhh.', '.hhhh.gggg.hhhh.',
        '.hhh.gggggg.hhh.', '....gggggggg....', '...gggggggggg...', '..gggggggggggg..'],
      pal: { h: '#9c4a2c', s: '#efc3a0', S: '#cf9a78', e: '#1b1b24', m: '#b0505a', g: '#6d9a6a' }, bg: '#2f2a26',
    },
    pix: {
      rows: ['................', '................', '....cccccccc....', '...cCCCCCCCCc...', '..cCCCCCCCCCCc..', '..cCwwCCCCwwCc..',
        '..cCwkCCCCwkCc..', '..cCCCCCCCCCCc..', '..cCCCmmmmCCCc..', '..cCCCCCCCCCCc..', '...cCCCCCCCCc...', '....cccccccc....',
        '.....c....c.....', '....cc....cc....', '................', '................'],
      pal: { c: '#8a4a12', C: '#ffb347', w: '#ffffff', k: '#1b1406', m: '#8a4a12' }, bg: '#2a1a0a',
    },
    process: {
      rows: ['................', '.......a........', '.......a........', '...cccccccccc...', '..cddddddddddc..', '..cddddddddddc..',
        '..cddeeddeeddc..', '..cddeeddeeddc..', '..cddddddddddc..', '..cdddeeeedddc..', '..cddddddddddc..', '...cccccccccc...',
        '.....cbbbbc.....', '...cbbbbbbbbc...', '..cbbbbbbbbbbc..', '..cbbbbbbbbbbc..'],
      pal: { a: '#cfd6e0', c: '#cfd6e0', d: '#10182a', e: '#7fe3ff', b: '#4d6fa8' }, bg: '#14203a',
    },
  };

  // Цветовые варианты процессов: каждый — свой цвет и знак, не только цвет.
  const PROCESS_PAL = {
    cal: { c: '#ffd166', b: '#b88a2e', e: '#ffd166', a: '#ffd166' },
    mail: { c: '#f4a261', b: '#b8663a', e: '#ffe0c2', a: '#f4a261' },
    trash: { c: '#9aa5b1', b: '#5f6b78', e: '#c8f0c0', a: '#9aa5b1' },
    copier: { c: '#b69cff', b: '#6c58a8', e: '#e6dcff', a: '#b69cff' },
    guardp: { c: '#ff5a5f', b: '#8a2a33', e: '#ffd0d0', a: '#ff5a5f' },
  };

  const cache = {};
  function build(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || !pal[ch]) continue;
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  const Sprites = (NP.Sprites = {
    // Кадр персонажа: dir = down|up|left|right, frame = idle|w1|w2.
    person(who, dir, frame) {
      const key = 'p:' + who + ':' + dir + ':' + frame;
      if (cache[key]) return cache[key];
      const side = dir === 'left' || dir === 'right';
      const body = side ? BODY.side : BODY[dir];
      const legs = (side ? SIDE_LEGS : LEGS)[frame] || LEGS.idle;
      let c = build(body.concat(legs), PAL[who] || PAL.ilya);
      if (dir === 'left') {
        const f = document.createElement('canvas');
        f.width = c.width; f.height = c.height;
        const g = f.getContext('2d');
        g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
        c = f;
      }
      return (cache[key] = c);
    },
    get(name, palOverride) {
      const key = 's:' + name + ':' + (palOverride ? JSON.stringify(palOverride) : '');
      if (cache[key]) return cache[key];
      const base = {
        process: PORTRAITS.process.pal, guard: { r: '#ff5a5f', w: '#f4f1ea', k: '#241018', p: '#ff5a5f' },
        laptop: { g: '#9aa0aa', k: '#1a2233', G: '#6c717a' }, shard: { w: '#f4f1ea', c: '#7fe3ff', l: '#ffffff' },
        node: { o: '#7fe3ff', l: '#7fe3ff', c: '#f4f1ea' }, terminal: { g: '#9aa0aa', k: '#101522', l: '#7fe3ff' },
        coffee: { g: '#8a8f99', k: '#2a2d33', r: '#ff5a5f', w: '#e9e2d6' },
      }[name] || {};
      return (cache[key] = build(SPRITES[name], Object.assign({}, base, palOverride || {})));
    },
    processPal(id) { return PROCESS_PAL[id]; },
    portraitImg(id) {
      const def = PORTRAITS[id];
      return cache['portrait:' + id] || (cache['portrait:' + id] = build(def.rows, def.pal));
    },
    // Портрет рисуется в canvas 16×16; CSS увеличивает его без сглаживания.
    drawPortrait(canvas, id, t) {
      const g = canvas.getContext('2d');
      const def = PORTRAITS[id === 'cal' || id === 'mail' || id === 'trash' || id === 'copier' ? 'process' : id];
      canvas.width = 16; canvas.height = 16;
      g.clearRect(0, 0, 16, 16);
      if (!def) return;
      g.fillStyle = def.bg; g.fillRect(0, 0, 16, 16);
      const pal = Object.assign({}, def.pal, PROCESS_PAL[id] || {});
      const img = cache['portrait:' + id] || (cache['portrait:' + id] = build(def.rows, pal));
      if (def.glitch && !NP.Settings.values.reduceFlash) {
        // Мира — неполная запись: строки смещаются.
        for (let y = 0; y < 16; y++) {
          const off = Math.sin(t * 3 + y * 1.7) > 0.93 ? (y % 2 ? 1 : -1) : 0;
          g.drawImage(img, 0, y, 16, 1, off, y, 16, 1);
        }
      } else {
        g.drawImage(img, 0, 0);
      }
    },
  });

})();
