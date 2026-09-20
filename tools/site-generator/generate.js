#!/usr/bin/env node
// Personal tool: scaffolds a modern minimal static site (plain HTML/CSS/JS,
// no build step). Run with `node generate.js <name> [options]`.

const fs = require("fs");
const path = require("path");

const THEMES = {
  mono: { accent: "#111111", bg: "#ffffff", ink: "#111111" },
  ember: { accent: "#e85d3f", bg: "#ffffff", ink: "#141414" },
  indigo: { accent: "#4f46e5", bg: "#ffffff", ink: "#111111" },
  dark: { accent: "#7dd3fc", bg: "#0b0b0d", ink: "#f5f5f5" },
};

const SECTION_BUILDERS = {
  hero: (cfg) => `
    <section class="hero">
      <h1>${cfg.title}</h1>
      <p class="lede">${cfg.tagline}</p>
      <a href="#contact" class="btn">Get in touch</a>
    </section>`,
  work: (cfg) => `
    <section id="work" class="grid">
      <div class="card"><h3>Item one</h3><p>Short description.</p></div>
      <div class="card"><h3>Item two</h3><p>Short description.</p></div>
      <div class="card"><h3>Item three</h3><p>Short description.</p></div>
    </section>`,
  about: () => `
    <section id="about" class="prose">
      <h2>About</h2>
      <p>A couple of sentences about you or the project go here.</p>
    </section>`,
  contact: () => `
    <section id="contact" class="prose">
      <h2>Contact</h2>
      <p><a href="mailto:you@example.com">you@example.com</a></p>
    </section>`,
};

function parseArgs(argv) {
  const cfg = {
    name: "my-site",
    title: "My Site",
    tagline: "A clean, minimal starting point — swap this copy for yours.",
    theme: "mono",
    font: "Inter",
    sections: ["hero", "work", "about", "contact"],
    out: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [flag, inlineVal] = arg.slice(2).split("=");
      const val = inlineVal !== undefined ? inlineVal : argv[++i];
      if (flag === "sections") cfg.sections = val.split(",").map((s) => s.trim());
      else cfg[flag] = val;
    } else {
      positional.push(arg);
    }
  }
  if (positional[0]) cfg.name = positional[0];
  if (!cfg.title || cfg.title === "My Site") cfg.title = cfg.name;
  return cfg;
}

function render(cfg) {
  const theme = THEMES[cfg.theme] || THEMES.mono;
  const unknownSections = cfg.sections.filter((s) => !SECTION_BUILDERS[s]);
  if (unknownSections.length) {
    throw new Error(
      `Unknown section(s): ${unknownSections.join(", ")}. Available: ${Object.keys(SECTION_BUILDERS).join(", ")}`
    );
  }

  const nav = cfg.sections
    .filter((s) => s !== "hero")
    .map((s) => `<a href="#${s}">${s[0].toUpperCase() + s.slice(1)}</a>`)
    .join("");

  const body = cfg.sections.map((s) => SECTION_BUILDERS[s](cfg)).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${cfg.font}:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <a href="#top" class="logo">${cfg.title}</a>
    <nav>${nav}</nav>
  </header>

  <main id="top">
${body}
  </main>

  <footer><p>&copy; <span id="year"></span> ${cfg.title}</p></footer>
  <script src="js/main.js"></script>
</body>
</html>
`;

  const css = `:root {
  --bg: ${theme.bg};
  --ink: ${theme.ink};
  --muted: color-mix(in srgb, var(--ink) 55%, var(--bg));
  --border: color-mix(in srgb, var(--ink) 12%, var(--bg));
  --accent: ${theme.accent};
  --radius: 10px;
  --space: 1.5rem;
  --font: "${cfg.font}", system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); color: var(--ink); background: var(--bg); line-height: 1.5; }

.site-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space) 2rem; }
.site-header nav a { margin-left: 1.5rem; text-decoration: none; color: var(--ink); }
.logo { font-weight: 700; text-decoration: none; color: var(--ink); }

.hero { text-align: center; padding: 6rem 2rem; }
.hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; }
.hero .lede { color: var(--muted); margin: 1rem auto; max-width: 40ch; }

.btn { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem;
  background: var(--accent); color: var(--bg); border-radius: var(--radius); text-decoration: none; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space); padding: 2rem; max-width: 960px; margin: 0 auto; }
.card { border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }

.prose { max-width: 640px; margin: 0 auto; padding: 3rem 2rem; }
.prose h2 { margin-bottom: 1rem; }

footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.875rem; }
`;

  const js = `document.getElementById("year").textContent = new Date().getFullYear();\n`;

  return { html, css, js };
}

function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const { html, css, js } = render(cfg);

  const dir = cfg.out ? path.resolve(cfg.out) : path.join(process.cwd(), cfg.name);
  fs.mkdirSync(path.join(dir, "css"), { recursive: true });
  fs.mkdirSync(path.join(dir, "js"), { recursive: true });

  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "css", "style.css"), css);
  fs.writeFileSync(path.join(dir, "js", "main.js"), js);

  console.log(`Created "${cfg.name}" at ${dir}`);
  console.log(`Theme: ${cfg.theme}  Font: ${cfg.font}  Sections: ${cfg.sections.join(", ")}`);
  console.log(`Run it: npx serve "${dir}"`);
}

main();
