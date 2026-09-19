#!/usr/bin/env node
/* 截图矩阵：桌面/移动 × 暗夜/米金 = 4 张，另加 2 张首屏局部。
   产物落在 _shots/，用于人工复核视觉（门禁管「有没有坏」，截图管「好不好看」）。 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { console.error('!! 缺少 puppeteer-core'); process.exit(1); }
const CH = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CH) { console.error('!! 找不到 Chrome'); process.exit(1); }

const ROOT = path.dirname(__dirname);
const TARGET = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, '_shots');
fs.mkdirSync(OUT, { recursive: true });
const url = require('url').pathToFileURL(path.resolve(TARGET)).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = [
  { n: '01-desktop-dark-full', w: 1440, h: 950, theme: 'dark', full: true },
  { n: '02-desktop-light-full', w: 1440, h: 950, theme: 'light', full: true },
  { n: '03-mobile-dark-full', w: 390, h: 844, theme: 'dark', full: true },
  { n: '04-mobile-light-full', w: 390, h: 844, theme: 'light', full: true },
  { n: '05-desktop-dark-first', w: 1440, h: 950, theme: 'dark', full: false },
  { n: '06-mobile-dark-first', w: 390, h: 844, theme: 'dark', full: false }
];

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'act-shot-'));
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new', userDataDir: prof, args: ['--no-sandbox']
  });
  for (const s of SHOTS) {
    const p = await browser.newPage();
    await p.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 2 });
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.evaluate(t => { try { localStorage.setItem('baox.act.theme', t); } catch (e) {} }, s.theme);
    await p.reload({ waitUntil: 'load' });
    await sleep(1600);
    // 逐屏滚到底，触发全部进场动画后再回到顶部截图（否则长图里后半段是隐藏态）
    await p.evaluate(async () => {
      const H = document.body.scrollHeight;
      for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await sleep(900);
    await p.screenshot({ path: path.join(OUT, s.n + '.png'), fullPage: !!s.full });
    console.log('  ✓ ' + s.n + '.png  ' + s.w + '×' + s.h + '  ' + s.theme);
    await p.close();
  }
  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log('截图矩阵已输出: ' + OUT);
})();
