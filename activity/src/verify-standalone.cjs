#!/usr/bin/env node
/* ============================================================================
   单文件自包含版 · 隔离沙箱验证（导出件专用）

   为什么不能只对 dist 产物跑十关就算数：
     dist 的 index.html 与 assets/、libs/ 是「三件套」，在项目根目录里十关全绿 ——
     但那只证明「在配套齐全的环境里能跑」。
     用户要的是「一份网页文件」，场景是：拷到桌面 / scp 到服务器 / 丢进任意静态
     托管目录。这个场景下 assets/ 与 libs/ 都**不存在**。而缺失的症状是静默的：
       · 图标字体缺失 → 图标全变 0x0（不报错、不占位）
       · 图表库缺失   → KPI 照显示、canvas 不绘制
       · 默认头像缺失 → 裂图
     页面文字与布局都正常，看起来「只是有点空」。本关就是来抓这类静默缺陷的。

   本关做法：
     ① 把待验文件复制进一个**空目录**（无 assets/、无 libs/、无任何兄弟文件），
        再从那里加载 —— 复刻用户真实的使用环境；
     ② 判定全部落在**渲染结果**上：
        · 默认头像 naturalWidth > 0（data URI 写坏 → 静默 0x0，不报错）
        · favicon 的 href 以 data: 开头（内联失败时它仍是相对路径，只剩标签页可见）
        · 内联库真的可执行：Chart 构造函数在场、canvas 真的画出像素
        · **图标字形**（铁律 9）：这一块由三条判据分工把守，各自拦一种失效模式 ——
            ① iconFontLoaded  : 图标用的家族**真的 loaded**（抓「字体没内联/被删错」）
            ② iconNoGlyph     : ::before 的 content 非空（抓「CSS 规则缺失/class 拼错」）
            ③ iconZeroBox     : 元素盒子宽度 > 0（抓「元素塌成 0x0」）
          实测反例B（把字体 base64 清空）：只有 ① 报红，②③ 照绿 —— 这不是假绿，
          而是它们**本来就不负责**这一项：FontAwesome 给 .fa-solid 设了固定宽度
          （width:1.25em），字体没加载时宽度照样正常，字形却渲染成空白。
          所以这一组必须**同时存在**，缺一条就会有失效模式漏网。
        · 快照接口字段**按真实结构取**（days / counts / weeks），不猜字段名
          —— 曾经按 kpi/total 猜，结果 KPI 恒为 0、总量恒为 null，是假红。
        · 字体就绪判据**不用 document.fonts.check()**：实测它对「本页未加载」的
          字体名也宽松返回 true（反例A 里图标全塌，它照样 true）。改用
          「已注册 FontFace 的 status === 'loaded'」，反例 A/B 都能抓到。

   用法:
     node src/verify-standalone.cjs <单文件.html>
   前置:
     export NODE_PATH=<含 puppeteer-core 的 node_modules>
     export CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   退出码: 0 = 全绿, 1 = 有项不达标
   ============================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  console.error('!! 缺少 puppeteer-core。请设置 NODE_PATH 指向已安装依赖的 node_modules 目录。');
  process.exit(1);
}

const CH = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome'
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CH) { console.error('!! 找不到 Chrome，请用 CHROME_PATH 指定。'); process.exit(1); }

const ARGV = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SRC = ARGV[0];
if (!SRC) { console.error('用法: node src/verify-standalone.cjs <单文件.html>'); process.exit(1); }
if (!fs.existsSync(SRC)) { console.error('!! 待验文件不存在: ' + SRC); process.exit(1); }

let bad = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) bad++; };

(async () => {
  /* ── ① 搭隔离沙箱：一个只有这一个文件的空目录 ───────────────── */
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-'));
  const page_path = path.join(sandbox, 'app.html');
  fs.copyFileSync(SRC, page_path);

  const siblings = fs.readdirSync(sandbox);
  console.log('【隔离沙箱】');
  console.log('  目录: ' + sandbox);
  console.log('  同目录文件: ' + JSON.stringify(siblings));
  ok(siblings.length === 1 && siblings[0] === 'app.html',
     '沙箱内只有待验文件本身（无 assets/、无 libs/、无任何兄弟资源）');
  console.log('  大小: ' + (fs.statSync(page_path).size / 1024).toFixed(1) + ' KB');

  /* ── ② 加载并取证 ───────────────────────────────────────────── */
  const browser = await puppeteer.launch({
    executablePath: CH,
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--hide-scrollbars']
  });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900 });

  const errs = [], failed = [], external = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  pg.on('requestfailed', r => failed.push(r.url().slice(0, 100) + ' ← ' + ((r.failure() || {}).errorText)));
  pg.on('request', r => { if (/^https?:\/\//i.test(r.url())) external.push(r.url().slice(0, 100)); });

  await pg.goto(require('url').pathToFileURL(page_path).href, { waitUntil: 'load', timeout: 45000 });
  await pg.evaluate(() => document.fonts.ready);   // 字体是异步加载的，必须等，否则测早了会假红
  await new Promise(r => setTimeout(r, 1500));

  const p = await pg.evaluate(async () => {
    await document.fonts.ready;
    const out = {};

    /* 头像 / favicon */
    const av = document.querySelector('#brandAvatar');
    out.avatarExists = !!av;
    if (av) {
      out.avatarNW = av.naturalWidth;
      out.avatarScheme = (av.getAttribute('src') || '').slice(0, 30);
      out.avatarRendered = av.getBoundingClientRect().width > 0;
    }
    const ico = document.querySelector('link[rel="icon"]');
    out.iconHref = ico ? (ico.getAttribute('href') || '').slice(0, 30) : null;

    /* 运行时是否还有相对资源引用 */
    const rel = [];
    document.querySelectorAll('[src],[href]').forEach(el => {
      const v = el.getAttribute('src') || el.getAttribute('href') || '';
      if (v && !/^(data:|#|javascript:|mailto:)/i.test(v)) rel.push(v.slice(0, 80));
    });
    out.relativeRefs = rel;

    /* 快照接口：按真实结构取，不猜字段 */
    try {
      out.hasSnapshot = typeof window.__ACT_SNAPSHOT__ === 'function';
      if (out.hasSnapshot) {
        const s = window.__ACT_SNAPSHOT__();
        out.snapKeys  = Object.keys(s).length;
        out.days      = s.days;
        out.windowDays= s.windowDays;
        out.scoreKeys = s.counts ? Object.keys(s.counts).length : 0;
        out.weekCount = Array.isArray(s.weeks) ? s.weeks.length : 0;
        out.hasFunnel = !!s.funnel;
      }
    } catch (e) { out.snapshotErr = String(e); }

    /* 内联库是否真的可执行 */
    out.hasChart = typeof window.Chart !== 'undefined';
    out.chartVer = (typeof window.Chart !== 'undefined' && window.Chart.version) || null;
    out.canvasPainted = Array.from(document.querySelectorAll('canvas')).some(c => {
      try {
        const g = c.getContext('2d');
        if (!g || !c.width || !c.height) return false;
        const d = g.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 400) if (d[i] > 0) return true;
        return false;
      } catch (e) { return true; }   // 像素被污染时无法读，不据此判负
    });

    /* 字体：是否真的注册并可用 */
    // ⚠️ document.fonts.check() 不可作为判据 —— 实测它对本页**未加载**的字体名
    //    也宽松返回 true（反例A 里图标全塌成 0x0，它照样报 true）。只作信息输出。
    out.fontCheck = document.fonts.check('900 16px "Font Awesome 6 Free"');
    out.fontFaces = Array.from(document.fonts).map(f => f.family + ' ' + f.weight + ' ' + f.status).slice(0, 12);
    out.fontCount = document.fonts.size;

    /* 图标字形（铁律 9）：只看**可见**元素，避免折叠面板里的图标造成假红 */
    const icons = Array.from(document.querySelectorAll('i')).filter(el => /fa-solid/.test(el.className));
    const visible = icons.filter(el => el.getClientRects().length > 0);
    out.iconTotal = icons.length;
    out.iconVisible = visible.length;
    const detail = visible.map(el => {
      const cs = getComputedStyle(el, '::before');
      const c = (cs.content || '').trim();
      const r = el.getBoundingClientRect();
      const cls = el.className.replace(/\bfa-solid\b/, '').replace(/\bbrand__hint\b/, '').trim();
      return { cls, content: c, w: Math.round(r.width * 10) / 10, fam: (cs.fontFamily || '').slice(0, 34) };
    });
    out.iconNoGlyph = detail.filter(d => !d.content || d.content === 'none' || d.content === 'normal' || d.content === '""');
    out.iconZeroBox = detail.filter(d => d.w <= 0.5);
    out.iconFamilies = [...new Set(detail.map(d => d.fam))];
    out.iconSample   = detail.slice(0, 4);

    /* 本质判据：图标**实际使用**的家族，必须真的加载完成（status=loaded）。
       这比 document.fonts.check() 硬得多 —— 后者对未加载的字体名也返回 true。 */
    const norm = s => (s || '').replace(/["']/g, '').trim();
    out.loadedFaces = Array.from(document.fonts)
      .filter(f => f.status === 'loaded')
      .map(f => norm(f.family) + '/' + f.weight);
    out.iconFontLoaded = out.iconFamilies.every(fam =>
      Array.from(document.fonts).some(f => norm(f.family) === norm(fam) && f.status === 'loaded'));

    out.bodyText = document.body.innerText.length;
    out.hasIdentity = !!window.__ACT_IDENTITY__;
    return out;
  });

  console.log('\n【渲染证据】');
  console.log('  默认头像 naturalWidth = ' + p.avatarNW + '，可见宽度 > 0 = ' + p.avatarRendered);
  console.log('  头像 src 前缀 = ' + p.avatarScheme + ' ／ favicon = ' + p.iconHref);
  console.log('  运行时相对引用 = ' + JSON.stringify(p.relativeRefs));
  console.log('  快照字段数 = ' + p.snapKeys + '，窗口天数 = ' + p.days + '，计分项 = ' + p.scoreKeys + '，自然周 = ' + p.weekCount);
  console.log('  Chart.js = ' + p.hasChart + '（v' + p.chartVer + '），canvas 已绘 = ' + p.canvasPainted);
  console.log('  字体：已注册 FontFace = ' + p.fontCount + ' 个，其中加载完成 = ' + JSON.stringify(p.loadedFaces));
  console.log('    （document.fonts.check() = ' + p.fontCheck + ' —— 仅供参考；它对本页未加载的字体名也会返回 true，不作判据）');
  console.log('  图标：共 ' + p.iconTotal + ' 个，可见 ' + p.iconVisible + ' 个，涉及字体 = ' + JSON.stringify(p.iconFamilies));
  console.log('  图标样例 = ' + JSON.stringify(p.iconSample));
  console.log('  页面可见文本 = ' + p.bodyText + ' 字符');

  console.log('\n【判定】');
  ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  ok(failed.length === 0, '无请求失败' + (failed.length ? '：' + failed.slice(0, 3).join(' | ') : ''));
  ok(external.length === 0, '运行期零外部网络请求' + (external.length ? '：' + external.slice(0, 3).join(' | ') : ''));
  ok(p.relativeRefs.length === 0, '文档内无任何非 data: 的相对资源引用（自包含）'
     + (p.relativeRefs.length ? '：' + p.relativeRefs.join(', ') : ''));

  /* 头像 / favicon */
  ok(p.avatarExists, '默认头像元素在场');
  ok(p.avatarNW > 0, '默认头像**真的渲染出像素**（naturalWidth=' + p.avatarNW + '）');
  ok(p.avatarRendered, '默认头像可见宽度 > 0');
  ok((p.avatarScheme || '').startsWith('data:image/'), '头像 src 已是内联 data URI');
  ok((p.iconHref || '').startsWith('data:'), 'favicon 已内联为 data URI');

  /* 内联库 */
  ok(p.hasChart, 'Chart.js 在场（图表库已被内联，不依赖 libs/）');
  ok(p.canvasPainted, 'canvas **真的画出了像素**（不是「元素存在」这种弱判定）');

  /* 快照 / 数据 */
  ok(p.hasSnapshot && !p.snapshotErr, '快照接口 __ACT_SNAPSHOT__ 可用'
     + (p.snapshotErr ? '：' + p.snapshotErr : ''));
  ok(p.days === 30, '窗口天数为 30（实为 ' + p.days + '）—— 内联未截断逻辑');
  ok(p.scoreKeys === 12, '计分项为 12（实为 ' + p.scoreKeys + '）');
  ok(p.weekCount === 5, '自然周分档为 5（实为 ' + p.weekCount + '）');
  ok(p.hasFunnel, '漏斗结构在场');

  /* 图标字形 —— 精简 @font-face 后的唯一安全绳 */
  ok(p.iconFontLoaded,
     '图标使用的字体家族已真正加载完成（loaded: ' + JSON.stringify(p.loadedFaces) + '）'
     + ' —— 这才是硬判据；document.fonts.check()=' + p.fontCheck + ' 对未加载字体也会返回 true，不可信');
  ok(p.iconVisible > 0, '存在可见图标元素（' + p.iconVisible + '/' + p.iconTotal + '）');
  ok(p.iconNoGlyph.length === 0,
     '全部可见图标都有字形（::before content 非空）'
     + (p.iconNoGlyph.length ? ' —— 缺失: ' + p.iconNoGlyph.map(d => d.cls).slice(0, 8).join(', ') : ''));
  ok(p.iconZeroBox.length === 0,
     '全部可见图标盒子宽度 > 0（字形缺失时会静默塌成 0x0）'
     + (p.iconZeroBox.length ? ' —— 塌陷: ' + p.iconZeroBox.map(d => d.cls).slice(0, 8).join(', ') : ''));
  ok(p.iconFamilies.length === 1 && /Font Awesome 6 Free/.test(p.iconFamilies[0] || ''),
     '图标只使用 "Font Awesome 6 Free" 一个家族（印证精简未删错）');

  ok(p.bodyText > 200, '页面有实质可见内容（' + p.bodyText + ' 字符）');
  ok(p.hasIdentity, '身份接口 __ACT_IDENTITY__ 在场（自定义身份功能随文件一起走）');

  await browser.close();
  fs.rmSync(sandbox, { recursive: true, force: true });

  console.log('');
  if (bad === 0) {
    console.log('🎉 单文件自包含验证通过：脱离子项目录、断网、零兄弟资源，功能与图标完整。');
    process.exit(0);
  }
  console.log('💥 ' + bad + ' 项不达标。');
  process.exit(1);
})().catch(e => { console.error('!! 验证脚本异常: ' + e.message); process.exit(1); });
