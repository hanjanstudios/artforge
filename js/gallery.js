// ArtForge — Forged Gallery: infinite scroll + content transition
// Vertical-loop technique adapted from Codrops' "Infinite Scroll Gallery
// with Page Transitions" (https://tympanus.net/codrops/?p=118084), reworked
// to sit inside a normal page (scroll-driven via ScrollTrigger + pin,
// instead of hijacking wheel/touch on the whole document).
(() => {
  'use strict';

  const section = document.getElementById('gallery');
  if (!section || typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger, Flip, SplitText);

  const viewport = section.querySelector('.forge-gallery-viewport');
  const track = section.querySelector('.forge-track');
  const slides = gsap.utils.toArray('.forge-slide', track);
  if (!slides.length) return;

  const detail = document.getElementById('forgeDetail');
  const previewMedia = detail.querySelector('.forge-detail-media');
  const groups = gsap.utils.toArray('.forge-detail-group', detail);
  const backBtn = detail.querySelector('.forge-detail-back');

  /* ---------- vertical loop ---------- */
  function verticalLoop(items, config) {
    items = gsap.utils.toArray(items);
    config = config || {};

    const tl = gsap.timeline({
      repeat: config.repeat,
      paused: config.paused,
      defaults: { ease: 'none' },
      onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100),
    });

    const length = items.length;
    const startY = 0;
    const heights = [];
    const yPercents = [];
    const pixelsPerSecond = (config.speed || 1) * 100;
    const snap = config.snap === false ? (v) => v : gsap.utils.snap(config.snap || 1);

    gsap.set(items, {
      yPercent: (i, el) => {
        const h = (heights[i] = parseFloat(gsap.getProperty(el, 'height', 'px')));
        yPercents[i] = snap(
          (parseFloat(gsap.getProperty(el, 'y', 'px')) / h) * 100 + gsap.getProperty(el, 'yPercent'),
        );
        return yPercents[i];
      },
    });
    gsap.set(items, { y: 0 });

    const totalHeight =
      items[length - 1].offsetTop +
      (yPercents[length - 1] / 100) * heights[length - 1] -
      startY +
      items[length - 1].offsetHeight * gsap.getProperty(items[length - 1], 'scaleY') +
      (parseFloat(config.paddingBottom) || 0);

    for (let i = 0; i < length; i++) {
      const item = items[i];
      const curY = (yPercents[i] / 100) * heights[i];
      const distanceToStart = item.offsetTop + curY - startY;
      const distanceToLoop = distanceToStart + heights[i] * gsap.getProperty(item, 'scaleY');

      tl.to(
        item,
        {
          yPercent: snap(((curY - distanceToLoop) / heights[i]) * 100),
          duration: distanceToLoop / pixelsPerSecond,
        },
        0,
      ).fromTo(
        item,
        { yPercent: snap(((curY - distanceToLoop + totalHeight) / heights[i]) * 100) },
        {
          yPercent: yPercents[i],
          duration: (totalHeight - distanceToLoop) / pixelsPerSecond,
          immediateRender: false,
        },
        distanceToLoop / pixelsPerSecond,
      );
    }

    tl.progress(1, true).progress(0, true);
    return tl;
  }

  /* ---------- reveal slides in/out relative to the viewport box ---------- */
  const revealItems = new Map();
  slides.forEach((slide) => {
    const media = slide.querySelector('.forge-slide-media');
    const caption = slide.querySelector('figcaption');
    gsap.set([media, caption], { autoAlpha: 0 });
    revealItems.set(slide, { media, caption, visible: false });
  });

  function updateReveal() {
    const box = viewport.getBoundingClientRect();
    const entered = [];

    revealItems.forEach((item, slide) => {
      const rect = slide.getBoundingClientRect();
      const visible = rect.bottom > box.top + 20 && rect.top < box.bottom - 20;
      if (visible === item.visible) return;
      item.visible = visible;

      if (visible) {
        entered.push({ item, top: rect.top });
      } else {
        gsap.to([item.media, item.caption], { autoAlpha: 0, duration: 0.4, overwrite: true });
      }
    });

    entered
      .sort((a, b) => a.top - b.top)
      .forEach(({ item }, i) => {
        gsap.to(item.media, { autoAlpha: 1, duration: 0.9, delay: i * 0.08, ease: 'power2.out', overwrite: true });
        gsap.to(item.caption, {
          autoAlpha: 1,
          duration: 0.6,
          delay: i * 0.08 + 0.12,
          ease: 'power2.out',
          overwrite: true,
        });
      });
  }

  /* ---------- build the loop, scrub it from page scroll while the section is pinned ---------- */
  let loop, wrap, scrollTl;

  function build() {
    const gap = parseFloat(getComputedStyle(track).rowGap) || 0;
    loop = verticalLoop(slides, { repeat: -1, paused: true, paddingBottom: gap });
    wrap = gsap.utils.wrap(0, loop.duration());

    const proxy = { time: 0 };

    scrollTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * 2.4),
        scrub: 0.8,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    }).to(proxy, {
      time: loop.duration() * 1.6,
      ease: 'none',
      onUpdate: () => {
        loop.time(wrap(proxy.time));
        updateReveal();
      },
    });

    updateReveal();
  }

  build();

  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => {
      scrollTl.scrollTrigger.kill();
      scrollTl.kill();
      loop.kill();
      gsap.set(slides, { clearProps: 'transform' });
      build();
      ScrollTrigger.refresh();
    }, 200);
  });

  /* ---------- content transition (click a slide -> its finish story) ---------- */
  let split = null;
  let activeSlide = null;
  let state = 'closed'; // closed | opening | open | closing
  let tl = null;

  function otherVisuals(slide) {
    return slides
      .filter((s) => s !== slide)
      .flatMap((s) => [s.querySelector('.forge-slide-media'), s.querySelector('figcaption')]);
  }

  function openDetail(slide, index) {
    if (state !== 'closed') return;
    state = 'opening';
    activeSlide = slide;

    groups.forEach((g) => g.classList.toggle('active', Number(g.dataset.index) === index));

    const media = slide.querySelector('.forge-slide-media');
    const caption = slide.querySelector('figcaption');
    const activeGroup = groups.find((g) => g.classList.contains('active'));

    previewMedia.style.setProperty('--hue', getComputedStyle(media).getPropertyValue('--hue'));

    const flipState = Flip.getState(media);
    detail.style.display = 'block';
    gsap.set(media, { autoAlpha: 0 });

    split = new SplitText([backBtn, ...activeGroup.querySelectorAll('.forge-detail-medium, .forge-detail-title, .forge-detail-desc')], {
      type: 'lines,chars',
      charsClass: 'char',
    });

    tl = gsap
      .timeline({
        onComplete: () => (state = 'open'),
        onReverseComplete: () => resetDetail(),
      })
      .to(otherVisuals(slide), { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 0)
      .to(caption, { autoAlpha: 0, duration: 0.3, ease: 'power2.out' }, 0)
      .add(
        Flip.from(flipState, {
          targets: previewMedia,
          duration: 1.1,
          ease: 'power4.inOut',
          absolute: true,
        }),
        0,
      );

    split.lines.forEach((line, i) => {
      tl.fromTo(
        line.querySelectorAll('.char'),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.012 },
        0.6 + i * 0.05,
      );
    });
  }

  function closeDetail() {
    if (state === 'opening') {
      state = 'closing';
      if (!tl) {
        resetDetail();
        return;
      }
      tl.reverse();
      return;
    }
    if (state !== 'open') return;
    state = 'closing';

    const media = activeSlide.querySelector('.forge-slide-media');
    const caption = activeSlide.querySelector('figcaption');

    tl = gsap
      .timeline({ onComplete: () => resetDetail() })
      .to(split.lines, { autoAlpha: 0, duration: 0.35, stagger: 0.03, ease: 'power1.out' }, 0)
      .add(Flip.fit(previewMedia, media, { duration: 0.9, ease: 'power3.inOut', absolute: true }), 0)
      .set(media, { autoAlpha: 1 }, 0.5)
      .to(otherVisuals(activeSlide), { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.5)
      .to(caption, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 0.6);
  }

  function resetDetail() {
    split?.revert();
    split = null;
    detail.style.display = 'none';
    previewMedia.style.removeProperty('--hue');
    activeSlide = null;
    tl = null;
    state = 'closed';
  }

  slides.forEach((slide, index) => {
    slide.addEventListener('click', () => openDetail(slide, index));
    slide.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(slide, index);
      }
    });
  });

  backBtn.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });
})();
