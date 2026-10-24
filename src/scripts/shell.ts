// Shared page behavior: theme toggle, header background, mobile menu, reveal on scroll.

const root = document.documentElement;

function syncThemeButton() {
  const light = root.getAttribute('data-theme') === 'light';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) =>
    b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#efe7d6' : '#0c0a08');
}
syncThemeButton();
document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* storage blocked */ }
    syncThemeButton();
    document.dispatchEvent(new CustomEvent('themechange'));
  }));

const header = document.getElementById('site-header');
const onScroll = () => header?.toggleAttribute('data-scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const menu = document.getElementById('mobile-nav');
const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
const closeBtn = document.querySelector<HTMLButtonElement>('[data-menu-close]');
function setMenu(open: boolean, moveFocus = true) {
  if (!menu || !openBtn) return;
  menu.toggleAttribute('data-open', open);
  openBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (!moveFocus) return;
  if (open) closeBtn?.focus(); else openBtn.focus();
}
openBtn?.addEventListener('click', () => setMenu(true));
closeBtn?.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu?.hasAttribute('data-open')) setMenu(false);
  if (e.key === 'Tab' && menu?.hasAttribute('data-open')) {
    const items = Array.from(menu.querySelectorAll<HTMLElement>('a, button'));
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && menu?.hasAttribute('data-open')) setMenu(false, false); });

const reveal = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  reveal.forEach((el) => io.observe(el));
} else {
  reveal.forEach((el) => el.classList.add('is-in'));
}
