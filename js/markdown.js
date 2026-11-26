// Minimal, dependency-free Markdown → HTML parser.
// Supports: front matter, headings, paragraphs, line breaks, bold, italic,
// strikethrough, inline code, links, images, lists (nested, task items),
// blockquotes, fenced code blocks, horizontal rules, and GFM tables.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Allow http(s), mailto, anchors, and relative URLs. Anything else with a
// scheme (javascript:, data:, vbscript:, ...) is replaced with "#".
function safeUrl(url) {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (!u.includes(':')) return u;
  // A colon after the first "/", "?" or "#" is part of a relative path, not a scheme.
  const firstSep = u.search(/[/?#]/);
  if (firstSep !== -1 && firstSep < u.indexOf(':')) return u;
  return '#';
}

/* ---------- Front matter ---------- */

export function parseFrontMatter(src) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2].replace(/^(["'])(.*)\1$/, '$2');
    if (m[1] === 'tags') {
      value = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((t) => t.trim().replace(/^(["'])(.*)\1$/, '$2'))
        .filter(Boolean);
    }
    meta[m[1]] = value;
  }
  return { meta, body: text.slice(match[0].length) };
}

/* ---------- Inline ---------- */

function emphasis(text) {
  return text
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?=[^\w]|$)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/\*(?=[^\s*])([^*])\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_]|[^\s_])_(?=[^\w]|$)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

export function inline(text) {
  // Generated tags are stored as placeholders so later rules can't mangle them.
  const slots = [];
  const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`;

  // 1. Code spans first: their contents are never formatted.
  let out = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _ticks, code) =>
    hold(`<code>${escapeHtml(code.replace(/^ (.*) $/, '$1'))}</code>`)
  );

  // 2. Backslash escapes for Markdown punctuation.
  out = out.replace(/\\([\\`*_{}\[\]()#+\-.!~|>])/g, (_, ch) => hold(escapeHtml(ch)));

  // 3. Escape everything else, then add markup on the escaped text.
  out = escapeHtml(out);

  // Images: ![alt](src "title")
  out = out.replace(
    /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    (_, alt, src, title) =>
      hold(
        `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy"${title ? ` title="${title}"` : ''}>`
      )
  );

  // Links: [text](href "title")
  out = out.replace(
    /\[([^\]]+)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    (_, label, href, title) => {
      const url = safeUrl(href);
      const external = /^https?:/i.test(url);
      return hold(
        `<a href="${url}"${title ? ` title="${title}"` : ''}${
          external ? ' target="_blank" rel="noopener noreferrer"' : ''
        }>${emphasis(label)}</a>`
      );
    }
  );

  // Autolinks: <https://example.com>
  out = out.replace(/&lt;(https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*)&gt;/g, (_, url) =>
    hold(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
  );

  out = emphasis(out);

  // Restore placeholders (they can be nested, e.g. a code span inside a link).
  while (/\u0000\d+\u0000/.test(out)) {
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)]);
  }
  return out;
}

/* ---------- Blocks ---------- */

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/,
  heading: /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}>/,
  list: /^(\s*)([-*+]|\d{1,9}[.)])\s+/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
};

const indentOf = (line) => line.match(/^\s*/)[0].replace(/\t/g, '    ').length;

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('-');
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return (
    RE.fence.test(line) ||
    RE.heading.test(line) ||
    RE.hr.test(line) ||
    RE.quote.test(line) ||
    RE.list.test(line) ||
    isTableStart(lines, i)
  );
}

function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map(indentOf);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.replace(/\t/g, '    ').slice(Math.min(min, indentOf(l))));
}

function slugify(text, used) {
  const base =
    text
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z#0-9]+;/gi, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';
  const n = used.get(base) || 0;
  used.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

function splitRow(row) {
  const cells = [];
  let cur = '';
  const s = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += s[i];
    }
  }
  cells.push(cur.trim());
  return cells;
}

