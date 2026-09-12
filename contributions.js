(() => {
  const card = document.getElementById('contribution-card');
  if (!card) return;
  const grid = card.querySelector('.contribution-grid');
  const summary = card.querySelector('.contribution-summary');
  const cacheKey = 'vs-github-contributions-v1';
  const formatter = new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' });

  function render(data) {
    if (!Array.isArray(data.contributions) || !data.contributions.length) throw new Error('Missing activity');
    const days = data.contributions.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isInteger(day.count) && day.count >= 0).sort((a,b) => a.date.localeCompare(b.date));
    if (!days.length) throw new Error('Invalid activity');
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const defaultLabel = `${total.toLocaleString()} contributions in the last year`;
    const fragment = document.createDocumentFragment();
    const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
    for (let i = 0; i < offset; i++) {
      const blank = document.createElement('span');
      blank.setAttribute('aria-hidden', 'true');
      fragment.append(blank);
    }
    days.forEach((day, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contribution-day';
      button.dataset.level = String(Math.max(0, Math.min(4, Number(day.level) || 0)));
      button.tabIndex = index === days.length - 1 ? 0 : -1;
      const label = `${day.count} contribution${day.count === 1 ? '' : 's'} on ${formatter.format(new Date(`${day.date}T00:00:00Z`))}`;
      button.setAttribute('aria-label', label);
      const show = () => { summary.textContent = label; };
      button.addEventListener('pointerenter', show);
      button.addEventListener('focus', show);
      button.addEventListener('click', show);
      fragment.append(button);
    });
    grid.replaceChildren(fragment);
    grid.hidden = false;
    summary.textContent = defaultLabel;
    card.setAttribute('aria-busy', 'false');
    const buttons = Array.from(grid.querySelectorAll('button'));
    grid.onkeydown = event => {
      const index = buttons.indexOf(document.activeElement);
      const delta = { ArrowLeft:-7, ArrowRight:7, ArrowUp:-1, ArrowDown:1 }[event.key];
      if (index < 0 || (delta === undefined && !['Home','End'].includes(event.key))) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + delta));
      buttons.forEach((button, i) => { button.tabIndex = i === next ? 0 : -1; });
      buttons[next].focus();
    };
    grid.onpointerleave = () => { if (!grid.contains(document.activeElement)) summary.textContent = defaultLabel; };
    grid.onfocusout = event => { if (!grid.contains(event.relatedTarget)) summary.textContent = defaultLabel; };
    const scroll = card.querySelector('.contribution-scroll');
    scroll.scrollLeft = scroll.scrollWidth;
  }

  async function load() {
    try {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        if (cached && Date.now() - cached.time < 21600000) { render(cached.data); return; }
      } catch { /* Storage is optional. */ }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let data;
      try {
        // Public contribution counts via a community API; no token or private data.
        const response = await fetch('https://github-contributions-api.jogruber.de/v4/vibhoresinghal?y=last', { signal:controller.signal, credentials:'omit' });
        if (!response.ok) throw new Error('Activity unavailable');
        data = await response.json();
      } finally { clearTimeout(timeout); }
      render(data);
      try { localStorage.setItem(cacheKey, JSON.stringify({ time:Date.now(), data })); } catch { /* Storage is optional. */ }
    } catch {
      card.setAttribute('aria-busy', 'false');
      summary.textContent = 'Activity unavailable right now. View it on GitHub below.';
      card.querySelector('.contribution-legend').hidden = true;
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin:'150px' });
    observer.observe(card);
  } else load();
})();
