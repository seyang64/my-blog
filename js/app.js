import { parseMarkdown, parseFrontMatter } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_TITLE = 'My Blog';
const app = document.getElementById('app');
const SLUG_RE = /^[\p{L}\p{N}_-]+$/u;
const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

let postIndex = null;

// ---------- Data ----------

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function loadIndex() {
  if (!postIndex) {
    const posts = JSON.parse(await fetchText('posts/index.json'));
    postIndex = posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  return postIndex;
}

// ---------- Helpers ----------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return el('time', { dateTime: m[0], textContent: dateFormat.format(date) });
}

function tagList(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  return el('ul', { className: 'tags' }, tags.map((t) => el('li', { className: 'tag', textContent: `#${t}` })));
}

function setTitle(title) {
  document.title = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE;
}

function show(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

function showError(title, message) {
  setTitle(title);
  const box = el('section', { className: 'error' }, [
    el('h1', { textContent: title }),
    el('p', { textContent: message }),
  ]);
  if (location.protocol === 'file:') {
    box.append(
      el('p', {}, [
        '파일을 직접 열면 글을 불러올 수 없습니다. 로컬 서버로 실행해 주세요: ',
        el('code', { textContent: 'python -m http.server 8000' }),
      ])
    );
  }
  box.append(el('p', {}, [el('a', { href: '#/', textContent: '← 목록으로' })]));
  show(box);
}

// ---------- Views ----------

async function renderList() {
  setTitle('');
  const posts = await loadIndex();

  const items = posts.map((post) =>
    el('li', { className: 'post-item' }, [
      el('h2', {}, [el('a', { href: `#/post/${encodeURIComponent(post.slug)}`, textContent: post.title })]),
      el('div', { className: 'post-meta' }, [formatDate(post.date)]),
      post.summary ? el('p', { textContent: post.summary }) : null,
      tagList(post.tags),
    ])
  );

  show(
    el('h1', { className: 'page-heading', textContent: '글 목록' }),
    items.length
      ? el('ul', { className: 'post-list' }, items)
      : el('p', { className: 'status', textContent: '아직 작성된 글이 없습니다.' })
  );
}

async function renderPost(slug) {
  if (!SLUG_RE.test(slug)) {
    showError('글을 찾을 수 없습니다', '주소가 올바른지 확인해 주세요.');
    return;
  }

  let text;
  try {
    text = await fetchText(`posts/${encodeURIComponent(slug)}.md`);
  } catch (err) {
    showError('글을 찾을 수 없습니다', '글을 불러올 수 없습니다. 주소가 올바른지 확인해 주세요.');
    return;
  }

  const posts = await loadIndex().catch(() => []);
  const entry = posts.find((p) => p.slug === slug) || {};
  const { meta, body } = parseFrontMatter(text);
  const title = meta.title || entry.title || slug;
  const date = meta.date || entry.date;
  const tags = entry.tags;

  // Drop a leading "# Title" that just repeats the post title.
  const content = body.replace(/^\s*#[ \t]+(.+?)[ \t]*\n/, (line, h) => (h.trim() === title ? '' : line));

  const article = el('article', { className: 'post' }, [
    el('header', { className: 'post-header' }, [
      el('h1', { textContent: title }),
      el('div', { className: 'post-meta' }, [formatDate(date)]),
      tagList(tags),
    ]),
  ]);
  const bodyEl = el('div', { className: 'post-body' });
  bodyEl.innerHTML = parseMarkdown(content); // parser escapes all text and URLs
  article.append(bodyEl);

  setTitle(title);
  show(el('a', { className: 'back-link', href: '#/', textContent: '← 목록으로' }), article);
}

// ---------- Router ----------

async function route() {
  const hash = location.hash || '#/';
  try {
    if (hash === '#/' || hash === '#') {
      await renderList();
      return;
    }
    const m = hash.match(/^#\/post\/(.+)$/);
    if (m) {
      await renderPost(decodeURIComponent(m[1]));
      return;
    }
    showError('페이지를 찾을 수 없습니다', '요청한 페이지가 존재하지 않습니다.');
  } catch (err) {
    console.error(err);
    showError('문제가 발생했습니다', '글 목록을 불러올 수 없습니다.');
  }
}

// In-post anchor links (#heading-id) scroll instead of changing the route.
app.addEventListener('click', (event) => {
  const a = event.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('#/')) return;
  event.preventDefault();
  const target = document.getElementById(decodeURIComponent(href.slice(1)));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('year').textContent = new Date().getFullYear();
initThemeToggle(document.querySelector('.theme-toggle'));
window.addEventListener('hashchange', route);
route();
