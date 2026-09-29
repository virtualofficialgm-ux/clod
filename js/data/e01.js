// Эпизод 1 «Вход»: сцены, объекты, диалоги, улики, загадки, дела и катсцены.
// Сюжетные условия и переходы объявлены здесь, а не в коде сцен. Тексты — в locales/ru.js.
(function () {
  const NP = window.NP;
  const D = (NP.Data = NP.Data || {});

  // --- Помощники разметки
  const fill = (w, ch) => ch.repeat(w);
  const row = (w, marks, ch) => {
    const r = ('#' + fill(w - 2, '.') + '#').split('');
    marks.forEach((x) => { r[x] = ch; });
    return r.join('');
  };
  // Реплика: speaker, next, дополнительные поля (choices, effects, if).
  const L = (speaker, next, extra) => Object.assign({ speaker, next: next || null }, extra || {});
  const C = (id, next, effects, extra) => Object.assign({ id, next: next || null, effects }, extra || {});

  const BASE = {
    '#': { tile: 'top', solid: true },
    '=': { tile: 'face', solid: true },
    '.': { tile: 'floor' },
  };
  const legend = (extra) => Object.assign({}, BASE, extra);

  // ================================================================ СЦЕНЫ
  const APPS_DONE = ['flag:app_calendar', 'flag:app_mail', 'flag:app_trash'];
  const afterApp = ['if', APPS_DONE, [['bark', 'nul', 'bark.e01_bridge_done'], ['objective', 'obj_port'], ['save']]];

  const routeConsole = (n, x) => ({
    id: 'console_' + n, x, y: 2, solid: false, label: 'label.console',
    tag: [{ if: 'flag:route_' + n, key: 'tag.gate_open', style: 'on' }, { key: 'tag.gate_closed' }],
    actions: [['if', 'flag:route_' + n, [['toast', 'ui.route_done']], [
      ['puzzle', 'e01_route_' + n], ['flag', 'route_' + n], ['sfx', 'door'], ['bark', 'nul', 'bark.e01_route' + n], ['save'],
      ['if', 'flag:route_4', [['objective', 'obj_cache_go']]],
    ]]],
  });

  const shard = (id, x, y, dlg) => ({
    id: 'pick_' + id, x, y, if: '!ev:' + id, label: 'label.shard', draw: { kind: 'shard' },
    actions: [['evidence', id], ['dialogue', dlg], ['if', 'count:cache>=3', [['objective', 'obj_cache_clean'], ['save']]]],
  });

  const chaseLegend = legend({ o: { tile: 'pillar', solid: true } });

  D.scenes = {
    e01_office: {
      id: 'e01_office', episode_id: 'e01', background_id: 'office', palette: 'office', music: 'office',
      entry_condition: true, next_scene_id: 'e01_desktop',
      map: [
        '##########################',
        '#==www===www====wwww===w=#',
        '#........................#',
        '#.DDD....DDD.......SS..KK#',
        '#.DDD....DDD.......SS..KK#',
        '#........................#',
        '#.,,,,,,,,,,,,,,,,,,,,,,.#',
        '#.,,,,,,,,,,,,,,,,,,,,,,.#',
        '#.DDD....DDD.............#',
        '#.DDD....DDD..........P..#',
        '#........................#',
        '#P.....................P.#',
        '############dd############',
      ],
      legend: legend({
        w: { tile: 'window', solid: true }, ',': { tile: 'carpet' }, D: { tile: 'desk', solid: true }, S: { tile: 'shelf', solid: true },
        K: { tile: 'counter', solid: true }, P: { tile: 'plant', solid: true }, d: { tile: 'door', solid: true },
      }),
      spawns: { start: { x: 3, y: 5, dir: 'up' } },
      on_first_enter: [['objective', 'obj_morning'], ['bark', 'ilya', 'bark.e01_start']],
      interactables: [
        {
          id: 'laptop', x: 3, y: 4, label: 'label.laptop', draw: { kind: 'laptop', alert: ['flag:intercepted', '!flag:intro_complete'] },
          actions: [['if', '!flag:intercepted', [
            ['puzzle', 'e01_laptop'], ['flag', 'intercepted'], ['dialogue', 'e01_nul_intro'], ['objective', 'obj_window'], ['save'],
          ], [['if', '!flag:window_checked', [['dialogue', 'e01_laptop_wait']], [
            ['puzzle', 'e01_laptop_source'], ['dialogue', 'e01_nul_enter'], ['flag', 'intro_complete'],
            ['cutscene', 'e01_transfer'], ['flag', 'entered_system'], ['scene', 'e01_desktop'],
          ]]]]],
        },
        {
          id: 'window', x: 17, y: 1, w: 2, label: 'label.window', draw: { kind: 'traffic', off: 'flag:traffic_off' }, range: 20,
          actions: [['if', 'flag:window_checked', [['dialogue', 'e01_window_after']], [
            ['if', 'flag:traffic_off', [['dialogue', 'e01_window'], ['flag', 'window_checked'], ['objective', 'obj_source'], ['save']], [['dialogue', 'e01_window_before']]],
          ]]],
        },
        { id: 'vera', x: 10, y: 5, solid: true, label: 'label.vera', draw: { kind: 'person', who: 'vera', dir: 'down' },
          actions: [['if', 'flag:traffic_off', [['dialogue', 'e01_vera_after']], [['dialogue', 'e01_vera_before']]]] },
        { id: 'coffee', x: 23, y: 3, h: 2, label: 'label.coffee', draw: { kind: 'coffee' }, actions: [['dialogue', 'e01_coffee']] },
        { id: 'printer', x: 19, y: 4, w: 2, label: 'label.printer', actions: [['dialogue', 'e01_printer']] },
        { id: 'door', x: 12, y: 11, w: 2, label: 'label.door', actions: [['if', 'flag:intercepted', [['dialogue', 'e01_door_after']], [['dialogue', 'e01_door']]]] },
      ],
    },

    e01_desktop: {
      id: 'e01_desktop', episode_id: 'e01', background_id: 'desktop', palette: 'desktop', music: 'desktop',
      entry_condition: 'flag:entered_system', next_scene_id: 'e01_gateway',
      map: [
        '##############################',
        '#============================#',
        '#............................#',
        '#.AAAAA....MMMMM....TTTTT....#',
        '#.AAAAA....MMMMM....TTTTT....#',
        '#.AAAAA....MMMMM....TTTTT....#',
        '#............................#',
        '#............................#',
        '#~~~~~~~~~~~~~1~~~~~~~~~~~~~~#',
        '#~~~~~~~~~~~~~1~~~~~~~~~~~~~~#',
        '#~~~~~~~~~~~~~2~~~~~~~~~~~~~~#',
        '#~~~~~~~~~~~~~2~~~~~~~~~~~~~~#',
        '#~~~~~~~~~~~~~3~~~~~~~~~~~~~~#',
        '#~~~~~~~~~~~~~3~~~~~~~~~~~~~~#',
        '#............................#',
        '#............................#',
        '##############################',
      ],
      legend: legend({
        A: { tile: 'app', solid: true }, M: { tile: 'app', solid: true }, T: { tile: 'app', solid: true },
        '~': { tile: 'void' },
        1: { tile: 'bridge', if: 'flag:app_calendar', else: '~' },
        2: { tile: 'bridge', if: 'flag:app_mail', else: '~' },
        3: { tile: 'bridge', if: 'flag:app_trash', else: '~' },
      }),
      spawns: { start: { x: 14, y: 6, dir: 'down' }, bottom: { x: 14, y: 14, dir: 'down' } },
      on_first_enter: [['dialogue', 'e01_desktop_arrive'], ['objective', 'obj_desktop']],
      on_void: [['bark', 'nul', 'bark.e01_void']],
      triggers: [{ id: 'crossed', x: 1, y: 14, w: 28, h: 2, actions: [['checkpoint', 'bottom']] }],
      interactables: [
        { id: 'app_cal', x: 2, y: 3, w: 5, h: 3, tag: [{ if: 'flag:app_calendar', key: 'tag.cal_on', style: 'on' }, { key: 'tag.cal_off' }] },
        { id: 'app_mail', x: 11, y: 3, w: 5, h: 3, tag: [{ if: 'flag:app_mail', key: 'tag.mail_on', style: 'on' }, { key: 'tag.mail_off' }] },
        { id: 'app_trash', x: 20, y: 3, w: 5, h: 3, tag: [{ if: 'flag:app_trash', key: 'tag.trash_on', style: 'on' }, { key: 'tag.trash_off' }] },
        { id: 'proc_cal', x: 7, y: 5, solid: true, label: 'label.cal', draw: { kind: 'process', who: 'cal' },
          actions: [['if', 'flag:app_calendar', [['dialogue', 'e01_cal_again']], [['dialogue', 'e01_cal'], ['flag', 'app_calendar'], ['sfx', 'door'], afterApp]]] },
        { id: 'proc_mail', x: 16, y: 5, solid: true, label: 'label.mail', draw: { kind: 'process', who: 'mail' },
          actions: [['if', 'flag:app_mail', [['dialogue', 'e01_mail_again']], [['dialogue', 'e01_mail'], ['flag', 'app_mail'], ['sfx', 'door'], afterApp]]] },
        { id: 'proc_trash', x: 25, y: 5, solid: true, label: 'label.trash', draw: { kind: 'process', who: 'trash' },
          actions: [['if', 'flag:app_trash', [['dialogue', 'e01_trash_again']], [['dialogue', 'e01_trash'], ['flag', 'app_trash'], ['sfx', 'door'], afterApp]]] },
        { id: 'port', x: 14, y: 15, label: 'label.port', draw: { kind: 'port', open: true }, actions: [['scene', 'e01_gateway']] },
      ],
    },

    e01_gateway: {
      id: 'e01_gateway', episode_id: 'e01', background_id: 'network', palette: 'network', music: 'network',
      entry_condition: 'flag:app_trash', next_scene_id: 'e01_cache',
      map: [
        '######################################',
        '#====================================#',
        '#....c...1...c...2...c...3...c...4...#',
        '#........1.......2.......3.......4...#',
        '#........1.......2.......3.......4...#',
        '#........1.......2.......3.......4...#',
        '#........1.......2.......3.......4...#',
        '######################################',
      ],
      legend: legend({
        c: { tile: 'console', solid: true },
        1: { tile: 'gate', solid: true, if: '!flag:route_1', else: { tile: 'gateOpen' } },
        2: { tile: 'gate', solid: true, if: '!flag:route_2', else: { tile: 'gateOpen' } },
        3: { tile: 'gate', solid: true, if: '!flag:route_3', else: { tile: 'gateOpen' } },
        4: { tile: 'gate', solid: true, if: '!flag:route_4', else: { tile: 'gateOpen' } },
      }),
      spawns: { start: { x: 2, y: 4, dir: 'right' } },
      on_first_enter: [['dialogue', 'e01_gateway_arrive'], ['objective', 'obj_route']],
      interactables: [
        routeConsole(1, 5), routeConsole(2, 13), routeConsole(3, 21), routeConsole(4, 29),
        { id: 'to_cache', x: 35, y: 3, w: 2, h: 3, label: 'label.to_cache', draw: { kind: 'exit' }, actions: [['scene', 'e01_cache']] },
      ],
    },

    e01_cache: {
      id: 'e01_cache', episode_id: 'e01', background_id: 'cache', palette: 'cache', music: 'cache',
      entry_condition: 'flag:route_4', next_scene_id: 'e01_chase_1',
      map: [
        '############################',
        '#==========================#',
        '#.SSSS..SSSS....SSSS..SSSS.#',
        '#.SSSS..SSSS....SSSS..SSSS.#',
        '#..........................#',
        '#..........................#',
        '#..SS....................SS#',
        '#..SS.....c.......c......SS#',
        '#..........................#',
        '#..........................#',
        '#.SSSS....rr.....rr...SSSS.#',
        '#.SSSS....rr.....rr...SSSS.#',
        '#..........................#',
        '#..........................#',
        '#..........................#',
        '#############XX#############',
      ],
      legend: legend({ S: { tile: 'shelf', solid: true }, c: { tile: 'console', solid: true }, r: { tile: 'rack', solid: true }, X: { tile: 'door', solid: true } }),
      spawns: { start: { x: 13, y: 5, dir: 'down' }, exit: { x: 13, y: 13, dir: 'down' } },
      on_first_enter: [['dialogue', 'e01_cache_arrive'], ['objective', 'obj_cache_evidence']],
      interactables: [
        shard('ev_cache_log', 4, 4, 'e01_pick_log'),
        shard('ev_access_protocol', 2, 9, 'e01_pick_protocol'),
        shard('ev_mira_letter', 24, 13, 'e01_pick_letter'),
        { id: 'copier', x: 21, y: 5, solid: true, label: 'label.copier', draw: { kind: 'process', who: 'copier' }, actions: [['dialogue', 'e01_copier']] },
        {
          id: 'clean', x: 10, y: 7, label: 'label.clean',
          tag: [{ if: 'flag:cache_clean', key: 'tag.done', style: 'on' }, { if: 'count:cache>=3', key: 'tag.ready' }, { key: 'tag.locked' }],
          actions: [['if', 'flag:cache_clean', [['toast', 'ui.already_done']], [['if', 'count:cache>=3', [
            ['puzzle', 'e01_clean'], ['flag', 'cache_clean'], ['evidence', 'ev_forged_permission'], ['evidence', 'key_cache'],
            ['bark', 'nul', 'bark.e01_clean'], ['objective', 'obj_sync'], ['save'],
          ], [['dialogue', 'e01_console_locked']]]]]],
        },
        {
          id: 'sync', x: 18, y: 7, label: 'label.sync',
          tag: [{ if: 'flag:cache_synced', key: 'tag.done', style: 'on' }, { if: 'flag:cache_clean', key: 'tag.ready' }, { key: 'tag.locked' }],
          actions: [['if', 'flag:cache_synced', [['toast', 'ui.already_done']], [['if', 'flag:cache_clean', [
            ['puzzle', 'e01_sync'], ['flag', 'cache_synced'], ['evidence', 'ev_chronology'], ['bark', 'nul', 'bark.e01_sync'], ['objective', 'obj_board'], ['save'],
          ], [['dialogue', 'e01_sync_locked']]]]]],
        },
        { id: 'board', x: 14, y: 9, solid: true, label: 'label.board', draw: { kind: 'terminal', blink: ['flag:cache_synced', '!concl:c1'] },
          actions: [['if', 'concl:c1', [['dialogue', 'e01_cache_exit'], ['scene', 'e01_chase_1']], [['journal', 'board']]]] },
        { id: 'exit', x: 13, y: 14, w: 2, label: 'label.exit',
          actions: [['if', 'concl:c1', [['dialogue', 'e01_cache_exit'], ['scene', 'e01_chase_1']], [['dialogue', 'e01_cache_locked']]]] },
      ],
    },

    // --- Побег из кэша: три контрольные точки, каждая не длиннее 1–3 минут.
    e01_chase_1: {
      id: 'e01_chase_1', episode_id: 'e01', background_id: 'chase', palette: 'chase', music: 'chase', action: true,
      safe_scene: 'e01_cache', safe_checkpoint: 'exit', next_scene_id: 'e01_chase_2',
      map: [
        fill(30, '#'), '#' + fill(28, '=') + '#',
        row(30, [], '.'), row(30, [7, 15, 22], 'o'), row(30, [], '.'), row(30, [12, 20], 'o'),
        row(30, [5, 21], 'o'), row(30, [], '.'), row(30, [], '.'), fill(30, '#'),
      ],
      legend: chaseLegend,
      spawns: { start: { x: 1, y: 5, dir: 'right' } },
      on_first_enter: [['bark', 'nul', 'bark.c1']],
      hazards: {
        turrets: [
          { x: 8, y: 1, dir: 'down', reach: 4, period: 1.5 },
          { x: 16, y: 1, dir: 'down', reach: 4, period: 1.5, offset: 0.5 },
          { x: 24, y: 1, dir: 'down', reach: 4, period: 1.5, offset: 1 },
        ],
      },
      triggers: [{ id: 'out', x: 28, y: 2, w: 1, h: 7, actions: [['scene', 'e01_chase_2']] }],
      interactables: [],
    },
    e01_chase_2: {
      id: 'e01_chase_2', episode_id: 'e01', background_id: 'chase', palette: 'chase', music: 'chase', action: true,
      safe_scene: 'e01_cache', safe_checkpoint: 'exit', next_scene_id: 'e01_chase_3', reset_flags: ['c2_door', 'c2_node'],
      map: [
        fill(24, '#'), '#' + fill(22, '=') + '#',
        row(24, [], '.'), row(24, [], '.'), row(24, [4, 19], 'o'),
        '#' + fill(22, '.') + 'D', '#' + fill(22, '.') + 'D',
        row(24, [4, 19], 'o'), row(24, [], '.'), row(24, [], '.'), row(24, [], '.'), fill(24, '#'),
      ],
      legend: Object.assign({}, chaseLegend, { D: { tile: 'door', solid: true, if: '!flag:c2_door', else: { tile: 'floor' } } }),
      spawns: { start: { x: 1, y: 5, dir: 'right' } },
      on_first_enter: [['bark', 'nul', 'bark.c2']],
      hazards: { guards: [{ id: 'g1', path: [[8, 3], [15, 3], [15, 8], [8, 8]], speed: 26, period: 2.4 }] },
      triggers: [{ id: 'out', x: 23, y: 5, w: 1, h: 2, if: 'flag:c2_door', actions: [['scene', 'e01_chase_3']] }],
      interactables: [
        { id: 'nodeA', x: 2, y: 9, label: 'label.node_freeze', draw: { kind: 'node' }, tag: [{ key: 'tag.node_freeze' }],
          actions: [['freeze', 'g1', 5], ['sfx', 'confirm'], ['flag', 'c2_node']] },
        { id: 'nodeB', x: 20, y: 9, label: 'label.node_door', draw: { kind: 'node', used: 'flag:c2_door' },
          tag: [{ if: 'flag:c2_door', key: 'tag.door_open', style: 'on' }, { key: 'tag.node_door' }],
          actions: [['if', 'flag:c2_door', [], [['flag', 'c2_door'], ['sfx', 'door'], ['bark', 'nul', 'bark.c2_door']]]] },
      ],
    },
    e01_chase_3: {
      id: 'e01_chase_3', episode_id: 'e01', background_id: 'chase', palette: 'chase', music: 'chase', action: true,
      safe_scene: 'e01_cache', safe_checkpoint: 'exit', next_scene_id: 'e01_node',
      map: [
        fill(64, '#'), '#' + fill(62, '=') + '#',
        row(64, [], '.'), row(64, [10, 22, 34, 46], 'o'), row(64, [16, 40], 'o'), row(64, [6, 28, 52], 'o'),
        row(64, [18, 44], 'o'), row(64, [12, 32, 56], 'o'), row(64, [24, 48], 'o'), row(64, [], '.'), fill(64, '#'),
      ],
      legend: chaseLegend,
      spawns: { start: { x: 2, y: 6, dir: 'right' } },
      on_first_enter: [['bark', 'nul', 'bark.c3']],
      hazards: {
        scanner: { startX: -1, speed: 2.6, delay: 1.6 },
        turrets: [
          { x: 15, y: 1, dir: 'down', reach: 3, period: 1.8 },
          { x: 27, y: 1, dir: 'down', reach: 3, period: 1.8, offset: 0.6 },
          { x: 39, y: 1, dir: 'down', reach: 3, period: 1.8, offset: 0.3 },
          { x: 51, y: 1, dir: 'down', reach: 3, period: 1.8, offset: 0.9 },
        ],
      },
      interactables: [
        { id: 'port3', x: 62, y: 3, label: 'label.port3', draw: { kind: 'port', open: false }, tag: [{ key: 'tag.port3' }], actions: [['sfx', 'error'], ['toast', 'ui.port_closed']] },
        { id: 'port7', x: 62, y: 5, label: 'label.port7', draw: { kind: 'port', open: true }, tag: [{ key: 'tag.port7' }],
          actions: [['bark', 'ilya', 'bark.port7'], ['flag', 'chase_complete'], ['scene', 'e01_node']] },
        { id: 'port12', x: 62, y: 7, label: 'label.port12', draw: { kind: 'port', open: false }, tag: [{ key: 'tag.port12' }], actions: [['sfx', 'error'], ['toast', 'ui.port_closed']] },
      ],
    },

    e01_node: {
      id: 'e01_node', episode_id: 'e01', background_id: 'node', palette: 'node', music: 'mira',
      entry_condition: 'flag:chase_complete', next_scene_id: null,
      map: [fill(16, '#'), '#' + fill(14, '=') + '#', row(16, [], '.'), row(16, [], '.'), row(16, [], '.'), row(16, [], '.'), row(16, [], '.'), row(16, [], '.'), fill(16, '#')],
      legend: legend({}),
      spawns: { start: { x: 7, y: 6, dir: 'up' } },
      on_first_enter: [['dialogue', 'e01_node_arrive'], ['objective', 'obj_mira'], ['save'], ['save_prechoice']],
      interactables: [
        { id: 'terminal', x: 7, y: 3, solid: true, label: 'label.terminal', draw: { kind: 'terminal', blink: '!flag:mira_message_seen', pal: { l: '#b69cff' } },
          actions: [['flag', 'met_mira'], ['dialogue', 'e01_mira'], ['flag', 'mira_message_seen'], ['cutscene', 'e01_erase'], ['dialogue', 'e01_mira_after'], ['episode_end']] },
      ],
    },
  };

  // ================================================================ ЦЕЛИ (3 ступени подсказок)
  const obj = (extra) => extra || {};
  D.objectives = {
    obj_morning: obj(), obj_window: obj(), obj_source: obj(),
    obj_desktop: obj({ flags: ['app_calendar', 'app_mail', 'app_trash'], total: 3 }),
    obj_port: obj(),
    obj_route: obj({ flags: ['route_1', 'route_2', 'route_3', 'route_4'], total: 4 }),
    obj_cache_go: obj(),
    obj_cache_evidence: obj({ count: 'cache', total: 3 }),
    obj_cache_clean: obj(), obj_sync: obj(), obj_board: obj(), obj_escape: obj(), obj_mira: obj(),
  };
  for (const id in D.objectives) D.objectives[id].hints = ['hint.' + id + '.1', 'hint.' + id + '.2', 'hint.' + id + '.3'];

  // ================================================================ УЛИКИ И ПОКАЗАНИЯ
  const ev = (kind, group) => ({ kind, group, episode: 'e01' });
  D.evidence = {
    ev_tasklist: ev('evidence', 'office'),
    tm_nul_meeting: ev('testimony', 'office'),
    tm_calendar: ev('testimony', 'desktop'),
    ev_cache_log: ev('evidence', 'cache'),
    ev_access_protocol: ev('evidence', 'cache'),
    ev_mira_letter: ev('evidence', 'cache'),
    tm_copier: ev('testimony', 'cache_t'),
    ev_forged_permission: ev('evidence', 'cache2'),
    key_cache: ev('key', 'keys'),
    ev_chronology: ev('evidence', 'cache2'),
    ev_mira_record: ev('evidence', 'node'),
  };

  // ================================================================ ДЕЛА
  D.cases = {
    case1: {
      available: 'flag:entered_system',
      ready: 'flag:cache_synced',
      theses: [{ id: 't1', correct: false }, { id: 't2', correct: true }, { id: 't3', correct: false }],
      required: [['tm_nul_meeting'], ['ev_tasklist'], ['ev_cache_log', 'ev_chronology', 'tm_calendar', 'tm_copier']],
      conclusion: 'c1',
      onSolve: [['flag', 'case1_solved'], ['dialogue', 'e01_cache_after'], ['objective', 'obj_escape'], ['save'], ['scene', 'e01_chase_1']],
    },
  };

  // ================================================================ ЗАГАДКИ
  D.puzzles = {
    e01_laptop: { type: 'laptop' },
    e01_laptop_source: { type: 'laptop', mode: 'source' },
    // Маршрут: 2 учебных и 2 самостоятельных варианта. Символы: ▶ вход, B приёмник, X перегруз.
    e01_route_1: { type: 'route', seed: 1, level: ['>──┐', '...│', '...B'] },
    e01_route_2: { type: 'route', seed: 2, level: ['>┐.┌B', '.│X│.', '.└─┘.'] },
    e01_route_3: { type: 'route', seed: 3, level: ['>─┐┌─┐', '┌X││X│', '│.└┘.│', '└───.B'] },
    e01_route_4: { type: 'route', seed: 4, level: ['>─┬──┐.', '.X│.X│.', '.┌┘.┌┘.', '.│..│X.', '.└──┴─B'] },
    e01_clean: {
      type: 'cleanup', answer: 'r5', reference: ['ev_access_protocol', 'ev_cache_log', 'ev_mira_letter'],
      records: [{ id: 'r2', time: '09:11' }, { id: 'r4', time: '09:12' }, { id: 'r5', time: '09:03' }, { id: 'r1', time: '09:05' }, { id: 'r3', time: '09:11' }],
    },
    e01_sync: {
      type: 'sync',
      answer: ['s1', 's2', 's3', 's4', 's5', 's6'],
      shuffled: ['s4', 's1', 's6', 's3', 's5', 's2'],
    },
  };

  // ================================================================ КАТСЦЕНЫ
  D.cutscenes = {
    e01_intro: { fx: 'title', music: 'title', frames: [
      { title: true, key: 'cut.intro.title', ms: 2800 }, { key: 'cut.intro.1', ms: 3600 }, { key: 'cut.intro.2', ms: 3600 },
    ] },
    e01_transfer: { fx: 'transfer', music: 'desktop', frames: [
      { key: 'cut.transfer.1', ms: 4200, sfx: 'glitch' }, { key: 'cut.transfer.2', speaker: 'nul', ms: 4600 },
      { key: 'cut.transfer.3', speaker: 'nul', ms: 5200 }, { key: 'cut.transfer.4', ms: 4200 }, { title: true, key: 'cut.transfer.5', ms: 2400 },
    ] },
    e01_erase: { fx: 'erase', frames: [{ key: 'cut.erase.1', ms: 3600, sfx: 'glitch' }, { key: 'cut.erase.2', ms: 4200 }] },
    e01_outro: { fx: 'title', music: 'title', frames: [
      { key: 'cut.outro.1', ms: 4600 }, { key: 'cut.outro.2', speaker: 'nul', ms: 5200 }, { title: true, key: 'cut.outro.3', ms: 3000 },
    ] },
  };

  // ================================================================ ДИАЛОГИ
  // Ключ текста строки: dlg.<диалог>.<реплика>, выбора: dlg.<диалог>.<реплика>.<выбор>.
  D.dialogues = {
    e01_vera_before: { start: 'l1', lines: {
      l1: L('vera', null, { choices: [C('c1', 'l2a'), C('c2', 'l2b')] }),
      l2a: L('vera'), l2b: L('vera'),
    } },
    e01_vera_after: { start: 'l1', lines: { l1: L('vera', 'l2'), l2: L('ilya', 'l3'), l3: L('vera') } },
    e01_coffee: { start: 'l1', lines: { l1: L('sys') } },
    e01_printer: { start: 'l1', lines: { l1: L('sys') } },
    e01_door: { start: 'l1', lines: { l1: L('ilya') } },
    e01_door_after: { start: 'l1', lines: { l1: L('ilya') } },

    e01_nul_intro: { start: 'l1', lines: {
      l1: L('sys', 'l2'),
      l2: L('nul', null, { choices: [C('c1', 'l3a'), C('c2', 'l3b'), C('c3', 'l3c')] }),
      l3a: L('nul', 'l4'), l3b: L('nul', 'l4'), l3c: L('nul', 'l4'),
      l4: L('nul', 'l5'),
      l5: L('nul', null, { effects: [['evidence', 'tm_nul_meeting']], choices: [C('c1', 'l6a'), C('c2', 'l6b'), C('c3', 'l6c', [['trust', 'trust_zero', 1]])] }),
      l6a: L('nul', 'l7'), l6b: L('nul', 'l7'), l6c: L('nul', 'l7'),
      l7: L('sys', null, { effects: [['flag', 'traffic_off'], ['sfx', 'glitch'], ['shake', 0.3]] }),
    } },
    e01_laptop_wait: { start: 'l1', lines: { l1: L('nul') } },
    e01_window_before: { start: 'l1', lines: { l1: L('ilya') } },
    e01_window: { start: 'l1', lines: { l1: L('sys', 'l2'), l2: L('ilya', 'l3'), l3: L('vera', 'l4'), l4: L('ilya') } },
    e01_window_after: { start: 'l1', lines: { l1: L('ilya') } },
    e01_nul_enter: { start: 'l1', lines: {
      l1: L('ilya', 'l2'), l2: L('nul', 'l3'),
      l3: L('nul', null, { choices: [C('c1', 'l4a'), C('c2', 'l4b'), C('c3', 'l4c')] }),
      l4a: L('nul', 'l5'), l4b: L('nul', 'l5'), l4c: L('nul', 'l5'),
      l5: L('sys'),
    } },

    e01_desktop_arrive: { start: 'l1', lines: { l1: L('ilya', 'l2'), l2: L('nul', 'l3'), l3: L('nul', 'l4'), l4: L('nul', 'l5'), l5: L('nul') } },
    e01_cal: { start: 'l1', lines: {
      l1: L('cal', null, { choices: [C('c1', 'l2'), C('c2', 'l2')] }),
      l2: L('cal', 'l3'), l3: L('cal', 'l4', { effects: [['evidence', 'tm_calendar']] }), l4: L('ilya', 'l5'), l5: L('cal', 'l6'), l6: L('cal'),
    } },
    e01_cal_again: { start: 'l1', lines: { l1: L('cal') } },
    e01_mail: { start: 'l1', lines: {
      l1: L('mail', 'l2'),
      l2: L('mail', null, { effects: [['flag', 'heard_of_m']], choices: [C('c1', 'l3'), C('c2', 'l3')] }),
      l3: L('mail', 'l4'), l4: L('mail'),
    } },
    e01_mail_again: { start: 'l1', lines: { l1: L('mail') } },
    e01_trash: { start: 'l1', lines: {
      l1: L('trash', 'l2'), l2: L('ilya', 'l3'),
      l3: L('trash', null, { choices: [C('c1', 'l4a'), C('c2', 'l4b')] }),
      l4a: L('trash', 'l5'), l4b: L('trash', 'l5'), l5: L('trash'),
    } },
    e01_trash_again: { start: 'l1', lines: { l1: L('trash') } },

    e01_gateway_arrive: { start: 'l1', lines: { l1: L('nul', 'l2'), l2: L('nul', 'l3'), l3: L('ilya', 'l4'), l4: L('nul') } },

    e01_cache_arrive: { start: 'l1', lines: {
      l1: L('nul', 'l2'), l2: L('nul', 'l3'), l3: L('ilya', 'l4', { if: 'flag:heard_of_m' }), l4: L('nul', null, { if: 'flag:heard_of_m' }),
    } },
    e01_pick_log: { start: 'l1', lines: { l1: L('ilya') } },
    e01_pick_letter: { start: 'l1', lines: { l1: L('sys', 'l2'), l2: L('ilya', 'l3'), l3: L('nul') } },
    e01_pick_protocol: { start: 'l1', lines: { l1: L('ilya', 'l2'), l2: L('ilya') } },
    e01_copier: { start: 'l1', lines: {
      l1: L('copier', null, { choices: [C('c1', 'l2'), C('c2', 'l3')] }),
      l2: L('copier', 'l3', { effects: [['evidence', 'tm_copier']] }), l3: L('copier'),
    } },
    e01_console_locked: { start: 'l1', lines: { l1: L('nul') } },
    e01_sync_locked: { start: 'l1', lines: { l1: L('nul') } },
    e01_cache_locked: { start: 'l1', lines: { l1: L('nul') } },
    e01_cache_exit: { start: 'l1', lines: { l1: L('nul') } },
    e01_cache_after: { start: 'l1', lines: {
      l1: L('ilya', 'l2'),
      l2: L('nul', 'l3', { if: 'trust:trust_zero>=1' }),
      l3: L('nul', 'l4', { if: 'trust:trust_zero<1' }),
      l4: L('nul', null, { choices: [C('c1', 'l5a', [['trust', 'trust_zero', -1]]), C('c2', 'l5b')] }),
      l5a: L('nul', 'l6'), l5b: L('nul', 'l6'),
      l6: L('sys', 'l7', { effects: [['sfx', 'alarm'], ['flash'], ['shake', 0.4]] }),
      l7: L('nul', 'l8'), l8: L('ilya', 'l9'), l9: L('nul'),
    } },

    e01_node_arrive: { start: 'l1', lines: { l1: L('sys', 'l2'), l2: L('nul', 'l3'), l3: L('sys') } },
    e01_mira: { start: 'l1', lines: {
      l1: L('sys', 'l2'),
      l2: L('mira', null, { choices: [C('c1', 'l3a'), C('c2', 'l3b'), C('c3', 'l3c')] }),
      l3a: L('mira', 'l4'), l3b: L('mira', 'l4'), l3c: L('mira', 'l4'),
      l4: L('mira', 'l5'),
      l5: L('mira', 'l6', { effects: [['evidence', 'ev_mira_record']] }),
      l6: L('mira', null, { choices: [
        C('c1', 'l7a', [['flag', 'shared_with_zero', false], ['trust', 'trust_mira', 1], ['trust', 'trust_zero', -1]]),
        C('c2', 'l7b', [['flag', 'shared_with_zero', true], ['trust', 'trust_zero', 1], ['trust', 'trust_mira', -1]]),
      ] }),
      l7a: L('mira'),
      l7b: L('nul', 'l8b'), l8b: L('mira'),
    } },
    e01_mira_after: { start: 'l1', lines: {
      l1: L('nul', 'l2', { if: 'flag:shared_with_zero' }),
      l2: L('nul', 'l3', { if: '!flag:shared_with_zero' }),
      l3: L('ilya', null, { choices: [C('c1', 'l4a'), C('c2', 'l4b')] }),
      l4a: L('nul', 'l5'), l4b: L('nul', 'l5'), l5: L('sys'),
    } },
  };

  // Нормализация контракта строки: line_id, speaker_id, text_key, portrait_id, choices[].
  for (const did in D.dialogues) {
    const d = D.dialogues[did];
    for (const lid in d.lines) {
      const l = d.lines[lid];
      l.line_id = lid;
      l.speaker_id = l.speaker;
      l.text_key = l.text_key || 'dlg.' + did + '.' + lid;
      l.portrait_id = l.portrait || l.speaker;
      (l.choices || []).forEach((c) => { c.text_key = c.text_key || 'dlg.' + did + '.' + lid + '.' + c.id; c.next_line_id = c.next; });
    }
  }
})();
