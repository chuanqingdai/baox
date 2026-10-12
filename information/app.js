/* Progressive enhancement: all reading content remains visible without JavaScript. */
(() => {
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.site-nav');
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  const backTop = document.querySelector('.to-top');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setMenu(open, returnFocus = false) {
    header.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '关闭' : '目录';
    if (returnFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && header.classList.contains('menu-open')) setMenu(false, true); });
  document.addEventListener('click', event => { if (!header.contains(event.target)) setMenu(false); });
  window.addEventListener('resize', () => { if (innerWidth > 760) setMenu(false); });

  let scheduled = false;
  function updateScroll() {
    const y = window.scrollY;
    const travel = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--progress', travel > 0 ? Math.min(1, y / travel) : 0);
    header.classList.toggle('scrolled', y > 24);
    backTop.classList.toggle('show', y > 650);
    let current = null;
    for (const section of sections) if (section.getBoundingClientRect().top <= 180) current = section.id;
    links.forEach(link => {
      if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  window.addEventListener('resize', updateScroll);
  updateScroll();

  if ('IntersectionObserver' in window && !reduced.matches) {
    document.documentElement.classList.add('js');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove('waiting'); observer.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px -30px 0px', threshold: .04 });
    document.querySelectorAll('.reveal').forEach(element => { element.classList.add('waiting'); observer.observe(element); });
  }
})();
