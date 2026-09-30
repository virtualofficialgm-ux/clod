// Автоматы НУЛЯ эпизода 1: какая игра, номер, время новости при проигрыше, музыка и значок трофея.
(function () {
  const NP = window.NP;
  const D = (NP.Data = NP.Data || {});

  // Кубок 16×16 с глифом игры 8×5 в центре.
  const CUP = [
    '................', '.yyyyyyyyyyyyyy.', 'yy.yyyyyyyyyy.yy', 'y..yGGGGGGGGy..y', 'y..yGGGGGGGGy..y', 'yy.yGGGGGGGGy.yy',
    '.y.yGGGGGGGGy.y.', '...yGGGGGGGGy...', '....yyyyyyyy....', '......yyyy......', '.......yy.......', '.......yy.......',
    '.....yyyyyy.....', '....yyyyyyyy....', '....oooooooo....', '................',
  ];
  const cup = (glyph) => CUP.map((row, y) => {
    if (y < 3 || y > 7) return row;
    const g = glyph[y - 3];
    return row.slice(0, 4) + [...g].map((c) => (c === '.' ? 'G' : 'k')).join('') + row.slice(12);
  });
  const PAL = { y: '#ffd166', G: '#b88a2e', o: '#8a5a3c', k: '#1b1406' };

  D.arcades = {
    snake: { game: 'snake', color: '#9bbc0f', number: 1, newsTime: '09:34', music: 'desktop', iconPal: PAL,
      icon: cup(['kkkkkk..', '.....k..', '.kkkkk..', '.k......', '.kkkkkkk']) },
    bricks: { game: 'bricks', color: '#ff9f43', number: 2, newsTime: '09:41', music: 'network', iconPal: PAL,
      icon: cup(['kk.kk.kk', 'kk.kk.kk', '........', '...k....', '.kkkkk..']) },
    crossing: { game: 'crossing', color: '#3cff9a', number: 3, newsTime: '09:47', music: 'network', iconPal: PAL,
      icon: cup(['.k....k.', 'kkkkkkkk', '.kkkkkk.', 'k.kkkk.k', 'k......k']) },
    maze: { game: 'maze', color: '#b69cff', number: 4, newsTime: '09:53', music: 'cache', iconPal: PAL,
      icon: cup(['..kkkk..', '.kkkkk..', 'kkk.....', '.kkkkk..', '..kkkk.k']) },
    invaders: { game: 'invaders', color: '#ff5a5f', number: 5, newsTime: '09:58', music: 'chase', iconPal: PAL,
      icon: cup(['.k....k.', '..kkkk..', '.kk..kk.', 'kkkkkkkk', 'k.k..k.k']) },
  };
})();
