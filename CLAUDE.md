# CLAUDE.md

This file guides Claude Code when working in this repository.

## Project overview

A simple personal blog that reads Markdown files and renders them as a website.
Built with **plain HTML, CSS, and JavaScript only** — no frameworks, no build step, no npm dependencies.

Goals, in priority order:
1. **Readability** — clean typography, comfortable line length, generous spacing.
2. **Mobile-friendly** — mobile-first layout that reads well on small screens.
3. **Dark mode** — follows the OS setting by default, with a manual toggle that is remembered.
4. **Simplicity** — small, readable code that is easy to change by hand.

## Tech constraints

- Vanilla HTML5, CSS3, and ES2020+ JavaScript (ES modules via `<script type="module">`).
- **No frameworks or libraries** (no React/Vue/Tailwind/Bootstrap/jQuery, no `marked`/`markdown-it`). The Markdown parser is written by hand in `js/markdown.js`.
- No build tools, bundlers, or transpilers. Files are served exactly as written.
- No external fonts or CDNs; use a system font stack.
- Must work as a static site (e.g. GitHub Pages, Netlify, any static host).

## Directory structure

```
my-blog/
├── CLAUDE.md
├── index.html          # Single entry page (post list + post view)
├── css/
│   └── style.css       # All styles: theme tokens, layout, typography
├── js/
│   ├── app.js          # Routing, loading posts, rendering pages
│   ├── markdown.js     # Hand-written Markdown → HTML converter
│   └── theme.js        # Dark/light mode toggle
├── images/             # Images used in posts (reference as images/<file>)
└── posts/
    ├── index.json      # Post manifest (list of posts + metadata)
    └── *.md            # Blog posts in Markdown
```

## How it works

1. `index.html` loads `js/app.js`.
2. `app.js` fetches `posts/index.json` and shows the post list (newest first).
3. Routing uses the URL hash: `#/` = post list, `#/post/<slug>` = a single post.
4. Opening a post fetches `posts/<slug>.md`, strips the front matter, converts it with `markdown.js`, and inserts the HTML into the page.
5. The page `<title>` is updated to the post title.

### Post manifest (`posts/index.json`)

```json
[
  {
    "slug": "hello-world",
    "title": "Hello World",
    "date": "2026-11-13",
    "summary": "First post on the blog.",
    "tags": ["intro"]
  }
]
```

`slug` must match the file name (`posts/hello-world.md`). When adding a new post, **always add its entry to `index.json`**.

### Post file format

Each post may start with simple front matter (key: value lines), which is removed before rendering:

```markdown
---
title: Hello World
date: 2026-11-13
---

# Hello World

Post body in Markdown...
```

The post page shows the title and date from front matter (or `index.json`) in its header. A leading `# Title` that matches the title is dropped so it doesn't appear twice. Image paths are relative to the site root (e.g. `images/photo.jpg`), not to the `posts/` folder. Raw HTML in Markdown is escaped and shown as text.

## Markdown support (`js/markdown.js`)

Export a single function: `export function parseMarkdown(text) → string (HTML)`.

Supported syntax:
- Headings `#` to `######` (add `id` attributes for anchor links)
- Paragraphs and line breaks
- **Bold**, *italic*, ~~strikethrough~~, `inline code`
- Links `[text](url)` and images `![alt](src)` (images get `loading="lazy"`)
- Unordered (`-`, `*`) and ordered (`1.`) lists, including nested lists
- Blockquotes `>`
- Fenced code blocks ```` ``` ```` with optional language (`<pre><code class="language-xxx">`)
- Horizontal rules `---`
- Tables (GFM pipe tables)

Rules:
- **Escape HTML** in text and code (`&`, `<`, `>`, `"`) to prevent XSS. Code block content must never be parsed as Markdown.
- Only allow `http:`, `https:`, `mailto:`, and relative URLs in links/images (block `javascript:`).
- Keep the parser readable: block-level pass first, then inline pass.

## Design guidelines

### Typography & layout
- Content column `max-width: 680px` (~65–75 characters per line), centered.
- Base font size `18px` on desktop, `16–17px` on mobile; `line-height: 1.7`.
- System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif`.
- Monospace stack for code: `ui-monospace, SFMono-Regular, Consolas, monospace`.
- Use `rem`/`em` units; avoid fixed pixel heights.
- Minimal UI: header (blog title + theme toggle), content, small footer. No sidebars.

### Mobile
- Mobile-first CSS; add larger-screen rules with `@media (min-width: ...)`.
- Include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Side padding at least `16px`; no horizontal page scrolling.
- Code blocks and tables scroll horizontally inside their own box (`overflow-x: auto`).
- Images: `max-width: 100%; height: auto;`.
- Tap targets at least `44px` tall.

### Dark mode
- Define all colors as CSS custom properties on `:root` (e.g. `--bg`, `--text`, `--muted`, `--link`, `--border`, `--code-bg`).
- Default to the OS preference via `@media (prefers-color-scheme: dark)`.
- Manual toggle sets `data-theme="light" | "dark"` on `<html>` and saves the choice in `localStorage` (wrap in `try/catch`).
- Apply the saved theme with a tiny inline script in `<head>` to avoid a flash of the wrong theme.
- Keep text contrast at WCAG AA (4.5:1) or better in both themes. Avoid pure black/white; use soft tones (e.g. `#1a1a1a` background, `#e6e6e6` text in dark).

### Accessibility
- Semantic HTML: `<header>`, `<main>`, `<article>`, `<nav>`, `<footer>`, `<time>`.
- Theme toggle is a `<button>` with an `aria-label`.
- Visible focus styles; respect `prefers-reduced-motion`.
- Set `lang` on `<html>`.

## Coding conventions

- 2-space indentation, single quotes in JS, semicolons.
- Use `const`/`let`, never `var`. Small, named functions.
- Use `textContent` for plain text; only use `innerHTML` with output from the escaping Markdown parser.
- Handle fetch errors gracefully (show a friendly "Post not found" message).
- Keep comments short and useful; no dead code.

## Running locally

Opening `index.html` directly (`file://`) does not work: browsers block ES modules and `fetch()` there, so `index.html` shows a help message instead. Serve the folder with a local static server.

On Windows, double-click `start-blog.bat`. It starts a Python server on port 8000 and opens the browser. Close its window to stop it. Or run:

```bash
python -m http.server 8000
```

or

```bash
npx serve .
```

Then open http://localhost:8000.

## Adding a new post

1. Create `posts/<slug>.md`.
2. Add an entry to `posts/index.json` with the same `slug`, plus `title`, `date` (YYYY-MM-DD), and `summary`.
3. Reload the site and check it in both light and dark mode and at mobile width.

## Testing checklist

Before finishing a change, verify:
- Post list and a single post render correctly.
- All supported Markdown syntax renders (keep a `posts/markdown-test.md` sample post for this).
- Light and dark mode both look right; the toggle persists after reload.
- Layout at ~375px width: no horizontal scroll, readable text, code blocks scroll inside their box.
- Browser console shows no errors.
