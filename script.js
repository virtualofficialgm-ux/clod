(() => {
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const page = body.dataset.page || 'home';

  // Прелоадер (есть только на главной)
  const finishLoading = () => {
    body.classList.add('is-loaded');
    setTimeout(() => body.classList.remove('is-loading'), 900);
  };
  if (document.querySelector('.preloader')) {
    window.addEventListener('load', () => setTimeout(finishLoading, reduced ? 0 : 900));
    setTimeout(finishLoading, 2500); // запасной вариант, если шрифты грузятся долго
  } else {
    body.classList.add('is-loaded');
  }

  document.getElementById('year').textContent = new Date().getFullYear();

  // Шапка: фон при скролле и скрытие при прокрутке вниз
  const header = document.querySelector('.header');
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > lastY && y > 400 && !nav.classList.contains('is-open'));
    lastY = y;
  }, { passive: true });

  // Мобильное меню
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    header.classList.toggle('is-menu-open', open);
    burger.setAttribute('aria-expanded', open);
    body.style.overflow = open ? 'hidden' : '';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    header.classList.remove('is-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    body.style.overflow = '';
  }));


  // ——— Контент сайта: берётся из content/*.json (редактируется в /admin) ———
  const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const parseDate = s => { const [d, t = '00:00'] = String(s).split('T'); const [y, m, day] = d.split('-').map(Number); const [hh, mm] = t.split(':').map(Number); return new Date(y, m - 1, day, hh || 0, mm || 0); };
  const pad = n => String(n).padStart(2, '0');
  const textOnly = !!window.__TEXT_CONTACTS__; // в превью ссылки mailto/tel не работают
  const paragraphs = (text, cls = '') => String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p${cls ? ` class="${cls}"` : ''}>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const formatDate = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const formatTime = d => (d.getHours() || d.getMinutes() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '');

  // Адрес страницы строится из названия: «Плутни Скапена» → plutni-skapena
  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const slugify = str => String(str || '').toLowerCase().split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const showUrl = title => `spektakl.html?id=${slugify(title)}`;
  const newsUrl = n => `novost.html?id=${String(n.date || '').slice(0, 10)}-${slugify(n.title)}`;
  const findShow = (shows, title) => (shows.shows || []).find(sh => slugify(sh.title) === slugify(title));
  // Все показы: даты из карточек спектаклей
  const allDates = shows => (shows.shows || []).flatMap(sh => (sh.dates || []).map(d => ({ ...d, title: sh.title })));
  const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const when = e => (e.date ? parseDate(e.date).getTime() : Infinity);
  const upcoming = list => list.filter(e => when(e) >= startOfToday()).sort((a, b) => when(a) - when(b));
  const ticketButton = e => (e.ticket_url
    ? `<a href="${esc(e.ticket_url)}" target="_blank" rel="noopener" class="event__btn">Купить билеты</a>`
    : '<span class="event__btn is-soon" aria-disabled="true">Билеты скоро</span>');
  const plural = (n, forms) => forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
  const firstParagraph = (text, max = 180) => {
    const p = String(text || '').split(/\n\s*\n/)[0].trim();
    return p.length > max ? p.slice(0, max).replace(/\s+\S*$/, '') + '…' : p;
  };

  const loadContent = async () => {
    if (window.__CONTENT__) return window.__CONTENT__;
    const get = name => fetch(`content/${name}.json`, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    const [settings, news, shows] = await Promise.all([get('settings'), get('news'), get('shows')]);
    return { settings, news, shows };
  };

  const renderHome = ({ settings: s, news, shows }) => {
    document.querySelectorAll('[data-text]').forEach(el => (el.textContent = s[el.dataset.text] || ''));

    const words = (s.marquee || []).map(w => `<span>${esc(w)}</span><b>△</b>`).join('');
    document.getElementById('marquee').innerHTML = words + words;

    document.getElementById('about-text').innerHTML = (s.about_text || []).map(p => `<p class="reveal">${esc(p)}</p>`).join('');
    document.getElementById('stats').hidden = !(s.stats || []).length;
    document.getElementById('stats').innerHTML = (s.stats || []).map(st => {
      const [first, ...rest] = esc(st.label).split(' ');
      return `<div class="stat reveal"><span class="stat__num" data-count="${+st.number || 0}">0</span><span class="stat__label">${first}<br>${rest.join(' ')}</span></div>`;
    }).join('');

    // Афиша: все будущие показы всех спектаклей по дате; показы без даты («скоро») — в конце
    // Афиша: каждый спектакль одной строкой с ближайшим показом; все даты и билеты — на странице спектакля
    const repertoire = (shows.shows || [])
      .map(sh => ({ sh, dates: upcoming((sh.dates || []).map(d => ({ ...d, title: sh.title }))) }))
      .filter(r => r.dates.length)
      .sort((a, b) => when(a.dates[0]) - when(b.dates[0]));
    document.getElementById('events').innerHTML = repertoire.length ? repertoire.map(({ sh, dates }) => {
      const next = dates[0];
      const d = next.date ? parseDate(next.date) : null;
      const more = dates.length - 1;
      const meta = [next.category, sh.genre, sh.age, sh.duration].filter(Boolean).map(esc).join(' · ');
      const desc = firstParagraph(sh.description);
      return `<li class="event reveal">
          <div class="event__date">${d ? `<span>${pad(d.getDate())}</span>${MONTHS[d.getMonth()]}` : '<span>Скоро</span>'}
            ${more > 0 ? `<small class="event__more-dates">и ещё ${more} ${plural(more, ['дата', 'даты', 'дат'])}</small>` : ''}</div>
          <div class="event__info">
            <h3 class="event__title"><a href="${showUrl(sh.title)}" class="event__link">${esc(sh.title)}</a></h3>
            ${meta ? `<p class="event__meta">${meta}</p>` : ''}
            ${desc ? `<p class="event__desc">${esc(desc)}</p>` : ''}
          </div>
          <span class="event__btn">Даты и билеты</span>
        </li>`;
    }).join('') : '<li class="events__empty reveal">Скоро объявим новые спектакли</li>';

    const items = (news.items || []).slice().sort((a, b) => parseDate(b.date) - parseDate(a.date));
    document.getElementById('news-list').innerHTML = items.length ? items.map(n => {
      const d = parseDate(n.date);
      const cover = n.image || (n.gallery || [])[0];
      const first = String(n.text || '').split(/\n\s*\n/)[0] || '';
      return `<article class="news-item reveal">
          ${cover ? `<div class="news-item__img"><img src="${esc(cover)}" alt="" loading="lazy"></div>` : ''}
          <time class="news-item__date">${formatDate(d)}</time>
          <h3 class="news-item__title"><a href="${newsUrl(n)}" class="news-item__link">${esc(n.title)}</a></h3>
          <p class="news-item__text">${esc(first.length > 220 ? first.slice(0, 220).replace(/\s+\S*$/, '') + '…' : first)}</p>
          <span class="news-item__more">Читать полностью →</span>
        </article>`;
    }).join('') : '<p class="events__empty reveal">Новостей пока нет</p>';

    document.getElementById('cards').innerHTML = (s.projects || []).map((p, i) => `<article class="card reveal">
          <span class="card__num">${pad(i + 1)}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
        </article>`).join('');

    const c = s.contacts || {};
    const tel = String(c.phone || '').replace(/[^\d+]/g, '');
    const link = (href, text) => textOnly || !href ? esc(text) : `<a href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(text)}</a>`;
    const socials = [c.vk && link(c.vk, 'ВКонтакте'), c.telegram && link(c.telegram, 'Telegram')].filter(Boolean).join(' · ');
    document.getElementById('contacts-info').innerHTML = [
      ['Адрес', esc(c.address)],
      ['Телефон', link(tel && `tel:${tel}`, c.phone)],
      ['Почта', link(c.email && `mailto:${c.email}`, c.email)],
      socials && ['Соцсети', socials],
    ].filter(row => row && row[1]).map(([cap, val]) => `<div class="reveal"><span class="contacts__cap">${cap}</span><p>${val}</p></div>`).join('');
    if (c.email && !textOnly) document.getElementById('write-us').href = `mailto:${c.email}`;
  };

  const renderGallery = photos => (photos || []).filter(Boolean).length ? `
      <section class="detail__block reveal">
        <h2 class="detail__h">Фотографии</h2>
        <div class="gallery">${photos.filter(Boolean).map((src, i) =>
          `<button class="gallery__item" data-index="${i}" aria-label="Открыть фото ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>
      </section>` : '';

  const notFound = (root, text, back) => {
    root.innerHTML = `<div class="detail__empty"><p>${text}</p><a href="${back}" class="event__btn">Вернуться</a></div>`;
  };

  const renderShowPage = ({ shows }) => {
    const root = document.getElementById('detail');
    const id = new URLSearchParams(location.search).get('id');
    const show = (shows.shows || []).find(sh => slugify(sh.title) === id);
    const dates = upcoming(allDates(shows).filter(e => slugify(e.title) === id));
    if (!show && !dates.length) return notFound(root, 'Спектакль не найден', 'index.html#afisha');
    const sh = show || { title: dates[0].title };
    document.title = `${sh.title} — Театр новых возможностей`;
    const first = dates[0] || {};
    const meta = [sh.genre, sh.author, sh.age || first.age, sh.duration || first.duration].filter(Boolean);

    root.innerHTML = `
      <a href="index.html#afisha" class="detail__back reveal">← Афиша</a>
      <header class="detail__head${sh.poster ? ' has-poster' : ''}">
        <div class="detail__intro">
          ${first.category ? `<p class="detail__eyebrow reveal">${esc(first.category)}</p>` : ''}
          <h1 class="detail__title reveal">${esc(sh.title)}</h1>
          ${meta.length ? `<p class="detail__meta reveal">${meta.map(esc).join(' · ')}</p>` : ''}
          ${sh.description ? `<div class="detail__text reveal">${paragraphs(sh.description)}</div>` : ''}
        </div>
        ${sh.poster ? `<div class="detail__poster reveal"><img src="${esc(sh.poster)}" alt="Афиша спектакля «${esc(sh.title)}»"></div>` : ''}
      </header>

      ${dates.length ? `
      <section class="detail__block reveal">
        <h2 class="detail__h">Даты и билеты</h2>
        <ul class="dates">${dates.map(e => {
          const d = e.date ? parseDate(e.date) : null;
          const btn = ticketButton(e);
          return `<li class="dates__row">
              <span class="dates__day">${d ? `<b>${pad(d.getDate())}</b> ${MONTHS[d.getMonth()]}` : '<b>Скоро</b>'}</span>
              <span class="dates__info">${[e.category, d && formatTime(d), e.venue].filter(Boolean).map(esc).join(' · ')}</span>
              ${btn}
            </li>`;
        }).join('')}</ul>
      </section>` : ''}

      ${(sh.creators || []).length ? `
      <section class="detail__block reveal">
        <h2 class="detail__h">Создатели</h2>
        <dl class="creators">${sh.creators.map(c => `<div class="creators__row"><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`).join('')}</dl>
      </section>` : ''}

      ${(sh.cast || []).length ? `
      <section class="detail__block reveal">
        <h2 class="detail__h">В ролях</h2>
        ${sh.cast.some(a => a.photo) ? `<ul class="cast">${sh.cast.filter(a => a.photo).map(a => `<li class="cast__item">
            <div class="cast__photo"><img src="${esc(a.photo)}" alt="${esc(a.name)}" loading="lazy"></div>
            <p class="cast__name">${esc(a.name)}</p>
            ${a.role ? `<p class="cast__role">${esc(a.role)}</p>` : ''}
          </li>`).join('')}</ul>` : ''}
        ${sh.cast.some(a => !a.photo) ? `<dl class="creators cast-list">${sh.cast.filter(a => !a.photo).map(a =>
          `<div class="creators__row"><dt>${esc(a.role || '')}</dt><dd>${esc(a.name)}</dd></div>`).join('')}</dl>` : ''}
      </section>` : ''}

      ${renderGallery(sh.gallery)}`;
    initLightbox(sh.gallery);
  };

  const renderNewsPage = ({ news }) => {
    const root = document.getElementById('detail');
    const id = new URLSearchParams(location.search).get('id');
    const n = (news.items || []).find(item => newsUrl(item).endsWith(`=${id}`));
    if (!n) return notFound(root, 'Новость не найдена', 'index.html#news');
    document.title = `${n.title} — Театр новых возможностей`;
    const links = (n.links || []).filter(l => l && l.url);
    root.innerHTML = `
      <a href="index.html#news" class="detail__back reveal">← Новости</a>
      <header class="detail__head">
        <div class="detail__intro">
          <p class="detail__eyebrow reveal">${formatDate(parseDate(n.date))}</p>
          <h1 class="detail__title detail__title--news reveal">${esc(n.title)}</h1>
        </div>
      </header>
      ${n.image ? `<figure class="detail__cover reveal"><img src="${esc(n.image)}" alt=""></figure>` : ''}
      <div class="detail__text detail__text--article reveal">${paragraphs(n.text)}</div>
      ${links.length ? `
      <section class="detail__block reveal">
        <h2 class="detail__h">Пресса</h2>
        <ul class="news-item__links">${links.map(l =>
          `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>
      </section>` : ''}
      ${renderGallery(n.gallery)}`;
    initLightbox(n.gallery);
  };

  // Просмотр фотографий на весь экран: клик по фото, стрелки, Esc
  const initLightbox = photos => {
    const list = (photos || []).filter(Boolean);
    if (!list.length) return;
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.innerHTML = `<button class="lightbox__close" aria-label="Закрыть">×</button>
      <button class="lightbox__nav lightbox__nav--prev" aria-label="Предыдущее фото">←</button>
      <img class="lightbox__img" alt="">
      <button class="lightbox__nav lightbox__nav--next" aria-label="Следующее фото">→</button>`;
    document.body.appendChild(box);
    const img = box.querySelector('.lightbox__img');
    let current = 0;
    const show = i => { current = (i + list.length) % list.length; img.src = list[current]; };
    const open = i => { show(i); box.hidden = false; body.style.overflow = 'hidden'; };
    const close = () => { box.hidden = true; body.style.overflow = ''; };
    document.querySelectorAll('.gallery__item').forEach(btn => btn.addEventListener('click', () => open(+btn.dataset.index)));
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__nav--prev').addEventListener('click', () => show(current - 1));
    box.querySelector('.lightbox__nav--next').addEventListener('click', () => show(current + 1));
    box.addEventListener('click', e => { if (e.target === box) close(); });
    let touchX = null;
    box.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
    document.addEventListener('keydown', e => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    if (list.length < 2) box.querySelectorAll('.lightbox__nav').forEach(b => (b.hidden = true));
  };

  // Вся строка афиши и карточка новости ведут на подробную страницу
  const initCardLinks = () => {
    document.querySelectorAll('.event, .news-item').forEach(card => {
      const link = card.querySelector('.event__link, .news-item__link');
      if (!link) return;
      card.addEventListener('click', e => {
        if (e.target.closest('a') || window.getSelection().toString()) return;
        if (e.metaKey || e.ctrlKey) window.open(link.href, '_blank');
        else location.href = link.href;
      });
    });
  };

  const initAnimations = () => {
    initCardLinks();
    // Появление элементов при скролле (с каскадной задержкой внутри группы)
    document.querySelectorAll('.events, .cards, .stats, .contacts__grid, .about__text, .news__list, .cast, .gallery').forEach(group => {
      [...group.querySelectorAll('.reveal')].forEach((el, i) => el.style.setProperty('--d', `${i * 0.1}s`));
    });

    const counters = document.querySelectorAll('[data-count]');
    const countUp = el => {
      const target = +el.dataset.count;
      const start = performance.now();
      const dur = 1600;
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    // скрываем до появления только то, что ниже первого экрана
    document.documentElement.classList.add('js');
    document.querySelectorAll('.reveal').forEach(el => {
      if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add('pending');
      else el.querySelectorAll('[data-count]').forEach(c => (c.textContent = c.dataset.count));
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('pending');
        const counter = entry.target.querySelector('[data-count]');
        if (counter) countUp(counter);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal.pending').forEach(el => io.observe(el));
    if (reduced) counters.forEach(c => (c.textContent = c.dataset.count));

    // Кастомный курсор
    const cursor = document.querySelector('.cursor');
    if (window.matchMedia('(hover: hover)').matches && !reduced) {
      let x = 0, y = 0, cx = 0, cy = 0;
      window.addEventListener('mousemove', e => {
        x = e.clientX; y = e.clientY;
        cursor.classList.add('is-active');
      });
      document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
      const loop = () => {
        cx += (x - cx) * 0.18;
        cy += (y - cy) * 0.18;
        cursor.style.transform = `translate(${cx}px, ${cy}px)`;
        requestAnimationFrame(loop);
      };
      loop();
      document.querySelectorAll('a, button, .card, .event, .news-item').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
      });
    }
  };

  const render = { home: renderHome, show: renderShowPage, news: renderNewsPage }[page] || renderHome;
  loadContent()
    .then(render)
    .catch(err => console.error('Не удалось загрузить контент', err))
    .finally(initAnimations);
})();
