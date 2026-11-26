import { parseMarkdown, escapeHtml } from './markdown.js';

const SITE_NAME = 'My Blog';
const MANIFEST = 'posts/posts.json';

/* ---------- Helpers ---------- */

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function readingTime(text) {
  // ~200 words/min for English; Korean has no spaces between many words,
  // so count CJK/Hangul characters separately (~500 chars/min).
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
  const words = text.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200 + cjk / 500));
}

function toTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function tagsHtml(tags) {
  const list = toTags(tags);
  if (!list.length) return '';
  return `<ul class="tags">${list.map((t) => `<li>#${escapeHtml(t)}</li>`).join('')}</ul>`;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function loadManifest() {
  const posts = JSON.parse(await fetchText(MANIFEST));
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- Home page ---------- */

async function renderHome() {
  const list = document.getElementById('post-list');
  try {
    const posts = await loadManifest();
    if (!posts.length) {
      list.innerHTML = '<li class="status">No posts yet.</li>';
      return;
    }
    list.innerHTML = posts
      .map(
        (p) => `
        <li class="post-card">
          <a href="post.html?slug=${encodeURIComponent(p.slug)}">
            <time datetime="${escapeHtml(p.date || '')}">${formatDate(p.date)}</time>
            <h2>${escapeHtml(p.title || p.slug)}</h2>
            ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
          </a>
          ${tagsHtml(p.tags)}
        </li>`
      )
      .join('');
  } catch (err) {
    list.innerHTML = `<li class="status error">Could not load posts. ${
      location.protocol === 'file:' ? 'Open this site through a local server (see CLAUDE.md).' : escapeHtml(err.message)
    }</li>`;
  }
}

/* ---------- Post page ---------- */

function addCopyButtons(container) {
  container.querySelectorAll('pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code').textContent);
        btn.textContent = 'Copied!';
      } catch {
        btn.textContent = 'Failed';
      }
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    });
    pre.appendChild(btn);
  });
}

function showNotFound(article, message) {
  document.title = `Not found — ${SITE_NAME}`;
  article.innerHTML = `
    <div class="not-found">
      <h1>Post not found</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <p><a href="./">Go back to the post list</a></p>
    </div>`;
}

async function renderPost() {
  const article = document.getElementById('post');
  const slug = new URLSearchParams(location.search).get('slug') || '';

  // Only allow simple file names: blocks "../" and other path tricks.
  if (!/^[\w-]+$/.test(slug)) {
    showNotFound(article, 'No post was specified, or the link is invalid.');
    return;
  }

  let src;
  try {
    src = await fetchText(`posts/${slug}.md`);
  } catch {
    showNotFound(article, `We couldn't find "${slug}".`);
    return;
  }

  const { meta, body, html } = parseMarkdown(src);

  // Fall back to the manifest for anything the front matter doesn't set.
  let entry = {};
  try {
    entry = (await loadManifest()).find((p) => p.slug === slug) || {};
  } catch {
    /* manifest is optional for rendering a post */
  }
  const title = meta.title || entry.title || slug;
  const date = meta.date || entry.date;
  const tags = meta.tags || entry.tags;
  const description = meta.description || entry.description;

  document.title = `${title} — ${SITE_NAME}`;
  if (description) {
    const m = document.createElement('meta');
    m.name = 'description';
    m.content = description;
    document.head.appendChild(m);
  }

  article.innerHTML = `
    <header class="post-header">
      <h1>${escapeHtml(title)}</h1>
      <div class="post-meta">
        ${date ? `<time datetime="${escapeHtml(date)}">${formatDate(date)}</time><span aria-hidden="true">·</span>` : ''}
        <span>${readingTime(body)} min read</span>
      </div>
      ${tagsHtml(tags)}
    </header>
    <div class="post-content">${html}</div>`;

  // Drop a leading H1 in the body if it just repeats the title.
  const content = article.querySelector('.post-content');
  const firstH1 = content.firstElementChild;
  if (firstH1 && firstH1.tagName === 'H1' && firstH1.textContent.trim() === title.trim()) firstH1.remove();

  addCopyButtons(content);

  // Jump to #heading if the URL has one (content was injected after load).
  if (location.hash) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
}

/* ---------- Init ---------- */

document.getElementById('year').textContent = new Date().getFullYear();

if (document.body.dataset.page === 'home') renderHome();
else if (document.body.dataset.page === 'post') renderPost();
