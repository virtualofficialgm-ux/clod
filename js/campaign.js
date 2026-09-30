// Кампания «как в фильме»: сценки и раунды по порядку, общий счёт Земля : Пришельцы.
// Три раунда за пришельцами — планета обнулена (можно переиграть последний раунд).
(function () {
  const NP = window.NP;
  const GS = NP.GameState;

  const Camp = (NP.Campaign = {
    get c() { return GS.data.campaign; },
    start() {
      GS.reset();
      GS.data.campaign = { step: 0, h: 0, a: 0 };
      NP.Menus.closeTitle();
      Camp.run();
    },
    resume(d) {
      NP.SaveManager.load(d);
      NP.Menus.closeTitle();
      Camp.run();
    },
    save() {
      GS.data.scene_id = 'campaign';
      NP.SaveManager.save('auto');
    },
    // Табло раундов между сценами.
    score(flip, key) {
      const c = Camp.c;
      return NP.Director.playCutscene({
        fx: 'title', music: flip === 'h' ? 'title' : 'chase',
        stage: { bg: 'score', vars: { h: c.h, a: c.a, flip } },
        frames: [{ key: key || (flip === 'h' ? 'camp.score.h' : 'camp.score.a'), ms: 3400, sfx: flip === 'h' ? 'success' : 'alarm',
          do: flip === 'h' ? [['burst', 190, 150, 'confetti']] : [['shake', 0.5], ['flash']] }],
      });
    },
    async run() {
      const Dir = NP.Director;
      Dir.mode = 'blank';
      NP.UI.setHud(false);
      const steps = NP.Data.campaign;
      const c = Camp.c;
      while (c.step < steps.length) {
        const s = steps[c.step];
        Camp.save();
        if (s.type === 'cutscene') await Dir.playCutscene(s.cut);
        else if (s.type === 'set') Object.assign(c, s.values);
        else if (s.type === 'score') await Camp.score(s.flip, s.key);
        else if (s.type === 'level') {
          const r = await NP.Arcade.run(s.game);
          if (r === 'quit') { Dir.toTitle(); return; }
          GS.setGameResult(s.game, r);
          if (r === 'won') {
            c.h++;
            if (!GS.flag('companion')) { GS.setFlag('companion'); await Dir.playCutscene('c_trophy'); }
            if (s.win) await Dir.playCutscene(s.win);
            if (s.game !== 'kong') await Camp.score('h');
          } else {
            c.a++;
            await Dir.playInvasion(s.game);
            await Camp.score('a');
            if (c.a >= 3) {
              await Dir.playCutscene('c_gameover');
              const retry = await NP.Menus.gameOver();
              if (!retry) { Dir.toTitle(); return; }
              c.a--; // переигрываем тот же раунд
              continue;
            }
            // Финал нужно выиграть: без победы корабль не остановить.
            if (s.mustWin) continue;
          }
        } else if (s.type === 'end') {
          GS.setFlag('campaign_complete');
          c.step++;
          Camp.save();
          NP.Audio.music('title');
          NP.Menus.campaignEnd();
          return;
        }
        c.step++;
      }
      Dir.toTitle();
    },
  });
})();
