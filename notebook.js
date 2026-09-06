(() => {
  // Later: set `src` to a 1280×720 open-book photo in images/notebook/
  const SPREADS = [
    { title: "X-S20 / Virtus", src: "", left: "camera", right: "car" },
    { title: "Sunday pan / Edit night", src: "", left: "pan", right: "film" },
    { title: "Desk notes / Court lights", src: "", left: "desk", right: "racket" },
    { title: "Plant by the door / Late Bangalore", src: "", left: "plant", right: "street" }
  ];

  const book = document.querySelector("#book");
  const fullEl = document.querySelector("#book-full");
  const flipEl = document.querySelector("#book-flip");
  const captionsEl = document.querySelector("#notebook-captions");
  const prevButtons = [document.querySelector("#notebook-prev"), document.querySelector("#notebook-zone-prev")];
  const nextButtons = [document.querySelector("#notebook-next"), document.querySelector("#notebook-zone-next")];

  if (!book) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const simple = reduceMotion || window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const pages = SPREADS.map((spread, index) => ({
    ...spread,
    w: 1280,
    h: 720,
    href: spread.src || drawSpread(spread, index)
  }));

  let index = 0;
  let flip = null;
  let flipId = 0;

  const go = (dir) => {
    if (flip) return;
    const from = index;
    const to = dir === "next" ? (from + 1) % pages.length : (from - 1 + pages.length) % pages.length;
    if (simple) {
      index = to;
      paint();
      return;
    }
    flipId += 1;
    flip = { id: flipId, dir, from, to };
    paint();
  };

  const paint = () => {
    const current = pages[flip ? flip.to : index];
    if (!flip || simple) {
      fullEl.className = "sb-full";
      fullEl.innerHTML = "";
      fullEl.append(img(current.href, current.title));
      flipEl.innerHTML = "";
    } else {
      fullEl.innerHTML = "";
      const from = pages[flip.from];
      const to = pages[flip.to];
      const next = flip.dir === "next";
      flipEl.innerHTML = "";
      flipEl.append(
        half(next ? from : to, "left", next ? "sb-out" : "sb-in"),
        half(next ? to : from, "right", next ? "sb-in" : "sb-out"),
        flap(from, to, flip.dir)
      );
    }

    const outgoing = flip ? `<p class="sb-caption cap-out">${pages[flip.from].title}</p>` : "";
    captionsEl.innerHTML = `${outgoing}<p class="sb-caption">${current.title}</p>`;
  };

  const img = (src, alt = "", side = "") => {
    const node = document.createElement("img");
    node.src = src;
    node.alt = alt;
    node.draggable = false;
    node.width = 1280;
    node.height = 720;
    if (side) node.className = `sb-half-img ${side}`;
    return node;
  };

  const half = (page, side, state) => {
    const node = document.createElement("div");
    node.className = `sb-half ${side} ${state}`;
    node.append(img(page.href, "", side));
    return node;
  };

  const flap = (from, to, dir) => {
    const node = document.createElement("div");
    node.className = `sb-flap ${dir}`;
    const front = document.createElement("div");
    front.className = "sb-face front";
    front.append(img(from.href, "", dir === "next" ? "right" : "left"));
    const back = document.createElement("div");
    back.className = "sb-face back";
    back.append(img(to.href, "", dir === "next" ? "left" : "right"));
    node.append(front, back);
    node.addEventListener("animationend", (event) => {
      if (event.target !== node || !flip || flip.id !== flipId) return;
      index = flip.to;
      flip = null;
      paint();
    });
    return node;
  };

  prevButtons.forEach((button) => button?.addEventListener("click", () => go("prev")));
  nextButtons.forEach((button) => button?.addEventListener("click", () => go("next")));
  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
    event.preventDefault();
    go(event.key === "ArrowRight" ? "next" : "prev");
  });

  paint();

  function drawSpread(spread, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    const book = { x: 248, y: 42, w: 784, h: 628 };
    const spine = book.x + book.w / 2;

    ctx.save();
    ctx.fillStyle = "rgba(20, 22, 30, 0.16)";
    ctx.filter = "blur(22px)";
    ctx.beginPath();
    ctx.ellipse(640, 668, 292, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#c4b49a";
    roundRect(ctx, book.x - 10, book.y + 10, book.w + 20, book.h + 8, 10);
    ctx.fill();
    ctx.fillStyle = "#b9a88d";
    ctx.fillRect(book.x - 10, book.y + 18, 8, book.h - 8);
    ctx.fillRect(book.x + book.w + 2, book.y + 18, 8, book.h - 8);

    for (let i = 3; i >= 0; i -= 1) {
      ctx.fillStyle = i % 2 ? "#efe8dc" : "#e7dfd1";
      ctx.fillRect(book.x - 4 + i, book.y + 8, 5, book.h - 6);
      ctx.fillRect(book.x + book.w - 1 - i, book.y + 8, 5, book.h - 6);
    }

    const left = paperPage(spread.left, spread.title.split(" / ")[0], seed);
    const right = paperPage(spread.right, spread.title.split(" / ")[1] || "", seed + 11);
    const pageY = book.y + 6;
    const pageH = book.h - 14;
    const pageW = book.w / 2;

    ctx.save();
    pathPage(ctx, book.x, pageY, pageW, pageH, "left");
    ctx.clip();
    ctx.drawImage(left, book.x, pageY, pageW, pageH);
    ctx.restore();

    ctx.save();
    pathPage(ctx, spine, pageY, pageW, pageH, "right");
    ctx.clip();
    ctx.drawImage(right, spine, pageY, pageW, pageH);
    ctx.restore();

    const gutter = ctx.createLinearGradient(spine - 42, 0, spine + 42, 0);
    gutter.addColorStop(0, "rgba(70, 52, 36, 0)");
    gutter.addColorStop(0.45, "rgba(70, 52, 36, 0.1)");
    gutter.addColorStop(0.5, "rgba(40, 30, 20, 0.22)");
    gutter.addColorStop(0.55, "rgba(70, 52, 36, 0.1)");
    gutter.addColorStop(1, "rgba(70, 52, 36, 0)");
    ctx.fillStyle = gutter;
    ctx.fillRect(spine - 42, pageY, 84, pageH);

    ctx.strokeStyle = "rgba(60, 46, 32, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spine + 0.5, pageY + 8);
    ctx.lineTo(spine + 0.5, pageY + pageH - 8);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  }

  function paperPage(doodle, title, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1408;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3eee4";
    ctx.fillRect(0, 0, 1024, 1408);
    const image = ctx.getImageData(0, 0, 1024, 1408);
    const data = image.data;
    let s = (seed + 3) * 997 + 13;
    for (let i = 0; i < data.length; i += 4) {
      s = (s * 16807 + 11) % 2147483647;
      const n = (s % 9) - 4;
      data[i] = Math.min(255, data[i] + n);
      data[i + 1] = Math.min(255, data[i + 1] + n);
      data[i + 2] = Math.min(255, data[i + 2] + n);
    }
    ctx.putImageData(image, 0, 0);
    const pen = makePen(ctx, seed * 17 + title.length);
    ({
      camera: drawCamera,
      car: drawCar,
      pan: drawPan,
      film: drawFilm,
      desk: drawDesk,
      racket: drawRacket,
      plant: drawPlant,
      street: drawStreet
    })[doodle](pen);
    pen.note(title);
    return canvas;
  }

  function pathPage(ctx, x, y, w, h, side) {
    const r = 16;
    ctx.beginPath();
    if (side === "left") {
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.lineTo(x, y + h - r);
      ctx.quadraticCurveTo(x, y + h, x + r, y + h);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x, y + h);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function makePen(ctx, seed) {
    let s = seed || 1;
    const rand = () => {
      s = (s * 16807 + 11) % 2147483647;
      return s / 2147483647;
    };
    const jitter = (n) => (rand() - 0.5) * n;
    const stroke = (points, width = 1.8) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(34, 30, 26, ${0.68 + rand() * 0.24})`;
      ctx.lineWidth = width + 0.4 + rand() * 0.6;
      ctx.beginPath();
      points.forEach((point, i) => {
        const x = point[0] + jitter(1.4);
        const y = point[1] + jitter(1.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };
    const curve = (a, b, c, d, width = 1.8) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(34, 30, 26, ${0.7 + rand() * 0.2})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0] + jitter(1), a[1] + jitter(1));
      ctx.bezierCurveTo(b[0] + jitter(2), b[1] + jitter(2), c[0] + jitter(2), c[1] + jitter(2), d[0] + jitter(1), d[1] + jitter(1));
      ctx.stroke();
      ctx.restore();
    };
    const oval = (x, y, rx, ry, width = 1.7) => {
      const pts = [];
      for (let i = 0; i <= 22; i += 1) {
        const a = (i / 22) * Math.PI * 2;
        pts.push([x + Math.cos(a) * rx + jitter(1.2), y + Math.sin(a) * ry + jitter(1.2)]);
      }
      stroke(pts, width);
    };
    const hatch = (x, y, w, h, n = 8) => {
      for (let i = 0; i < n; i += 1) {
        const t = i / n;
        stroke([[x + t * w + jitter(3), y + jitter(3)], [x + t * w - 8 + jitter(3), y + h + jitter(3)]], 1.1);
      }
    };
    const note = (text) => {
      ctx.save();
      ctx.translate(140, 1280);
      ctx.rotate(-0.04 + jitter(0.02));
      ctx.fillStyle = "rgba(42, 38, 32, 0.62)";
      ctx.font = "italic 34px 'Momo Trust Display', Georgia, serif";
      ctx.fillText(text.toLowerCase(), 0, 0);
      ctx.restore();
    };
    return { rand, jitter, stroke, curve, oval, hatch, note };
  }

  function drawCamera(pen) {
    pen.stroke([[220, 430], [780, 420], [800, 780], [210, 790], [220, 430]], 2.1);
    pen.stroke([[250, 430], [300, 320], [520, 310], [560, 428]], 1.7);
    pen.oval(520, 600, 118, 118, 2);
    pen.oval(520, 600, 72, 72, 1.5);
    pen.oval(520, 600, 22, 22, 1.3);
    pen.stroke([[250, 470], [360, 468]], 1.4);
    pen.hatch(230, 700, 160, 70, 7);
    pen.curve([180, 360], [120, 520], [130, 700], [210, 790], 1.5);
  }

  function drawCar(pen) {
    pen.curve([160, 720], [220, 520], [780, 500], [860, 720], 2.1);
    pen.curve([160, 720], [300, 760], [700, 760], [860, 720], 1.8);
    pen.stroke([[250, 560], [360, 430], [640, 420], [740, 550]], 1.8);
    pen.stroke([[400, 430], [410, 555]], 1.3);
    pen.oval(320, 740, 62, 62, 2);
    pen.oval(320, 740, 28, 28, 1.3);
    pen.oval(730, 738, 62, 62, 2);
    pen.oval(730, 738, 28, 28, 1.3);
    pen.hatch(500, 590, 150, 90, 6);
  }

  function drawPan(pen) {
    pen.oval(510, 620, 250, 78, 2);
    pen.oval(510, 600, 210, 58, 1.5);
    pen.stroke([[740, 590], [900, 470], [930, 450]], 2);
    pen.curve([360, 600], [400, 540], [460, 530], [500, 570], 1.4);
    pen.hatch(360, 640, 220, 50, 8);
  }

  function drawFilm(pen) {
    pen.stroke([[260, 280], [760, 270], [780, 980], [250, 990], [260, 280]], 2);
    for (let y = 320; y < 960; y += 90) {
      pen.stroke([[290, y], [730, y + pen.jitter(4)]], 1.3);
    }
    pen.hatch(300, 700, 180, 80, 7);
  }

  function drawDesk(pen) {
    pen.stroke([[180, 780], [840, 770], [800, 980], [220, 990], [180, 780]], 1.8);
    pen.stroke([[250, 520], [620, 510], [640, 760], [260, 770], [250, 520]], 1.7);
    pen.oval(760, 600, 48, 70, 1.6);
    pen.stroke([[760, 670], [760, 760]], 1.4);
    pen.hatch(280, 800, 200, 70, 6);
  }

  function drawRacket(pen) {
    pen.oval(500, 480, 170, 220, 2);
    for (let i = -3; i <= 3; i += 1) {
      pen.stroke([[500 + i * 28, 300], [500 + i * 22, 660]], 1);
    }
    pen.stroke([[500, 700], [510, 980], [470, 990], [490, 700]], 2);
    pen.oval(780, 860, 70, 70, 1.6);
  }

  function drawPlant(pen) {
    pen.stroke([[500, 980], [510, 640]], 2);
    pen.curve([510, 700], [360, 620], [280, 500], [340, 420], 1.7);
    pen.curve([510, 680], [620, 560], [740, 430], [680, 360], 1.7);
    pen.curve([510, 720], [430, 540], [390, 360], [460, 300], 1.6);
    pen.stroke([[430, 980], [590, 975], [560, 1080], [450, 1085], [430, 980]], 1.6);
  }

  function drawStreet(pen) {
    pen.stroke([[180, 980], [420, 520], [600, 520], [860, 990]], 1.8);
    pen.stroke([[300, 400], [300, 700], [420, 700]], 1.6);
    pen.stroke([[640, 360], [640, 680], [780, 860]], 1.6);
    pen.curve([200, 280], [400, 240], [620, 250], [860, 300], 1.2);
    pen.hatch(650, 720, 80, 90, 5);
  }
})();
