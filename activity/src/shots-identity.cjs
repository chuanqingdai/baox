#!/usr/bin/env node
/* 自定义身份的**视觉实证**：门禁管「有没有坏」，这组图管「好不好看 / 看不看得见」。
   产物落在 _shots/。
   四张：
     01 默认态（头像 = 本地默认图，字样 = 公子的）
     02 自定义后（走**真实上传路径**灌一张渐变图 + 改字样）
     03 编辑态（contenteditable 的金色描边 —— 断言测不到「看起来像不像能编辑」）
     04 移动端自定义后（触屏没有 hover，还原按钮必须常驻可见 —— 铁律 15）
   另加一张首屏全景，看它在真实版面里的位置。 */
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

/* 在页面里画一张「看得出是照片」的图并灌进文件框 —— 走的是与用户同一条路径：
   change 事件 → FileReader → canvas 居中裁切 → 压 JPEG → 落盘 → 刷新 DOM。 */
const UPLOAD = () => {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 900;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 900, 900);
  grd.addColorStop(0, '#c8102e');
  grd.addColorStop(.55, '#8a1c3a');
  grd.addColorStop(1, '#1d6f42');
  g.fillStyle = grd; g.fillRect(0, 0, 900, 900);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.arc(450, 340, 150, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(450, 830, 270, Math.PI, 0, true); g.fill();
  return new Promise(res => c.toBlob(blob => {
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
    const inp = document.getElementById('avatarFile');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    res(true);
  }, 'image/png'));
};

const NAME = '公子说';

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'act-idshot-'));
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new', userDataDir: prof, args: ['--no-sandbox']
  });

  const open = async (w, h, custom) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.evaluate(() => { try { localStorage.setItem('baox.act.theme', 'dark'); } catch (e) {} });
    await p.reload({ waitUntil: 'load' });
    await sleep(1800);
    if (custom) {
      await p.evaluate(UPLOAD);
      await sleep(800);
      await p.click('#brandName');
      await sleep(200);
      await p.keyboard.type(NAME);
      await sleep(700);
      await p.keyboard.press('Enter');
      await sleep(400);
    }
    return p;
  };

  const shotEl = async (p, sel, name) => {
    const el = await p.$(sel);
    await el.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ✓ ' + name + '.png');
  };

  // 01 默认态
  let p = await open(1440, 950, false);
  await shotEl(p, '.topbar', 'id-01-default-topbar');
  await p.close();

  // 02 自定义后
  p = await open(1440, 950, true);
  await shotEl(p, '.topbar', 'id-02-custom-topbar');
  // 顺带把存储原文打出来，作为「真的落盘了」的旁证
  const raw = await p.evaluate(() => localStorage.getItem(window.__ACT_IDENTITY__.LS_ID));
  console.log('    身份键：', raw ? raw.slice(0, 64) + '…（' + raw.length + ' 字符）' : '(空)');
  await p.screenshot({ path: path.join(OUT, 'id-05-firstscreen-custom.png') });
  console.log('  ✓ id-05-firstscreen-custom.png');

  // 03 编辑态（鼠标悬停在字样上，再进入编辑）
  await p.click('#brandName');
  await sleep(300);
  await shotEl(p, '.topbar', 'id-03-editing-topbar');
  await p.keyboard.press('Escape');
  await sleep(300);
  await p.close();

  // 04 移动端自定义后
  p = await open(390, 844, true);
  await shotEl(p, '.topbar', 'id-04-custom-topbar-mobile');
  await p.close();

  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log('身份视觉实证已输出: ' + OUT);
})();
