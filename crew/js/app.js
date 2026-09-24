// CrewCall — directory, filters, job board, and forms
(() => {
  'use strict';

  const data = window.CREW_DATA;
  const $ = (sel) => document.querySelector(sel);

  /* ---------- local persistence (user-added crew & jobs) ---------- */
  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const crew = [...store.get('crewcall.crew'), ...data.crew];
  const jobs = [...store.get('crewcall.jobs'), ...data.jobs];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const initials = (name) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const fillSelect = (el, items) => items.forEach((v) => el.add(new Option(v, v)));

  /* ---------- controls ---------- */
  const f = {
    query: $('#fQuery'), role: $('#fRole'), platform: $('#fPlatform'), work: $('#fWork'),
    rate: $('#fRate'), rateOut: $('#fRateOut'), avail: $('#fAvail'), sort: $('#fSort'),
  };

  fillSelect(f.role, data.roles);
  fillSelect(f.platform, data.platforms);
  document.querySelectorAll('select[name="role"]').forEach((s) => fillSelect(s, data.roles));

  const chips = $('#roleChips');
  data.roles.forEach((role) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = role;
    b.addEventListener('click', () => {
      f.role.value = f.role.value === role ? '' : role;
      render();
      $('#browse').scrollIntoView({ behavior: 'smooth' });
    });
    chips.appendChild(b);
  });

  /* ---------- directory ---------- */
  const STOPWORDS = new Set(['a', 'an', 'the', 'in', 'for', 'and', 'or', 'of', 'to', 'who', 'with', 'near', 'at']);

  const matches = (c) => {
    const words = f.query.value.toLowerCase().split(/[\s,]+/).filter((w) => w && !STOPWORDS.has(w));
    if (words.length) {
      const hay = [c.name, c.role, c.location, c.bio, ...c.skills, ...c.platforms, ...c.credits,
        c.remote ? 'remote' : '', c.onsite ? 'on-site onsite on location in-person' : '']
        .join(' ').toLowerCase();
      if (!words.every((word) => hay.includes(word))) return false;
    }
    if (f.role.value && c.role !== f.role.value) return false;
    if (f.platform.value && !c.platforms.includes(f.platform.value)) return false;
    if (f.work.value === 'remote' && !c.remote) return false;
    if (f.work.value === 'onsite' && !c.onsite) return false;
    if (c.rate > Number(f.rate.value)) return false;
    if (f.avail.checked && !c.available) return false;
    return true;
  };

  const sorters = {
    rating: (a, b) => b.rating - a.rating || b.projects - a.projects,
    rateAsc: (a, b) => a.rate - b.rate,
    rateDesc: (a, b) => b.rate - a.rate,
    projects: (a, b) => b.projects - a.projects,
  };

  const card = (c) => `
    <article class="card" tabindex="0" data-id="${c.id}">
      <div class="card-top">
        <span class="avatar" aria-hidden="true">${esc(initials(c.name))}</span>
        <div>
          <h3 class="card-name">${esc(c.name)}</h3>
          <p class="card-role">${esc(c.role)}</p>
        </div>
        <span class="status ${c.available ? 'on' : ''}">${c.available ? 'Available' : 'Booked'}</span>
      </div>
      <p class="card-meta">${esc(c.location)} · ${c.remote ? 'Remote' : ''}${c.remote && c.onsite ? ' + ' : ''}${c.onsite ? 'On location' : ''}</p>
      <ul class="tags">${c.skills.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <div class="card-foot">
        <span><strong>$${c.rate}</strong>/day</span>
        <span>${c.rating ? `★ ${c.rating.toFixed(1)} · ${c.projects} projects` : 'New'}</span>
      </div>
    </article>`;

  const render = () => {
    f.rateOut.textContent = Number(f.rate.value) >= 1500 ? 'any' : `$${f.rate.value}`;
    chips.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b.textContent === f.role.value));

    const list = crew.filter(matches).sort(sorters[f.sort.value]);
    $('#cards').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = `${list.length} of ${crew.length}`;
  };

  Object.values(f).forEach((el) => el.addEventListener && el.addEventListener('input', render));

  $('#resetFilters').addEventListener('click', () => {
    f.query.value = ''; f.role.value = ''; f.platform.value = ''; f.work.value = '';
    f.rate.value = f.rate.max; f.avail.checked = false; f.sort.value = 'rating';
    render();
  });

  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    f.query.value = $('#heroQuery').value;
    render();
    $('#browse').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- profile modal ---------- */
  const openProfile = (id) => {
    const c = crew.find((x) => String(x.id) === String(id));
    if (!c) return;
    $('#profileBody').innerHTML = `
      <div class="profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${esc(initials(c.name))}</span>
        <div>
          <h2 class="modal-title">${esc(c.name)}</h2>
          <p class="card-role">${esc(c.role)} · ${esc(c.location)}</p>
        </div>
      </div>
      <p>${esc(c.bio) || '<span class="muted">No bio yet.</span>'}</p>
      <dl class="profile-facts">
        <div><dt>Day rate</dt><dd>$${c.rate}</dd></div>
        <div><dt>Rating</dt><dd>${c.rating ? `★ ${c.rating.toFixed(1)}` : 'New'}</dd></div>
        <div><dt>Projects</dt><dd>${c.projects}</dd></div>
        <div><dt>Status</dt><dd>${c.available ? 'Available' : 'Booked'}</dd></div>
      </dl>
      <h4>Skills</h4>
      <ul class="tags">${c.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <h4>Platforms</h4>
      <ul class="tags">${c.platforms.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      ${c.credits.length ? `<h4>Worked with</h4><p>${c.credits.map(esc).join(', ')}</p>` : ''}
      <form class="form contact-form" data-name="${esc(c.name)}">
        <label>Message ${esc(c.name.split(' ')[0])}
          <textarea name="msg" rows="3" required placeholder="Hi! I run @mychannel and I'm looking for…"></textarea>
        </label>
        <button class="btn btn-solid" type="submit">Send message</button>
      </form>`;
    $('#profileModal').showModal();
  };

  $('#cards').addEventListener('click', (e) => {
    const el = e.target.closest('.card');
    if (el) openProfile(el.dataset.id);
  });
  $('#cards').addEventListener('keydown', (e) => {
    const el = e.target.closest('.card');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProfile(el.dataset.id); }
  });
  $('#profileBody').addEventListener('submit', (e) => {
    e.preventDefault();
    $('#profileModal').close();
    toast(`Message sent to ${e.target.dataset.name}.`);
  });

  /* ---------- modals ---------- */
  document.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', () => document.getElementById(b.dataset.open).showModal()));
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });

  /* ---------- job board ---------- */
  const renderJobs = () => {
    $('#jobList').innerHTML = jobs.map((j) => `
      <li class="job">
        <div>
          <h3 class="job-title">${esc(j.title)}</h3>
          <p class="card-meta">${esc(j.creator)} · ${esc(j.location || 'Remote')} · ${esc(j.posted)}</p>
        </div>
        <span class="job-role">${esc(j.role)}</span>
        <span class="job-budget">${esc(j.budget)}</span>
        <button class="btn btn-outline btn-small" type="button" data-apply="${esc(j.title)}">Apply</button>
      </li>`).join('');
  };

  $('#jobList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-apply]');
    if (b) { b.disabled = true; b.textContent = 'Applied'; toast(`Applied to "${b.dataset.apply}".`); }
  });

  $('#jobForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const job = { ...Object.fromEntries(new FormData(e.target)), posted: 'just now' };
    jobs.unshift(job);
    store.set('crewcall.jobs', [job, ...store.get('crewcall.jobs')]);
    renderJobs();
    e.target.reset();
    $('#jobModal').close();
    toast('Job posted.');
    $('#jobs').scrollIntoView({ behavior: 'smooth' });
  });

  $('#joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const member = {
      id: `u${Date.now()}`,
      name: fd.get('name'),
      role: fd.get('role'),
      location: fd.get('location'),
      remote: fd.get('remote') === 'on',
      onsite: true,
      rate: Number(fd.get('rate')),
      rating: 0,
      projects: 0,
      available: true,
      platforms: [],
      skills: split(fd.get('skills')),
      credits: split(fd.get('credits')),
      bio: fd.get('bio'),
    };
    crew.unshift(member);
    store.set('crewcall.crew', [member, ...store.get('crewcall.crew')]);
    e.target.reset();
    $('#joinModal').close();
    updateStats();
    render();
    toast('Your profile is live.');
    $('#browse').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- misc ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function updateStats() {
    $('#statRoles').textContent = data.roles.length;
    $('#statCrew').textContent = crew.length;
    $('#statAvail').textContent = crew.filter((c) => c.available).length;
  }

  $('#year').textContent = new Date().getFullYear();
  updateStats();
  render();
  renderJobs();
})();
