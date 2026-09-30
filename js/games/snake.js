// Автомат 1 «Сборщик мусора» — змейка в духе старых телефонов. Собрать 15 пакетов.
(function () {
  const NP = window.NP;
  const C = 10, GW = 32, GH = 17, OY = 5, GOAL = 15;
  const PAL = { bg: '#9bbc0f', grid: '#8bac0f', dark: '#0f380f', mid: '#306230' };

  NP.Games.snake = function (api) {
    let snake, dir, queue, food, t, eaten, wobble = 0;
    const occupied = (x, y) => snake.some((s) => s.x === x && s.y === y);
    const place = () => {
      let x, y, n = 0;
      do { x = 1 + Math.floor(Math.random() * (GW - 2)); y = 1 + Math.floor(Math.random() * (GH - 2)); n++; } while (occupied(x, y) && n < 500);
      food = { x, y };
    };
    const turn = (dx, dy) => {
      const lastDir = queue.length ? queue[queue.length - 1] : dir;
      if (lastDir.x === -dx && lastDir.y === -dy) return;
      if (lastDir.x === dx && lastDir.y === dy) return;
      if (queue.length < 2) queue.push({ x: dx, y: dy });
    };
    return {
      reset(full) {
        snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
        dir = { x: 1, y: 0 }; queue = []; t = 0;
        if (full) eaten = 0;
        place();
      },
      update(dt) {
        // Поворот — по нажатию, не по удержанию, чтобы не было случайных разворотов.
        if (api.pressed('left')) turn(-1, 0);
        if (api.pressed('right')) turn(1, 0);
        if (api.pressed('up')) turn(0, -1);
        if (api.pressed('down')) turn(0, 1);
        const a = api.axis();
        if (Math.abs(a.x) > 0.6) turn(Math.sign(a.x), 0); else if (Math.abs(a.y) > 0.6) turn(0, Math.sign(a.y));
        wobble += dt;
        t += dt;
        const step = Math.max(0.07, (api.easy ? 0.16 : 0.12) - eaten * 0.003);
        while (t >= step) {
          t -= step;
          if (queue.length) dir = queue.shift();
          const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
          if (h.x < 0 || h.y < 0 || h.x >= GW || h.y >= GH || occupied(h.x, h.y)) return api.die();
          snake.unshift(h);
          if (h.x === food.x && h.y === food.y) {
            eaten++;
            api.sfx('blip');
            api.boom(h.x * C + 5, OY + h.y * C + 5, PAL.dark, 12);
            if (eaten >= GOAL) return api.win();
            place();
          } else snake.pop();
        }
      },
      draw(g) {
        g.fillStyle = PAL.dark; g.fillRect(0, 0, api.W, api.H);
        g.fillStyle = PAL.bg; g.fillRect(0, OY, GW * C, GH * C);
        g.fillStyle = PAL.grid;
        for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) if ((x + y) % 2) g.fillRect(x * C, OY + y * C, C, C);
        // Пакет: конверт, мигает
        const fx = food.x * C, fy = OY + food.y * C;
        g.fillStyle = PAL.dark; g.fillRect(fx + 1, fy + 2, 8, 6);
        g.fillStyle = Math.sin(wobble * 8) > 0 ? PAL.bg : PAL.mid; g.fillRect(fx + 2, fy + 3, 6, 1); g.fillRect(fx + 3, fy + 4, 4, 1);
        snake.forEach((s, i) => {
          g.fillStyle = i === 0 ? PAL.dark : PAL.mid;
          g.fillRect(s.x * C + 1, OY + s.y * C + 1, C - 2, C - 2);
          if (i === 0) { g.fillStyle = PAL.bg; g.fillRect(s.x * C + 3 + dir.x * 2, OY + s.y * C + 3 + dir.y * 2, 2, 2); }
        });
      },
      status() { return NP.T('arc.snake.status', { n: eaten, total: GOAL }); },
    };
  };
})();
