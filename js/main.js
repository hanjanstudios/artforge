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

  /* ---------- signup / upload modal (no backend — free account stored
     locally in this browser, so "create account" never loops back on
     itself and never asks for payment) ---------- */
  const STORAGE_KEY = 'artforge_account';
  const backdrop = document.getElementById('signupBackdrop');
  const modal = document.getElementById('signupModal');
  const closeBtn = document.getElementById('signupClose');
  const stepAccount = document.getElementById('stepAccount');
  const stepUpload = document.getElementById('stepUpload');
  const accountForm = document.getElementById('accountForm');
  const uploadWelcome = document.getElementById('uploadWelcome');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadPreview = document.getElementById('uploadPreview');
  const uploadPreviewImg = document.getElementById('uploadPreviewImg');
  const uploadSuccess = document.getElementById('uploadSuccess');
  const doneBtn = document.getElementById('signupDone');

  if (backdrop) {
    let lastFocused = null;

    const getAccount = () => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
      catch { return null; }
    };

    const showStep = (step) => {
      stepAccount.hidden = step !== 'account';
      stepUpload.hidden = step !== 'upload';
    };

    const resetUploadUI = () => {
      dropzone.hidden = false;
      uploadPreview.hidden = true;
      fileInput.value = '';
    };

    const openModal = () => {
      const account = getAccount();
      resetUploadUI();
      if (account) {
        uploadWelcome.textContent = `Signed in as ${account.name} — free account. Drop in a WIP to start your first critique.`;
        showStep('upload');
      } else {
        accountForm.reset();
        showStep('account');
      }
      lastFocused = document.activeElement;
      backdrop.hidden = false;
      document.body.classList.add('modal-open');
      requestAnimationFrame(() => backdrop.classList.add('is-open'));
      (account ? dropzone : accountForm.querySelector('input')).focus();
    };

    const closeModal = () => {
      backdrop.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      setTimeout(() => { backdrop.hidden = true; }, 250);
      if (lastFocused) lastFocused.focus();
    };

    ['heroUploadCta', 'createAccountCta'].forEach((id) => {
      const trigger = document.getElementById(id);
      if (!trigger) return;
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !backdrop.hidden) closeModal();
    });

    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(accountForm);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      if (!name || !email) return;
      const account = { name, email, createdAt: new Date().toISOString() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(account)); } catch { /* storage unavailable — continue anyway */ }
      uploadWelcome.textContent = `You're in, ${name.split(' ')[0]} — free account created. Drop in a WIP to start your first critique.`;
      showStep('upload');
      dropzone.focus();
    });

    const handleFile = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      uploadPreviewImg.src = url;
      uploadPreviewImg.alt = file.name;
      uploadSuccess.textContent = `"${file.name}" uploaded. A reviewer will start your first critique shortly.`;
      dropzone.hidden = true;
      uploadPreview.hidden = false;
      doneBtn.focus();
    };

    // Clicking the <label> already triggers its nested file input natively;
    // only keyboard activation needs a manual trigger.
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-drag'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-drag'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-drag');
      handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
    doneBtn.addEventListener('click', closeModal);
  }
})();
