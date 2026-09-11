// Generate original placeholder product recordings. This is asset production, not a test.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const output = path.resolve(__dirname, '../media/work');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await page.setContent('<html><body style="margin:0"><canvas id="screen" width="780" height="1688"></canvas></body></html>');
    for (const kind of ['payments', 'spending', 'savings']) {
      const result = await page.evaluate(async kind => {
        const canvas = document.getElementById('screen');
        const ctx = canvas.getContext('2d');
        const ink = '#223a31', muted = '#82877e', paper = '#f6f5ef', line = '#e3e5dc';
        const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
        function box(x, y, w, h, r, color) {
          ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
        }
        function text(value, x, y, size = 14, color = ink, font = 'sans-serif', weight = '400') {
          ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(value, x, y);
        }
        function rule(y) { box(26, y, 338, 1, 0, line); }
        function tick(x, y, scale = 1, color = ink) {
          ctx.strokeStyle = color; ctx.lineWidth = 3 * scale; ctx.lineCap = 'round'; ctx.beginPath();
          ctx.moveTo(x - 9 * scale, y); ctx.lineTo(x - 2 * scale, y + 7 * scale); ctx.lineTo(x + 12 * scale, y - 9 * scale); ctx.stroke();
        }
        function nav(active) {
          rule(769);
          ['Home', 'Activity', 'Save', 'You'].forEach((label, i) => {
            box(43 + i * 91, 786, 13, 13, i === 3 ? 7 : 4, i === active ? ink : '#bfc5b8');
            text(label, 33 + i * 91, 820, 10, i === active ? ink : muted);
          });
        }
        function draw(time) {
          ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 390, 844);
          box(0, 0, 390, 844, 0, paper);
          text('9:41', 30, 30, 13, ink, 'sans-serif', '600');
          [0, 1, 2, 3].forEach(i => box(317 + i * 4, 29 - i * 2, 2.5, 3 + i * 2, 1, ink));
          box(343, 21, 19, 9, 2, ink); box(364, 24, 2, 3, 1, ink);
          text('everyday', 27, 91, 23, ink, 'Georgia');
          box(326, 66, 36, 36, 18, '#e4e8dc'); text('JD', 335, 89, 11, ink, 'sans-serif', '600');
          if (kind === 'payments') {
            text('PAYMENTS / 01', 27, 143, 10, muted);
            text('A simpler way', 26, 191, 34, ink, 'Georgia');
            text('to send a little.', 26, 232, 34, ink, 'Georgia');
            box(26, 266, 338, 79, 18, '#e9ecdf');
            box(43, 281, 49, 49, 25, '#c6d1b7'); text('N', 60, 313, 20, ink, 'Georgia');
            text('Nora', 108, 298, 15, ink, 'sans-serif', '600'); text('Coffee, and a catch-up', 108, 321, 12, muted);
            text('YOU SEND', 27, 391, 10, muted);
            text('$24.00', 26, 451, 53, ink, 'Georgia');
            rule(477); text('From your everyday balance', 27, 511, 12, muted); text('$2,480.00', 275, 511, 12);
            box(26, 554, 338, 60, 15, ink); text('Send to Nora', 133, 591, 14, '#f7f4e8', 'sans-serif', '500');
            text('No fees. Just a little more time together.', 62, 645, 11, muted);
            const progress = ease((time - 1.2) / .65);
            if (progress > 0) {
              ctx.save(); ctx.globalAlpha = progress; ctx.translate(0, 18 * (1 - progress));
              box(18, 360, 354, 316, 24, '#eef1e5');
              box(167, 393, 56, 56, 28, '#c9d8b7'); tick(194, 421);
              text('A little kindness, sent.', 63, 499, 27, ink, 'Georgia');
              text('$24.00 is on its way to Nora.', 101, 532, 13, muted);
              rule(557); text('Transfer complete', 49, 590, 12); text('Just now', 286, 590, 11, muted);
              box(44, 614, 302, 43, 12, ink); text('All done', 171, 641, 13, '#f7f4e8'); ctx.restore();
            }
            nav(0);
          } else if (kind === 'spending') {
            text('YOUR MONEY / 02', 27, 143, 10, muted);
            text('The bigger picture.', 26, 191, 32, ink, 'Georgia');
            text('September, at your pace.', 27, 220, 13, muted);
            box(26, 253, 338, 249, 20, '#e8ecdf');
            text('THIS MONTH', 47, 286, 10, muted);
            text('$1,264', 46, 333, 42, ink, 'Georgia');
            text('A little less than last month', 47, 358, 11, muted);
            const heights = [33, 62, 48, 81, 55, 107, 72];
            heights.forEach((h, i) => {
              const rise = ease((time - .08 * i) / .8);
              box(48 + i * 43, 464 - h * rise, 26, h * rise + .1, 5, i === 5 ? '#294a39' : '#b5c6a3');
              text(['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], 57 + i * 43, 487, 9, muted);
            });
            text('The everyday things', 27, 546, 20, ink, 'Georgia');
            [['Food & coffee', '$328.00', '#dce3cb'], ['Getting around', '$96.50', '#e4dbc9'], ['A little treat', '$42.00', '#dddfe9']].forEach((row, i) => {
              const a = ease((time - .5 - i * .22) / .5); ctx.save(); ctx.globalAlpha = a; ctx.translate(0, 10 * (1 - a));
              box(27, 571 + i * 59, 34, 34, 11, row[2]); text(['C', 'T', '+'][i], 39, 594 + i * 59, 12);
              text(row[0], 76, 592 + i * 59, 13); text(row[1], 300, 592 + i * 59, 12); ctx.restore();
            }); nav(1);
          } else {
            text('LITTLE BY LITTLE / 03', 27, 143, 10, muted);
            text('Somewhere', 26, 190, 34, ink, 'Georgia'); text('worth going.', 26, 231, 34, ink, 'Georgia');
            box(26, 267, 338, 231, 22, '#dae3cc');
            ctx.fillStyle = '#f7f0cc'; ctx.beginPath(); ctx.arc(282, 320, 29, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#adbfa0'; ctx.beginPath(); ctx.moveTo(26, 464); ctx.lineTo(155, 315); ctx.lineTo(267, 470); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#69886c'; ctx.beginPath(); ctx.moveTo(141, 479); ctx.lineTo(284, 350); ctx.lineTo(364, 439); ctx.lineTo(364, 479); ctx.closePath(); ctx.fill();
            box(26, 465, 338, 33, 0, '#dae3cc'); text('A weekend in the mountains', 46, 484, 17, ink, 'Georgia');
            const p = ease((time - 1) / 1.3), amount = Math.round(620 + p * 120);
            text('$' + amount, 27, 554, 37, ink, 'Georgia'); text('of $1,000 saved', 236, 551, 12, muted);
            box(27, 578, 336, 8, 4, '#dfe4d6'); box(27, 578, 336 * (.62 + p * .12), 8, 4, '#658163');
            text('Every small step counts.', 27, 617, 13, muted);
            box(26, 654, 338, 53, 14, ink); text(p > .98 ? 'A little closer. Nice.' : 'Add to your goal', p > .98 ? 125 : 136, 687, 13, '#f6f2e8');
            if (p > .98) tick(105, 681, .6, '#f6f2e8'); nav(2);
          }
        }
        draw(0);
        const poster = canvas.toDataURL('image/png').split(',')[1];
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1600000 });
        const chunks = [];
        const done = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.start();
        const start = performance.now();
        await new Promise(resolve => {
          const frame = () => {
            const elapsed = (performance.now() - start) / 1000;
            draw(Math.min(elapsed, 4.6));
            if (elapsed >= 4.8) resolve(); else setTimeout(frame, 1000 / 30);
          };
          frame();
        });
        recorder.stop(); await done; stream.getTracks().forEach(track => track.stop());
        const buffer = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
        let binary = '';
        for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
        return { poster, video: btoa(binary) };
      }, kind);
      fs.writeFileSync(path.join(output, kind + '.png'), Buffer.from(result.poster, 'base64'));
      fs.writeFileSync(path.join(output, kind + '.webm'), Buffer.from(result.video, 'base64'));
      process.stdout.write('Created ' + kind + ' demo recording and poster.\n');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
