// Hand-written Markdown → HTML converter (no dependencies).
// Block pass first (code, headings, lists, ...), then an inline pass per block.
// All text is HTML-escaped; raw HTML in Markdown is shown as text, not rendered.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// ---------- Front matter ----------

export function parseFrontMatter(text) {
  const src = normalize(text);
  const match = src.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return { meta: {}, body: src };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      meta[key] = value;
    }
  }
  return { meta, body: src.slice(match[0].length) };
}

// ---------- Public entry ----------

export function parseMarkdown(text) {
  const ctx = { slugs: new Map() };
  return parseBlocks(normalize(text).split('\n'), ctx, false);
}

function normalize(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u0000/g, '�');
}

// ---------- Block patterns ----------

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?:( +)(.*))?$/;
const TABLE_SEP_RE = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

function isTableStart(lines, i) {
  return (
    lines[i].includes('|') &&
    i + 1 < lines.length &&
    lines[i + 1].includes('|') &&
    TABLE_SEP_RE.test(lines[i + 1])
  );
}

// Lines that end a paragraph. Only bullets or "1." may interrupt a paragraph,
// so text like "2026. 11. 13." stays a paragraph.
function interruptsParagraph(lines, i) {
  const line = lines[i];
  if (FENCE_RE.test(line) || HEADING_RE.test(line) || HR_RE.test(line) || QUOTE_RE.test(line)) {
    return true;
  }
  const m = line.match(LIST_RE);
  if (m && m[4] && (/^[-*+]$/.test(m[2]) || /^1[.)]$/.test(m[2]))) return true;
  return isTableStart(lines, i);
}

// ---------- Block pass ----------

function parseBlocks(lines, ctx, tight) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    let m = line.match(FENCE_RE);
    if (m) {
      const fence = m[1];
      const lang = m[2];
      const closeRe = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
      const code = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    m = line.match(HEADING_RE);
    if (m) {
      const level = m[1].length;
      const id = uniqueSlug(m[2], ctx);
      out.push(`<h${level} id="${escapeHtml(id)}">${parseInline(m[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule (checked before lists so "* * *" is a rule)
    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i].replace(QUOTE_RE, ''));
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(inner, ctx, false)}\n</blockquote>`);
      continue;
    }

    // Table
    if (isTableStart(lines, i)) {
      i = parseTable(lines, i, out);
      continue;
    }

    // List
    if (LIST_RE.test(line)) {
      i = parseList(lines, i, ctx, out);
      continue;
    }

    // Paragraph
    const para = [line.trimStart()];
    i++;
    while (i < lines.length && lines[i].trim() && !interruptsParagraph(lines, i)) {
      para.push(lines[i].trimStart());
      i++;
    }
    const html = parseInline(para.join('\n').trimEnd());
    out.push(tight ? html : `<p>${html}</p>`);
  }

  return out.join('\n');
}

function parseList(lines, i, ctx, out) {
  const first = lines[i].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const start = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let current = null;
  let loose = false;
  let sawBlank = false;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      sawBlank = true;
      i++;
      continue;
    }

    const m = line.match(LIST_RE);
    const indent = line.length - line.trimStart().length;

    // New item at the same level and of the same list type
    if (m && m[1].length === baseIndent && /\d/.test(m[2]) === ordered) {
      if (sawBlank && current) loose = true;
      const gap = m[3] && m[3].length <= 4 ? m[3].length : 1;
      current = { lines: [m[4] || ''], contentIndent: baseIndent + m[2].length + gap };
      items.push(current);
      sawBlank = false;
      i++;
      continue;
    }

    // Indented content belongs to the current item (continuation or nested list)
    if (current && indent > baseIndent) {
      if (sawBlank) {
        current.lines.push('');
        loose = true;
        sawBlank = false;
      }
      current.lines.push(line.slice(Math.min(indent, current.contentIndent)));
      i++;
      continue;
    }

    // Lazy continuation of the item's paragraph
    if (current && !sawBlank && !m && !interruptsParagraph(lines, i)) {
      current.lines.push(line.trimStart());
      i++;
      continue;
    }

    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
  const body = items
    .map((item) => `<li>${parseBlocks(item.lines, ctx, !loose)}</li>`)
    .join('\n');
  out.push(`<${tag}${startAttr}>\n${body}\n</${tag}>`);
  return i;
}

