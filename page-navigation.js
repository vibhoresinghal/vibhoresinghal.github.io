(() => {
  const mount = document.getElementById('page-navigation');
  if (!mount) return;
  const current = location.pathname.split('/').pop() || 'index.html';
  const pages = [
    ['index.html', 'Intro', '<path d="M3 8 8 3l5 5v5H9.5V10h-3v3H3Z"/>'],
    ['day.html', 'What my day looks like', '<circle cx="8" cy="8" r="5.7"/><path d="M8 4.5V8l2.5 1.5"/>'],
    ['digital-creations.html', 'Digital creations', '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="3" width="5" height="5" rx="1"/><rect x="4" y="9" width="5" height="5" rx="1"/>'],
    ['notebook.html', 'My notebook', '<path d="M8 4v9M8 4C6 2.5 3.5 3 2 3v9c2-.5 4-.5 6 1 2-1.5 4-1.5 6-1V3c-1.5 0-4-.5-6 1Z"/>']
  ];
  const nav = document.createElement('nav');
  nav.className = 'page-entry-points';
  nav.setAttribute('aria-label', 'Explore other pages');
  pages.filter(([href]) => href !== current).forEach(([href, label, icon]) => {
    const link = document.createElement('a');
    link.href = href;
    link.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${icon}</svg><span>${label}</span><span class="entry-point-arrow" aria-hidden="true">&#8599;</span>`;
    nav.append(link);
  });
  mount.replaceWith(nav);
})();
