// ArtForge — interactive 3D hero
// Dependency-free WebGL raymarcher: a molten "forge orb" that rotates toward
// the pointer, with a light that follows the cursor and glowing cracks that
// pulse across its surface. No external libraries — a single fullscreen
// fragment shader.
(() => {
  'use strict';

  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false })
    || canvas.getContext('experimental-webgl');

  if (!gl) {
    canvas.closest('.hero-visual')?.classList.add('no-webgl');
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VERT = `
    attribute vec2 aPos;
    void main() {
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  uResolution;
    uniform float uTime;
    uniform vec2  uMouse;      // -1..1, smoothed
    uniform vec2  uDrag;       // accumulated drag rotation (radians)
    uniform float uHover;      // 0..1 pointer-inside fade

    // ---------- hash / noise ----------
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }

    // ---------- scene SDF ----------
    // domain-rotated coordinates so the noise field turns with the object
    vec3 gRotP;

    // single-octave noise here (not fbm) — this runs inside the raymarch
    // inner loop dozens of times per pixel, so it stays cheap; the full
    // multi-octave fbm is reserved for the one-time crack pass after a hit.
    float map(vec3 p) {
      vec3 q = p;
      q.xz *= rot(uTime * 0.12 + uDrag.x);
      q.yz *= rot(uDrag.y);
      gRotP = q;

      float base = length(q) - 1.0;
      float surface = noise(q * 2.1 + uTime * 0.05) * 0.09;
      float veins = noise(q * 4.5 - uTime * 0.03);
      return base + surface - veins * 0.015;
    }

    vec3 calcNormal(vec3 p) {
      vec2 e = vec2(0.0016, 0.0);
      return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
      ));
    }

    float ambientOcclusion(vec3 p, vec3 n) {
      float occ = 0.0;
      float sca = 1.0;
      for (int i = 0; i < 4; i++) {
        float h = 0.01 + 0.14 * float(i) / 3.0;
        float d = map(p + n * h);
        occ += (h - d) * sca;
        sca *= 0.7;
      }
      return clamp(1.0 - 1.4 * occ, 0.0, 1.0);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

      vec3 ro = vec3(0.0, 0.05, 3.3);
      vec3 rd = normalize(vec3(uv, -1.65));

      // gentle parallax toward pointer
      ro.xy += uMouse * 0.16;
      rd = normalize(rd + vec3(uMouse * 0.1, 0.0));

      float t = 0.0;
      float dist = -1.0;
      vec3 pos = ro;
      bool hit = false;

      for (int i = 0; i < 56; i++) {
        pos = ro + rd * t;
        dist = map(pos);
        if (dist < 0.0015) { hit = true; break; }
        if (t > 8.0) break;
        t += dist * 0.92;
      }

      vec3 col = vec3(0.0);
      float alpha = 0.0;

      if (hit) {
        vec3 n = calcNormal(pos);
        float ao = ambientOcclusion(pos, n);

        // light follows the pointer, orbiting slightly
        vec3 lightPos = vec3(uMouse * 2.6 + vec2(1.4, 1.6), 2.4);
        vec3 lightDir = normalize(lightPos - pos);
        float diff = clamp(dot(n, lightDir), 0.0, 1.0);

        vec3 viewDir = normalize(ro - pos);
        vec3 halfV = normalize(lightDir + viewDir);
        float spec = pow(clamp(dot(n, halfV), 0.0, 1.0), 42.0);

        float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 2.4);

        // glowing crack network from the domain-rotated noise field —
        // narrow, high-contrast veins rather than a broad crackle pattern
        float crack = fbm(gRotP * 5.5 - uTime * 0.025);
        float cracks = smoothstep(0.565, 0.6, crack) * (1.0 - smoothstep(0.6, 0.63, crack));
        float pulse = 0.6 + 0.4 * sin(uTime * 1.4 + crack * 10.0);

        vec3 rock   = vec3(0.028, 0.023, 0.022);
        vec3 rockHi = vec3(0.09, 0.065, 0.055);
        vec3 ember  = vec3(1.0, 0.32, 0.07);
        vec3 emberHot = vec3(1.0, 0.6, 0.2);

        vec3 base = mix(rock, rockHi, diff * ao * 0.7);
        base += ember * fresnel * 0.22;

        vec3 glow = mix(ember, emberHot, pulse) * cracks * 2.6;

        col = base + glow;
        col += spec * emberHot * 0.45;
        col *= ao;

        // soft rim brightening near silhouette
        col += fresnel * fresnel * vec3(1.0, 0.4, 0.15) * 0.2;

        alpha = 1.0;
      } else {
        // faint ember haze behind the object, fading with distance from center
        float haze = smoothstep(1.0, 0.0, length(uv)) * 0.10;
        col = vec3(1.0, 0.45, 0.15) * haze;
        alpha = haze;
      }

      alpha *= mix(0.85, 1.0, uHover);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uMouse = gl.getUniformLocation(program, 'uMouse');
  const uDrag = gl.getUniformLocation(program, 'uDrag');
  const uHover = gl.getUniformLocation(program, 'uHover');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // ---------- interaction state ----------
  let mouseTarget = [0, 0];
  let mouse = [0, 0];
  let hoverTarget = 0;
  let hover = 0;

  let dragging = false;
  let dragStart = [0, 0];
  let dragAt = [0, 0];
  let drag = [0, 0.2];

  function setPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    mouseTarget = [nx, -ny];
  }

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e.clientX, e.clientY);
    if (dragging) {
      drag = [dragAt[0] + (e.clientX - dragStart[0]) * 0.006, dragAt[1] - (e.clientY - dragStart[1]) * 0.006];
    }
  });
  canvas.addEventListener('pointerenter', () => { hoverTarget = 1; });
  canvas.addEventListener('pointerleave', () => { hoverTarget = 0; });
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStart = [e.clientX, e.clientY];
    dragAt = drag;
    canvas.setPointerCapture(e.pointerId);
  });
  ['pointerup', 'pointercancel'].forEach(evt =>
    canvas.addEventListener(evt, () => { dragging = false; })
  );

  // ---------- sizing ----------
  // The raymarcher's cost scales directly with pixel count, so the internal
  // render resolution is capped well below native — the CSS layer stretches
  // it back up, which a soft glowing blob hides easily.
  const MAX_RENDER_DIM = 1400;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let w = Math.max(1, Math.round(rect.width * dpr));
    let h = Math.max(1, Math.round(rect.height * dpr));
    const overscale = Math.max(w, h) / MAX_RENDER_DIM;
    if (overscale > 1) {
      w = Math.max(1, Math.round(w / overscale));
      h = Math.max(1, Math.round(h / overscale));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- pause when off-screen / hidden ----------
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });
  const io = new IntersectionObserver(
    (entries) => { entries.forEach(e => { running = e.isIntersecting && !document.hidden; }); },
    { threshold: 0.05 }
  );
  io.observe(canvas);

  // ---------- render loop ----------
  const start = performance.now();
  let last = start;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    mouse[0] += (mouseTarget[0] - mouse[0]) * 0.06;
    mouse[1] += (mouseTarget[1] - mouse[1]) * 0.06;
    hover += (hoverTarget - hover) * 0.08;

    resize();
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, prefersReducedMotion ? 0.0 : (now - start) / 1000);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.uniform2f(uDrag, drag[0], drag[1]);
    gl.uniform1f(uHover, hover);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  requestAnimationFrame(frame);
})();
