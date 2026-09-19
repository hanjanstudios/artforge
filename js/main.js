// MONO — interactions
(() => {
  'use strict';

  /* ---------- footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- header clock (studio timezone) ---------- */
  const timeEl = document.getElementById('headerTime');
  if (timeEl) {
    const fmt = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
      timeEl.textContent = `Portland — ${time}`;
    };
    fmt();
    setInterval(fmt, 30000);
  }

  /* ---------- header show/hide + scrolled state ---------- */
  const header = document.getElementById('siteHeader');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 40);
    if (y > lastY && y > 160) {
      header.classList.add('hide');
    } else {
      header.classList.remove('hide');
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile nav ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const navMobile = document.getElementById('navMobile');

  const closeMenu = () => {
    navMobile.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  menuToggle.addEventListener('click', () => {
    const open = navMobile.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const lineEls = document.querySelectorAll('.reveal-line');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  revealEls.forEach(el => io.observe(el));
  lineEls.forEach((el, i) => {
    el.style.transitionDelay = `${i * 90}ms`;
    io.observe(el);
  });

  /* ---------- custom cursor ---------- */
  const cursor = document.getElementById('cursor');
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (isFinePointer && cursor) {
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });

    const tick = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    tick();

    document.querySelectorAll('[data-hover]').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
  } else if (cursor) {
    cursor.style.display = 'none';
  }

  /* ---------- smooth in-page nav (accounts for fixed header) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
})();
