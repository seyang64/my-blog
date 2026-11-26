// Dark mode toggle. The initial theme is applied by an inline script in <head>
// (before first paint); this module wires up the button and keeps it in sync.

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0f1115' : '#ffffff';
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    const next = theme === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', `Switch to ${next} mode`);
    btn.title = `Switch to ${next} mode`;
  }
}

function init() {
  applyTheme(root.dataset.theme || (media.matches ? 'dark' : 'light'));

  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable: theme still changes for this page */
    }
  });

  // Follow OS changes only while the user hasn't picked a theme themselves.
  media.addEventListener('change', (e) => {
    if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });
}

init();
