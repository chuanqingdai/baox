#!/usr/bin/env node
/* 观测窗口的**视觉实证**：门禁管「有没有坏」，这组图管「看不看得见 / 好不好用」。
   产物落在 _shots/，前缀 wn-。

   为什么这一块特别需要图（而不是只看断言）：
     ① 「窗口组排在抽屉最前」是一条设计约束，断言只能证明它在源码里的顺序；
        真正要确认的是**打开抽屉第一眼看到的就是它**，而不是要先往下滚。
     ② 预设胶囊的选中态、日期框的对齐、金色日历图标在双主题下的可见性 ——
        这些全是「看起来对不对」，只有图能判。实测踩过：日期框在深色底上
        默认的日历图标是近黑色，几乎看不见（见 panel.css ⑩b 的 filter 那段）。
     ③ 越窗提示是一整句话，它折不折行、会不会被挤出可视区，只有图能判。

   七张：
     wn-01-window-group-dark    窗口组（深色 · 默认 30 天）
     wn-02-window-group-light   同一组（米金主题）
     wn-03a-preset-7d-group     点「近 7 天」后：胶囊选中 + 说明变成 7 天 · 1 周
     wn-03b-preset-7d-grid      同一时刻的「逐日数据」组标题：7 天 × 12 项
     wn-04-overlimit-toast      填 2027-03-31 → 截到 90 天 + toast 说出来
     wn-05-outwindow-note       窗口收到 10/01 起 → 「窗口外另有 1 天记录…不会被删除」
     wn-06-drawer-firstscreen   抽屉首屏（窗口组在最上，一屏可见）
     wn-07-window-group-mobile  移动端 390 宽
*/
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

const D1 = '2026-09-19';

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'act-winshot-'));
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new', userDataDir: prof, args: ['--no-sandbox']
  });

  const open = async (w, h, theme) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    /* 先清业绩覆盖层：本节要展示的是窗口本身，残留的改动会让「当前窗口」说明
       与截图意图对不上（而图是要拿去给人看的，带着脏数据更容易被误读）。 */
    await p.evaluate(t => {
      try { localStorage.setItem('baox.act.theme', t); localStorage.removeItem('baox.act.data.v2'); }
      catch (e) {}
    }, theme || 'dark');
    await p.reload({ waitUntil: 'load' });
    await sleep(1700);
    return p;
  };

  /* 抽屉里的分组按顺序取：0 观测窗口 / 1 业务指标 / 2 各周保费目标 / 3 逐日数据。
     用下标而不是「找含某段文字的那个组」—— 后者会随文案改动静默失配。 */
  const groups = p => p.$$('#setBody .set-group');
  const shotGroup = async (p, i, name) => {
    const gs = await groups(p);
    if (!gs[i]) { console.log('  !! 第 ' + i + ' 组不存在，跳过 ' + name); return; }
    await gs[i].screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ✓ ' + name + '.png');
  };
  const shotPage = async (p, name) => {
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ✓ ' + name + '.png');
  };
  const setWin = async (p, which, iso) => {
    await p.evaluate((w, v) => {
      const e = document.getElementById(w === 'start' ? 'winStart' : 'winEnd');
      e.value = v;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }, which, iso);
    await sleep(420);
  };
  const openDrawer = async p => {
    await p.evaluate(() => document.getElementById('btnSettings').click());
    await sleep(560);
  };

  // ---- 01 / 06 深色 · 默认窗口 ----
  let p = await open(1440, 950, 'dark');
  await openDrawer(p);
  await shotGroup(p, 0, 'wn-01-window-group-dark');
  await shotPage(p, 'wn-06-drawer-firstscreen');
  await p.close();

  // ---- 02 米金主题（看金色日历图标是否可见）----
  p = await open(1440, 950, 'light');
  await openDrawer(p);
  await shotGroup(p, 0, 'wn-02-window-group-light');
  await p.close();

  // ---- 03 预设「近 7 天」：胶囊选中 + 说明与表格一起重建 ----
  p = await open(1440, 950, 'dark');
  await openDrawer(p);
  await p.evaluate(() => document.querySelector('#setBody .win-p[data-preset="d7"]').click());
  await sleep(560);
  await shotGroup(p, 0, 'wn-03a-preset-7d-group');
  await shotGroup(p, 3, 'wn-03b-preset-7d-grid');

  // ---- 04 超上限：截到 90 天 + toast ----
  await setWin(p, 'end', '2027-03-31');
  await shotPage(p, 'wn-04-overlimit-toast');
  const t4 = await p.evaluate(() => (document.getElementById('toast') || {}).textContent);
  console.log('    toast：' + t4);
  await p.close();

  // ---- 05 越窗提示：先存一条窗口外的记录，再把窗口收走 ----
  p = await open(1440, 950, 'dark');
  await openDrawer(p);
  await p.evaluate(d => {
    const e = document.querySelector('#setBody .dg-in[data-d="' + d + '"][data-k="gzh"]');
    e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, D1);
  await sleep(400);
  await p.evaluate(() => document.getElementById('btnSetSave').click());
  await sleep(760);
  await openDrawer(p);
  await setWin(p, 'start', '2026-10-01');
  await shotGroup(p, 0, 'wn-05-outwindow-note');
  const note = await p.evaluate(() => document.getElementById('winNote').textContent
    .replace(/\s+/g, ' ').trim());
  console.log('    提示：' + note.slice(note.indexOf('窗口外')));
  await p.close();

  // ---- 07 移动端 ----
  p = await open(390, 844, 'dark');
  await openDrawer(p);
  await shotGroup(p, 0, 'wn-07-window-group-mobile');
  await p.close();

  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log('观测窗口视觉实证已输出: ' + OUT);
})();
