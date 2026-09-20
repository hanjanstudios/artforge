# Minimal Site Generator

Personal CLI tool that scaffolds a modern minimal static site — plain
HTML/CSS/JS, no build step, no dependencies.

## Usage

```bash
node generate.js <project-name> [options]
```

Options:

| Flag         | Default                          | Description                                      |
|--------------|-----------------------------------|---------------------------------------------------|
| `--title`    | project name                      | Page `<title>` and header logo text                |
| `--tagline`  | generic placeholder                | Hero subtitle                                      |
| `--theme`    | `mono`                             | One of: `mono`, `ember`, `indigo`, `dark`          |
| `--font`     | `Inter`                            | Any Google Font family name                        |
| `--sections` | `hero,work,about,contact`          | Comma-separated list, in order                     |
| `--out`      | `./<project-name>`                 | Output directory                                   |

## Examples

```bash
# Basic site with defaults
node generate.js my-portfolio

# Custom title, dark theme, only hero + contact
node generate.js landing --title "Launch Day" --theme dark --sections hero,contact

# Custom output location
node generate.js side-project --out ~/sites/side-project --theme indigo
```

Then preview it:

```bash
npx serve my-portfolio
```

## Adding a new theme

Add an entry to the `THEMES` object in `generate.js` with `accent`, `bg`,
and `ink` hex colors.

## Adding a new section

Add a key to `SECTION_BUILDERS` in `generate.js`: a function that takes
`cfg` and returns an HTML string. It becomes available via `--sections`
and gets an auto-generated nav link.
