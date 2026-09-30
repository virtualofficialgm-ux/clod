// Сценарий кампании: порядок сцен и раундов, катсцены-мультики. Тексты — в locales/ru.js (ключи film.*).
(function () {
  const NP = window.NP;
  const D = (NP.Data = NP.Data || {});

  D.campaign = [
    { id: 'prologue', type: 'cutscene', cut: 'c_prologue' },
    { id: 'base', type: 'cutscene', cut: 'c_base' },
    { id: 'call', type: 'cutscene', cut: 'c_call' },
    { id: 'message', type: 'cutscene', cut: 'c_message' },
    { id: 'first', type: 'set', values: { a: 1 } },
    { id: 'score1', type: 'score', flip: 'a', key: 'camp.score.first' },
    { id: 'team', type: 'cutscene', cut: 'c_team' },
    { id: 'r2', type: 'level', game: 'centipede' },
    { id: 'chase_in', type: 'cutscene', cut: 'c_chase_intro' },
    { id: 'r3', type: 'level', game: 'chase' },
    { id: 'twist', type: 'cutscene', cut: 'c_twist' },
    { id: 'r4', type: 'level', game: 'skyfight' },
    { id: 'ship', type: 'cutscene', cut: 'c_mothership' },
    { id: 'r5', type: 'level', game: 'kong', mustWin: true },
    { id: 'victory', type: 'cutscene', cut: 'c_victory' },
    { id: 'end', type: 'end' },
  ];

  const P = (who, x, dir, extra) => Object.assign({ who, x, y: 300, dir: dir || 'down', scale: 4 }, extra || {});
  const cars = [{ x: 60, col: '#ff5a5f' }, { x: 180, col: '#7fe3ff' }, { x: 300, col: '#6fe3a1' }, { x: 430, col: '#f4f1ea' }, { x: 560, col: '#ff9f43' }];

  Object.assign(D.cutscenes = D.cutscenes || {}, {
    // Июнь 1996: финал, жульничество, запуск капсулы.
    c_prologue: {
      fx: 'title', music: 'title',
      stage: {
        bg: 'hall', vars: { score: '2 : 2' },
        actors: { ilya: { who: 'kid', x: 285, y: 272, dir: 'up', scale: 3, anim: 'play' }, gleb: { who: 'gleb', x: 375, y: 272, dir: 'up', scale: 3.3, anim: 'play' } },
      },
      frames: [
        { title: true, key: 'film.p0', ms: 2400 },
        { key: 'film.p1', ms: 4200, do: [['cam', 320, 190, 1.2, 4]] },
        { key: 'film.p2', ms: 4200, do: [['cam', 330, 210, 1.75, 1.6], ['emote', 'ilya', '!', 1.6], ['after', 1.8, [['emote', 'gleb', '♪', 1.6]]]] },
        { key: 'film.p3', ms: 5000, sfx: 'alarm', do: [
          ['set', 'score', '2 : 3'], ['flash'], ['shake', 0.3], ['face', 'gleb', 'down'], ['anim', 'gleb', 'cheer'], ['jump', 'gleb', 5],
          ['burst', 375, 110, 'confetti'], ['set', 'cheer', 1], ['anim', 'ilya', 'idle'], ['cam', 320, 185, 1.3, 1.2],
          ['after', 1.4, [['face', 'ilya', 'down'], ['anim', 'ilya', 'sad'], ['emote', 'ilya', '…', 3.5], ['burst', 285, 215, 'tears']]],
        ] },
        { key: 'film.p4', ms: 5200, stage: 'launch', do: [
          ['remove', 'ilya'], ['remove', 'gleb'], ['set', 'cheer', 0], ['cam', 320, 180, 1, 0.001],
          ['spawn', 'rocket', { kind: 'rocket', x: 320, y: 300, scale: 1 }], ['after', 1.4, [['prop', 'rocket', 'fire', true], ['shake', 0.5], ['sfx', 'glitch']]],
        ] },
        { key: 'film.p5', ms: 4600, do: [['move', 'rocket', 320, -340, 4.4], ['cam', 320, 130, 1.15, 4]] },
        { title: true, key: 'film.p6', ms: 2400, fx: 'title' },
      ],
    },
    // Ночь, аэродром: первый раунд пришельцы выигрывают без спроса.
    c_base: {
      fx: 'title', music: 'chase',
      stage: { bg: 'base', vars: { swarm: 1 }, cam: { x: 320, y: 180, z: 1 } },
      frames: [
        { key: 'film.b1', ms: 4600, do: [
          ['spawn', 's1', { kind: 'ship', x: 120, y: -60, scale: 4, color: '#ff5a5f' }], ['spawn', 's2', { kind: 'ship', x: 260, y: -90, scale: 4, color: '#ff9f43' }],
          ['spawn', 's3', { kind: 'ship', x: 400, y: -70, scale: 4, color: '#b69cff' }], ['spawn', 's4', { kind: 'ship', x: 540, y: -100, scale: 4, color: '#7fe3ff' }],
          ['move', 's1', 120, 70, 2.5], ['move', 's2', 260, 50, 2.8], ['move', 's3', 400, 80, 2.6], ['move', 's4', 540, 60, 3], ['cam', 320, 200, 1.15, 4],
        ] },
        { key: 'film.b2', ms: 5200, sfx: 'glitch', do: [['set', 'beam', 1], ['shake', 0.6], ['flash']] },
        { key: 'film.b3', ms: 4200, do: [['set', 'beam', 0], ['cam', 320, 170, 0.95, 3]] },
      ],
    },
    // Мэрия: мэр — друг детства — зовёт Илью.
    c_call: {
      fx: 'title', music: 'office',
      stage: { bg: 'mayor', vars: { news: 1 }, actors: { seryoga: P('seryoga', 380, 'left'), ilya: P('ilya', -40, 'right') }, cam: { x: 320, y: 190, z: 1.05 } },
      frames: [
        { key: 'film.m1', ms: 4400, do: [['walk', 'ilya', 200, 2.4, 'right'], ['after', 2.5, [['emote', 'seryoga', '!', 1.5]]]] },
        { key: 'film.m2', speaker: 'seryoga', ms: 4200, do: [['walk', 'seryoga', 300, 1.2, 'left'], ['cam', 260, 200, 1.35, 2]] },
        { key: 'film.m3', speaker: 'ilya', ms: 5200, do: [['emote', 'ilya', '#', 2]] },
        { key: 'film.m4', speaker: 'seryoga', ms: 4600, do: [['jump', 'seryoga', 1], ['set', 'redSky', 1]] },
      ],
    },
    // Послание пришельцев по телевидению.
    c_message: {
      fx: 'title', music: 'chase',
      stage: { bg: 'tv', vars: { bars: 1 }, actors: {}, cam: { x: 320, y: 180, z: 1 } },
      frames: [
        { key: 'film.t0', ms: 2600, sfx: 'glitch', do: [['set', 'static', 1]] },
        { key: 'film.t1', speaker: 'host', ms: 5000, do: [['set', 'bars', 0], ['set', 'static', 0], ['spawn', 'host', { kind: 'face', who: 'host', x: 285, y: 180, scale: 2.6, anim: 'talk' }], ['cam', 290, 180, 1.1, 5]] },
        { key: 'film.t2', speaker: 'host', ms: 5600, do: [['shake', 0.3]] },
        { key: 'film.t3', speaker: 'host', ms: 4400, do: [['after', 3.4, [['set', 'static', 1]]]] },
      ],
    },
    // Штаб: команда и лучевые ружья.
    c_team: {
      fx: 'title', music: 'network',
      stage: { bg: 'lab', actors: { vera: P('vera', 420, 'left'), kuzya: P('kuzya', 540, 'left'), ilya: P('ilya', 200, 'right') }, cam: { x: 320, y: 190, z: 1 } },
      frames: [
        { key: 'film.l1', ms: 3800, do: [['cam', 330, 200, 1.1, 3]] },
        { key: 'film.l2', speaker: 'vera', ms: 4800, do: [['cam', 400, 200, 1.4, 1.5], ['emote', 'vera', '★', 2]] },
        { key: 'film.l3', speaker: 'kuzya', ms: 5200, do: [['cam', 500, 200, 1.4, 1.5], ['jump', 'kuzya', 2]] },
        { key: 'film.l4', speaker: 'gleb', ms: 4600, do: [['spawn', 'gleb', P('gleb2', 760, 'left')], ['walk', 'gleb', 300, 2.4, 'left'], ['cam', 320, 200, 1.1, 2]] },
        { key: 'film.l5', speaker: 'ilya', ms: 4200, do: [['emote', 'ilya', '#', 2], ['cam', 250, 200, 1.4, 1.5]] },
      ],
    },
    // Первая победа: трофей оживает.
    c_trophy: {
      fx: 'title', music: 'title',
      stage: { bg: 'cityNight', actors: { ilya: P('ilya', 250, 'right'), kuzya: P('kuzya', 420, 'left') }, cam: { x: 320, y: 190, z: 1.1 } },
      frames: [
        { key: 'film.tr1', ms: 3800, sfx: 'evidence', do: [['spawn', 'pix', { kind: 'trophy', x: 335, y: -40, scale: 3 }], ['move', 'pix', 335, 300, 1.2], ['after', 1.3, [['burst', 335, 260, 'sparks'], ['shake', 0.2]]]] },
        { key: 'film.tr2', speaker: 'pix', ms: 3000, do: [['emote', 'ilya', '!', 1.5], ['emote', 'kuzya', '♥', 1.5]] },
        { key: 'film.tr3', speaker: 'kuzya', ms: 4400, do: [['jump', 'kuzya', 2]] },
      ],
    },
    // Пожиратель на ночных улицах.
    c_chase_intro: {
      fx: 'title', music: 'chase',
      stage: { bg: 'street', vars: { cars }, actors: { eater: { kind: 'eater', x: -80, y: 300, dir: 'right', scale: 2 } }, cam: { x: 320, y: 190, z: 1 } },
      frames: [
        { key: 'film.s1', ms: 5200, do: [['move', 'eater', 720, 300, 5]] },
        { key: 'film.s2', speaker: 'vera', ms: 4600, do: [['remove', 'eater'], ['spawn', 'vera', P('vera', 240, 'right')], ['spawn', 'gleb', P('gleb2', 380, 'left')], ['cam', 310, 210, 1.3, 1.5]] },
        { key: 'film.s3', speaker: 'gleb', ms: 4400, do: [['emote', 'gleb', '#', 2]] },
      ],
    },
    // Разоблачение: Глеб жульничал в 1996-м, пришельцы похищают Веру.
    c_twist: {
      fx: 'title', music: 'chase',
      stage: { bg: 'tv', actors: { host: { kind: 'face', who: 'host', x: 285, y: 180, scale: 2.6, anim: 'talk' } } },
      frames: [
        { key: 'film.w1', speaker: 'host', ms: 4400, sfx: 'glitch', do: [['set', 'static', 1], ['after', 0.5, [['set', 'static', 0]]]] },
        { key: 'film.w2', speaker: 'host', ms: 5600, do: [['cam', 285, 170, 1.25, 5]] },
        { key: 'film.w3', speaker: 'kuzya', ms: 5200, stage: 'lab', do: [
          ['remove', 'host'], ['cam', 320, 200, 1.2, 0.001], ['spawn', 'kuzya', P('kuzya', 470, 'left')], ['spawn', 'gleb', P('gleb2', 330, 'right')],
          ['spawn', 'ilya', P('ilya', 190, 'right')], ['spawn', 'vera', P('vera', 560, 'left')], ['emote', 'kuzya', '!', 2],
        ] },
        { key: 'film.w4', speaker: 'gleb', ms: 4400, do: [['anim', 'gleb', 'sad'], ['emote', 'gleb', '…', 3], ['cam', 300, 200, 1.5, 1.5]] },
        { key: 'film.w5', speaker: 'ilya', ms: 4200, do: [['emote', 'ilya', '#', 2]] },
        { key: 'film.w6', ms: 4800, sfx: 'alarm', do: [['set', 'beamX', 560], ['set', 'beamDown', 1], ['shake', 0.5], ['emote', 'vera', '!', 2], ['after', 1, [['move', 'vera', 560, -100, 2.5]]], ['cam', 420, 160, 1.1, 3]] },
      ],
    },
    // Корабль-матка: горилла держит Веру.
    c_mothership: {
      fx: 'title', music: 'chase',
      stage: { bg: 'mother', actors: { ape: { kind: 'ape', x: 200, y: 118, scale: 3 }, vera: { who: 'vera', x: 470, y: 70, dir: 'down', scale: 2.5, anim: 'wave' } }, cam: { x: 320, y: 180, z: 1 } },
      frames: [
        { key: 'film.x1', ms: 4800, do: [['spawn', 'ilya', P('ilya', 320, 'up', { y: -60 })], ['drop', 'ilya', 290, 1], ['spawn', 'pix', { kind: 'trophy', x: 365, y: 290, scale: 1.5 }]] },
        { key: 'film.x2', speaker: 'gleb', ms: 4400, do: [['cam', 220, 140, 1.4, 2], ['shake', 0.3]] },
        { key: 'film.x3', speaker: 'ilya', ms: 5200, do: [['cam', 320, 210, 1.5, 1.5], ['emote', 'ilya', '★', 2]] },
      ],
    },
    c_victory: {
      fx: 'title', music: 'title',
      stage: { bg: 'mother', actors: { ape: { kind: 'ape', x: 200, y: 118, scale: 3 } }, cam: { x: 320, y: 180, z: 1 } },
      frames: [
        { key: 'film.v1', ms: 4400, sfx: 'hit', do: [['shake', 0.8], ['move', 'ape', 200, 520, 2], ['burst', 200, 120, 'sparks'], ['after', 0.8, [['burst', 200, 200, 'sparks']]]] },
        { key: 'film.v2', ms: 5200, stage: 'victory', do: [['remove', 'ape'], ['set', 'restore', 1], ['spawn', 'ilya', P('ilya', 250, 'down')], ['spawn', 'vera', P('vera', 320, 'down')], ['spawn', 'pix', { kind: 'trophy', x: 385, y: 300, scale: 1.5 }], ['cam', 320, 200, 1.1, 5]] },
        { key: 'film.v3', speaker: 'host', ms: 4400, do: [['set', 'restore', 0]] },
        { key: 'film.v4', speaker: 'vera', ms: 3600, do: [['emote', 'vera', '♥', 2.4], ['emote', 'ilya', '!', 2]] },
        { key: 'film.v5', speaker: 'gleb', ms: 3800, do: [['spawn', 'gleb', P('gleb2', 720, 'left')], ['walk', 'gleb', 460, 1.8, 'left']] },
        { key: 'film.v6', speaker: 'ilya', ms: 3600, do: [['emote', 'ilya', '★', 2], ['burst', 320, 120, 'confetti']] },
        { title: true, key: 'film.v7', ms: 3000 },
      ],
    },
    c_gameover: {
      fx: 'title', music: 'chase',
      stage: { bg: 'zeroed', cam: { x: 320, y: 180, z: 1 } },
      frames: [
        { key: 'film.z1', speaker: 'host', ms: 4400, sfx: 'glitch', do: [['shake', 0.8], ['flash']] },
        { title: true, key: 'film.z2', ms: 2600 },
      ],
    },
  });
})();
