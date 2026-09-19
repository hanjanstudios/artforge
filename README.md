# ArtForge — Landing Page

A landing page for ArtForge, a platform for getting structured critique on
work-in-progress art and actually finishing it. Static HTML/CSS/JS, no
build step, no external runtime dependencies — including the 3D hero.

## Structure

```
index.html         Page markup (hero, features, how-it-works, critique
                    mockup, testimonial, CTA, footer)
css/style.css       Design system: tokens, layout, components, animations
js/hero-scene.js    Interactive WebGL hero — a raymarched "forge orb"
js/main.js          Scroll reveals, header behavior, mobile nav
```

## The 3D hero

`js/hero-scene.js` renders a glowing, cracked "forge orb" behind the hero
copy — a single fullscreen-quad fragment shader doing signed-distance-field
raymarching, entirely in vanilla WebGL1. There's no Three.js, no asset
files, and no CDN request: this environment's sandbox blocks every JS CDN
(jsdelivr, unpkg, cdnjs) outright, so a library-based approach couldn't be
loaded or tested here, and it means the effect ships with zero extra
network requests wherever it's hosted.

Behavior:
- The object slowly auto-rotates and drifts toward the pointer (parallax).
- A light source follows the cursor across the surface.
- Click-drag free-rotates the object.
- Glowing "cracks" pulse across the surface using layered value noise.
- Rendering pauses when the canvas scrolls out of view or the tab is
  hidden, and respects `prefers-reduced-motion` (disables the idle
  auto-rotate/pulse).
- Internal render resolution is capped independently of CSS size (see
  `MAX_RENDER_DIM` in the file) since raymarching cost scales directly with
  pixel count — the canvas is allowed to stretch via CSS without that
  costing extra fragment-shader work.

If you'd rather have an actual Spline scene (e.g. matching
`https://app.spline.design/community/file/...`), export it from Spline as
a `.splinecode` file with their runtime (`@splinetool/runtime` /
`<spline-viewer>` web component) and swap it in for `#heroCanvas` — that
requires a Spline account and CDN access, neither of which this build
environment has, which is why it isn't wired in.

## Design system

- **Type**: `Fraunces` (display serif) + `Inter` (UI/body), from Google
  Fonts.
- **Color**: near-black charcoal background (`--bg`), warm cream text
  (`--ink`), ember orange accent (`--accent`/`--accent-hot`). Tokens live
  in the `:root` block of `css/style.css`.
- **Motion**: `IntersectionObserver`-driven fade/slide-up reveals, a
  hide-on-scroll-down header, and a marquee strip — all in `js/main.js`.

## Customizing

1. Swap the placeholder copy, stats, and testimonial in `index.html`.
2. Replace the mock critique canvas (`.critique-canvas-fill` + `.pin`
   buttons) with a real annotated artwork screenshot once you have one.
3. Retune the hero shader's palette in the fragment shader's `main()` —
   look for the `rock` / `rockHi` / `ember` / `emberHot` vec3s in
   `js/hero-scene.js`.
4. Point the CTA links and footer contact/social links at your real
   destinations.

## Running locally

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploying

Static site — deploys as-is to Vercel, Netlify, GitHub Pages, or any
static host, no build command needed.
