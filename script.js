(() => {
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Прелоадер
  const finishLoading = () => {
    body.classList.add('is-loaded');
    setTimeout(() => body.classList.remove('is-loading'), 900);
  };
  window.addEventListener('load', () => setTimeout(finishLoading, reduced ? 0 : 900));
  setTimeout(finishLoading, 2500); // запасной вариант, если шрифты грузятся долго

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
    burger.setAttribute('aria-expanded', open);
    body.style.overflow = open ? 'hidden' : '';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    body.style.overflow = '';
  }));


  // ——— Контент сайта: берётся из content/*.json (редактируется в /admin) ———
  const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const parseDate = s => { const [d, t = '00:00'] = String(s).split('T'); const [y, m, day] = d.split('-').map(Number); const [hh, mm] = t.split(':').map(Number); return new Date(y, m - 1, day, hh || 0, mm || 0); };
  const pad = n => String(n).padStart(2, '0');
  const textOnly = !!window.__TEXT_CONTACTS__; // в превью ссылки mailto/tel не работают

  const loadContent = async () => {
    if (window.__CONTENT__) return window.__CONTENT__;
    const get = name => fetch(`content/${name}.json`, { cache: 'no-cache' }).then(r => r.json());
    const [settings, afisha, news] = await Promise.all([get('settings'), get('afisha'), get('news')]);
    return { settings, afisha, news };
  };

  const render = ({ settings: s, afisha, news }) => {
    document.querySelectorAll('[data-text]').forEach(el => (el.textContent = s[el.dataset.text] || ''));

    const words = (s.marquee || []).map(w => `<span>${esc(w)}</span><b>△</b>`).join('');
    document.getElementById('marquee').innerHTML = words + words;

    document.getElementById('about-text').innerHTML = (s.about_text || []).map(p => `<p class="reveal">${esc(p)}</p>`).join('');
    document.getElementById('stats').innerHTML = (s.stats || []).map(st => {
      const [first, ...rest] = esc(st.label).split(' ');
      return `<div class="stat reveal"><span class="stat__num" data-count="${+st.number || 0}">0</span><span class="stat__label">${first}<br>${rest.join(' ')}</span></div>`;
    }).join('');

    // Афиша: только будущие спектакли, по дате
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const events = (afisha.events || []).filter(e => parseDate(e.date) >= startOfToday).sort((a, b) => parseDate(a.date) - parseDate(b.date));
    document.getElementById('events').innerHTML = events.length ? events.map(e => {
      const d = parseDate(e.date);
      const meta = [e.category, e.age, e.duration, `${pad(d.getHours())}:${pad(d.getMinutes())}`].filter(Boolean).map(esc).join(' · ');
      const link = e.ticket_url ? `href="${esc(e.ticket_url)}" target="_blank" rel="noopener"` : 'href="#contacts"';
      return `<li class="event reveal">
          <div class="event__date"><span>${pad(d.getDate())}</span>${MONTHS[d.getMonth()]}</div>
          <div class="event__info">
            <h3 class="event__title">${esc(e.title)}</h3>
            <p class="event__meta">${meta}</p>
            ${e.description ? `<p class="event__desc">${esc(e.description)}</p>` : ''}
          </div>
          <a ${link} class="event__btn">Билеты</a>
        </li>`;
    }).join('') : '<li class="events__empty reveal">Скоро объявим новые спектакли</li>';

    const items = (news.items || []).slice().sort((a, b) => parseDate(b.date) - parseDate(a.date));
    document.getElementById('news-list').innerHTML = items.length ? items.map(n => {
      const d = parseDate(n.date);
      return `<article class="news-item reveal">
          ${n.image ? `<div class="news-item__img"><img src="${esc(n.image)}" alt="" loading="lazy"></div>` : ''}
          <time class="news-item__date">${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</time>
          <h3 class="news-item__title">${esc(n.title)}</h3>
          <p class="news-item__text">${esc(n.text)}</p>
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

  const initAnimations = () => {
    // Появление элементов при скролле (с каскадной задержкой внутри группы)
    document.querySelectorAll('.events, .cards, .stats, .contacts__grid, .about__text, .news__list').forEach(group => {
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
      document.querySelectorAll('a, button, .card').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
      });
    }
  };

  loadContent()
    .then(render)
    .catch(err => console.error('Не удалось загрузить контент', err))
    .finally(initAnimations);
})();
