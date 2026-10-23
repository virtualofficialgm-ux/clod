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

  // Появление элементов при скролле (с каскадной задержкой внутри группы)
  document.querySelectorAll('.events, .cards, .stats, .contacts__grid, .about__text').forEach(group => {
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
})();
