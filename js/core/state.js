// GameState — единственный источник сюжетного состояния.
// SaveManager — атомарная запись через временный ключ, две резервные копии, миграции версий.
(function () {
  const NP = window.NP;

  NP.SCHEMA_VERSION = 2;

  function freshState() {
    return {
      schema_version: NP.SCHEMA_VERSION,
      episode_id: 'e01',
      scene_id: 'e01_office',
      checkpoint_id: 'start',
      pos: null,
      flags: {},
      trust_values: { trust_zero: 0, trust_mira: 0, trust_caretaker: 0 },
      evidence_ids: [],
      conclusions: [],
      refuted: [],
      objective: null,
      objectives_done: [],
      hint_levels: {},
      log: [],
      playtime_seconds: 0,
      saved_at: 0,
    };
  }

  const GS = (NP.GameState = {
    data: freshState(),
    version: 0, // растёт при любом изменении — комнаты по нему перерисовывают условные тайлы
    reset() { this.data = freshState(); this.version++; },
    flag(name) { return !!this.data.flags[name]; },
    setFlag(name, value) {
      if (value === undefined) value = true;
      if (this.data.flags[name] === value) return;
      this.data.flags[name] = value;
      this.version++;
      NP.Director && NP.Director.progress();
    },
    trust(key) { return this.data.trust_values[key] || 0; },
    addTrust(key, d) {
      this.data.trust_values[key] = NP.clamp((this.data.trust_values[key] || 0) + d, -2, 2);
      this.version++;
    },
    hasEvidence(id) { return this.data.evidence_ids.indexOf(id) >= 0; },
    // Повторное открытие сцены не выдаёт свидетельство дважды.
    addEvidence(id) {
      if (this.hasEvidence(id)) return false;
      this.data.evidence_ids.push(id);
      this.version++;
      NP.Director && NP.Director.progress();
      return true;
    },
    countEvidence(group) {
      const defs = NP.Data.evidence;
      return this.data.evidence_ids.filter((id) => defs[id] && defs[id].group === group).length;
    },
    addConclusion(id) {
      if (this.data.conclusions.indexOf(id) < 0) this.data.conclusions.push(id);
      this.version++;
    },
    addRefuted(id) {
      if (this.data.refuted.indexOf(id) < 0) this.data.refuted.push(id);
    },
    pushLog(speaker, key) {
      this.data.log.push({ s: speaker, k: key });
      if (this.data.log.length > 150) this.data.log.shift();
    },
  });

  // Условия из данных: 'flag:x', '!flag:x', 'ev:id', 'count:group>=3', 'trust:trust_zero>=1', массив = И.
  NP.cond = function (c) {
    if (c === undefined || c === null || c === true) return true;
    if (c === false) return false;
    if (Array.isArray(c)) return c.every(NP.cond);
    if (typeof c === 'function') return !!c(GS);
    let neg = false;
    let s = String(c);
    if (s[0] === '!') { neg = true; s = s.slice(1); }
    let r = false;
    const idx = s.indexOf(':');
    const kind = s.slice(0, idx), arg = s.slice(idx + 1);
    if (kind === 'flag') r = GS.flag(arg);
    else if (kind === 'ev') r = GS.hasEvidence(arg);
    else if (kind === 'concl') r = GS.data.conclusions.indexOf(arg) >= 0;
    else if (kind === 'count' || kind === 'trust') {
      const m = arg.match(/^(\w+)(>=|<=|==|>|<)(-?\d+)$/);
      if (m) {
        const v = kind === 'count' ? GS.countEvidence(m[1]) : GS.trust(m[1]);
        const n = +m[3];
        r = m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : m[2] === '<' ? v < n : v === n;
      }
    } else {
      console.warn('Неизвестное условие', c);
    }
    return neg ? !r : r;
  };

  // --- Миграции: каждая поднимает схему на одну версию.
  const migrations = {
    // v1 → v2: добавлены опровергнутые версии и уровни подсказок.
    1(d) { d.refuted = d.refuted || []; d.hint_levels = d.hint_levels || {}; d.schema_version = 2; return d; },
  };
  function migrate(d) {
    if (!d || typeof d !== 'object' || typeof d.schema_version !== 'number') return null;
    while (d.schema_version < NP.SCHEMA_VERSION) {
      const m = migrations[d.schema_version];
      if (!m) return null;
      d = m(d);
    }
    if (d.schema_version > NP.SCHEMA_VERSION) return null; // сохранение из будущей версии
    const base = freshState();
    for (const k in base) if (d[k] === undefined) d[k] = base[k];
    return d;
  }

  const PREFIX = 'np.save.';
  NP.SaveManager = {
    slots: ['auto', 'manual'],
    // Атомарная запись: временный ключ → проверка → ротация копий → основной ключ.
    save(slot) {
      const d = GS.data;
      d.saved_at = Date.now();
      d.settings = NP.Settings.values;
      const json = JSON.stringify(d);
      const base = PREFIX + slot;
      if (!NP.store.set(base + '.tmp', json)) return false;
      try { JSON.parse(NP.store.get(base + '.tmp')); } catch (e) { return false; }
      const cur = NP.store.get(base);
      if (cur) {
        const b1 = NP.store.get(base + '.bak1');
        if (b1) NP.store.set(base + '.bak2', b1);
        NP.store.set(base + '.bak1', cur);
      }
      NP.store.set(base, json);
      NP.store.remove(base + '.tmp');
      return true;
    },
    read(slot) {
      const base = PREFIX + slot;
      for (const k of [base, base + '.bak1', base + '.bak2']) {
        const raw = NP.store.get(k);
        if (!raw) continue;
        try {
          const d = migrate(JSON.parse(raw));
          if (d) return d;
        } catch (e) { /* повреждённая копия — пробуем следующую */ }
      }
      return null;
    },
    latest() {
      let best = null;
      for (const s of this.slots) {
        const d = this.read(s);
        if (d && (!best || d.saved_at > best.saved_at)) best = d;
      }
      return best;
    },
    load(d) {
      GS.data = d;
      GS.version++;
    },
    clearAll() {
      for (const s of this.slots) for (const suf of ['', '.tmp', '.bak1', '.bak2']) NP.store.remove(PREFIX + s + suf);
    },
    _migrate: migrate,
  };

  // --- Настройки хранятся отдельно, чтобы переживать новую игру.
  const defaults = {
    music: 0.5, sfx: 0.7, voice: 0.6,
    textSpeed: 'normal', autoAdvance: false, textSize: 'm',
    reduceFlash: false, easyChase: false,
    keys: {
      up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      act: ['KeyE', 'Enter', 'Space'], journal: ['KeyJ'], hint: ['KeyH'], scan: ['KeyQ', 'Tab'], menu: ['Escape'],
    },
  };
  NP.Settings = {
    values: JSON.parse(JSON.stringify(defaults)),
    defaults,
    load() {
      const raw = NP.store.get('np.settings');
      if (!raw) return;
      try {
        const v = JSON.parse(raw);
        this.values = Object.assign(JSON.parse(JSON.stringify(defaults)), v);
        this.values.keys = Object.assign(JSON.parse(JSON.stringify(defaults.keys)), v.keys || {});
      } catch (e) { /* оставляем значения по умолчанию */ }
    },
    save() { NP.store.set('np.settings', JSON.stringify(this.values)); this.apply(); },
    apply() {
      const sizes = { s: 0.9, m: 1, l: 1.18, xl: 1.36 };
      document.documentElement.style.setProperty('--ts', sizes[this.values.textSize] || 1);
      NP.Audio && NP.Audio.applyVolumes();
    },
    resetKeys() { this.values.keys = JSON.parse(JSON.stringify(defaults.keys)); this.save(); },
  };
})();
