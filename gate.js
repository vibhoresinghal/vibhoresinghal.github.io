(() => {
  const HASH = "e46a22f8d4c8855603b27e0cdb22ae4118d96ad5c934503188cbdfc854d66f95";
  const KEY = "vs-gate";

  const isOpen = () => {
    try {
      return sessionStorage.getItem(KEY) === "ok";
    } catch {
      return false;
    }
  };

  const unlock = () => {
    try {
      sessionStorage.setItem(KEY, "ok");
    } catch {}
    document.documentElement.classList.remove("is-gated");
    document.querySelector(".site-gate")?.remove();
  };

  const digest = async (value) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  if (isOpen()) {
    document.documentElement.classList.remove("is-gated");
    return;
  }

  document.documentElement.classList.add("is-gated");

  const gate = document.createElement("div");
  gate.className = "site-gate";
  gate.innerHTML = `
    <form>
      <p>This site isn’t public yet.</p>
      <label>
        Password
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Enter</button>
      <p class="site-gate-error" hidden>That’s not it.</p>
    </form>
  `;
  document.body.prepend(gate);

  const form = gate.querySelector("form");
  const input = gate.querySelector("input");
  const error = gate.querySelector(".site-gate-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hash = await digest(input.value.trim());
    if (hash === HASH) {
      unlock();
      return;
    }
    error.hidden = false;
    input.value = "";
    input.focus();
  });

  input.focus();
})();
