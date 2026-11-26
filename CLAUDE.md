# CLAUDE.md

This file guides Claude Code when working in this repository.

## Project Overview

A static blog website that reads Markdown (`.md`) files and renders them as blog posts.
The goal is a **clean, readable** reading experience that works well on **mobile** and supports **dark mode**.

## Tech Constraints (must follow)

- **Plain HTML, CSS, and JavaScript only.**
- **No frameworks or libraries**: no React, Vue, Svelte, jQuery, Tailwind, Bootstrap, etc.
- **No build step**: no bundlers, transpilers, or `npm install`. Files are served as-is.
- Markdown is parsed by **our own vanilla JS parser** (`js/markdown.js`), not a third-party library.
- Use modern standard browser APIs (ES modules, `fetch`, CSS custom properties, `prefers-color-scheme`).

## Directory Structure

```
my-blog/
├── CLAUDE.md
├── index.html          # Post list (home page)
├── post.html           # Single post view: post.html?slug=<file-name-without-.md>
├── css/
│   └── style.css       # All styles, black + neon theme via CSS variables
├── js/
│   ├── app.js          # Loads post list / post, renders the page (grid, tag filter, TOC)
│   ├── markdown.js     # Markdown → HTML parser (vanilla JS)
│   └── theme.js        # Neon color switcher + persistence
└── posts/
    ├── posts.json      # Manifest: list of posts (browsers cannot list directories)
    └── *.md            # Blog posts
```

## How Posts Work

1. Each post is a Markdown file in `posts/`, e.g. `posts/hello-world.md`.
2. Each post may start with front matter:

   ```markdown
   ---
   title: Hello World
   date: 2026-11-26
   tags: intro, blog
   description: A short summary shown on the home page.
   ---

   # Hello World
   Post body...
   ```

3. `posts/posts.json` lists every post so the home page can show them:

   ```json
   [
     { "slug": "hello-world", "title": "Hello World", "date": "2026-11-26", "description": "A short summary." }
   ]
   ```

4. **When adding a new post, always add an entry to `posts/posts.json`.** Sort by date, newest first.
5. `post.html?slug=hello-world` fetches `posts/hello-world.md`, parses front matter and body, and renders it.

## Markdown Parser Requirements (`js/markdown.js`)

Support at least:

- Headings `#` to `######`
- Paragraphs and line breaks
- **Bold**, *italic*, ~~strikethrough~~, `inline code`
- Links `[text](url)` and images `![alt](src)`
- Ordered and unordered lists (including simple nesting)
- Blockquotes `>`
- Fenced code blocks ```` ```lang ```` (add `class="language-lang"`)
- Horizontal rules `---`
- Tables (GFM style)
- Front matter block at the top of the file

**Security:** escape HTML in post text before inserting markup, and only allow `http:`, `https:`, `mailto:`, and relative URLs in links/images (block `javascript:`).

## Design Guidelines

### Readability
- Content column max width around `680–720px`, centered.
- Body font size `17–18px` on desktop, `16px` minimum on mobile; line height `1.7`.
- Use a system font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif`.
- Monospace font for code: `ui-monospace, SFMono-Regular, Consolas, monospace`.
- Generous spacing between paragraphs and headings; clear heading hierarchy.
- Code blocks scroll horizontally (`overflow-x: auto`) instead of breaking layout.
- Images are responsive (`max-width: 100%; height: auto`).

### Neon Theme (replaces light/dark mode)
- The background is **always black** (`#050507`) with a faint neon grid and scanlines; text is **neon-tinted**.
- Neon color is chosen with `[data-neon="cyan|green|pink|amber"]` on `<html>`. Each sets `--neon` (main accent), `--neon-2` (secondary accent), `--text`, `--text-strong`, `--muted`.
- Define all colors as CSS custom properties; never hard-code a neon color in a component.
- The header button (`.neon-switch`, `js/theme.js`) cycles the neon color. The choice is saved in `localStorage` (`neon`) and applied **before first paint** by a small inline script in `<head>`.
- Use full-strength neon + glow (`--glow`) for headings, links, and accents; use the softer `--text` for body text so long posts stay readable. Keep text contrast at least WCAG AA (4.5:1).
- Headings and UI labels use the monospace font (terminal look); body text uses the sans font.

### Mobile / Responsive
- Mobile-first CSS; include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Breakpoint around `768px` for wider layouts.
- Tap targets at least `44px`.
- No horizontal scrolling on the page itself (tables and code blocks scroll inside their own containers).

### Layout & Pages
- **Sidebar layout:** on desktop (≥1024px) a sticky left sidebar (`.sidebar`, 290px) holds the logo, neon color switch, and page tools; content sits on the right. On mobile the sidebar stacks above the content.
- **Home (`index.html`):** terminal-style hero (`> ls ./posts`), then a **grid of post cards** (2 columns ≥640px; the newest post is a full-width featured card). Cards show number, date, title, description, tags. The sidebar has a **tag filter** (horizontal chips on mobile).
- **Post (`post.html`):** neon title, date, reading time, tags, rendered content, "<- Back to list" links, a reading **progress bar** at the top, and a **table of contents** in the sidebar (built from h2/h3, highlights the current section; collapsible on mobile). Set `document.title` to the post title.
- **Footer:** copyright line in the sidebar (desktop).
- Show a friendly message if a post is not found or fails to load.

## Running Locally

`fetch()` does not work over `file://`, so serve the folder with any static server:

```powershell
python -m http.server 8000
```

Then open http://localhost:8000.

## Coding Conventions

- 2-space indentation; use `const`/`let`, never `var`.
- ES modules (`<script type="module">`), small focused functions.
- Semantic HTML (`<header>`, `<main>`, `<article>`, `<nav>`, `<footer>`).
- Keep everything dependency-free and easy to read; comment only non-obvious logic.
- Test changes with more than one neon color and at a mobile width (~375px) and desktop width (≥1024px).
