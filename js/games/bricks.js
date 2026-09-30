// Автомат 2 «Файрвол» — разбить стену кирпичей мячом и ракеткой, как в классических аркадах.
(function () {
  const NP = window.NP;
  const COLS = 10, ROWS = 5, BW = 28, BH = 9, BX = 20, BY = 22;
  const ROW_COL = ['#ff5a5f', '#ff9f43', '#ffd166', '#6fe3a1', '#7fe3ff'];

  NP.Games.bricks = function (api) {
    let bricks, pad, ball, stuck, speed, flash = 0;
    const padW = () => (api.easy ? 54 : 42);
    const launch = () => {
      stuck = false;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed;
      api.sfx('confirm');
    };
    return {
      reset(full) {
        if (full) {
          bricks = [];
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            // Верхний ряд прочнее: два удара.
            bricks.push({ x: BX + c * BW, y: BY + r * (BH + 2), hp: r === 0 ? 2 : 1, row: r });
          }
        }
        pad = { x: api.W / 2, y: 166 };
        speed = api.easy ? 115 : 145;
        ball = { x: pad.x, y: pad.y - 5, vx: 0, vy: 0, r: 2 };
        stuck = true;
      },
      update(dt) {
        const a = api.axis();
        if (api.pointer.x !== null && !a.x && (api.pointer.active || performance.now() - (api.pointer.t || 0) < 600)) pad.x += (api.pointer.x - pad.x) * Math.min(1, dt * 18);
        pad.x += a.x * 190 * dt;
        pad.x = NP.clamp(pad.x, padW() / 2 + 4, api.W - padW() / 2 - 4);
        if (stuck) {
          ball.x = pad.x; ball.y = pad.y - 5;
          if (api.pressed('act') || api.pressed('up')) launch();
          return;
        }
        // Шаги поменьше, чтобы мяч не проскакивал кирпичи.
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          ball.x += (ball.vx * dt) / steps; ball.y += (ball.vy * dt) / steps;
          if (ball.x < 4 + ball.r) { ball.x = 4 + ball.r; ball.vx = Math.abs(ball.vx); }
          if (ball.x > api.W - 4 - ball.r) { ball.x = api.W - 4 - ball.r; ball.vx = -Math.abs(ball.vx); }
          if (ball.y < 12 + ball.r) { ball.y = 12 + ball.r; ball.vy = Math.abs(ball.vy); }
          // Ракетка: угол отскока зависит от точки удара.
          const pw = padW();
          if (ball.vy > 0 && ball.y + ball.r >= pad.y && ball.y + ball.r <= pad.y + 5 && Math.abs(ball.x - pad.x) <= pw / 2 + ball.r) {
            const k = (ball.x - pad.x) / (pw / 2);
            const ang = -Math.PI / 2 + k * 1.05;
            speed = Math.min(speed + 3, api.easy ? 170 : 215);
            ball.vx = Math.cos(ang) * speed; ball.vy = Math.sin(ang) * speed;
            ball.y = pad.y - ball.r;
            api.sfx('rotate');
          }
          for (const b of bricks) {
            if (b.hp <= 0) continue;
            if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + BW - 2 || ball.y + ball.r < b.y || ball.y - ball.r > b.y + BH) continue;
            const ox = Math.min(ball.x + ball.r - b.x, b.x + BW - 2 - (ball.x - ball.r));
            const oy = Math.min(ball.y + ball.r - b.y, b.y + BH - (ball.y - ball.r));
            if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            b.hp--;
            flash = 0.06;
            api.sfx(b.hp ? 'rotate' : 'blip');
            break;
          }
        }
        if (ball.y > api.H + 6) return api.die();
        if (flash > 0) flash -= dt;
        if (bricks.every((b) => b.hp <= 0)) api.win();
      },
      draw(g) {
        g.fillStyle = '#0b0d1a'; g.fillRect(0, 0, api.W, api.H);
        g.fillStyle = '#1a1f3a';
        for (let y = 12; y < api.H; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < api.W; x += 8) g.fillRect(x, y, 1, 1);
        g.fillStyle = '#3e4a7a'; g.fillRect(0, 10, api.W, 2); g.fillRect(0, 10, 4, api.H); g.fillRect(api.W - 4, 10, 4, api.H);
        for (const b of bricks) {
          if (b.hp <= 0) continue;
          g.fillStyle = b.hp > 1 ? '#c8d0d9' : ROW_COL[b.row];
          g.fillRect(b.x, b.y, BW - 2, BH);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(b.x, b.y, BW - 2, 2);
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(b.x, b.y + BH - 2, BW - 2, 2);
          if (b.hp > 1) { g.fillStyle = '#5f6b78'; g.fillRect(b.x + 12, b.y + 3, 2, 3); }
        }
        const pw = padW();
        g.fillStyle = '#ffd166'; g.fillRect(Math.round(pad.x - pw / 2), pad.y, pw, 5);
        g.fillStyle = '#ff5a5f'; g.fillRect(Math.round(pad.x - pw / 2), pad.y, 4, 5); g.fillRect(Math.round(pad.x + pw / 2 - 4), pad.y, 4, 5);
        g.fillStyle = flash > 0 && !NP.Settings.values.reduceFlash ? '#ffd166' : '#ffffff';
        g.fillRect(Math.round(ball.x - 2), Math.round(ball.y - 2), 4, 4);
        if (stuck) { g.fillStyle = 'rgba(255,209,102,0.6)'; g.fillRect(Math.round(ball.x), Math.round(ball.y) - 12, 1, 8); }
      },
      status() { return NP.T('arc.bricks.status', { n: bricks.filter((b) => b.hp > 0).length }); },
    };
  };
})();
