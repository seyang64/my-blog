const STORAGE_KEY = 'theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'light' || set === 'dark') return set;
  return darkQuery.matches ? 'dark' : 'light';
}

function updateButton(button) {
  const isDark = currentTheme() === 'dark';
  button.textContent = isDark ? '☀️' : '🌙';
  button.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
  button.title = button.getAttribute('aria-label');
}

export function initThemeToggle(button) {
  if (!button) return;
  updateButton(button);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) { /* storage unavailable */ }
    updateButton(button);
  });

  // Keep the icon in sync when the OS theme changes and no choice is saved.
  darkQuery.addEventListener('change', () => updateButton(button));
}
