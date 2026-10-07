# ArtForge — Landing Page

A landing page for ArtForge, a platform for getting structured critique on
work-in-progress art and actually finishing it. Static HTML/CSS/JS, no
build step, no external runtime dependencies — including the 3D hero.

## Structure

```
index.html          Landing page (hero, features, how-it-works, critique
                    mockup, testimonial, CTA, footer)
app.html            The studio app: sign up / log in, upload pieces,
                    version history, pinned critiques
css/style.css       Design system: tokens, layout, components, animations
css/app.css         Studio app styles
js/hero-scene.js    Interactive WebGL hero — a raymarched "forge orb"
js/main.js          Landing page: scroll reveals, header, mobile nav
js/app.js           Studio app logic (talks to Supabase)
js/config.js        Your Supabase project URL + public key
js/vendor/          supabase-js 2.117.3 (bundled, no CDN needed)
supabase/setup.sql  Database tables, security rules and image storage
```

## Setting up accounts, uploads and critiques (free)

The studio app stores accounts, artwork and critiques in
[Supabase](https://supabase.com) — the free plan includes logins, a
database and 1 GB of image storage. One-time setup, about 5 minutes:

1. **Create a project.** Sign up at supabase.com → *New project*. Pick any
   name and database password (save it somewhere), choose the region
   closest to you, and wait a minute for it to finish setting up.
2. **Create the tables.** In the left sidebar open *SQL Editor* → *New
   query*. Paste the entire contents of `supabase/setup.sql` and click
   *Run*. You should see "Success. No rows returned".
3. **Connect the site.** Go to *Project Settings → API* (or *Data API*).
   Copy the **Project URL** and the **publishable** key (older projects
   call it the **anon public** key) into
   `js/config.js`. Never use the `secret` / `service_role` key.
4. **Set the return address for emails.** *Authentication → URL
   Configuration*: set **Site URL** to
   `https://artforge.hannahjanicke.com/app.html` and add the same address
   under **Redirect URLs**. This is where confirmation and password-reset
   links send people.
5. **Email confirmation (choose one).** Supabase's built-in email sender
   only sends a few emails per hour, which isn't enough once people start
   signing up. Either:
   - turn off *Authentication → Sign In / Providers → Email → Confirm
     email* so people are logged in straight away, or
   - keep it on and connect a free email sender (e.g. Resend) under
     *Authentication → Emails → SMTP Settings*.

Notes:
- Free Supabase projects **pause after a week with no activity**. Log in
  to supabase.com and click *Restore* if the site stops loading pieces.
- Uploaded images are private: only signed-in ArtForge members can see
  them, through links that expire after an hour.
- Everyone who is signed in can see and critique every piece (that's the
  point of the site), but people can only edit or delete their own
  pieces, versions and critiques.

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
static host, no build command needed. The app's data lives in Supabase,
so nothing else needs a server.