function splitRow(row) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines, i, out) {
  const header = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
  i += 2;

  const rows = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
    rows.push(splitRow(lines[i]));
    i++;
  }

  const cell = (tag, text, col) => {
    const align = aligns[col] ? ` style="text-align:${aligns[col]}"` : '';
    return `<${tag}${align}>${parseInline(text || '')}</${tag}>`;
  };
  const head = header.map((text, col) => cell('th', text, col)).join('');
  const body = rows
    .map((row) => `<tr>${header.map((_, col) => cell('td', row[col], col)).join('')}</tr>`)
    .join('\n');

  out.push(
    `<div class="table-wrap"><table>\n<thead><tr>${head}</tr></thead>\n` +
      `<tbody>\n${body}\n</tbody>\n</table></div>`
  );
  return i;
}

// ---------- Headings ----------

function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
  return slug || 'section';
}

function uniqueSlug(text, ctx) {
  const base = slugify(text);
  const count = ctx.slugs.get(base) || 0;
  ctx.slugs.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

// ---------- Inline pass ----------

const PLACEHOLDER_RE = /\u0000(\d+)\u0000/g;

// Allow http(s), mailto, anchors and relative URLs; block other schemes (javascript:, data:, ...).
function safeUrl(url) {
  const trimmed = url.trim();
  const check = trimmed.replace(/[\u0000- \u007f]/g, '');
  if (/^(https?:|mailto:)/i.test(check)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(check)) return '#';
  return trimmed;
}

function parseInline(text) {
  // Finished HTML pieces are stored here and swapped back in at the end,
  // so later regexes never touch code, links or escaped characters.
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  const restore = (str) => {
    for (let n = 0; n < 20 && str.includes('\u0000'); n++) {
      str = str.replace(PLACEHOLDER_RE, (_, k) => tokens[k] ?? '');
    }
    return str;
  };

  const link = (href, labelHtml, title) => {
    const url = safeUrl(restore(href));
    const external = /^https?:\/\//i.test(url);
    return (
      `<a href="${escapeHtml(url)}"` +
      (title ? ` title="${escapeHtml(title)}"` : '') +
      (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
      `>${labelHtml}</a>`
    );
  };

  const run = (s) => {
    // Backslash escapes and code spans (leftmost match wins)
    s = s.replace(
      /\\([\\`*_{}[\]()#+\-.!~>|<])|``[ ]?([\s\S]+?)[ ]?``|`([^`]+)`/g,
      (_, esc, code2, code1) =>
        esc !== undefined
          ? stash(escapeHtml(esc))
          : stash(`<code>${escapeHtml(code2 ?? code1)}</code>`)
    );

    // Autolinks <https://...>
    s = s.replace(/<(https?:\/\/[^\s<>]+)>/g, (_, url) => stash(link(url, escapeHtml(url))));

    // Images ![alt](src "title")
    s = s.replace(
      /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g,
      (_, alt, src, title) =>
        stash(
          `<img src="${escapeHtml(safeUrl(restore(src)))}" alt="${escapeHtml(alt)}"` +
            (title ? ` title="${escapeHtml(title)}"` : '') +
            ' loading="lazy">'
        )
    );

    // Links [text](url "title")
    s = s.replace(
      /\[([^\]]+)\]\(\s*<?([^)\s>]*)>?(?:\s+"([^"]*)")?\s*\)/g,
      (_, label, href, title) => stash(link(href, run(label), title))
    );

    s = escapeHtml(s);

    // Emphasis
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
    s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>');
    s = s.replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

    // Hard line break: two or more trailing spaces
    s = s.replace(/ {2,}\n/g, '<br>\n');
    return s;
  };

  return restore(run(text));
}
