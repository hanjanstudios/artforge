/* ============================================================
   Hannah Janicke — Catalog
   Card data, fan-out layout, pointer tilt, and the pulled-card
   overlay. No build step, no external JS.

   NOTE: swap every url: '#' below for the real destination once
   you have it — everything else (copy, order, side) can also be
   edited here without touching the HTML/CSS.
   ============================================================ */

const BLOG = { name: 'Blog', url: 'https://hannahjanicke.com' };

const TOOLS = [
  {
    id: 'artforge',
    side: 'creative',
    eyebrow: 'Web App',
    name: 'ArtForge',
    tagline: 'Finish the art you keep abandoning.',
    desc: 'Pairs your work-in-progress art with structured critique from real artists, so a piece gets finished instead of shelved.',
    url: '#',
  },
  {
    id: 'artlab',
    side: 'creative',
    eyebrow: 'Playground',
    name: 'ArtLab',
    tagline: 'A sandbox for visual experiments.',
    desc: 'Where new ideas and techniques get tried out before they turn into something bigger.',
    url: '#',
  },
  {
    id: 'coloring-book-spacer',
    side: 'creative',
    eyebrow: 'Tool',
    name: 'Coloring Book Spacer',
    tagline: 'Line art in, print-ready PDF out.',
    desc: 'Auto-spaces and paginates line art into print-ready coloring book PDFs, built for artists who sell coloring books.',
    url: '#',
  },
  {
    id: 'realtor-ai',
    side: 'professional',
    eyebrow: 'AI Chatbot',
    name: 'Realtor AI',
    tagline: 'A chatbot that talks real estate.',
    desc: 'Answers buyer and seller questions and qualifies leads for real estate sites, around the clock.',
    url: '#',
  },
];

const TILTS = [-9, 5, -3, 8, -6, 3];

function buildCard(tool, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-haspopup', 'dialog');
  card.setAttribute('aria-label', `${tool.name} — open card`);
  card.dataset.id = tool.id;

  const tilt = TILTS[index % TILTS.length];
  card.style.setProperty('--tilt', `${tilt}deg`);
  card.style.setProperty('--lift', `${(index % 3) * -4}px`);
  card.style.setProperty('--sway-dur', `${5 + (index % 4)}s`);
  card.style.setProperty('--sway-delay', `${(index * 0.35).toFixed(2)}s`);

  card.innerHTML = `
    <p class="card-eyebrow">${tool.eyebrow}</p>
    <h3 class="card-name">${tool.name}</h3>
    <p class="card-tagline">${tool.tagline}</p>
  `;

  card.addEventListener('pointerenter', () => bringToFront(card));
  card.addEventListener('pointermove', (e) => onCardPointerMove(e, card));
  card.addEventListener('pointerleave', () => onCardPointerLeave(card));
  card.addEventListener('focus', () => bringToFront(card));
  card.addEventListener('blur', () => onCardPointerLeave(card));
  card.addEventListener('click', () => openCard(tool));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCard(tool);
    }
  });

  return card;
}

function bringToFront(card) {
  if (!card.dataset.baseZ) card.dataset.baseZ = card.style.zIndex || '0';
  card.style.zIndex = '99';
}

function onCardPointerMove(e, card) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = card.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width - 0.5;
  const py = (e.clientY - rect.top) / rect.height - 0.5;
  const rotY = px * 16;
  const rotX = -py * 12;
  card.style.transform =
    `translateY(-28px) scale(1.05) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

function onCardPointerLeave(card) {
  card.style.transform = '';
  if (card.dataset.baseZ) card.style.zIndex = card.dataset.baseZ;
}

function layoutCards(container, tools) {
  const n = tools.length;
  tools.forEach((tool, i) => {
    const card = buildCard(tool, i);
    const offset = (i - (n - 1) / 2) * 44;
    card.style.left = `calc(50% + ${offset}px)`;
    card.style.marginLeft = '-105px';
    card.style.zIndex = String(i + 1);
    container.appendChild(card);
  });
}

function renderLinks() {
  const row = document.getElementById('linkRow');
  const entries = [BLOG, ...TOOLS.map((t) => ({ name: t.name, url: t.url }))];
  entries.forEach((entry, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'link-sep';
      sep.textContent = '·';
      sep.setAttribute('aria-hidden', 'true');
      row.appendChild(sep);
    }
    const a = document.createElement('a');
    a.href = entry.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = entry.name;
    if (i === 0) a.classList.add('is-blog');
    row.appendChild(a);
  });
}

/* ---------- Pulled-card overlay ---------- */
const overlay = document.getElementById('overlay');
const overlayScrim = document.getElementById('overlayScrim');
const pulledClose = document.getElementById('pulledClose');
const pulledKicker = document.getElementById('pulledKicker');
const pulledTitle = document.getElementById('pulledTitle');
const pulledDesc = document.getElementById('pulledDesc');
const pulledVisit = document.getElementById('pulledVisit');

let lastFocused = null;

function openCard(tool) {
  lastFocused = document.activeElement;
  pulledKicker.textContent = tool.eyebrow;
  pulledTitle.textContent = tool.name;
  pulledDesc.textContent = tool.desc;
  pulledVisit.href = tool.url;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  pulledClose.focus();
}

function closeCard() {
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  if (lastFocused) lastFocused.focus();
}

overlayScrim.addEventListener('click', closeCard);
pulledClose.addEventListener('click', closeCard);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeCard();
});

/* ---------- Init ---------- */
layoutCards(
  document.getElementById('creativeCards'),
  TOOLS.filter((t) => t.side === 'creative')
);
layoutCards(
  document.getElementById('professionalCards'),
  TOOLS.filter((t) => t.side === 'professional')
);
renderLinks();
document.getElementById('year').textContent = new Date().getFullYear();
