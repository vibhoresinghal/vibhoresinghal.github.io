(() => {
  const canvas = document.querySelector(".creation-canvas");
  const world = document.querySelector(".creation-world");
  const grid = document.querySelector(".creation-grid");
  const focusLayer = document.querySelector(".creation-focus");
  const count = document.querySelector(".creation-count");
  if (!canvas || !world || !grid || !focusLayer) return;

  const CELL_X = 236;
  const CELL_Y = 248;
  const OVERSCAN = 820;
  const MIN_SCALE = 0.46;
  const MAX_SCALE = 1.75;
  const MAX_TILES = 720;
  const active = new Map();
  const tilePool = [];
  const styleCache = new WeakMap();
  const pointers = new Map();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = window.innerWidth;
  let height = window.innerHeight;
  const home = { x: width * 0.5, y: height * 0.5, scale: 0.9 };
  const camera = { ...home };
  const target = { ...home };
  const inertia = { x: 0, y: 0 };
  const motion = { x: 0, y: 0, speed: 0, blur: 0 };
  const steer = { x: 0, y: 0, active: false };

  let dragging = false;
  let dragMoved = false;
  let lastPointer = null;
  let pinch = null;
  let lastRange = "";
  let lastTime = performance.now();
  let fps = 60;
  let fpsFrames = 0;
  let fpsTime = lastTime;
  let statusTime = 0;
  let slowSamples = 0;
  let focusFrame = 0;
  let frameId = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;

  const hash = (x, y, salt = 0) => {
    let n = Math.imul(x ^ salt, 374761393) + Math.imul(y + salt, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  };

  const tilePhotos = [
    { src: "images/creations/a.jpg", label: "A" },
    { src: "images/creations/b.jpg", label: "B" },
    { src: "images/creations/c.jpg", label: "C" },
    { src: "images/creations/d.jpg", label: "D" },
    { src: "images/creations/e.jpg", label: "E" },
    { src: "images/creations/f.jpg", label: "F" },
    { src: "images/creations/g.jpg", label: "G" },
    { src: "images/creations/h.jpg", label: "H" },
    { src: "images/creations/i.jpg", label: "I" },
    { src: "images/creations/j.jpg", label: "J" },
    { src: "images/creations/k.jpg", label: "K" },
    { src: "images/creations/l.jpg", label: "L" },
    { src: "images/creations/m.jpg", label: "M" },
    { src: "images/creations/n.jpg", label: "N" },
    { src: "images/creations/o.jpg", label: "O" },
    { src: "images/creations/p.jpg", label: "P" },
    { src: "images/creations/q.jpg", label: "Q" },
    { src: "images/creations/r.jpg", label: "R" },
    { src: "images/creations/s.jpg", label: "S" },
    { src: "images/creations/t.jpg", label: "T" },
    { src: "images/creations/u.jpg", label: "U" },
    { src: "images/creations/v.jpg", label: "V" },
    { src: "images/creations/w.jpg", label: "W" },
    { src: "images/creations/x.jpg", label: "X" },
    { src: "images/creations/y.jpg", label: "Y" },
    { src: "images/creations/z.jpg", label: "Z" },
    { src: "images/creations/basketball.jpg", label: "Basketball" },
    { src: "images/creations/football.jpg", label: "Football" },
    { src: "images/creations/lawn-tennis.jpg", label: "Lawn Tennis" },
    { src: "images/creations/cricket.jpg", label: "Cricket" },
    { src: "images/creations/badminton.jpg", label: "Badminton" },
    { src: "images/creations/boxing.jpg", label: "Boxing" },
    { src: "images/creations/volleyball.jpg", label: "Volleyball" },
    { src: "images/creations/swimming.jpg", label: "Swimming" },
    { src: "images/creations/track.jpg", label: "Track" },
    { src: "images/creations/firefighter.jpg", label: "Firefighter" },
    { src: "images/creations/singer.jpg", label: "Singer" },
    { src: "images/creations/intelligent-car.jpg", label: "Intelligent car" },
    { src: "images/creations/iso.jpg", label: "Iso" },
    { src: "images/creations/img-0112.jpg", label: "Flamingo" },
    { src: "images/creations/windmill.jpg", label: "Windmill" },
    { src: "images/creations/doggo-1.jpg", label: "Doggo" },
    { src: "images/creations/first-grain.jpg", label: "First grain" },
    { src: "images/creations/skateboard.jpg", label: "Skateboard" },
    { src: "images/creations/calavera.jpg", label: "Calavera" },
    { src: "images/creations/day-of-the-dead.jpg", label: "Day of the Dead" },
    { src: "images/creations/caged-heart.jpg", label: "Caged heart" },
    { src: "images/creations/gold-ball.jpg", label: "Gold ball" },
    { src: "images/creations/lowpoly-rose.jpg", label: "Rose" }
  ];

  const requestedPhotos = new Set();
  const readyPhotos = new Set();
  let prefetchQueue = [];
  let prefetchTimer = null;
  let prefetching = 0;

  const setStyle = (element, property, value) => {
    let cache = styleCache.get(element);
    if (!cache) {
      cache = new Map();
      styleCache.set(element, cache);
    }
    if (cache.get(property) === value) return;
    cache.set(property, value);
    element.style.setProperty(property, value);
  };

  const showPhoto = (tile, priority) => {
    const src = tilePhotos[tile._creationData.image].src;
    const image = tile._image;
    if (image.fetchPriority !== priority) image.fetchPriority = priority;
    if (image.getAttribute("src") !== src) image.src = src;
    requestedPhotos.add(src);
  };

  // Include enlarged cards and their shadows before they reach the viewport.
  const isNearViewport = (data) => {
    const x = camera.x + (data.x + data.width / 2) * camera.scale;
    const y = camera.y + (data.y + data.height / 2) * camera.scale;
    const margin = 160 * camera.scale + 120;
    return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
  };

  const schedulePrefetch = () => {
    if (prefetchTimer !== null || prefetching >= 2 || !prefetchQueue.length) return;
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = null;
      while (prefetching < 2 && prefetchQueue.length) {
        const src = prefetchQueue.shift();
        if (requestedPhotos.has(src)) continue;
        requestedPhotos.add(src);
        prefetching += 1;
        const image = new Image();
        image.decoding = "async";
        image.fetchPriority = "low";
        const finish = (loaded) => {
          image.onload = image.onerror = null;
          prefetching -= 1;
          if (loaded) {
            readyPhotos.add(src);
            active.forEach((tile) => {
              if (tilePhotos[tile._creationData.image].src === src) showPhoto(tile, "low");
            });
          } else {
            requestedPhotos.delete(src);
          }
          schedulePrefetch();
        };
        image.onload = () => finish(true);
        image.onerror = () => finish(false);
        image.src = src;
      }
    }, 150);
  };

  const prioritizePhotos = () => {
    const nearby = new Map();
    active.forEach((tile) => {
      const data = tile._creationData;
      const src = tilePhotos[data.image].src;
      if (isNearViewport(data)) {
        showPhoto(tile, "high");
      } else if (readyPhotos.has(src)) {
        showPhoto(tile, "low");
      } else if (!requestedPhotos.has(src)) {
        const dx = camera.x + (data.x + data.width / 2) * camera.scale - width / 2;
        const dy = camera.y + (data.y + data.height / 2) * camera.scale - height / 2;
        nearby.set(src, Math.min(nearby.get(src) ?? Infinity, dx * dx + dy * dy));
      }
    });
    prefetchQueue = [...nearby].sort((a, b) => a[1] - b[1]).map(([src]) => src);
    schedulePrefetch();
  };

  const tileData = (cellX, cellY) => {
    const seed = hash(cellX, cellY);
    const tileWidth = 148;
    const tileHeight = 148;
    return {
      key: `${cellX}:${cellY}`,
      x: cellX * CELL_X - tileWidth * 0.5,
      y: cellY * CELL_Y - tileHeight * 0.5,
      width: tileWidth,
      height: tileHeight,
      rotate: 0,
      depth: 1,
      shadow: 0.04,
      image: seed % tilePhotos.length,
      number: String((seed % 999) + 1).padStart(3, "0")
    };
  };

  const focusFor = (data) => {
    const centerX = camera.x + (data.x + data.width * 0.5) * camera.scale;
    const centerY = camera.y + (data.y + data.height * 0.5) * camera.scale;
    const focalX = width * 0.5;
    const focalY = height * 0.48;
    const dx = centerX - focalX;
    const dy = centerY - focalY;
    const nx = dx / Math.max(1, width * 0.55);
    const ny = dy / Math.max(1, height * 0.57);
    const radius = Math.hypot(nx, ny);
    const emphasis = Math.exp(-radius * radius * 2.15);
    const scale = 0.72 + emphasis * 1.22;
    const distance = Math.hypot(dx, dy);
    const grow = Math.max(0, scale - 1);
    const push = distance * (0.24 + grow * 0.62);
    const den = Math.max(1, distance);
    return {
      scale,
      opacity: 0.58 + emphasis * 0.42,
      zIndex: Math.round(emphasis * 10),
      x: (dx / den) * push / camera.scale,
      y: (dy / den) * push / camera.scale
    };
  };

  const applyFocus = (tile, focus) => {
    setStyle(tile, "--focus-scale", focus.scale.toFixed(3));
    setStyle(tile, "--focus-opacity", focus.opacity.toFixed(3));
    setStyle(tile, "--focus-x", `${focus.x.toFixed(2)}px`);
    setStyle(tile, "--focus-y", `${focus.y.toFixed(2)}px`);
    setStyle(tile, "z-index", String(focus.zIndex));
    const captioned = focus.scale > 1.45;
    if (tile._captioned !== captioned) {
      tile.classList.toggle("is-captioned", captioned);
      tile._captioned = captioned;
    }
  };

  const makeTile = (data) => {
    const tile = tilePool.pop() || document.createElement("button");
    if (!tile._image) {
      tile.type = "button";
      tile.className = "creation-tile";
      tile.innerHTML = `
        <span class="creation-tile-frame">
          <img alt="" draggable="false" decoding="async">
        </span>
        <span class="creation-tile-label"></span>
      `;
      tile._image = tile.querySelector("img");
      tile._label = tile.querySelector(".creation-tile-label");
      tile._image.addEventListener("load", () => {
        const src = tile._image.getAttribute("src");
        if (src) readyPhotos.add(src);
      });
    }
    tile.dataset.key = data.key;
    tile.setAttribute("aria-label", tilePhotos[data.image].label);
    tile.style.setProperty("--tile-x", `${data.x}px`);
    tile.style.setProperty("--tile-y", `${data.y}px`);
    tile.style.setProperty("--tile-w", `${data.width}px`);
    tile.style.setProperty("--tile-h", `${data.height}px`);
    tile.style.setProperty("--tile-rotate", `${data.rotate.toFixed(2)}deg`);
    tile.style.setProperty("--tile-shadow", data.shadow.toFixed(3));
    tile._creationData = data;
    const focus = focusFor(data);
    applyFocus(tile, focus);
    tile._label.textContent = tilePhotos[data.image].label;
    return tile;
  };

  const visibleRange = (fullBuffer = false) => {
    const base = fullBuffer ? OVERSCAN : 360;
    const leadX = fullBuffer ? 0 : clamp(motion.x * 24, -460, 460);
    const leadY = fullBuffer ? 0 : clamp(motion.y * 24, -460, 460);
    const minX = (-camera.x - base - Math.max(0, leadX)) / camera.scale;
    const maxX = (width - camera.x + base + Math.max(0, -leadX)) / camera.scale;
    const minY = (-camera.y - base - Math.max(0, leadY)) / camera.scale;
    const maxY = (height - camera.y + base + Math.max(0, -leadY)) / camera.scale;
    return {
      left: Math.floor(minX / CELL_X),
      right: Math.ceil(maxX / CELL_X),
      top: Math.floor(minY / CELL_Y),
      bottom: Math.ceil(maxY / CELL_Y)
    };
  };

  const reconcileTiles = (force = false) => {
    const range = visibleRange();
    // Keep the original density thresholds even though fewer offscreen tiles mount.
    const densityRange = visibleRange(true);
    let stride = camera.scale < 0.55 ? 2 : 1;
    const columns = densityRange.right - densityRange.left + 1;
    const rows = densityRange.bottom - densityRange.top + 1;
    while (Math.ceil(columns / stride) * Math.ceil(rows / stride) > MAX_TILES) stride += 1;
    const rangeKey = `${range.left}:${range.right}:${range.top}:${range.bottom}:${stride}`;
    if (!force && rangeKey === lastRange) return;
    lastRange = rangeKey;

    const wanted = new Set();
    const additions = [];
    let visited = 0;
    const startX = Math.floor(range.left / stride) * stride;
    const startY = Math.floor(range.top / stride) * stride;

    for (let y = startY; y <= range.bottom && visited < MAX_TILES; y += stride) {
      for (let x = startX; x <= range.right && visited < MAX_TILES; x += stride) {
        visited += 1;
        const key = `${x}:${y}`;
        wanted.add(key);
        if (!active.has(key)) {
          const data = tileData(x, y);
          additions.push(data);
        }
      }
    }

    active.forEach((tile, key) => {
      if (wanted.has(key)) return;
      if (tile === document.activeElement) return;
      tile.remove();
      active.delete(key);
      tile._image.removeAttribute("src");
      if (tilePool.length < 128) tilePool.push(tile);
    });

    if (additions.length) {
      const fragment = document.createDocumentFragment();
      additions.forEach((data) => {
        const tile = makeTile(data);
        active.set(data.key, tile);
        fragment.append(tile);
      });
      world.append(fragment);
    }
    prioritizePhotos();
  };

  const applyCamera = () => {
    setStyle(world, "--camera-x", `${camera.x.toFixed(2)}px`);
    setStyle(world, "--camera-y", `${camera.y.toFixed(2)}px`);
    setStyle(world, "--camera-scale", camera.scale.toFixed(4));
    setStyle(focusLayer, "--edge-energy", (0.72 + motion.blur / 7.5 * 0.28).toFixed(3));
    const gridSize = 18 * camera.scale;
    setStyle(grid, "--grid-size", `${gridSize.toFixed(2)}px`);
    setStyle(grid, "--grid-x", `${(camera.x % gridSize).toFixed(2)}px`);
    setStyle(grid, "--grid-y", `${(camera.y % gridSize).toFixed(2)}px`);
  };

  const updateFocusDepth = () => {
    active.forEach((tile) => {
      const data = tile._creationData;
      if (!data) return;
      applyFocus(tile, focusFor(data));
      if (isNearViewport(data)) showPhoto(tile, "high");
    });
  };

  const updateStatus = (now, force = false) => {
    fpsFrames += 1;
    if (now - fpsTime >= 500) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsTime));
      fpsFrames = 0;
      fpsTime = now;

      slowSamples = fps < 46 ? slowSamples + 1 : 0;

      if (slowSamples >= 3) {
        document.body.classList.add("is-lightweight");
      }
    }
    if (count && (force || now - statusTime > 300)) {
      statusTime = now;
      count.textContent = `${active.size} nearby · ${Math.round(camera.scale * 100)}% · ${fps} fps`;
    }
  };

  const wake = () => {
    if (frameId !== null || document.hidden) return;
    lastTime = performance.now();
    fpsTime = lastTime;
    fpsFrames = 0;
    slowSamples = 0;
    frameId = requestAnimationFrame(frame);
  };

  const frame = (now) => {
    const delta = Math.min(32, now - lastTime) / 16.67;
    lastTime = now;

    if (!dragging && !pinch) {
      if (steer.active && !reduceMotion) {
        target.x -= steer.x * 2.2 * delta;
        target.y -= steer.y * 2.2 * delta;
      }
      target.x += inertia.x * delta;
      target.y += inertia.y * delta;
      inertia.x *= Math.pow(0.82, delta);
      inertia.y *= Math.pow(0.82, delta);
      if (Math.abs(inertia.x) < 0.02) inertia.x = 0;
      if (Math.abs(inertia.y) < 0.02) inertia.y = 0;
    }

    if (reduceMotion) {
      camera.x = target.x;
      camera.y = target.y;
      motion.x = 0;
      motion.y = 0;
    } else {
      const acceleration = 0.08 * delta;
      const damping = Math.pow(0.64, delta);
      motion.x = (motion.x + (target.x - camera.x) * acceleration) * damping;
      motion.y = (motion.y + (target.y - camera.y) * acceleration) * damping;
      camera.x += motion.x * delta;
      camera.y += motion.y * delta;
    }

    const ease = reduceMotion ? 1 : 1 - Math.pow(0.72, delta);
    camera.scale = mix(camera.scale, target.scale, ease);
    motion.speed = Math.hypot(motion.x, motion.y);
    const blurLimit = document.body.classList.contains("is-lightweight") ? 4 : 7.5;
    const blurTarget = reduceMotion ? 0 : clamp((motion.speed - 0.35) * 0.16, 0, blurLimit);
    motion.blur = mix(motion.blur, blurTarget, blurTarget > motion.blur ? 0.24 : 0.1);
    const drifting = !dragging && !pinch && steer.active && !reduceMotion && (steer.x !== 0 || steer.y !== 0);
    const coasting = !dragging && !pinch && (inertia.x !== 0 || inertia.y !== 0);
    const settled = !drifting && !coasting
      && Math.abs(target.x - camera.x) < 0.005
      && Math.abs(target.y - camera.y) < 0.005
      && Math.abs(target.scale - camera.scale) < 0.000001
      && motion.speed < 0.005 && motion.blur < 0.001;
    if (settled) {
      Object.assign(camera, target);
      motion.x = motion.y = motion.speed = motion.blur = 0;
    }
    applyCamera();
    reconcileTiles();
    focusFrame = (focusFrame + 1) % 3;
    if (focusFrame === 0 || settled) updateFocusDepth();
    // Retain the last measured FPS while idle; idle time is not a slow frame.
    updateStatus(now, settled);
    frameId = settled ? null : requestAnimationFrame(frame);
  };

  const midpoint = (points) => ({
    x: (points[0].x + points[1].x) * 0.5,
    y: (points[0].y + points[1].y) * 0.5
  });

  const distance = (points) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);

  const updateSteer = (clientX, clientY) => {
    const deadZone = 0.2;
    const shape = (value) => {
      const amount = Math.abs(value);
      if (amount <= deadZone) return 0;
      const normalized = (amount - deadZone) / (1 - deadZone);
      return Math.sign(value) * normalized * normalized;
    };
    steer.x = shape((clientX / width - 0.5) * 2);
    steer.y = shape((clientY / height - 0.5) * 2);
    steer.active = true;
  };

  const beginPinch = () => {
    const points = [...pointers.values()].slice(0, 2);
    const mid = midpoint(points);
    pinch = {
      distance: Math.max(1, distance(points)),
      scale: target.scale,
      worldX: (mid.x - target.x) / target.scale,
      worldY: (mid.y - target.y) / target.scale
    };
    dragging = false;
    canvas.classList.add("is-dragging");
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    wake();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    inertia.x = 0;
    inertia.y = 0;
    steer.active = false;
    dragMoved = false;

    if (pointers.size === 2) {
      beginPinch();
      return;
    }

    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    wake();
    if (event.pointerType === "mouse" && pointers.size === 0) {
      updateSteer(event.clientX, event.clientY);
      return;
    }
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2 && pinch) {
      event.preventDefault();
      const points = [...pointers.values()].slice(0, 2);
      const mid = midpoint(points);
      const nextScale = clamp(pinch.scale * (distance(points) / pinch.distance), MIN_SCALE, MAX_SCALE);
      target.scale = nextScale;
      target.x = mid.x - pinch.worldX * nextScale;
      target.y = mid.y - pinch.worldY * nextScale;
      dragMoved = true;
      return;
    }

    if (!dragging || !lastPointer) return;
    event.preventDefault();
    const now = performance.now();
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    const elapsed = Math.max(8, now - lastPointer.time);
    target.x += dx;
    target.y += dy;
    const releaseX = clamp((dx / elapsed) * 10, -6, 6);
    const releaseY = clamp((dy / elapsed) * 10, -6, 6);
    inertia.x = mix(inertia.x, releaseX, 0.22);
    inertia.y = mix(inertia.y, releaseY, 0.22);
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    lastPointer = { x: event.clientX, y: event.clientY, time: now };
  });

  const endPointer = (event) => {
    wake();
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const point = [...pointers.values()][0];
      pinch = null;
      dragging = true;
      lastPointer = { ...point, time: performance.now() };
      return;
    }
    if (pointers.size === 0) {
      dragging = false;
      pinch = null;
      lastPointer = null;
      canvas.classList.remove("is-dragging");
      if (event.pointerType === "mouse") updateSteer(event.clientX, event.clientY);
    }
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => {
    if (!dragging) steer.active = false;
    wake();
  });

  const zoomAt = (screenX, screenY, nextScale) => {
    wake();
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldX = (screenX - target.x) / target.scale;
    const worldY = (screenY - target.y) / target.scale;
    target.x = screenX - worldX * scale;
    target.y = screenY - worldY * scale;
    target.scale = scale;
  };

  canvas.addEventListener("wheel", (event) => {
    wake();
    event.preventDefault();
    inertia.x = 0;
    inertia.y = 0;

    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.006);
      zoomAt(event.clientX, event.clientY, target.scale * factor);
      return;
    }

    target.x -= event.deltaX * 0.72;
    target.y -= event.deltaY * 0.72;
  }, { passive: false });

  canvas.addEventListener("click", (event) => {
    const tile = event.target.closest(".creation-tile");
    if (!tile || dragMoved) {
      dragMoved = false;
      return;
    }
    const box = tile.getBoundingClientRect();
    target.x += width * 0.5 - (box.left + box.width * 0.5);
    target.y += height * 0.5 - (box.top + box.height * 0.5);
    zoomAt(width * 0.5, height * 0.5, Math.max(target.scale, 1.08));
  });

  canvas.addEventListener("keydown", (event) => {
    wake();
    const distance = event.shiftKey ? 240 : 90;
    const moves = {
      ArrowLeft: [distance, 0],
      ArrowRight: [-distance, 0],
      ArrowUp: [0, distance],
      ArrowDown: [0, -distance]
    };
    if (moves[event.key]) {
      event.preventDefault();
      target.x += moves[event.key][0];
      target.y += moves[event.key][1];
    }
    if (event.key === "+" || event.key === "=") zoomAt(width / 2, height / 2, target.scale * 1.18);
    if (event.key === "-") zoomAt(width / 2, height / 2, target.scale / 1.18);
    if (event.key === "0" || event.key === "Home") {
      Object.assign(target, home);
      inertia.x = 0;
      inertia.y = 0;
    }
  });

  document.querySelector("[data-action='zoom-in']")?.addEventListener("click", () => {
    zoomAt(width / 2, height / 2, target.scale * 1.2);
  });

  document.querySelector("[data-action='zoom-out']")?.addEventListener("click", () => {
    zoomAt(width / 2, height / 2, target.scale / 1.2);
  });

  document.querySelector("[data-action='reset']")?.addEventListener("click", () => {
    wake();
    Object.assign(target, home);
    inertia.x = 0;
    inertia.y = 0;
  });

  window.addEventListener("resize", () => {
    const oldWidth = width;
    const oldHeight = height;
    width = window.innerWidth;
    height = window.innerHeight;
    const dx = (width - oldWidth) * 0.5;
    const dy = (height - oldHeight) * 0.5;
    camera.x += dx;
    camera.y += dy;
    target.x += dx;
    target.y += dy;
    home.x = width * 0.5;
    home.y = height * 0.5;
    lastRange = "";
    reconcileTiles(true);
    updateFocusDepth();
    wake();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    } else {
      wake();
    }
  });

  reconcileTiles(true);
  applyCamera();
  wake();
})();
