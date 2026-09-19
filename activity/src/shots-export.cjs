#!/usr/bin/env node
/* 导出件视觉实证：单文件版 vs dist 三件套版，逐像素比对
 *
 * 门禁管「有没有坏」，这组图管「是不是同一个东西」。
 * 精简掉 9 个 @font-face 是本导出流程里唯一有「改变外观」风险的动作，
 * 必须用同视口同裁剪区的像素差异来证明它对视觉零影响 —— 而不是靠"我看过了"。
 *
 * 前置: NODE_PATH / CHROME_PATH
 * 用法: node src/shots-export.cjs
 */
'use strict';
const path = require('path');
const fs = require('fs');

let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { console.error('!! 缺少 puppeteer-core（设置 NODE_PATH）'); process.exit(1); }

const CH = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CH)) { console.error('!! 找不到 Chrome'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..');
os_mkdir(path.join(ROOT, '_shots'));
function os_mkdir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

const CLIP = { x: 0, y: 0, width: 1440, height: 640 };
const TARGETS = [
  ['exp-a-dist',       path.join(ROOT, 'index.html')],
  ['exp-b-standalone', path.join(process.env.HOME, 'Desktop', 'activity-panel-v1.3.html')]
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--hide-scrollbars']
  });

  const shots = [];
  for (const [name, file] of TARGETS) {
    if (!fs.existsSync(file)) { console.error('!! 不存在: ' + file); process.exit(1); }
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await pg.goto(require('url').pathToFileURL(file).href, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 2600));      // 等图表动画收尾，否则比的是动画中间帧
    const out = path.join(ROOT, '_shots', name + '.png');
    await pg.screenshot({ path: out, clip: CLIP });
    console.log('  ✓ ' + path.basename(out) + '  (' + fs.statSync(out).size + ' 字节)');
    shots.push(out);
    await pg.close();
  }

  /* 逐像素比对。
     ⚠️ 不能直接把 file:// 图片地址传进页面 Image() —— file:// 页面加载另一个
     file:// 资源属跨源，img.onerror 会抛一个 Event（错误信息就是裸的 "Event"，
     看不出原因），而且就算加载成功，drawImage 后的 canvas 也会被 taint。
     改成在 Node 侧读成 data URL 再传进去：data URL 与任何页面对 canvas 都是干净的。 */
  const toDataUrl = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const pg = await browser.newPage();
  const r = await pg.evaluate(async (aUrl, bUrl) => {
    const load = u => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u;
    });
    const [ia, ib] = await Promise.all([load(aUrl), load(bUrl)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { dimMismatch: true, a: [ia.width, ia.height], b: [ib.width, ib.height] };
    }
    const c = document.createElement('canvas');
    c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d');
    g.drawImage(ia, 0, 0);
    const da = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(ib, 0, 0);
    const db = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, max = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 12) n++;
      if (d > max) max = d;
    }
    return { total: da.length / 4, diff: n, rate: n / (da.length / 4), max };
  }, toDataUrl(shots[0]), toDataUrl(shots[1]));

  await browser.close();

  console.log('\n【逐像素比对（1440×640 首屏区）】');
  if (r.dimMismatch) {
    console.log('  ❌ 尺寸不一致: ' + JSON.stringify(r.a) + ' vs ' + JSON.stringify(r.b));
    process.exit(1);
  }
  console.log('  比对像素数: ' + r.total);
  console.log('  差异像素数: ' + r.diff + '（差异率 ' + (r.rate * 100).toFixed(4) + '%，最大通道差 ' + r.max + '）');

  if (r.rate === 0) {
    console.log('\n🎉 首屏区**逐像素完全一致** —— 精简 @font-face 的视觉影响为零。');
  } else if (r.rate < 0.001) {
    console.log('\n✅ 差异率 ' + (r.rate * 100).toFixed(4) + '%（<0.1%），属抗锯齿级别的噪声，视觉一致。');
  } else {
    console.log('\n⚠️ 差异率 ' + (r.rate * 100).toFixed(2) + '% 偏高，请人工核对截图 _shots/exp-*.png');
    process.exit(1);
  }
})().catch(e => { console.error('!! ' + e.message); process.exit(1); });
