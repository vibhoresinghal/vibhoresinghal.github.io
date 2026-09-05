(() => {
  const root = document.documentElement;
  const grid = document.createElement("div");
  grid.className = "dot-grid";
  grid.setAttribute("aria-hidden", "true");
  grid.innerHTML = `<div class="dot-grid-paper"></div>`;
  document.body.prepend(grid);

  const sync = () => {
    root.style.setProperty("--dot-scroll", `${window.scrollY}px`);
    root.style.setProperty("--dot-page-height", `${document.documentElement.scrollHeight}px`);
  };

  let frame = 0;
  window.addEventListener("scroll", () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }, { passive: true });
  window.addEventListener("resize", sync);
  new ResizeObserver(sync).observe(document.documentElement);
  sync();
})();