function renderTable(lines, i) {
  const header = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((c) =>
    c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''
  );
  const cell = (tag, text, idx) =>
    `<${tag}${aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''}>${inline(text)}</${tag}>`;

  let html = '<div class="table-wrap"><table><thead><tr>';
  html += header.map((h, idx) => cell('th', h, idx)).join('');
  html += '</tr></thead><tbody>';
  i += 2;
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    html += '<tr>' + header.map((_, idx) => cell('td', cells[idx] ?? '', idx)).join('') + '</tr>';
    i++;
  }
  html += '</tbody></table></div>';
  return { html, next: i };
}

function renderList(lines, i, ctx) {
  const first = lines[i].match(RE.list);
  const baseIndent = indentOf(first[1]);
  const ordered = /\d/.test(first[2]);
  const items = [];

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(RE.list);
    if (m && indentOf(m[1]) === baseIndent && /\d/.test(m[2]) === ordered) {
      items.push({ first: line.slice(m[0].length), rest: [] });
      i++;
      continue;
    }
    if (!line.trim()) {
      // A blank line continues the list only if more list content follows.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const nm = j < lines.length && lines[j].match(RE.list);
      const sameList = nm && indentOf(nm[1]) === baseIndent && /\d/.test(nm[2]) === ordered;
      if (j < lines.length && (indentOf(lines[j]) > baseIndent || sameList)) {
        items[items.length - 1].rest.push('');
        i++;
        continue;
      }
      break;
    }
    if (indentOf(line) > baseIndent) {
      items[items.length - 1].rest.push(line);
      i++;
      continue;
    }
    // Lazy continuation of the item's text.
    if (!isBlockStart(lines, i) && items[items.length - 1].rest.length === 0) {
      items[items.length - 1].first += '\n' + line.trim();
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const start = ordered ? parseInt(first[2], 10) : 1;
  let html = `<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>`;
  for (const item of items) {
    let text = item.first;
    let cls = '';
    const task = text.match(/^\[([ xX])\]\s+/);
    if (task) {
      cls = ' class="task"';
      text =
        `<input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ` + inline(text.slice(task[0].length));
    } else {
      text = inline(text);
    }
    const rest = dedent(item.rest);
    while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
    html += `<li${cls}>${text}${rest.length ? renderBlocks(rest, ctx) : ''}</li>`;
  }
  html += `</${tag}>`;
  return { html, next: i };
}

function renderBlocks(lines, ctx) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    let m = line.match(RE.fence);
    if (m) {
      const fence = m[1];
      const lang = m[2];
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++; // closing fence
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html += `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`;
      continue;
    }

    // Heading
    m = line.match(RE.heading);
    if (m) {
      const level = m[1].length;
      const content = inline(m[2] || '');
      html += `<h${level} id="${slugify(content, ctx.ids)}">${content}</h${level}>`;
      i++;
      continue;
    }

    // Horizontal rule
    if (RE.hr.test(line)) {
      html += '<hr>';
      i++;
      continue;
    }

    // Blockquote
    if (RE.quote.test(line)) {
      const inner = [];
      while (i < lines.length && lines[i].trim() && (RE.quote.test(lines[i]) || !isBlockStart(lines, i))) {
        inner.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      html += `<blockquote>${renderBlocks(inner, ctx)}</blockquote>`;
      continue;
    }

    // Table
    if (isTableStart(lines, i)) {
      const t = renderTable(lines, i);
      html += t.html;
      i = t.next;
      continue;
    }

    // List
    if (RE.list.test(line)) {
      const l = renderList(lines, i, ctx);
      html += l.html;
      i = l.next;
      continue;
    }

    // Paragraph
    const para = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isBlockStart(lines, i))) {
      para.push(lines[i].trim() === lines[i] ? lines[i] : lines[i].replace(/^\s+/, ''));
      i++;
    }
    // Two trailing spaces or a trailing backslash = hard line break.
    const text = para.map((l, idx) => (idx < para.length - 1 ? l.replace(/( {2,}|\\)$/, '\u0001') : l.trimEnd())).join('\n');
    html += `<p>${inline(text).replace(/\u0001\n/g, '<br>\n')}</p>`;
  }

  return html;
}

/* ---------- Public API ---------- */

export function markdownToHtml(body) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  return renderBlocks(lines, { ids: new Map() });
}

export function parseMarkdown(src) {
  const { meta, body } = parseFrontMatter(src);
  return { meta, body, html: markdownToHtml(body) };
}
