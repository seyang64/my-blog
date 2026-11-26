---
title: Markdown Guide
date: 2026-11-25
tags: markdown, guide
description: Every Markdown feature this blog supports, with examples.
---

This post shows every Markdown feature the blog's parser supports.

## Text formatting

You can write **bold**, *italic*, ***both***, ~~strikethrough~~, and `inline code`.
A line ending with two spaces  
creates a line break.

Links look like [this one](https://developer.mozilla.org "MDN Web Docs"), and relative links work too: [back home](./).

## Headings

### Third level
#### Fourth level

## Lists

- Apples
- Oranges
  - Blood orange
  - Navel orange
- Bananas

1. First step
2. Second step
3. Third step

- [x] Write the parser
- [x] Add dark mode
- [ ] Write more posts

## Blockquote

> Simplicity is prerequisite for reliability.
>
> — Edsger W. Dijkstra

## Code block

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('world'));
```

```css
:root {
  --bg: #ffffff;
  --text: #1f2328;
}
```

## Table

| Feature     | Supported | Notes                     |
| :---------- | :-------: | ------------------------: |
| Dark mode   | ✅        | Follows your OS setting   |
| Mobile      | ✅        | Mobile-first layout       |
| Frameworks  | ❌        | Plain HTML/CSS/JS only    |

## Image

![A placeholder landscape](https://picsum.photos/seed/blog/1200/600)

---

That's everything. Happy writing! ✍️
