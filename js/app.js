// ArtForge — Studio app
// Accounts, uploads, version history and pinned critiques, backed by Supabase
// (auth + Postgres + storage). Tables and security rules: supabase/setup.sql.
(() => {
  'use strict';

  const cfg = window.ARTFORGE_CONFIG || {};
  const app = document.getElementById('app');
  const nav = document.getElementById('appNav');
  const headerRight = document.getElementById('appHeaderRight');
  const toastEl = document.getElementById('toast');

  const BUCKET = 'artwork';
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_DIM = 4000;
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const MEDIUMS = ['Illustration', 'Painting', 'Concept art', '3D', 'Comics', 'Animation', 'Sculpture', 'Photography', 'Other'];
  const CATEGORIES = ['composition', 'values', 'anatomy', 'color', 'intent', 'other'];

  let sb = null;
  let user = null;
  let renderId = 0;

  /* ---------- helpers ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  }

  function mount(...nodes) {
    app.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('is-error', !!isError);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, isError ? 6000 : 3500);
  }

  function setMsg(el, msg, isError) {
    el.textContent = msg || '';
    el.classList.toggle('is-error', !!isError);
  }

  function fmtDate(value) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00') : new Date(value);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

  function friendlyError(err) {
    const msg = (err && err.message) || String(err || 'Something went wrong');
    if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.';
    if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link we sent.';
    if (/already registered/i.test(msg)) return 'There’s already an account with that email. Try logging in instead.';
    if (/rate limit/i.test(msg)) return 'Too many attempts — please wait a few minutes and try again.';
    if (/Failed to fetch|NetworkError/i.test(msg)) return 'Couldn’t reach the server. Check your connection and try again.';
    return msg;
  }

  function busy(button, isBusy) {
    button.disabled = isBusy;
  }

  /* ---------- images ---------- */
  const urlCache = new Map();

  async function signedUrls(paths) {
    const now = Date.now();
    const missing = [...new Set(paths)].filter(p => p && !(urlCache.has(p) && urlCache.get(p).exp > now));
    if (missing.length) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(missing, 3600);
      if (error) throw error;
      data.forEach(d => { if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + 50 * 60 * 1000 }); });
    }
    const out = {};
    paths.forEach(p => { if (urlCache.has(p)) out[p] = urlCache.get(p).url; });
    return out;
  }

  // Big exports (e.g. layered-painting PNGs) are re-encoded so they fit the
  // 10 MB storage limit instead of failing the upload.
  async function prepareImage(file) {
    if (!file) throw new Error('Choose an image to upload.');
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Please upload a PNG, JPG, WebP or GIF image.');
    if (file.size <= MAX_BYTES) return file;
    if (file.type === 'image/gif') throw new Error('That GIF is over 10 MB — please upload a smaller one.');

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob || blob.size > MAX_BYTES) throw new Error('That image is too large — please export it under 10 MB.');
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  }

  async function uploadImage(file, pieceId, versionNumber) {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
    const path = `${user.id}/${pieceId}/v${versionNumber}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }

  function fileDrop(onChange) {
    const preview = h('div', { class: 'drop-preview' }, h('strong', { text: 'Click to choose an image' }), h('span', { text: 'or drag it here · PNG, JPG, WebP, GIF' }));
    const input = h('input', { type: 'file', accept: ALLOWED_TYPES.join(','), 'aria-label': 'Artwork image' });
    const drop = h('label', { class: 'drop' }, preview, input);
    let objectUrl;

    function show(file) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (!file) return;
      objectUrl = URL.createObjectURL(file);
      preview.replaceChildren(h('img', { src: objectUrl, alt: '' }), h('span', { text: file.name }));
      onChange(file);
    }
    input.addEventListener('change', () => show(input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('is-over');
      show(e.dataTransfer.files[0]);
    });
    return drop;
  }

  /* ---------- views: setup + auth ---------- */
  function viewSetup() {
    mount(
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow', text: '// Almost there' }), h('h1', { text: 'Connect ArtForge to Supabase' }))),
      h('div', { class: 'panel' },
        h('p', { text: 'The studio needs a free Supabase project to store accounts, artwork and critiques. One-time setup:' }),
        h('ol', { class: 'setup-steps' },
          h('li', null, 'Create a free project at supabase.com.'),
          h('li', null, 'In the SQL Editor, run everything in ', h('code', { text: 'supabase/setup.sql' }), '.'),
          h('li', null, 'Copy the Project URL and the anon public key from Project Settings → API into ', h('code', { text: 'js/config.js' }), '.')
        )
      )
    );
  }

  function viewAuth(mode, notice) {
    if (user) { location.hash = '#/studio'; return; }
    const isSignup = mode === 'signup';
    const msg = h('p', { class: 'form-msg', role: 'status' });
    if (notice) setMsg(msg, notice.text, notice.error);

    const nameInput = isSignup ? h('input', { class: 'input', id: 'authName', name: 'display_name', autocomplete: 'nickname', maxlength: '60', required: true }) : null;
    const emailInput = h('input', { class: 'input', id: 'authEmail', type: 'email', name: 'email', autocomplete: 'email', required: true });
    const passInput = h('input', { class: 'input', id: 'authPass', type: 'password', name: 'password', minlength: isSignup ? '8' : null, autocomplete: isSignup ? 'new-password' : 'current-password', required: true });
    const submit = h('button', { class: 'btn btn-solid btn-large', type: 'submit', text: isSignup ? 'Create my free account' : 'Log in' });

    const form = h('form', { class: 'form', novalidate: false },
      isSignup && h('div', { class: 'field' }, h('label', { for: 'authName', text: 'Artist name' }), nameInput, h('small', { text: 'Shown next to your pieces and critiques.' })),
      h('div', { class: 'field' }, h('label', { for: 'authEmail', text: 'Email' }), emailInput),
      h('div', { class: 'field' }, h('label', { for: 'authPass', text: 'Password' }), passInput, isSignup && h('small', { text: 'At least 8 characters.' })),
      submit,
      msg,
      !isSignup && h('button', { class: 'link-btn', type: 'button', text: 'Forgot your password?', onclick: forgot })
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      busy(submit, true);
      setMsg(msg, isSignup ? 'Creating your account…' : 'Logging in…');
      try {
        if (isSignup) {
          const { data, error } = await sb.auth.signUp({
            email: emailInput.value.trim(),
            password: passInput.value,
            options: { data: { display_name: nameInput.value.trim() }, emailRedirectTo: appUrl() }
          });
          if (error) throw error;
          if (data.session) {
            user = data.session.user;
            location.hash = '#/studio';
          } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            setMsg(msg, 'There’s already an account with that email. Try logging in instead.', true);
          } else {
            form.replaceChildren(h('p', null, h('strong', { text: 'Check your email.' }), ' We sent a confirmation link to ', emailInput.value.trim(), '. Click it and you’ll land back here, logged in.'));
          }
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email: emailInput.value.trim(), password: passInput.value });
          if (error) throw error;
          user = data.user;
          location.hash = '#/studio';
        }
      } catch (err) {
        setMsg(msg, friendlyError(err), true);
      } finally {
        busy(submit, false);
      }
    });

    async function forgot() {
      const email = emailInput.value.trim();
      if (!email) { setMsg(msg, 'Type your email above first, then click “Forgot your password?” again.', true); emailInput.focus(); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
      setMsg(msg, error ? friendlyError(error) : 'If that email has an account, a password reset link is on its way.', !!error);
    }

    mount(
      h('div', { class: 'auth-wrap' },
        h('div', { class: 'panel' },
          h('div', { class: 'auth-tabs' },
            h('a', { class: 'auth-tab' + (isSignup ? ' is-active' : ''), href: '#/signup', text: 'Sign up' }),
            h('a', { class: 'auth-tab' + (!isSignup ? ' is-active' : ''), href: '#/login', text: 'Log in' })
          ),
          form
        ),
        h('p', { class: 'cta-note', style: 'text-align:center;margin-top:16px', text: '100% free. No card required.' })
      )
    );
    (isSignup ? nameInput : emailInput).focus();
  }

  function viewResetPassword() {
    if (!user) { location.hash = '#/login'; return; }
    const pass = h('input', { class: 'input', id: 'newPass', type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
    const submit = h('button', { class: 'btn btn-solid btn-large', type: 'submit', text: 'Save new password' });
    const msg = h('p', { class: 'form-msg', role: 'status' });
    const form = h('form', { class: 'form' },
      h('div', { class: 'field' }, h('label', { for: 'newPass', text: 'New password' }), pass, h('small', { text: 'At least 8 characters.' })),
      submit, msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      busy(submit, true);
      const { error } = await sb.auth.updateUser({ password: pass.value });
      busy(submit, false);
      if (error) { setMsg(msg, friendlyError(error), true); return; }
      toast('Password updated.');
      location.hash = '#/studio';
    });
    mount(h('div', { class: 'auth-wrap' }, h('div', { class: 'panel' }, h('h1', { class: 'section-title', style: 'margin-bottom:20px', text: 'Choose a new password' }), form)));
    pass.focus();
  }

  /* ---------- views: lists ---------- */
  function latestVersion(piece) {
    return (piece.versions || []).reduce((a, b) => (!a || b.version_number > a.version_number ? b : a), null);
  }

  function critiqueCount(piece) {
    return (piece.versions || []).reduce((n, v) => n + ((v.critiques && v.critiques[0] && v.critiques[0].count) || 0), 0);
  }

  async function pieceCards(pieces, showOwner) {
    const paths = pieces.map(p => latestVersion(p)).filter(Boolean).map(v => v.image_path);
    const urls = paths.length ? await signedUrls(paths) : {};
    return h('div', { class: 'piece-grid' }, pieces.map(p => {
      const v = latestVersion(p);
      const crits = critiqueCount(p);
      return h('a', { class: 'piece-card', href: `#/piece/${p.id}` },
        h('div', { class: 'piece-thumb' }, v && urls[v.image_path] ? h('img', { src: urls[v.image_path], alt: p.title, loading: 'lazy' }) : null),
        h('div', { class: 'piece-card-body' },
          h('h3', { text: p.title }),
          h('div', { class: 'piece-meta' },
            showOwner && p.owner && h('span', { text: p.owner.display_name }),
            h('span', { text: v ? `v${v.version_number}` : 'no image' }),
            h('span', { text: plural(crits, 'critique') }),
            p.status === 'finished' ? h('span', { class: 'badge badge-done', text: 'Finished' }) : h('span', { text: p.medium || '' })
          )
        )
      );
    }));
  }

  const LIST_SELECT = 'id, title, medium, status, updated_at, owner:profiles!pieces_owner_id_fkey(display_name), versions(id, version_number, image_path, critiques(count))';

  async function viewStudio(id) {
    mount(h('p', { class: 'app-loading', text: 'Loading your studio…' }));
    const { data, error } = await sb.from('pieces').select(LIST_SELECT).eq('owner_id', user.id).order('updated_at', { ascending: false });
    if (id !== renderId) return;
    if (error) return viewError(error);

    const head = h('div', { class: 'page-head' },
      h('div', null, h('p', { class: 'eyebrow', text: '// Your studio' }), h('h1', { text: 'Your pieces' }),
        h('p', { class: 'page-sub', text: 'Everything you’ve uploaded, every version, and every critique — saved here.' })),
      h('a', { class: 'btn btn-solid', href: '#/new', text: '+ Upload a piece' }));

    if (!data.length) {
      return mount(head, h('div', { class: 'app-empty' },
        h('p', { text: 'No pieces yet. Upload the one you’re stuck on — sketch, half-painted, whatever stage it’s at.' }),
        h('a', { class: 'btn btn-solid', href: '#/new', text: 'Upload your first piece' })));
    }
    const active = data.filter(p => p.status !== 'finished');
    const done = data.filter(p => p.status === 'finished');
    const grids = await Promise.all([active.length ? pieceCards(active) : null, done.length ? pieceCards(done) : null]);
    if (id !== renderId) return;
    mount(head,
      grids[0] && h('section', null, h('h2', { class: 'eyebrow', text: `In progress · ${active.length}` }), grids[0]),
      grids[1] && h('section', { style: 'margin-top:48px' }, h('h2', { class: 'eyebrow', text: `Finished · ${done.length}` }), grids[1]));
  }

  async function viewExplore(id) {
    mount(h('p', { class: 'app-loading', text: 'Finding pieces that need critique…' }));
    const { data, error } = await sb.from('pieces').select(LIST_SELECT)
      .neq('owner_id', user.id).eq('status', 'in_progress')
      .order('updated_at', { ascending: false }).limit(60);
    if (id !== renderId) return;
    if (error) return viewError(error);

    const head = h('div', { class: 'page-head' },
      h('div', null, h('p', { class: 'eyebrow', text: '// Give critique' }), h('h1', { text: 'Pieces that need eyes' }),
        h('p', { class: 'page-sub', text: 'Open a piece, click on the spot you want to talk about, and leave a specific note.' })));
    if (!data.length) {
      return mount(head, h('div', { class: 'app-empty' }, h('p', { text: 'No one else has posted a piece yet. Share ArtForge with a friend and critique each other!' })));
    }
    const grid = await pieceCards(data, true);
    if (id !== renderId) return;
    mount(head, grid);
  }

  /* ---------- views: new piece ---------- */
  function viewNew() {
    let file = null;
    const msg = h('p', { class: 'form-msg', role: 'status' });
    const submit = h('button', { class: 'btn btn-solid btn-large', type: 'submit', text: 'Upload piece' });
    const title = h('input', { class: 'input', id: 'pTitle', maxlength: '120', required: true, placeholder: 'e.g. Portrait study #4' });
    const medium = h('select', { class: 'select', id: 'pMedium' }, MEDIUMS.map(m => h('option', { value: m, text: m })));
    const finishBy = h('input', { class: 'input', id: 'pFinish', type: 'date' });
    const wanted = h('textarea', { class: 'textarea', id: 'pWanted', maxlength: '1000', placeholder: 'What’s bugging you about it? e.g. “The face feels flat and I can’t tell why.”' });

    const form = h('form', { class: 'form' },
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Image' }), fileDrop(f => { file = f; })),
      h('div', { class: 'field' }, h('label', { for: 'pTitle', text: 'Title' }), title),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', { for: 'pMedium', text: 'Medium' }), medium),
        h('div', { class: 'field' }, h('label', { for: 'pFinish', text: 'Finish by (optional)' }), finishBy)),
      h('div', { class: 'field' }, h('label', { for: 'pWanted', text: 'What feedback do you want?' }), wanted),
      submit, msg);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      busy(submit, true);
      let piece = null;
      try {
        setMsg(msg, 'Preparing image…');
        const img = await prepareImage(file);
        setMsg(msg, 'Uploading…');
        const ins = await sb.from('pieces').insert({
          title: title.value.trim(),
          medium: medium.value,
          finish_by: finishBy.value || null,
          feedback_wanted: wanted.value.trim() || null
        }).select('id').single();
        if (ins.error) throw ins.error;
        piece = ins.data;
        const path = await uploadImage(img, piece.id, 1);
        const ver = await sb.from('versions').insert({ piece_id: piece.id, version_number: 1, image_path: path });
        if (ver.error) {
          await sb.storage.from(BUCKET).remove([path]);
          throw ver.error;
        }
        toast('Piece uploaded!');
        location.hash = `#/piece/${piece.id}`;
      } catch (err) {
        if (piece) await sb.from('pieces').delete().eq('id', piece.id);
        setMsg(msg, friendlyError(err), true);
        busy(submit, false);
      }
    });

    mount(
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow', text: '// New piece' }), h('h1', { text: 'Upload a work in progress' }))),
      h('div', { class: 'panel', style: 'max-width:720px' }, form)
    );
  }

  /* ---------- views: piece detail ---------- */
  async function viewPiece(id, pieceId, opts = {}) {
    if (!opts.keep) mount(h('p', { class: 'app-loading', text: 'Loading piece…' }));
    const { data: piece, error } = await sb.from('pieces')
      .select('*, owner:profiles!pieces_owner_id_fkey(display_name), versions(*, critiques(*, author:profiles!critiques_author_id_fkey(display_name)))')
      .eq('id', pieceId).maybeSingle();
    if (id !== renderId) return;
    if (error) return viewError(error);
    if (!piece) return mount(h('div', { class: 'app-empty' }, h('p', { text: 'That piece doesn’t exist anymore.' }), h('a', { class: 'btn btn-solid', href: '#/studio', text: 'Back to your studio' })));

    const versions = (piece.versions || []).sort((a, b) => a.version_number - b.version_number);
    versions.forEach(v => (v.critiques || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    const isOwner = piece.owner_id === user.id;
    const urls = versions.length ? await signedUrls(versions.map(v => v.image_path)) : {};
    if (id !== renderId) return;

    let current = versions.find(v => v.id === opts.versionId) || versions[versions.length - 1];
    let draftPin = null;

    const tabs = h('div', { class: 'version-tabs', role: 'tablist' });
    const stage = h('div', { class: 'stage' + (current ? ' is-pinnable' : '') });
    const stageNote = h('p', { class: 'version-note' });
    const critList = h('div', { class: 'critique-list' });
    const critHeading = h('h2');

    function renderVersion() {
      tabs.replaceChildren(...versions.map(v => h('button', {
        class: 'version-tab' + (v === current ? ' is-active' : ''), type: 'button', role: 'tab',
        'aria-selected': String(v === current), text: `v${v.version_number}`,
        onclick: () => { current = v; draftPin = null; renderVersion(); }
      })));
      if (!current) { stage.replaceChildren(); return; }

      const pinned = current.critiques.filter(c => c.pin_x != null && c.pin_y != null);
      const numberOf = new Map(pinned.map((c, i) => [c.id, i + 1]));
      const img = h('img', { src: urls[current.image_path] || '', alt: `${piece.title}, version ${current.version_number}`, draggable: 'false' });
      stage.replaceChildren(...[img,
        ...pinned.map(c => h('button', {
          class: 'pin-dot', type: 'button', style: `--x:${c.pin_x};--y:${c.pin_y}`, text: numberOf.get(c.id),
          'aria-label': `Critique ${numberOf.get(c.id)}`,
          onclick: (e) => { e.stopPropagation(); focusCritique(c.id); }
        })),
        draftPin && h('span', { class: 'pin-dot is-draft', style: `--x:${draftPin.x};--y:${draftPin.y}`, text: '+' })].filter(Boolean));
      stageNote.textContent = current.note || '';
      stageNote.hidden = !current.note;

      critHeading.textContent = `Critiques on v${current.version_number} · ${current.critiques.length}`;
      critList.replaceChildren(...(current.critiques.length ? current.critiques.map(c => {
        const n = numberOf.get(c.id);
        return h('div', { class: 'crit', 'data-crit': c.id },
          h('span', { class: 'crit-num' + (n ? '' : ' is-general'), text: n || '•' }),
          h('div', null,
            h('div', { class: 'crit-head' }, h('strong', { text: c.category }), h('span', { text: `${c.author ? c.author.display_name : 'Someone'} · ${fmtDate(c.created_at)}` })),
            h('p', { text: c.body }),
            c.author_id === user.id && h('button', { class: 'link-btn', type: 'button', text: 'Delete', onclick: () => deleteCritique(c) })
          ));
      }) : [h('p', { class: 'app-loading', text: isOwner ? 'No critiques on this version yet — they’ll show up here.' : 'No critiques yet. Be the first!' })]));
      if (critForm) critForm.update();
    }

    function focusCritique(cid) {
      app.querySelectorAll('.crit.is-focus').forEach(el => el.classList.remove('is-focus'));
      const el = app.querySelector(`[data-crit="${cid}"]`);
      if (el) { el.classList.add('is-focus'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }

    stage.addEventListener('click', (e) => {
      if (!current) return;
      const img = stage.querySelector('img');
      const r = img.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      draftPin = { x: +x.toFixed(4), y: +y.toFixed(4) };
      renderVersion();
      critForm.body.focus({ preventScroll: true });
    });

    async function deleteCritique(c) {
      if (!confirm('Delete this critique?')) return;
      const { error: err } = await sb.from('critiques').delete().eq('id', c.id);
      if (err) return toast(friendlyError(err), true);
      current.critiques = current.critiques.filter(x => x.id !== c.id);
      renderVersion();
    }

    /* critique form */
    const critForm = (() => {
      const category = h('select', { class: 'select', id: 'cCat' }, CATEGORIES.map(c => h('option', { value: c, text: c[0].toUpperCase() + c.slice(1) })));
      const body = h('textarea', { class: 'textarea', id: 'cBody', maxlength: '2000', required: true, placeholder: 'Be specific: what’s working, what isn’t, and one thing to try.' });
      const pinState = h('small');
      const submit = h('button', { class: 'btn btn-solid', type: 'submit', text: 'Post critique' });
      const msg = h('p', { class: 'form-msg', role: 'status' });
      const form = h('form', { class: 'form panel' },
        h('h2', { text: isOwner ? 'Add a note to yourself' : 'Leave a critique' }),
        h('div', { class: 'field' }, h('label', { for: 'cCat', text: 'Focus' }), category),
        h('div', { class: 'field' }, h('label', { for: 'cBody', text: 'Your note' }), body, pinState),
        submit, msg);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!current) return;
        busy(submit, true);
        const { data, error: err } = await sb.from('critiques').insert({
          version_id: current.id, category: category.value, body: body.value.trim(),
          pin_x: draftPin ? draftPin.x : null, pin_y: draftPin ? draftPin.y : null
        }).select('*, author:profiles!critiques_author_id_fkey(display_name)').single();
        busy(submit, false);
        if (err) return setMsg(msg, friendlyError(err), true);
        setMsg(msg, '');
        body.value = '';
        draftPin = null;
        current.critiques.push(data);
        renderVersion();
        focusCritique(data.id);
        toast('Critique posted.');
      });
      function update() {
        pinState.replaceChildren(draftPin
          ? h('span', null, 'Pinned to the spot you clicked. ', h('button', { class: 'link-btn', type: 'button', text: 'Remove pin', onclick: () => { draftPin = null; renderVersion(); } }))
          : 'Tip: click on the image to pin your note to a specific spot.');
      }
      return { form, body, update };
    })();

    /* owner tools */
    function ownerPanel() {
      let file = null;
      const note = h('textarea', { class: 'textarea', id: 'vNote', maxlength: '1000', placeholder: 'What did you change? e.g. “Pushed the shadow side darker, cropped 10%.”' });
      const submit = h('button', { class: 'btn btn-solid', type: 'submit', text: 'Upload new version' });
      const msg = h('p', { class: 'form-msg', role: 'status' });
      const form = h('form', { class: 'form panel' },
        h('h2', { text: 'Upload a revision' }),
        fileDrop(f => { file = f; }),
        h('div', { class: 'field' }, h('label', { for: 'vNote', text: 'What changed? (optional)' }), note),
        submit, msg);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        busy(submit, true);
        try {
          setMsg(msg, 'Uploading…');
          const img = await prepareImage(file);
          const next = versions.length ? versions[versions.length - 1].version_number + 1 : 1;
          const path = await uploadImage(img, piece.id, next);
          const { data, error: err } = await sb.from('versions')
            .insert({ piece_id: piece.id, version_number: next, image_path: path, note: note.value.trim() || null })
            .select('id').single();
          if (err) { await sb.storage.from(BUCKET).remove([path]); throw err; }
          toast(`Version ${next} uploaded.`);
          viewPiece(renderId, piece.id, { versionId: data.id });
        } catch (err) {
          setMsg(msg, friendlyError(err), true);
          busy(submit, false);
        }
      });

      const finished = piece.status === 'finished';
      const toggle = h('button', {
        class: 'btn ' + (finished ? 'btn-outline' : 'btn-solid'), type: 'button',
        text: finished ? 'Reopen piece' : 'Mark as finished',
        onclick: async () => {
          busy(toggle, true);
          const { error: err } = await sb.from('pieces').update({ status: finished ? 'in_progress' : 'finished' }).eq('id', piece.id);
          if (err) { busy(toggle, false); return toast(friendlyError(err), true); }
          toast(finished ? 'Piece reopened.' : 'Finished! It’s on your portfolio wall now.');
          viewPiece(renderId, piece.id, { versionId: current && current.id, keep: true });
        }
      });
      const del = h('button', {
        class: 'btn btn-outline btn-danger', type: 'button', text: 'Delete piece',
        onclick: async () => {
          if (!confirm(`Delete “${piece.title}” and all its versions and critiques? This can’t be undone.`)) return;
          busy(del, true);
          const paths = versions.map(v => v.image_path);
          const { error: err } = await sb.from('pieces').delete().eq('id', piece.id);
          if (err) { busy(del, false); return toast(friendlyError(err), true); }
          if (paths.length) await sb.storage.from(BUCKET).remove(paths);
          toast('Piece deleted.');
          location.hash = '#/studio';
        }
      });
      return [!finished && form, h('div', { class: 'owner-actions' }, toggle, del)];
    }

    const meta = h('div', { class: 'piece-meta' },
      h('span', { text: isOwner ? 'Your piece' : `by ${piece.owner ? piece.owner.display_name : 'an artist'}` }),
      piece.medium && h('span', { text: piece.medium }),
      h('span', { text: plural(versions.length, 'version') }),
      piece.finish_by && piece.status !== 'finished' && h('span', { text: `finish by ${fmtDate(piece.finish_by)}` }),
      piece.status === 'finished' && h('span', { class: 'badge badge-done', text: 'Finished' }));

    mount(
      h('div', { class: 'page-head' },
        h('div', null, h('p', { class: 'eyebrow' }, h('a', { href: isOwner ? '#/studio' : '#/explore', text: isOwner ? '← Your studio' : '← All pieces' })), h('h1', { text: piece.title }))),
      h('div', { class: 'piece-layout' },
        h('div', null, tabs, stage, stageNote,
          current && h('p', { class: 'stage-hint', text: 'Click anywhere on the image to pin a note there' })),
        h('div', { class: 'side' },
          h('div', { class: 'brief' }, meta,
            piece.feedback_wanted && h('p', null, h('strong', { text: 'Feedback wanted: ' }), piece.feedback_wanted)),
          critForm.form,
          h('div', null, critHeading, critList),
          isOwner && ownerPanel()
        ))
    );
    renderVersion();
  }

  function viewError(err) {
    mount(h('div', { class: 'app-empty' },
      h('p', { text: 'Something went wrong loading this page: ' + friendlyError(err) }),
      h('button', { class: 'btn btn-solid', type: 'button', text: 'Try again', onclick: route })));
  }

  /* ---------- routing ---------- */
  function appUrl() { return location.origin + location.pathname; }

  function updateChrome() {
    const page = location.hash.replace(/^#\/?/, '').split('/')[0];
    nav.hidden = headerRight.hidden = !user;
    nav.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === page));
  }

  let pendingNotice = null;

  function route() {
    const id = ++renderId;
    const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
    updateChrome();

    if (page === 'signup' || page === 'login') {
      const notice = pendingNotice;
      pendingNotice = null;
      return viewAuth(page, notice);
    }
    if (!user) { location.hash = '#/signup'; return; }
    switch (page) {
      case 'reset': return viewResetPassword();
      case 'explore': return viewExplore(id);
      case 'new': return viewNew();
      case 'piece': return arg ? viewPiece(id, arg) : (location.hash = '#/studio');
      case 'studio': return viewStudio(id);
      default: location.hash = '#/studio';
    }
  }

  async function start() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) return viewSetup();

    // Email links (confirm sign-up, reset password) come back with either
    // tokens or an error in the URL hash; supabase-js reads the tokens while
    // initialising, so read the hash before that and route afterwards.
    const rawHash = location.hash;
    const hashParams = new URLSearchParams(rawHash.replace(/^#/, ''));
    const fromEmail = hashParams.has('access_token') || hashParams.has('error_description');

    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    let recovering = hashParams.get('type') === 'recovery';
    sb.auth.onAuthStateChange((event, session) => {
      const wasIn = !!user;
      user = session ? session.user : null;
      if (event === 'PASSWORD_RECOVERY') { recovering = true; location.hash = '#/reset'; return; }
      if (event === 'SIGNED_OUT') { urlCache.clear(); location.hash = '#/login'; }
      else if (wasIn !== !!user) updateChrome();
    });

    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;

    window.addEventListener('hashchange', route);
    if (fromEmail) {
      if (hashParams.has('error_description')) {
        pendingNotice = { text: hashParams.get('error_description').replace(/\+/g, ' ') + ' — please try again.', error: true };
        location.hash = '#/login';
      } else {
        if (!recovering) toast('You’re signed in. Welcome to ArtForge!');
        location.hash = recovering ? '#/reset' : '#/studio';
      }
      return;
    }
    route();
  }

  document.getElementById('logoutBtn').addEventListener('click', () => sb.auth.signOut());
  start();
})();
