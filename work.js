(() => {
  const section = document.querySelector('.selected-work');
  if (!section) return;
  // Replace these original demo recordings with real project assets when ready.
  const projects = {
    // Temporary demo clips for these additional project placeholders.
    'card-controls': { title: 'Card controls', video: 'media/work/payments.webm', poster: 'media/work/payments.png', alt: 'Placeholder payment demo for the card controls project' },
    'transaction-details': { title: 'Transaction details', video: 'media/work/spending.webm', poster: 'media/work/spending.png', alt: 'Placeholder spending demo for the transaction details project' },
    workspace: { title: 'A calmer place to work', video: 'media/work/workspace.webm', poster: 'media/work/workspace.png', alt: 'Illustrative web workspace with projects and a contextual assistant' },
    workflows: { title: 'From a thought to a next step', video: 'media/work/workflows.webm', poster: 'media/work/workflows.png', alt: 'Illustrative assisted workflow progressing from a brief to a review-ready draft' },
    payments: { title: 'A simpler way to pay', video: 'media/work/payments.webm', poster: 'media/work/payments.png', alt: 'Illustrative payment app showing a transfer to Nora' },
    spending: { title: 'The bigger picture', video: 'media/work/spending.webm', poster: 'media/work/spending.png', alt: 'Illustrative spending dashboard with a weekly chart and expense categories' },
    savings: { title: 'Small steps, real progress', video: 'media/work/savings.webm', poster: 'media/work/savings.png', alt: 'Illustrative savings goal for a mountain trip with a progress bar' }
  };
  const phoneAngles = {
    payments: [-3, -14, 2],
    'card-controls': [2, 13, -1.2],
    'transaction-details': [-2, -8, -1.5],
    spending: [1.5, 16, 1.2],
    savings: [-3, -12, -2]
  };
  section.querySelectorAll('.work-employer').forEach(employer => {
  const preview = employer.querySelector('.work-preview');
  if (!preview) return;
  const isLaptop = preview.classList.contains('work-preview-laptop');
  const screen = preview.querySelector('.work-screen');
  const phone = preview.querySelector('.work-phone, .work-laptop');
  const caption = preview.querySelector('figcaption');
  const title = preview.querySelector('.work-preview-title');
  const meta = preview.querySelector('.work-preview-meta');
  const toggle = preview.querySelector('.work-play');
  const cues = [...employer.querySelectorAll('[data-work-preview]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const desktopDock = matchMedia(isLaptop ? '(min-width: 1260px) and (min-height: 600px)' : '(min-width: 1181px) and (min-height: 600px)');
  let selected = preview.dataset.initialPreview || 'payments';
  let active = 0;
  let visible = false;
  let intent = false;
  let pinned = false;
  let releaseTimer;
  let request = 0;
  let phoneMotion;
  let captionMotion;
  let openingMotion;
  let employerOpen = false;
  let introduced = false;
  let positionFrame = 0;
  let openingTimer = 0;
  let scrollFrame = 0;
  let framed = false;
  let phone3d = null;
  let phone3dRequested = false;
  let phone3dLoading = null;
  let mobileFrameVersion = 0;

  async function ensurePhone3D() {
    if (isLaptop || phone3dRequested) return;
    phone3dRequested = true;
    if (navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return;
    try {
      const { createPhone3D } = await import('./work-phone-3d.js');
      phone3d = await createPhone3D({
        element: phone, layers, angles: phoneAngles, getSelected: () => selected,
        reduced: () => reduced.matches, onError: () => { phone3d = null; }
      });
      phone3d?.select(selected, true);
      phone3d?.setVisible(visible && employerOpen && introduced && !preview.hidden);
    } catch { /* Keep the existing flat phone if WebGL or the module is unavailable. */ }
  }

  function positionPreview() {
    positionFrame = 0;
    if (!employerOpen || !introduced) {
      preview.hidden = true;
      visible = false;
      phone3d?.setVisible(false);
      return;
    }
    preview.hidden = false;
    if (desktopDock.matches) {
      const row = employer.getBoundingClientRect();
      preview.hidden = row.bottom < 24 || row.top > innerHeight - 24;
      if (preview.hidden) { visible = false; phone3d?.setVisible(false); pause(); return; }
      if (!isLaptop) {
        const availableWidth = Math.max(1, innerWidth - row.right - 48);
        const phoneWidth = Math.min(300, Math.max(180, (innerHeight - 180) * .42), availableWidth);
        preview.style.setProperty('--work-phone-width', `${Math.round(phoneWidth)}px`);
      }
      const width = preview.offsetWidth;
      const height = preview.offsetHeight;
      const left = isLaptop
        ? Math.min(row.right + 38, innerWidth - width - 24)
        : row.right + (innerWidth - row.right - width) / 2;
      const top = isLaptop
        ? Math.max(72, Math.min(row.top + 104, innerHeight - height - 88))
        : Math.max(56, Math.min(100, (innerHeight - height) / 2 - 8));
      preview.style.setProperty('--work-preview-left', `${Math.round(left)}px`);
      preview.style.setProperty('--work-preview-top', `${Math.round(top)}px`);
    }
    const bounds = preview.getBoundingClientRect();
    visible = bounds.bottom > 0 && bounds.top < innerHeight && bounds.width > 0;
    phone3d?.setVisible(visible);
  }

  function schedulePosition() {
    if (!positionFrame) positionFrame = requestAnimationFrame(positionPreview);
  }

  function dockPreview() {
    preview.classList.toggle('is-docked', desktopDock.matches);
    const parent = desktopDock.matches ? section : employer;
    if (preview.parentElement !== parent) parent.append(preview);
    positionPreview();
  }

  function cancelOpeningScroll() {
    mobileFrameVersion += 1;
    clearTimeout(openingTimer);
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }

  async function frameMobilePreview() {
    const version = ++mobileFrameVersion;
    const animations = employer.querySelector('.entry-panel')?.getAnimations() || [];
    if (openingMotion) animations.push(openingMotion);
    await Promise.allSettled(animations.map(animation => animation.finished));
    await Promise.race([
      phone3dLoading || Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (version !== mobileFrameVersion || desktopDock.matches || !employerOpen || preview.hidden || document.hidden) return;
    const bounds = preview.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || innerHeight;
    const viewportTop = window.visualViewport?.offsetTop || 0;
    // Reserve room for the fixed bottom fade as well as the caption and controls.
    const top = viewportTop + 24 + Math.max(0, (viewportHeight - 120 - bounds.height) / 2);
    const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const destination = Math.min(limit, Math.max(0, scrollY + bounds.top - top));
    window.scrollTo({ top: destination, behavior: reduced.matches ? 'instant' : 'smooth' });
  }

  function frameStory() {
    if (!desktopDock.matches || !employerOpen || framed) return;
    framed = true;
    openingTimer = setTimeout(() => {
      if (!employerOpen) { cancelOpeningScroll(); return; }
      const row = employer.getBoundingClientRect();
      if (row.top >= 48 && row.top <= 112) { cancelOpeningScroll(); return; }
      const from = scrollY;
      const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const to = Math.min(limit, Math.max(0, from + row.top - 76));
      if (Math.abs(to - from) < 32) { cancelOpeningScroll(); return; }
      if (reduced.matches) {
        window.scrollTo({ top: to, behavior: 'instant' });
        cancelOpeningScroll();
        positionPreview();
        return;
      }
      const start = performance.now();
      const move = now => {
        const t = Math.min(1, (now - start) / 540);
        const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        window.scrollTo({ top: from + (to - from) * eased, behavior: 'instant' });
        if (t < 1) scrollFrame = requestAnimationFrame(move);
        else cancelOpeningScroll();
      };
      scrollFrame = requestAnimationFrame(move);
    }, reduced.matches ? 0 : 660);
  }

  function syncEmployer() {
    const open = employer.classList.contains('is-hot') || employer.classList.contains('is-open');
    if (open === employerOpen) { schedulePosition(); return; }
    employerOpen = open;
    introduced = false;
    visible = false;
    phone3d?.setVisible(false);
    openingMotion?.cancel();
    preview.hidden = true;
    if (open) {
      dockPreview();
      warmPreviews();
      frameStory();
    } else {
      cancelOpeningScroll();
      pause(true);
    }
  }

  // Each project keeps its own player, so returning to it does not reload the clip.
  const initialPoster = screen.querySelector('.work-poster');
  const initialVideo = screen.querySelector('video');
  const keys = [...new Set(cues.map(cue => cue.dataset.workPreview))];
  const layers = keys.map((key, index) => {
    const element = document.createElement('div');
    element.className = 'work-clip-layer';
    element.style.opacity = index === 0 ? '1' : '0';
    element.setAttribute('aria-hidden', String(index !== 0));
    const poster = index === 0 ? initialPoster : initialPoster.cloneNode();
    poster.src = projects[key].poster;
    poster.alt = projects[key].alt;
    const video = index === 0 ? initialVideo : document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = projects[key].poster;
    video.setAttribute('aria-label', projects[key].title + ': illustrative product interaction recording');
    element.append(poster, video);
    screen.prepend(element);
    return { element, poster, video, key, loaded: false, motion: null };
  });

  function loadLayer(layer) {
    if (layer.loaded) return;
    layer.loaded = true;
    layer.video.preload = navigator.connection?.saveData ? 'metadata' : 'auto';
    layer.video.src = projects[layer.key].video;
    layer.video.load();
  }

  function warmPreviews() {
    phone3dLoading ||= ensurePhone3D();
    layers.forEach(layer => {
      layer.poster.loading = 'eager';
      if (!navigator.connection?.saveData || layer === layers[active]) loadLayer(layer);
    });
  }

  function pause(clearIntent = false) {
    request += 1;
    layers.forEach(layer => layer.video.pause());
    preview.classList.remove('is-playing');
    toggle.textContent = 'Play preview';
    toggle.setAttribute('aria-label', 'Play ' + projects[selected].title + ' preview');
    if (clearIntent) {
      intent = pinned = false;
      cues.forEach(cue => cue.setAttribute('aria-pressed', 'false'));
    }
  }

  function handoff(key) {
    if (key === selected) return;
    pause();
    const outgoing = layers[active];
    const next = layers.findIndex(layer => layer.key === key);
    active = next;
    const incoming = layers[active];
    selected = key;
    const project = projects[key];
    const layerOpacities = layers.map(layer => Number(getComputedStyle(layer.element).opacity));
    layers.forEach(layer => { layer.motion?.cancel(); layer.motion = null; });
    layers.forEach(layer => {
      if (layer !== incoming && layer !== outgoing) {
        layer.element.style.opacity = '0';
        layer.element.setAttribute('aria-hidden', 'true');
      }
    });
    incoming.element.style.opacity = '1';
    incoming.element.style.zIndex = '2';
    incoming.element.setAttribute('aria-hidden', 'false');
    outgoing.element.style.opacity = '0';
    outgoing.element.style.zIndex = '1';
    outgoing.element.setAttribute('aria-hidden', 'true');
    title.textContent = project.title;
    meta.textContent = 'Illustrative concept / looping demo';
    phoneMotion?.cancel();
    phone3d?.select(key, reduced.matches);
    captionMotion?.cancel();
    if (!reduced.matches) {
      if (isLaptop) {
        incoming.motion = incoming.element.animate([
          { opacity: .3, transform: 'translateY(10px) scale(1.01)' },
          { opacity: 1, transform: 'translateY(2px) scale(1.002)', offset: .28 },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 780, easing: 'cubic-bezier(.22,1,.36,1)' });
        outgoing.motion = outgoing.element.animate([
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-4px)' }
        ], { duration: 180, easing: 'ease-out' });
      } else {
        // Let the turn lead, crossfade mid-turn, then settle together.
        // Retain partial fades when another project interrupts the transition.
        layers.forEach((layer, index) => {
          const from = layerOpacities[index];
          const to = layer === incoming ? 1 : 0;
          layer.element.style.zIndex = layer === incoming ? '2' : '1';
          if (from === to) return;
          layer.motion = layer.element.animate([
            { opacity: from },
            { opacity: from, offset: .12, easing: 'ease-in-out' },
            { opacity: to, offset: .55 },
            { opacity: to }
          ], { duration: 1150, easing: 'linear' });
        });
      }
      if (isLaptop) {
        phoneMotion = phone.animate([
          { transform: 'perspective(1100px) rotateY(0deg) rotateZ(0deg)' },
          { transform: 'perspective(1100px) rotateY(-1.3deg) rotateZ(-.3deg)', offset: .25 },
          { transform: 'perspective(1100px) rotateY(0deg) rotateZ(0deg)' }
        ], { duration: 850, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
      captionMotion = caption.animate([
        { opacity: .6, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }

  async function play(explicit = false) {
    positionPreview();
    if (!visible || document.hidden || (!explicit && reduced.matches)) return;
    const layer = layers[active];
    loadLayer(layer);
    if (!layer.video.paused && layer.element.classList.contains('is-ready')) return;
    const id = ++request;
    try {
      await layer.video.play();
      if (id !== request || layer !== layers[active] || !visible || document.hidden || !intent) {
        if (layer !== layers[active] || !intent || !visible || document.hidden) layer.video.pause();
        return;
      }
      layer.element.classList.add('is-ready');
      preview.classList.add('is-playing');
      toggle.textContent = 'Pause preview';
      toggle.setAttribute('aria-label', 'Pause ' + projects[selected].title + ' preview');
      meta.textContent = 'Illustrative concept / looping demo';
    } catch {
      if (id !== request) return;
      pause();
      meta.textContent = 'Illustrative concept / tap play to preview';
    }
  }

  function select(key, explicit = false) {
    clearTimeout(releaseTimer);
    cancelOpeningScroll();
    syncEmployer();
    if (!employerOpen) return;
    const firstIntroduction = !introduced;
    introduced = true;
    positionPreview();
    handoff(key);
    if (firstIntroduction && !reduced.matches && !preview.hidden) {
      openingMotion?.cancel();
      openingMotion = preview.animate([
        { opacity: 0, translate: '0 12px' },
        { opacity: 1, translate: '0 0' }
      ], { duration: 480, easing: 'cubic-bezier(.22,.68,0,1)' });
    }
    intent = true;
    cues.forEach(cue => cue.setAttribute('aria-pressed', String(cue.dataset.workPreview === key)));
    play(explicit);
  }

  function release() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (pinned || employer.matches(':hover') || preview.matches(':hover') || employer.contains(document.activeElement) || preview.contains(document.activeElement)) return;
      pause(true);
    }, 500);
  }

  cues.forEach(cue => {
    cue.addEventListener('pointerenter', () => {
      if (!fine.matches) return;
      clearTimeout(releaseTimer);
      pinned = false;
      select(cue.dataset.workPreview);
    });
    cue.addEventListener('pointerleave', release);
    cue.addEventListener('focus', () => select(cue.dataset.workPreview));
    cue.addEventListener('blur', release);
    cue.addEventListener('click', () => {
      select(cue.dataset.workPreview, true);
      pinned = true;
      if (!desktopDock.matches) frameMobilePreview();
    });
  });
  preview.addEventListener('pointerenter', () => clearTimeout(releaseTimer));
  preview.addEventListener('pointerleave', release);
  employer.addEventListener('pointerleave', release);
  toggle.addEventListener('click', () => {
    if (!layers[active].video.paused) pause(true);
    else { select(selected, true); pinned = true; }
  });
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      clearTimeout(releaseTimer);
      pause(true);
    }
  });
  layers.forEach(layer => layer.video.addEventListener('error', () => {
    if (layer !== layers[active] || !layer.loaded) return;
    pause();
    layer.element.classList.remove('is-ready');
    meta.textContent = 'Illustrative concept / preview unavailable';
  }));
  new IntersectionObserver(entries => {
    visible = employerOpen && introduced && entries[0].isIntersecting;
    phone3d?.setVisible(visible && !preview.hidden);
    if (!visible) pause();
    else if (intent) play(pinned);
  }, { threshold: .05 }).observe(preview);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    cancelOpeningScroll();
    layers.forEach(layer => layer.motion?.cancel());
    phoneMotion?.cancel();
    captionMotion?.cancel();
    pause(true);
    openingMotion?.cancel();
    phone3d?.select(selected, true);
  });
  new MutationObserver(syncEmployer).observe(employer, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('entry:activate', event => {
    if (event.detail.item !== employer) cancelOpeningScroll();
  });
  desktopDock.addEventListener('change', () => { cancelOpeningScroll(); dockPreview(); });
  window.addEventListener('resize', schedulePosition, { passive: true });
  window.addEventListener('scroll', schedulePosition, { passive: true });
  window.addEventListener('wheel', cancelOpeningScroll, { passive: true });
  window.addEventListener('touchstart', cancelOpeningScroll, { passive: true });
  window.addEventListener('keydown', event => {
    if (['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelOpeningScroll();
  });
  preview.hidden = true;
  dockPreview();
  syncEmployer();
  });
})();
