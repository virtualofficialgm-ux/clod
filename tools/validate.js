#!/usr/bin/env node
// Проверка данных эпизода: недостижимые и бесконечные диалоги, отсутствующие строки,
// ссылки на несуществующие сцены/загадки/улики, геометрия карт, решаемость «Маршрута».
// Запуск: node tools/validate.js  (код выхода 1 при ошибках)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, console, document: undefined };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['js/core/util.js', 'js/locales/ru.js', 'js/core/state.js', 'js/data/e01.js', 'js/data/arcades.js', 'js/puzzles/puzzles.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const NP = ctx.window.NP;
const D = NP.Data;
const ru = NP.locales.ru;

const errors = [];
const warnings = [];
const used = new Set();
const err = (m) => errors.push(m);
const key = (k, where) => { used.add(k); if (ru[k] === undefined) err(`нет строки «${k}» (${where})`); };

// ---------- Действия
function checkActions(list, where) {
  if (!list) return;
  if (!Array.isArray(list)) return err(`${where}: действия должны быть массивом`);
  for (const a of list) {
    if (!Array.isArray(a)) { err(`${where}: неверное действие ${JSON.stringify(a)}`); continue; }
    const [op, x, y, z] = a;
    switch (op) {
      case 'dialogue': if (!D.dialogues[x]) err(`${where}: нет диалога ${x}`); break;
      case 'puzzle': if (!D.puzzles[x]) err(`${where}: нет загадки ${x}`); break;
      case 'scene': if (!D.scenes[x]) err(`${where}: нет сцены ${x}`); break;
      case 'evidence': if (!D.evidence[x]) err(`${where}: нет улики ${x}`); break;
      case 'objective': if (!D.objectives[x]) err(`${where}: нет цели ${x}`); break;
      case 'cutscene': if (!D.cutscenes[x]) err(`${where}: нет катсцены ${x}`); break;
      case 'bark': key('speaker.' + x, where); key(y, where); break;
      case 'toast': key(x, where); break;
      case 'journal': case 'flag': case 'trust': case 'save': case 'sfx': case 'music': case 'wait': case 'freeze':
      case 'shake': case 'flash': case 'episode_end': case 'save_prechoice': break;
      case 'checkpoint': case 'emote': break;
      case 'arcade': if (!D.arcades[x]) err(`${where}: нет автомата ${x}`); break;
      case 'if': checkActions(y, where + '/if'); checkActions(z, where + '/else'); break;
      default: err(`${where}: неизвестный эффект ${op}`);
    }
  }
}

// ---------- Диалоги
for (const did in D.dialogues) {
  const d = D.dialogues[did];
  const lines = d.lines;
  if (!lines[d.start]) err(`диалог ${did}: нет стартовой реплики ${d.start}`);
  const edges = {};
  for (const lid in lines) {
    const l = lines[lid];
    key(l.text_key, `${did}.${lid}`);
    if (l.speaker !== 'sys') key('speaker.' + l.speaker, `${did}.${lid}`);
    const out = [];
    if (l.next) { if (!lines[l.next]) err(`${did}.${lid}: next → нет реплики ${l.next}`); out.push(l.next); }
    for (const c of l.choices || []) {
      key(c.text_key, `${did}.${lid}.${c.id}`);
      if (c.next) { if (!lines[c.next]) err(`${did}.${lid}.${c.id}: → нет реплики ${c.next}`); out.push(c.next); }
      checkActions(c.effects, `${did}.${lid}.${c.id}`);
    }
    if (l.choices && l.choices.length > 3) err(`${did}.${lid}: больше трёх вариантов ответа`);
    if (l.choices && l.choices.length === 1) warnings.push(`${did}.${lid}: единственный вариант ответа`);
    checkActions(l.effects, `${did}.${lid}`);
    edges[lid] = out;
  }
  // Достижимость
  const seen = new Set();
  const stack = [d.start];
  while (stack.length) { const n = stack.pop(); if (!n || seen.has(n) || !lines[n]) continue; seen.add(n); stack.push(...edges[n]); }
  for (const lid in lines) if (!seen.has(lid)) err(`диалог ${did}: реплика ${lid} недостижима`);
  // Циклы = бесконечный диалог
  const state = {};
  const dfs = (n) => {
    if (state[n] === 1) return err(`диалог ${did}: цикл через ${n}`);
    if (state[n] === 2 || !lines[n]) return;
    state[n] = 1; edges[n].forEach(dfs); state[n] = 2;
  };
  dfs(d.start);
}

// ---------- Сцены
for (const sid in D.scenes) {
  const s = D.scenes[sid];
  key('scene.' + sid, sid);
  if (s.id !== sid) err(`сцена ${sid}: id не совпадает`);
  if (s.next_scene_id && !D.scenes[s.next_scene_id]) err(`${sid}: next_scene_id → нет сцены ${s.next_scene_id}`);
  if (s.safe_scene && !D.scenes[s.safe_scene]) err(`${sid}: safe_scene → нет сцены`);
  const w = s.map[0].length;
  s.map.forEach((r, i) => { if (r.length !== w) err(`${sid}: строка карты ${i} длиной ${r.length}, ожидалось ${w}`); });
  for (const r of s.map) for (const ch of r) if (!s.legend[ch]) err(`${sid}: символ «${ch}» не описан в легенде`);
  const solidAt = (x, y) => { const e = s.legend[s.map[y][x]]; return !e || e.solid; };
  for (const cp in s.spawns) {
    const p = s.spawns[cp];
    if (p.y >= s.map.length || p.x >= w || solidAt(p.x, p.y)) err(`${sid}: точка появления ${cp} в стене или вне карты`);
  }
  for (const it of s.interactables || []) {
    const where = `${sid}/${it.id}`;
    if (it.x + (it.w || 1) > w || it.y + (it.h || 1) > s.map.length) err(`${where}: вне карты`);
    if (it.actions) key(it.label, where);
    (it.tag || []).forEach((t) => key(t.key, where));
    checkActions(it.actions, where);
  }
  for (const tr of s.triggers || []) checkActions(tr.actions, `${sid}/trigger ${tr.id}`);
  checkActions(s.on_first_enter, sid + '/on_first_enter');
  checkActions(s.on_enter, sid + '/on_enter');
  checkActions(s.on_void, sid + '/on_void');
  const hz = s.hazards;
  if (hz) for (const t of hz.turrets || []) if (!solidAt(t.x, t.y)) warnings.push(`${sid}: башня ${t.x},${t.y} не в стене`);
}

