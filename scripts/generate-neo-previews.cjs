// Original illustrative web-tool recordings, not captures of Neo's product.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const output = path.resolve(__dirname, '../media/work');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent('<html><body style="margin:0"><canvas id="screen" width="1280" height="800"></canvas></body></html>');
    for (const kind of ['workspace', 'workflows']) {
      const result = await page.evaluate(async kind => {
        const canvas = document.getElementById('screen'), ctx = canvas.getContext('2d');
        const ink = '#293b36', muted = '#858b82', line = '#e5e7df', paper = '#f9faf5';
        const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
        const box = (x, y, w, h, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
        const text = (value, x, y, size = 18, color = ink, font = 'sans-serif', weight = '400') => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(value, x, y); };
        function check(x, y) { ctx.strokeStyle = '#5b8269'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 5); ctx.lineTo(x + 15, y - 7); ctx.stroke(); }
        function draw(t) {
          ctx.clearRect(0, 0, 1280, 800); box(0, 0, 1280, 800, 0, paper);
          box(0, 0, 220, 800, 0, '#edf0e8'); box(219, 0, 1, 800, 0, line);
          text('workspace', 28, 52, 29, ink, 'Georgia');
          text('YOUR LITTLE CORNER', 28, 91, 11, muted);
          box(18, kind === 'workspace' ? 126 : 270, 184, 41, 8, '#dce4d6');
          ['Overview', 'Projects', 'Conversations', 'Workflows'].forEach((label, i) => {
            box(30, 138 + i * 48, 13, 13, 3, i === (kind === 'workspace' ? 0 : 3) ? '#61795e' : '#b0baaa');
            text(label, 57, 151 + i * 48, 16);
          });
          text('PINNED', 28, 405, 11, muted);
          ['Website refresh', 'Team handbook', 'Friday notes'].forEach((label, i) => text(label, 30, 446 + i * 38, 15, muted));
          box(26, 735, 30, 30, 15, '#ccd8be'); text('JD', 33, 756, 12); text('Jamie Davis', 68, 755, 14);
          text(kind === 'workspace' ? 'Overview' : 'Your workflows', 258, 43, 15, muted);
          text('ILLUSTRATIVE CONCEPT', 1050, 43, 11, muted); box(220, 66, 1060, 1, 0, line);
          if (kind === 'workspace') {
            text('A little less scattered.', 264, 145, 38, ink, 'Georgia');
            text('Your projects, people, and next steps. Together.', 264, 180, 17, muted);
            const cards = [['Website refresh', 'Design / In progress', '#e4ebdc'], ['Team handbook', 'Writing / In review', '#eae5db'], ['Spring launch', 'Planning / Up next', '#e0e8ea']];
            cards.forEach((card, i) => {
              box(263 + i * 228, 220, 210, 155, 14, card[2]);
              box(283 + i * 228, 242, 30, 30, 8, '#fafbf5'); text(['W', 'T', 'S'][i], 292 + i * 228, 264, 16, ink, 'Georgia');
              text(card[0], 283 + i * 228, 314, 19, ink, 'Georgia'); text(card[1], 283 + i * 228, 345, 12, muted);
            });
            text('Room to focus', 264, 433, 25, ink, 'Georgia');
            ['Review the homepage direction', 'Tidy up the project brief', 'Share a few notes with the team'].forEach((label, i) => {
              box(265, 461 + i * 66, 661, 56, 10, '#f0f2eb');
              box(281, 480 + i * 66, 17, 17, 5, '#dde4d5');
              if (t > 1.5 && i === 0) check(282, 488);
              text(label, 315, 494 + i * 66, 16); text(['Today', 'Tomorrow', 'Friday'][i], 840, 494 + i * 66, 12, muted);
            });
            const appear = ease((t - .65) / .9);
            ctx.save(); ctx.globalAlpha = appear; ctx.translate(22 * (1 - appear), 0);
            box(969, 105, 282, 584, 16, '#eaf0e3');
            text('A little context', 991, 148, 24, ink, 'Georgia'); text('RIGHT WHEN YOU NEED IT', 991, 176, 10, muted);
            text('Website refresh', 991, 231, 16, ink, 'sans-serif', '600');
            ['The latest direction is ready.', 'Two decisions need a look:', '', '01  A simpler introduction', '02  A clearer next step'].forEach((label, i) => text(label, 991, 270 + i * 28, 13, muted));
            const fill = ease((t - 1.7) / .7);
            ctx.globalAlpha = fill * appear;
            box(988, 455, 245, 108, 12, '#fcfdf8'); text('Suggested next step', 1005, 484, 13, ink, 'sans-serif', '600');
            text('Bring the feedback together', 1005, 512, 12, muted); text('and share a short summary.', 1005, 535, 12, muted);
            box(989, 589, 244, 46, 10, '#344e3b'); text('Draft a summary', 1055, 617, 13, '#fafaf2'); ctx.restore();
          } else {
            text('From a thought to a next step.', 264, 145, 36, ink, 'Georgia');
            text('A helpful starting point. The decisions are still yours.', 264, 180, 17, muted);
            const steps = [['A new request', 'Website refresh brief'], ['A little assistance', 'Shape the first draft'], ['Your review', 'Make it your own']];
            steps.forEach((step, i) => {
              const active = t > i * .8;
              box(266, 245 + i * 136, 362, 96, 14, active ? '#e5ecdc' : '#f0f2eb');
              box(285, 267 + i * 136, 36, 36, 18, '#f9fbf3'); text(String(i + 1).padStart(2, '0'), 294, 291 + i * 136, 13);
              text(step[0], 338, 282 + i * 136, 18, ink, 'Georgia'); text(step[1], 338, 308 + i * 136, 13, muted);
              if (i < 2) box(304, 343 + i * 136, 2, 37, 1, '#b6c5a8');
              if (t > (i + 1) * .8) check(593, 286 + i * 136);
            });
            box(674, 235, 573, 442, 16, '#ffffff');
            text('Website refresh / First draft', 701, 274, 16, ink, 'sans-serif', '500');
            box(700, 296, 520, 1, 0, line);
            const lines = ['A clearer welcome.', 'Start with the thing people came for.', '', 'What we are making', 'A simple introduction to the product,', 'with room for a little personality.', '', 'Next up', 'Gather feedback on the first direction.'];
            lines.forEach((label, i) => {
              ctx.save(); ctx.globalAlpha = ease((t - .8 - i * .13) / .4);
              text(label, 701, 340 + i * 30, i === 0 ? 25 : 16, i === 0 || i === 3 || i === 7 ? ink : muted, i === 0 ? 'Georgia' : 'sans-serif'); ctx.restore();
            });
            box(698, 613, 521, 42, 10, '#edf2e6'); text(t > 2.5 ? 'Ready for your review' : 'Putting the pieces together...', 875, 639, 13, '#52714e');
          }
          text('A calmer kind of work.', 264, 751, 14, muted, 'Georgia');
        }
        draw(0);
        const poster = canvas.toDataURL('image/png').split(',')[1];
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1700000 });
        const chunks = [], finished = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.start();
        const start = performance.now();
        await new Promise(resolve => {
          function frame() { const t = (performance.now() - start) / 1000; draw(Math.min(t, 4.8)); if (t >= 5) resolve(); else setTimeout(frame, 1000 / 30); }
          frame();
        });
        recorder.stop(); await finished; stream.getTracks().forEach(track => track.stop());
        const bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return { poster, video: btoa(binary) };
      }, kind);
      fs.writeFileSync(path.join(output, kind + '.png'), Buffer.from(result.poster, 'base64'));
      fs.writeFileSync(path.join(output, kind + '.webm'), Buffer.from(result.video, 'base64'));
      process.stdout.write('Created ' + kind + ' illustrative recording and poster.\n');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
