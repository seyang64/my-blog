// Neon color switcher. The background is always black; this button cycles the
// neon accent color. The saved color is applied by an inline script in <head>
// before first paint; this module wires up the button.

const COLORS = ['cyan', 'green', 'pink', 'amber'];
const root = document.documentElement;

function applyColor(color) {
  root.dataset.neon = color;
  document.querySelectorAll('.neon-switch').forEach((btn) => {
    const next = COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];
    btn.querySelector('.neon-name').textContent = color;
    btn.setAttribute('aria-label', `Neon color: ${color}. Switch to ${next}`);
    btn.title = `Switch to ${next}`;
  });
}

function init() {
  applyColor(COLORS.includes(root.dataset.neon) ? root.dataset.neon : COLORS[0]);

  document.querySelectorAll('.neon-switch').forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = COLORS[(COLORS.indexOf(root.dataset.neon) + 1) % COLORS.length];
      applyColor(next);
      try {
        localStorage.setItem('neon', next);
      } catch {
        /* storage unavailable: color still changes for this page */
      }
    })
  );
}

init();
