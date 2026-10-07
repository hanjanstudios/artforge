// ArtForge — interactions
(() => {
  'use strict';

  /* ---------- footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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

  /* ---------- sign-up form ---------- */
  // Posts to FormSubmit's AJAX endpoint so the visitor stays on the page.
  const signupForm = document.getElementById('signupForm');
  const signupStatus = document.getElementById('signupStatus');

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = signupForm.querySelector('button[type="submit"]');
      button.disabled = true;
      signupStatus.classList.remove('is-error');
      signupStatus.textContent = 'Signing you up…';

      try {
        const res = await fetch(signupForm.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(signupForm)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || String(data.success) === 'false') throw new Error(data.message || 'Request failed');
        signupForm.reset();
        signupForm.hidden = true;
        signupStatus.textContent = "You're in! We'll email you as soon as your account is ready.";
      } catch (err) {
        signupStatus.classList.add('is-error');
        signupStatus.textContent = 'Something went wrong. Please try again in a moment.';
        button.disabled = false;
      }
    });
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
