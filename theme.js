(() => {
  const root = document.documentElement;
  const button = document.querySelector(".theme-toggle");
  const veil = document.querySelector(".theme-veil");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = { light: "#ece9e1", dark: "#141311" };

  const isDark = () => root.classList.contains("is-dark");

  const sync = () => {
    const dark = isDark();
    if (themeColor) themeColor.setAttribute("content", dark ? colors.dark : colors.light);
    if (!button) return;
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  };

  const apply = (dark) => {
    root.classList.toggle("is-dark", dark);
    try {
      localStorage.setItem("vs-theme", dark ? "dark" : "light");
    } catch {}
    sync();
  };

  const origin = () => {
    const rect = button?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40;
    const y = rect ? rect.top + rect.height / 2 : 40;
    const reach = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const radius = Math.ceil(reach + Math.min(window.innerWidth, window.innerHeight) * 0.18);
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-r", `${radius}px`);
    return { x, y, radius };
  };

  const wipeFallback = (next) => {
    if (!veil) {
      apply(next);
      return;
    }

    const { x, y, radius } = origin();
    veil.style.background = next ? colors.dark : colors.light;
    veil.style.setProperty("--wipe-r", "0px");
    veil.classList.add("is-wiping");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        veil.style.setProperty("--wipe-r", `${radius}px`);
      });
    });
    window.setTimeout(() => {
      apply(next);
      veil.classList.remove("is-wiping");
      veil.style.removeProperty("--wipe-r");
      veil.style.background = "";
    }, 1350);
  };

  const run = (next) => {
    origin();

    if (document.startViewTransition && !reduceMotion) {
      root.classList.add("is-theme-wiping");
      const transition = document.startViewTransition(() => apply(next));
      transition.finished.finally(() => root.classList.remove("is-theme-wiping"));
      return;
    }

    if (reduceMotion) {
      apply(next);
      return;
    }

    wipeFallback(next);
  };

  sync();
  button?.addEventListener("click", () => run(!isDark()));
})();
