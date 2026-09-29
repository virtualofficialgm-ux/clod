// Процедурный звук: короткие темы глав, интерфейсные сигналы и «голос» НУЛЯ.
// Внешних файлов нет — всё синтезируется WebAudio.
(function () {
  const NP = window.NP;
  let ctx = null, master = null, musicBus = null, sfxBus = null, voiceBus = null;
  let seq = null;

  // Темы: bpm, тоника (MIDI), лад, бас и арпеджио по ступеням (null — пауза).
  const THEMES = {
    title:   { bpm: 76,  root: 45, scale: [0, 3, 5, 7, 10], wave: 'triangle', bass: [0, null, null, null, -2, null, null, null], arp: [0, 2, 4, 2, 5, 4, 2, 1] },
    office:  { bpm: 92,  root: 50, scale: [0, 2, 4, 7, 9],  wave: 'triangle', bass: [0, null, 4, null, 3, null, 4, null], arp: [2, null, 4, null, 5, 4, null, 2] },
    desktop: { bpm: 100, root: 52, scale: [0, 2, 4, 7, 11], wave: 'square',   bass: [0, null, null, 0, 3, null, null, 3], arp: [0, 2, 4, 6, 4, 2, 5, 4] },
    network: { bpm: 112, root: 47, scale: [0, 2, 3, 7, 8],  wave: 'square',   bass: [0, 0, null, 0, 3, null, 2, null], arp: [4, 2, 0, 2, 5, 2, 0, 2] },
    cache:   { bpm: 84,  root: 44, scale: [0, 2, 3, 7, 10], wave: 'triangle', bass: [0, null, null, null, 2, null, 1, null], arp: [0, 4, 2, 5, 0, 4, 3, 1] },
    chase:   { bpm: 148, root: 45, scale: [0, 1, 3, 5, 7],  wave: 'sawtooth', bass: [0, 0, 0, 1, 0, 0, 3, 2], arp: [4, 3, 4, 2, 4, 3, 5, 2] },
    mira:    { bpm: 68,  root: 49, scale: [0, 2, 4, 7, 9],  wave: 'sine',     bass: [0, null, null, null, 3, null, null, null], arp: [4, null, 2, null, 5, null, 3, null] },
  };

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function degree(theme, d, octave) {
    const s = theme.scale, len = s.length;
    const o = Math.floor(d / len), i = ((d % len) + len) % len;
    return theme.root + s[i] + 12 * (o + (octave || 0));
  }

  function tone(bus, freq, t, dur, type, vol, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(bus, t, dur, vol) {
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b; g.gain.value = vol;
    s.connect(g); g.connect(bus); s.start(t);
  }

  const Audio = (NP.Audio = {
    current: null,
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.connect(ctx.destination);
        musicBus = ctx.createGain(); musicBus.connect(master);
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        voiceBus = ctx.createGain(); voiceBus.connect(master);
        Audio.applyVolumes();
        if (Audio.current) { const c = Audio.current; Audio.current = null; Audio.music(c); }
      } catch (e) { ctx = null; }
    },
    applyVolumes() {
      if (!ctx) return;
      const v = NP.Settings.values;
      musicBus.gain.value = v.music * 0.22;
      sfxBus.gain.value = v.sfx * 0.5;
      voiceBus.gain.value = v.voice * 0.35;
    },
    music(id) {
      if (Audio.current === id && seq) return;
      Audio.current = id;
      if (seq) { clearInterval(seq.timer); seq = null; }
      if (!ctx || !id || !THEMES[id]) return;
      const th = THEMES[id];
      const step = 60 / th.bpm / 2;
      seq = { i: 0, next: ctx.currentTime + 0.1 };
      seq.timer = setInterval(() => {
        if (!ctx) return;
        while (seq && seq.next < ctx.currentTime + 0.25) {
          const i = seq.i, t = seq.next;
          const b = th.bass[i % th.bass.length];
          if (b !== null) tone(musicBus, midi(degree(th, b, -1)), t, step * 1.8, 'triangle', 0.5);
          const a = th.arp[(i + Math.floor(i / 16) * 2) % th.arp.length];
          if (a !== null) tone(musicBus, midi(degree(th, a, 1)), t, step * 0.9, th.wave, th.wave === 'sine' ? 0.35 : 0.14);
          if (id === 'chase' && i % 2 === 0) noise(musicBus, t, 0.05, 0.25);
          seq.i++; seq.next += step;
        }
      }, 60);
    },
    sfx(name) {
      if (!ctx) return;
      const t = ctx.currentTime;
      switch (name) {
        case 'blip': tone(sfxBus, 880, t, 0.05, 'square', 0.2); break;
        case 'confirm': tone(sfxBus, 660, t, 0.07, 'square', 0.25); tone(sfxBus, 990, t + 0.07, 0.1, 'square', 0.25); break;
        case 'error': tone(sfxBus, 220, t, 0.18, 'sawtooth', 0.25, 0.7); break;
        case 'rotate': tone(sfxBus, 520, t, 0.04, 'triangle', 0.3); break;
        case 'evidence': [0, 4, 7, 12].forEach((s, k) => tone(sfxBus, midi(72 + s), t + k * 0.07, 0.14, 'square', 0.2)); break;
        case 'success': [0, 4, 7, 11, 12].forEach((s, k) => tone(sfxBus, midi(67 + s), t + k * 0.08, 0.2, 'triangle', 0.35)); break;
        case 'alarm': for (let k = 0; k < 4; k++) tone(sfxBus, k % 2 ? 620 : 880, t + k * 0.16, 0.15, 'square', 0.25); break;
        case 'glitch': noise(sfxBus, t, 0.35, 0.5); tone(sfxBus, 90, t, 0.3, 'sawtooth', 0.3, 3); break;
        case 'hit': noise(sfxBus, t, 0.25, 0.7); tone(sfxBus, 180, t, 0.3, 'square', 0.35, 0.3); break;
        case 'telegraph': tone(sfxBus, 1200, t, 0.05, 'sine', 0.12); break;
        case 'beam': noise(sfxBus, t, 0.12, 0.25); break;
        case 'fall': tone(sfxBus, 600, t, 0.5, 'triangle', 0.3, 0.2); break;
        case 'door': tone(sfxBus, 300, t, 0.12, 'square', 0.2, 1.6); break;
        case 'step': tone(sfxBus, 140, t, 0.03, 'triangle', 0.08); break;
      }
    },
    // Синтезированная реплика: короткая последовательность тонов, не озвучка.
    voice(speaker) {
      if (!ctx || speaker !== 'nul') return;
      const t = ctx.currentTime;
      for (let k = 0; k < 5; k++) tone(voiceBus, 300 + Math.random() * 500, t + k * 0.05, 0.045, 'square', 0.25);
    },
    typeTick() {
      if (!ctx) return;
      tone(sfxBus, 1500 + Math.random() * 200, ctx.currentTime, 0.012, 'square', 0.05);
    },
  });
})();
