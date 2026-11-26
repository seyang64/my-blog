import { parseMarkdown, escapeHtml } from './markdown.js';

const SITE_NAME = 'My Blog';
const MANIFEST = 'posts/posts.json';

/* ---------- Helpers ---------- */

// Dates are shown terminal-style: 2026.11.26
function formatDate(value) {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : escapeHtml(value);
}

function readingTime(text) {
  // ~200 words/min for English; Korean has no spaces between many words,
  // so count CJK/Hangul characters separately (~500 chars/min).
  const cjkRe = /[぀-ヿ㐀-鿿가-힯]/g;
  const cjk = (text.match(cjkRe) || []).length;
  const words = text.replace(cjkRe, ' ').split(/\s+/).filter(Boolean).length;
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

function cardHtml(p, i) {
  return `
    <li class="post-card${i === 0 ? ' featured' : ''}">
      <a href="post.html?slug=${encodeURIComponent(p.slug)}">
        <div class="card-top">
          <span class="card-index">${String(i + 1).padStart(2, '0')}</span>
          <time datetime="${escapeHtml(p.date || '')}">${formatDate(p.date)}</time>
        </div>
        <h2>${escapeHtml(p.title || p.slug)}</h2>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
        <span class="read-more" aria-hidden="true">read -&gt;</span>
      </a>
      ${tagsHtml(p.tags)}
    </li>`;
}

function renderGrid(posts, tag) {
  const list = document.getElementById('post-list');
  const shown = tag ? posts.filter((p) => toTags(p.tags).includes(tag)) : posts;
  list.innerHTML = shown.length ? shown.map(cardHtml).join('') : '<li class="status">No posts with this tag.</li>';
  document.getElementById('post-count').textContent = tag
    ? `${shown.length} post${shown.length === 1 ? '' : 's'} tagged #${tag}`
    : `${posts.length} post${posts.length === 1 ? '' : 's'} found`;
}

function renderTagFilter(posts) {
  const filter = document.getElementById('tag-filter');
  const counts = new Map();
  posts.forEach((p) => toTags(p.tags).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const tags = [...counts.keys()].sort();

  filter.innerHTML = [
    `<li><button type="button" data-tag="" aria-pressed="true">all <span>${posts.length}</span></button></li>`,
    ...tags.map(
      (t) =>
        `<li><button type="button" data-tag="${escapeHtml(t)}" aria-pressed="false">#${escapeHtml(t)} <span>${counts.get(t)}</span></button></li>`
    ),
  ].join('');

  filter.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tag]');
    if (!btn) return;
    filter.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    renderGrid(posts, btn.dataset.tag);
  });
}

async function renderHome() {
  const list = document.getElementById('post-list');
  try {
    const posts = await loadManifest();
    if (!posts.length) {
      list.innerHTML = '<li class="status">No posts yet.</li>';
      return;
    }
    renderTagFilter(posts);
    renderGrid(posts, '');
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
    btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code').textContent);
        btn.textContent = 'copied!';
      } catch {
        btn.textContent = 'failed';
      }
      setTimeout(() => (btn.textContent = 'copy'), 1500);
    });
    pre.appendChild(btn);
  });
}

function buildToc(content) {
  const headings = [...content.querySelectorAll('h2, h3')];
  const toc = document.getElementById('toc');
  if (headings.length < 2) return;

  document.getElementById('toc-list').innerHTML = headings
    .map(
      (h) =>
        `<li class="toc-${h.tagName.toLowerCase()}"><a href="#${encodeURIComponent(h.id)}">${escapeHtml(h.textContent)}</a></li>`
    )
    .join('');
  toc.hidden = false;
  // Collapsed by default on small screens, where the TOC sits above the post.
  if (window.matchMedia('(max-width: 1023px)').matches) toc.open = false;

  // Highlight the section currently being read.
  const links = new Map(headings.map((h) => [h, toc.querySelector(`a[href="#${CSS.escape(encodeURIComponent(h.id))}"]`)]));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a?.classList.remove('active'));
        links.get(entry.target)?.classList.add('active');
      });
    },
    { rootMargin: '0px 0px -70% 0px' }
  );
  headings.forEach((h) => observer.observe(h));
}

function trackProgress() {
  const bar = document.getElementById('progress-bar');
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function showNotFound(article, message) {
  document.title = `Not found — ${SITE_NAME}`;
  article.innerHTML = `
    <div class="not-found">
      <p class="prompt">&gt; error 404</p>
      <h1>Post not found</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <p><a href="./">&lt;- Go back to the post list</a></p>
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
      <p class="prompt">&gt; cat ${escapeHtml(slug)}.md</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="post-meta">
        ${date ? `<time datetime="${escapeHtml(date)}">${formatDate(date)}</time><span aria-hidden="true">/</span>` : ''}
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
  buildToc(content);
  trackProgress();

  // Jump to #heading if the URL has one (content was injected after load).
  if (location.hash) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
}

/* ---------- Init ---------- */

document.getElementById('year').textContent = new Date().getFullYear();

if (document.body.dataset.page === 'home') renderHome();
else if (document.body.dataset.page === 'post') renderPost();
