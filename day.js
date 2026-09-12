(() => {
  // Illustrative weekday. Hours are Bangalore time; an end above 24 crosses midnight.
  const routine = [
    { id:'move', start:7, end:8, title:'A little movement', short:'Movement', emoji:'🏃', copy:'An hour away from a screen. A workout, a walk, or simply getting the body moving before the day gets busy.', tone:'#e67e61' },
    { id:'morning', start:8, end:9, title:'A slow start', short:'Breakfast & a reset', emoji:'☕', copy:'Breakfast, a little catching up, and some room to think. Not every minute needs to be productive.', tone:'#d3a34e' },
    { id:'make', start:9, end:12.5, title:'Time to make', short:'Deep work', emoji:'🎯', copy:'The quieter stretch: working through a product problem, trying a few directions, and getting close to the details.', tone:'#de7549' },
    { id:'pause', start:12.5, end:13.5, title:'A proper pause', short:'Lunch & a breather', emoji:'🥗', copy:'Step away, eat something good, and let the morning settle. A little distance usually brings a clearer perspective.', tone:'#83aa75' },
    { id:'together', start:13.5, end:18, title:'Better, together', short:'Design & collaboration', emoji:'💬', copy:'Conversations, critique, and making things with the team. Turning individual ideas into something that holds together.', tone:'#709bc1' },
    { id:'outside', start:18, end:20, title:'Life outside the tabs', short:'Unplug & dinner', emoji:'🌿', copy:'A change of scene, a meal, and time with people. Leaving some space between the workday and the rest of the day.', tone:'#5fa391' },
    { id:'own', start:20, end:23, title:'Something of my own', short:'Personal projects', emoji:'🎬', copy:'A film to edit, a small tool to build, or a sketch to return to. Following an idea without needing it to go anywhere.', tone:'#cd8d78' },
    { id:'rest', start:23, end:31, title:'Nothing to do but rest', short:'Switch off', emoji:'🌙', copy:'Screens down. The unfinished things can wait. A little quiet, then enough sleep to begin again.', tone:'#7b909e' }
  ];
  const $ = id => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  const clock = document.querySelector('.day-clock');
  const arcRoot = $('day-arcs');
  const instrument = document.querySelector('.day-instrument');
  const agenda = $('day-agenda');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', weekday:'short', day:'numeric', month:'short' });
  const elements = new Map();
  let liveId = null;
  let selectedId = null;
  let pinnedId = null;
  let previewId = null;
  let timer = 0;
  let lastAngle = null;
  let displayedDate = '';
  let detailAnimation = null;

  function node(name, attrs, parent) {
    const el = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    parent.append(el);
    return el;
  }
  function point(hours, radius) {
    const radians = ((hours - 12) * 15 - 90) * Math.PI / 180;
    return [360 + Math.cos(radians) * radius, 360 + Math.sin(radians) * radius];
  }
  function arc(start, end, radius) {
    const a = point(start, radius), b = point(end, radius);
    return `M${a[0]} ${a[1]} A${radius} ${radius} 0 ${end - start > 12 ? 1 : 0} 1 ${b[0]} ${b[1]}`;
  }
  function hourLabel(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.round((hour % 1) * 60);
    return `${h % 12 || 12}${m ? ':' + String(m).padStart(2,'0') : ''}${h >= 12 ? 'pm' : 'am'}`;
  }
  function duration(hours) {
    const h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return `${h ? h + 'h' : ''}${h && m ? ' ' : ''}${m ? m + 'm' : ''}`;
  }

  for (let tick = 0; tick < 96; tick++) {
    const h = tick / 4;
    const major = tick % 24 === 0;
    const hourly = tick % 4 === 0;
    const a = point(h, major ? 314 : hourly ? 319 : 324), b = point(h, 329);
    node('line', { x1:a[0], y1:a[1], x2:b[0], y2:b[1], class:`day-tick${major ? ' is-quarter' : hourly ? ' is-hour' : ''}` }, $('day-ticks'));
  }
  for (let h = 0; h < 24; h++) {
    const quarter = h % 6 === 0;
    const [x,y] = point(h, 291);
    const label = node('text', { x, y:quarter ? y - 4 : y, class:`day-numeral${quarter ? ' is-quarter' : ''}` }, $('day-numerals'));
    label.textContent = h % 12 || 12;
    if (quarter) node('text', { x, y:y + 16, class:'day-meridiem' }, $('day-numerals')).textContent = h < 12 ? 'AM' : 'PM';
  }

  function show(id) {
    if (!id || selectedId === id) return;
    selectedId = id;
    const item = routine.find(entry => entry.id === id);
    instrument.style.setProperty('--day-selection', item.tone);
    elements.forEach((el, key) => {
      const active = key === id;
      el.arc.classList.toggle('is-selected', active);
      el.arc.setAttribute('aria-pressed', String(active));
      el.button.setAttribute('aria-pressed', String(active));
    });
    $('day-detail-time').textContent = `${hourLabel(item.start)} - ${hourLabel(item.end)}`;
    $('day-detail-title').textContent = item.short;
    $('day-detail-emoji').textContent = item.emoji;
    detailAnimation?.cancel();
    if (!reduced.matches) detailAnimation = $('day-detail').animate([{ opacity:.35, transform:'translateY(3px)' }, { opacity:1, transform:'translateY(0)' }], { duration:260, easing:'cubic-bezier(.2,.8,.2,1)' });
  }
  function sync() {
    const exploring = Boolean(previewId || pinnedId);
    clock.classList.toggle('is-exploring', exploring);
    instrument.classList.toggle('has-pinned-activity', Boolean(pinnedId));
    elements.forEach((el, id) => el.arc.classList.toggle('is-pinned', id === pinnedId));
    show(previewId || pinnedId || liveId);
  }
  function pin(id) {
    pinnedId = pinnedId === id ? null : id;
    previewId = null;
    sync();
  }
  routine.forEach((item, index) => {
    const path = arc(item.start + .18, item.end - .18, 253);
    const group = node('g', { class:'day-arc', tabindex:'0', role:'button', 'aria-pressed':'false', 'aria-label':`${item.short}, ${hourLabel(item.start)} to ${hourLabel(item.end)}` }, arcRoot);
    group.style.setProperty('--arc-color', item.tone);
    node('path', { d:path, class:'day-arc-hit' }, group);
    node('path', { d:path, class:'day-arc-color' }, group);
    node('path', { d:path, class:'day-arc-sheen' }, group);
    const [markerX, markerY] = point((item.start + item.end) / 2, 217);
    const marker = node('g', { transform:`translate(${markerX} ${markerY})`, 'aria-hidden':'true' }, group);
    const face = node('g', { class:'day-arc-marker' }, marker);
    node('circle', { cx:0, cy:0, r:14, class:'day-marker-disc' }, face);
    node('text', { x:0, y:1, class:'day-marker-emoji' }, face).textContent = item.emoji;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.style.setProperty('--arc-color', item.tone);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="day-agenda-emoji" aria-hidden="true">${item.emoji}</span><span>${item.short}</span><span class="day-agenda-time">${hourLabel(item.start)}</span>`;
    li.append(button);
    agenda.append(li);
    elements.set(item.id, { arc:group, button });
    [group,button].forEach(el => {
      el.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { previewId = item.id; sync(); } });
      el.addEventListener('pointerleave', () => { previewId = null; sync(); });
      el.addEventListener('focus', () => { previewId = item.id; sync(); });
      el.addEventListener('blur', () => { previewId = null; sync(); });
      el.addEventListener('click', () => pin(item.id));
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pin(item.id); }
      if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const direction = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
        elements.get(routine[(index + direction + routine.length) % routine.length].id).arc.focus();
      }
    });
  });
  function reset() { pinnedId = null; previewId = null; sync(); }
  $('day-live').addEventListener('click', reset);
  clock.addEventListener('click', event => { if (!event.target.closest('.day-arc')) reset(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') reset(); });
  const liveProgress = node('path', { class:'day-live-progress', 'aria-hidden':'true' }, arcRoot);

  function tick() {
    clearTimeout(timer);
    if (document.hidden) return;
    const now = new Date();
    const parts = Object.fromEntries(timeFormat.formatToParts(now).map(part => [part.type,part.value]));
    const h = Number(parts.hour), m = Number(parts.minute), s = Number(parts.second);
    const hours = h + m / 60 + s / 3600;
    $('day-time').textContent = `${h % 12 || 12}:${parts.minute}`;
    $('day-seconds').textContent = parts.second;
    $('day-period').textContent = h >= 12 ? 'PM' : 'AM';
    document.querySelector('.day-time').setAttribute('aria-label', `${h % 12 || 12}:${parts.minute} ${h >= 12 ? 'PM' : 'AM'}, Bangalore time`);
    const date = dateFormat.format(now);
    if (date !== displayedDate) { $('day-date').textContent = date; displayedDate = date; }
    let angle = (hours - 12) * 15;
    if (lastAngle !== null) {
      while (angle < lastAngle - 180) angle += 360;
      while (angle > lastAngle + 180) angle -= 360;
    } else $('day-hand').style.transition = 'none';
    $('day-hand').style.transform = `rotate(${angle}deg)`;
    if (lastAngle === null) requestAnimationFrame(() => requestAnimationFrame(() => $('day-hand').style.removeProperty('transition')));
    lastAngle = angle;
    const item = routine.find(entry => { const t = hours < entry.start ? hours + 24 : hours; return t >= entry.start && t < entry.end; });
    const currentHour = hours < item.start ? hours + 24 : hours;
    const progress = (currentHour - item.start) / (item.end - item.start);
    $('day-progress').style.transform = `scaleX(${progress})`;
    const progressStart = item.start + .18;
    const progressEnd = Math.min(currentHour, item.end - .18);
    liveProgress.setAttribute('d', progressEnd > progressStart ? arc(progressStart, progressEnd, 239) : '');
    if (item.id !== liveId) {
      liveId = item.id;
      instrument.style.setProperty('--day-live-color', item.tone);
      $('day-now-title').textContent = item.short;
      elements.forEach((el,key) => el.button.classList.toggle('is-now', key === liveId));
      sync();
    }
    timer = setTimeout(tick, 1000 - Date.now() % 1000 + 15);
  }
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', tick);
  tick();
})();