// ---------- Цели, улики, дела, катсцены
for (const id in D.objectives) { key('obj.' + id, 'objectives'); D.objectives[id].hints.forEach((k) => key(k, 'hints ' + id)); }
for (const id in D.evidence) { key('ev.' + id + '.title', 'evidence'); key('ev.' + id + '.text', 'evidence'); key('kind.' + D.evidence[id].kind, 'evidence'); }
for (const id in D.cases) {
  const c = D.cases[id];
  ['title', 'notready', 'missing'].forEach((k) => key(`case.${id}.${k}`, 'case'));
  key('concl.' + c.conclusion, 'case');
  if (c.theses.filter((t) => t.correct).length !== 1) err(`дело ${id}: должен быть ровно один верный тезис`);
  c.theses.forEach((t) => { key(`case.${id}.${t.id}`, 'case'); if (!t.correct) key(`case.${id}.${t.id}.why`, 'case'); });
  c.required.flat().forEach((e) => { if (!D.evidence[e]) err(`дело ${id}: нет улики ${e}`); });
  checkActions(c.onSolve, 'case ' + id);
}
for (const id in D.cutscenes) D.cutscenes[id].frames.forEach((f) => { key(f.key, 'cutscene ' + id); if (f.speaker) key('speaker.' + f.speaker, 'cutscene'); });

// ---------- Загадки
const R = NP.Puzzles._route;
for (const id in D.puzzles) {
  const p = D.puzzles[id];
  if (p.type === 'route') {
    key(`pz.${id}.title`, id); key(`pz.${id}.intro`, id);
    const lv = R.parseLevel(p.level);
    if (lv.cells.filter((c) => c.kind === 'src').length !== 1) err(`${id}: нужен ровно один вход`);
    if (!lv.cells.some((c) => c.kind === 'sink')) err(`${id}: нет приёмника`);
    const sol = R.flow(lv, true);
    if (!sol.sink || sol.over) err(`${id}: решённое состояние не проходит (приёмник: ${sol.sink}, перегруз: ${sol.over})`);
    R.scramble(lv, p.seed || 1);
    const st = R.flow(lv);
    if (st.sink && !st.over) err(`${id}: загадка решена сразу после перемешивания`);
  } else if (p.type === 'cleanup') {
    key(`pz.${id}.title`, id); key(`pz.${id}.intro`, id);
    if (!p.records.some((r) => r.id === p.answer)) err(`${id}: ответ не среди записей`);
    p.records.forEach((r) => ['from', 'what', 'route', 'why'].forEach((k) => key(`rec.${r.id}.${k}`, id)));
    (p.reference || []).forEach((e) => { if (!D.evidence[e]) err(`${id}: нет улики ${e}`); });
  } else if (p.type === 'sync') {
    key(`pz.${id}.title`, id); key(`pz.${id}.intro`, id); key(`pz.${id}.done`, id);
    if (p.answer.slice().sort().join() !== p.shuffled.slice().sort().join()) err(`${id}: перемешанный список не совпадает с ответом`);
    if (p.answer.join() === p.shuffled.join()) err(`${id}: список уже упорядочен`);
    p.answer.forEach((s) => key('sync.' + s, id));
  }
}

// ---------- Автоматы
const GAME_FILES = fs.readdirSync(path.join(root, 'js/games')).map((f) => f.replace('.js', ''));
for (const id in D.arcades) {
  const a = D.arcades[id];
  if (GAME_FILES.indexOf(a.game) < 0) err(`автомат ${id}: нет файла игры js/games/${a.game}.js`);
  ['title', 'genre', 'nul_intro', 'rules', 'keys', 'touch', 'trophy', 'trophy_desc', 'nul_win', 'nul_lose', 'news', 'news_short', 'status']
    .forEach((k) => key(`arc.${id}.${k}`, 'arcade ' + id));
  if (a.icon.length !== 16 || a.icon.some((r) => r.length !== 16)) err(`автомат ${id}: значок не 16×16`);
}

// ---------- Неиспользуемые строки диалогов (признак опечатки в id)
for (const k in ru) if (k.startsWith('dlg.e01') && !used.has(k)) warnings.push(`строка ${k} нигде не используется`);

warnings.forEach((w) => console.log('предупреждение: ' + w));
if (errors.length) {
  errors.forEach((e) => console.error('ОШИБКА: ' + e));
  console.error(`\n${errors.length} ошибок`);
  process.exit(1);
}
console.log(`Данные в порядке: ${Object.keys(D.scenes).length} сцен, ${Object.keys(D.dialogues).length} диалогов, ${Object.keys(D.puzzles).length} загадок, ${Object.keys(ru).length} строк.`);
