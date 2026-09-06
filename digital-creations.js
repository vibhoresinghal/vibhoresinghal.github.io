(() => {
  const canvas = document.querySelector(".creation-canvas");
  const world = document.querySelector(".creation-world");
  const grid = document.querySelector(".creation-grid");
  const focusLayer = document.querySelector(".creation-focus");
  const count = document.querySelector(".creation-count");
  if (!canvas || !world || !grid || !focusLayer) return;

  const CELL_X = 248;
  const CELL_Y = 198;
  const OVERSCAN = 820;
  const MIN_SCALE = 0.46;
  const MAX_SCALE = 1.75;
  const MAX_TILES = 720;
  const active = new Map();
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

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;

  const hash = (x, y, salt = 0) => {
    let n = Math.imul(x ^ salt, 374761393) + Math.imul(y + salt, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  };

  const tilePhotos = [
    { src: "images/hobbies/virtus-lean.jpg", label: "Veronica" },
    { src: "images/hobbies/virtus-front.jpg", label: "Virtus" },
    { src: "images/hobbies/virtus-wash.jpg", label: "Wash day" },
    { src: "images/hobbies/virtus-street.jpg", label: "Street park" },
    { src: "images/hobbies/sport-gym.jpg", label: "Gym" },
    { src: "images/hobbies/sport-tennis.jpg", label: "Tennis" },
    { src: "images/hobbies/sport-basketball.jpg", label: "Basketball" },
    { src: "images/hobbies/cook-vegetables.jpg", label: "Cooking" },
    { src: "images/hobbies/cook-sandwich.jpg", label: "Tawa" },
    { src: "images/workspaces/desk.jpg", label: "Bangalore desk" },
    { src: "images/workspaces/desk-detail.jpg", label: "Desk" },
    { src: "images/workspaces/monitor.jpg", label: "Night desk" },
    { src: "images/workspaces/camera.jpg", label: "X-S20" },
    { src: "images/workspaces/camera-field.jpg", label: "In the field" },
    { src: "images/workspaces/edit.jpg", label: "Edit corner" },
    { src: "images/workspaces/edit-detail.jpg", label: "Resolve" },
    { src: "images/workspaces/bag.jpg", label: "Bag" },
    { src: "images/bts/xs20-hands.jpg", label: "Learning the X-S20" },
    { src: "images/bts/xs20-tripod.jpg", label: "Tripod" },
    { src: "images/bts/filming-smoke.jpg", label: "Smoke" },
    { src: "images/bts/filming-set.jpg", label: "Set" },
    { src: "images/bts/filming-room.jpg", label: "Room" },
    { src: "images/bts/filming-camera.jpg", label: "On sticks" },
    { src: "images/bts/notes.jpg", label: "Notes" },
    { src: "images/bts/camera.jpg", label: "Camera" },
    { src: "images/films/sakleshpur.jpg", label: "Sakleshpur" },
    { src: "images/films/delhi.jpg", label: "Delhi" },
    { src: "images/films/ladakh.jpg", label: "Ladakh" },
    { src: "images/work/neo.jpg", label: "Neo" },
    { src: "images/work/payzapp.jpg", label: "PayZapp" },
    { src: "images/work/growth.jpg", label: "Growth" },
    { src: "images/work/unicorn.jpg", label: "Unicorn" }
  ];

  tilePhotos.forEach((photo) => {
    const image = new Image();
    image.decoding = "async";
    image.src = photo.src;
  });

  const tileData = (cellX, cellY) => {
    const seed = hash(cellX, cellY);
    const tileWidth = 132;
    const tileHeight = 104;
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
    tile.style.setProperty("--focus-scale", focus.scale.toFixed(3));
    tile.style.setProperty("--focus-opacity", focus.opacity.toFixed(3));
    tile.style.setProperty("--focus-x", `${focus.x.toFixed(2)}px`);
    tile.style.setProperty("--focus-y", `${focus.y.toFixed(2)}px`);
    tile.style.zIndex = String(focus.zIndex);
    tile.classList.toggle("is-captioned", focus.scale > 1.45);
  };

  const makeTile = (data) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "creation-tile";
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
    tile.innerHTML = `
      <span class="creation-tile-frame">
        <img src="${tilePhotos[data.image].src}" alt="" draggable="false" decoding="async">
      </span>
      <span class="creation-tile-label">${tilePhotos[data.image].label}</span>
    `;
    return tile;
  };

  const visibleRange = () => {
    const minX = (-camera.x - OVERSCAN) / camera.scale;
    const maxX = (width - camera.x + OVERSCAN) / camera.scale;
    const minY = (-camera.y - OVERSCAN) / camera.scale;
    const maxY = (height - camera.y + OVERSCAN) / camera.scale;
    return {
      left: Math.floor(minX / CELL_X),
      right: Math.ceil(maxX / CELL_X),
      top: Math.floor(minY / CELL_Y),
      bottom: Math.ceil(maxY / CELL_Y)
    };
  };

  const reconcileTiles = (force = false) => {
    const range = visibleRange();
    let stride = camera.scale < 0.55 ? 2 : 1;
    const columns = range.right - range.left + 1;
    const rows = range.bottom - range.top + 1;
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
          const tile = makeTile(data);
          active.set(key, tile);
          additions.push(tile);
        }
      }
    }

    active.forEach((tile, key) => {
      if (wanted.has(key)) return;
      tile.remove();
      active.delete(key);
    });

    if (additions.length) {
      const fragment = document.createDocumentFragment();
      additions.forEach((tile) => fragment.append(tile));
      world.append(fragment);
    }
  };

  const applyCamera = () => {
    world.style.setProperty("--camera-x", `${camera.x.toFixed(2)}px`);
    world.style.setProperty("--camera-y", `${camera.y.toFixed(2)}px`);
    world.style.setProperty("--camera-scale", camera.scale.toFixed(4));
    focusLayer.style.setProperty("--edge-energy", (0.72 + motion.blur / 7.5 * 0.28).toFixed(3));
    const gridSize = 18 * camera.scale;
    grid.style.setProperty("--grid-size", `${gridSize.toFixed(2)}px`);
    grid.style.setProperty("--grid-x", `${(camera.x % gridSize).toFixed(2)}px`);
    grid.style.setProperty("--grid-y", `${(camera.y % gridSize).toFixed(2)}px`);
  };

  const updateFocusDepth = () => {
    active.forEach((tile) => {
      const data = tile._creationData;
      if (!data) return;
      applyFocus(tile, focusFor(data));
    });
  };

  const updateStatus = (now) => {
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
    if (now - statusTime > 300) {
      statusTime = now;
      count.textContent = `${active.size} nearby · ${Math.round(camera.scale * 100)}% · ${fps} fps`;
    }
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
    applyCamera();
    reconcileTiles();
    focusFrame = (focusFrame + 1) % 3;
    if (focusFrame === 0) updateFocusDepth();
    updateStatus(now);
    requestAnimationFrame(frame);
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
  });

  const zoomAt = (screenX, screenY, nextScale) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldX = (screenX - target.x) / target.scale;
    const worldY = (screenY - target.y) / target.scale;
    target.x = screenX - worldX * scale;
    target.y = screenY - worldY * scale;
    target.scale = scale;
  };

  canvas.addEventListener("wheel", (event) => {
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
  }, { passive: true });

  reconcileTiles(true);
  applyCamera();
  requestAnimationFrame(frame);
})();
