const $ = (id) => document.getElementById(id);
const input = $('file-links');
const statusInputs = ['live-link', 'approved-link', 'experiment-link'];
let toastTimer;
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}
async function copyText(text) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand('copy');
    fallback.remove();
    if (!copied) throw new Error('Copy blocked');
  }
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  const after = button.dataset.view === 'after';
  $('after-view').hidden = !after;
  $('before-view').hidden = after;
  document.querySelectorAll('[data-view]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
}));
document.querySelector('.copy-install').addEventListener('click', async () => {
  try { await copyText('Install the attached figma-file-cleanup skill for me.'); notify('Installation prompt copied. Paste it into Codex.'); }
  catch { notify('Couldn’t copy automatically. Select and copy the prompt text.'); }
});
function validFigmaLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['figma.com', 'www.figma.com'].includes(url.hostname) && /^\/design\/[^/]+/.test(url.pathname); }
  catch { return false; }
}
function updatePrompt() {
  const links = input.value.split(/\n/).map(s => s.trim()).filter(Boolean);
  const invalid = links.filter(link => !validFigmaLink(link));
  $('link-error').hidden = !invalid.length;
  $('link-error').textContent = invalid.length ? 'Use a Figma Design link (https://www.figma.com/design/…), one per line.' : '';
  input.setAttribute('aria-invalid', String(Boolean(invalid.length)));
  const scope = document.querySelector('input[name="scope"]:checked').value;
  const target = links.length > 1 ? `these files:\n${links.map(link => '- ' + link).join('\n')}` : `this file: ${links[0] || '[paste your Figma file link]'}`;
  const scopes = {
    full: 'Clean up the sidebar and canvases for handover using the six emoji categories. Consolidate related pages and arrange the existing designs. Ask me about any design statuses you cannot establish.',
    sidebar: 'Sidebar only: improve page names, category dividers, and ordering using the six emoji categories. Do not move designs between pages or rearrange canvases.',
    audit: 'Audit only: inspect the file and propose a clearer sidebar, related-page consolidations, and canvas improvements. Do not edit the file.'
  };
  let prompt = `Use $figma-file-cleanup on ${target}\n\n${scopes[scope]}`;
  if (links.length > 1) prompt += '\nWork file by file and confirm live, approved, and experimental references separately where unclear.';
  const labels = ['Current live frame', 'Approved but not implemented', 'Active experiments'];
  statusInputs.forEach((id, index) => { const value = $(id).value.trim(); if (value) prompt += `\n${labels[index]}: ${value}`; });
  $('generated-prompt').textContent = prompt;
  return {prompt, invalid};
}
input.addEventListener('input', updatePrompt);
statusInputs.forEach(id => $(id).addEventListener('input', updatePrompt));
document.querySelectorAll('input[name="scope"]').forEach(radio => radio.addEventListener('change', updatePrompt));
$('copy-prompt').addEventListener('click', async () => {
  const {prompt, invalid} = updatePrompt();
  if (invalid.length) { input.focus(); notify('Check your Figma links before copying.'); return; }
  try { await copyText(prompt); notify('Prompt copied. Open a Codex task and paste it in.'); }
  catch { notify('Couldn’t copy automatically. Select and copy the preview text.'); }
});
updatePrompt();
