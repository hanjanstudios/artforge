# MONO — Studio Site Template

A minimal, editorial-style agency/studio website, in the design lineage of sites
featured on [Siteinspire](https://www.siteinspire.com/): large serif display
type, generous whitespace, a single warm accent color, scroll-reveal
animations, and a hover-driven project grid. No build step, no framework —
just HTML, CSS, and vanilla JS, so it deploys anywhere as-is.

## Structure

```
index.html       Page markup (hero, work grid, about, services, CTA, footer)
css/style.css     Design system: tokens, layout, components, animations
js/main.js        Scroll reveals, header behavior, custom cursor, mobile nav
```

## Design system

- **Type**: `Fraunces` (display serif, headlines) + `Inter` (body/UI), loaded
  from Google Fonts.
- **Color**: warm off-white paper background (`--bg`), near-black ink
  (`--ink`), and a single rust/orange accent (`--accent`). All defined as CSS
  custom properties at the top of `css/style.css` — change them there to
  re-theme the whole site.
- **Motion**: `IntersectionObserver`-driven fade/slide-up reveals on scroll,
  a hide-on-scroll-down header, a marquee strip, and a difference-blend
  custom cursor on desktop (auto-disabled on touch devices).

## Customizing

1. Swap the placeholder copy, project names, and stats in `index.html`.
2. Replace the gradient placeholder tiles in `.work-media-fill` with real
   project imagery — add `<img>` tags inside `.work-media` and adjust
   `object-fit: cover`.
3. Update the accent color and type scale in the `:root` block of
   `css/style.css`.
4. Point the contact links (`mailto:`, `tel:`) and social links in the
   footer at your real details.

## Running locally

No build tooling is required — open `index.html` directly, or serve the
folder for correct relative paths and a local URL:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploying

The site is static, so it deploys as-is to Vercel, Netlify, GitHub Pages, or
any static host — no build command needed (output directory is the repo
root).
