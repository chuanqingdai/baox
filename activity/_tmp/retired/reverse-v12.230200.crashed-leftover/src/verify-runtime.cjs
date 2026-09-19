#!/usr/bin/env node
/* ============================================================================
   铁律 12 补强 · 运行期数据一致性闸（展业活动量面板）

   为什么必须有这一关（本项目实测踩到的真实机制）：
     计分与聚合存在「同一口径两份实现」：
       · 构建期 src/expected.py  —— Python，从 data/activity.json 独立重算
       · 运行期 src/core.js       —— JS，浏览器里从内嵌 SEED 重算
     两者共享数据、不共享代码。一旦分叉，症状极具欺骗性：
     静态门禁（内容/语法/图标/计数）全绿，页面不报错，图表照画、KPI 照显示 ——
     只是数字整体偏移，而且偏移是**静默**的：没有任何一处会报错。
     用户看到的是一份「看起来很正常但数不对」的面板，这是最坏的一类缺陷。

     本关在无痕浏览器里载入产物，取 window.__ACT_SNAPSHOT__()，
     与 Python 侧期望值**逐值**比对：总量、单日、单周、漏斗三段、业务指标、
     KPI 文本 —— 不是「条数相等」这种弱判定。

   ⚠️ 删掉「源表口径校验」之后，本关的基准降级了（必须说清楚）
     v1.1 有一节「⑦ 逐列对照」：拿源表「总」行的数值当**外部**权威，
     验证「源表在哪几列被截断」。v1.2 按指令移除该模块，那一节连同它的字段
     （columns / sourceTotal）一起删除。
     于是本关现在是「两份实现互比」：它能抓住 JS 与 Python 分叉，
     **抓不住两边一起错**。这是删掉外部基准后的必然代价，不是可以顺手补上的疏漏 ——
     补它需要重新引入一个外部数据源，而那正是本轮被要求删掉的东西。

   用法:
     node verify-runtime.cjs <index.html> <_expected.json>

   前置: export NODE_PATH=<含 puppeteer-core 的 node_modules>
   退出码: 0 = 一致, 1 = 有分叉
   ============================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { console.error('!! 缺少 puppeteer-core，请设置 NODE_PATH'); process.exit(1); }

const CH = [process.env.CHROME_PATH,
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome']
  .filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CH) { console.error('!! 找不到 Chrome，请用 CHROME_PATH 指定'); process.exit(1); }

const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
const PAGE = positional[0], EXPF = positional[1];
if (!PAGE || !EXPF) {
  console.error('用法: node verify-runtime.cjs <index.html> <_expected.json>');
  process.exit(1);
}
const pageUrl = require('url').pathToFileURL(path.resolve(PAGE)).href;
const EXP = JSON.parse(fs.readFileSync(path.resolve(EXPF), 'utf8'));

/* 浮点比较：ratio 这类是两套语言各自的除法结果，必须给容差；
   而 2 位小数的金额是**已四舍五入**的确定值，容差要小到能抓住 0.01 的偏差。 */
const EPS = 1e-9;
const near = (a, b, tol) => Math.abs(Number(a) - Number(b)) <= (tol === undefined ? 1e-6 : tol);

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fail++; };

(async () => {
  /* 干净 profile：不带任何历史 localStorage，确保读的是内嵌种子而非旧存档 */
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'act-verify-'));
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new',
    userDataDir: prof, args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('error', () => {});
  await page.setViewport({ width: 1440, height: 950 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 200)));
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2200));

  /* DOM 取样**由期望值的键驱动**，不在这里再硬编码一遍 id 清单 ——
     两处各写一份，改了一处就会「少比了几张卡」而门禁照样全绿。 */
  const got = await page.evaluate((domKeys) => {
    const out = { snap: null, dom: {}, charted: {} };
    if (typeof window.__ACT_SNAPSHOT__ === 'function') { out.snap = window.__ACT_SNAPSHOT__(); }
    const txt = id => {
      const e = document.getElementById(id);
      return e ? e.textContent.trim() : null;
    };
    domKeys.forEach(k => { out.dom[k] = txt(k); });
    ['chDaily', 'chWeekGoal', 'chDow', 'chCum'].forEach(id => {
      const c = document.getElementById(id);
      out.charted[id] = !!(c && c.width > 0 && c.height > 0);
    });
    return out;
  }, Object.keys(EXP.dom));
  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}

  console.log('页面: ' + pageUrl.slice(0, 100));
  console.log('权威: ' + path.resolve(EXPF));
  console.log('');

  if (!got.snap) {
    console.log('  ❌ 页面未暴露 window.__ACT_SNAPSHOT__ —— 运行期无法取证');
    if (errs.length) console.log('     JS 错误: ' + errs.join(' | '));
    process.exit(1);
  }
  const S = got.snap;

  console.log('① 总量口径（Python 重算 ≡ JS 重算）');
  ok(S.days === EXP.days, '窗口天数 ' + S.days + ' / ' + EXP.days);
  ok(S.rows === EXP.rows, '日集合条数 ' + S.rows + ' / ' + EXP.rows);
  ok(S.windowDays === EXP.windowDays, 'meta 窗口天数 ' + S.windowDays + ' / ' + EXP.windowDays);
  ok(near(S.score, EXP.score, EPS), '累计活动量总分 ' + S.score + ' / ' + EXP.score);
  ok(near(S.premium, EXP.premium, 1e-6), '本期保费 ' + S.premium + ' / ' + EXP.premium);
  ok(near(S.closeCount, EXP.closeCount, EPS), '促成签单 ' + S.closeCount + ' / ' + EXP.closeCount);
  ok(near(S.perDeal, EXP.perDeal, 0.005), '件均保费 ' + S.perDeal + ' / ' + EXP.perDeal);
  ok(near(S.avgScore, EXP.avgScore, 0.05), '日均得分 ' + S.avgScore + ' / ' + EXP.avgScore);
  ok(near(S.rowMax, EXP.rowMax, EPS), '单日最高 ' + S.rowMax + ' / ' + EXP.rowMax);
  ok(near(S.rowMin, EXP.rowMin, EPS), '单日最低 ' + S.rowMin + ' / ' + EXP.rowMin);
  ok(S.streakEnd === EXP.streakEnd, '整窗末位连续 ' + S.streakEnd + ' / ' + EXP.streakEnd);
  ok(S.streakLongest === EXP.streakLongest, '窗口内最长连续 ' + S.streakLongest + ' / ' + EXP.streakLongest);
  /* 「当前连续」必须与「整窗末位连续」分开断言：窗口末日在未来，
     整窗末位恒为 0；若把两者当同一个值，前端的 curStreak 就算写成读整窗
     也照样"通过"—— 于是「今天打了卡，连续还是 0」这个 bug 会被门禁放行。 */
  ok(S.inWindow === EXP.inWindow,
     '今天 ' + EXP.today + (EXP.inWindow ? ' 在窗口内' : ' 不在窗口内') +
     '（前端 inWindow=' + S.inWindow + '）');
  ok(S.curStreak === EXP.curStreak,
     '当前连续（截至今天） ' + S.curStreak + ' / ' + EXP.curStreak +
     (EXP.inWindow ? '' : '（今天不在窗口内，退化为整窗末位）'));

  console.log('\n② 逐项计数（12 个计分项，逐值精确相等）');
  const cKeys = Object.keys(EXP.counts);
  const cDiff = cKeys.filter(k => !near((S.counts || {})[k], EXP.counts[k], EPS));
  ok(cDiff.length === 0, cKeys.length + ' 项计数全部一致' +
     (cDiff.length ? '（' + cDiff.length + ' 项不符：' + cDiff.join(',') + '）' : ''));
  cDiff.slice(0, 8).forEach(k => console.log('     ↳ ' + k + ' 权威=' + EXP.counts[k] +
    ' 前端=' + (S.counts || {})[k]));

  console.log('\n③ 业务指标（六项手动 + 一项派生）');
  const bKeys = Object.keys(EXP.biz);
  const bDiff = bKeys.filter(k => {
    const tol = (k === 'quarterRate') ? 0.05 : 1e-6;
    return !near((S.biz || {})[k], EXP.biz[k], tol);
  });
  ok(bDiff.length === 0, bKeys.length + ' 项业务指标全部一致' +
     (bDiff.length ? '（' + bDiff.length + ' 项不符）' : ''));
  bKeys.forEach(k => console.log('     ' + (bDiff.indexOf(k) < 0 ? '✅' : '❌') + ' ' +
    k + ' ' + (S.biz || {})[k] + ' / ' + EXP.biz[k]));

  console.log('\n④ 逐日得分（' + EXP.dayScores.length + ' 天，逐条精确相等）');
  const byDate = {};
  (S.dayScores || []).forEach(d => { byDate[d.date] = d.s; });
  const dDiff = [], dMiss = [];
  EXP.dayScores.forEach(e => {
    if (!(e.date in byDate)) { dMiss.push(e.date); return; }
    if (!near(byDate[e.date], e.s, EPS)) dDiff.push(e.date + ' 权威=' + e.s + ' 前端=' + byDate[e.date]);
  });
  ok(dMiss.length === 0, '无缺失日期' + (dMiss.length ? '（缺 ' + dMiss.length + '）' : ''));
  ok(dDiff.length === 0, '逐日得分全部一致' + (dDiff.length ? '（' + dDiff.length + ' 天不符）' : ''));
  dDiff.slice(0, 6).forEach(s => console.log('     ↳ ' + s));

  console.log('\n⑤ 逐周聚合（' + EXP.weeks.length + ' 周）');
  const wBy = {};
  (S.weeks || []).forEach(w => { wBy[w.idx] = w; });
  let wBad = 0;
  EXP.weeks.forEach(e => {
    const g = wBy[e.idx];
    if (!g) { console.log('     ❌ 第 ' + e.idx + ' 周缺失'); wBad++; return; }
    const c1 = near(g.score, e.score, EPS), c2 = near(g.premium, e.premium, 1e-6),
          c3 = near(g.rate, e.rate, 0.05);
    if (!(c1 && c2 && c3)) wBad++;
    console.log('     ' + (c1 && c2 && c3 ? '✅' : '❌') + ' W' + e.idx +
      ' 得分 ' + g.score + '/' + e.score +
      ' · 保费 ' + g.premium + '/' + e.premium +
      ' · 达标 ' + g.rate + '%/' + e.rate + '%');
  });
  ok(wBad === 0, '逐周全部一致' + (wBad ? '（' + wBad + ' 周不符）' : ''));

  /* ⑥ 成功方程式三段转化（方向传反会导致整段倒置）
     标识用自有编号 S1/S2/S3，并按 id 匹配 —— v1.1 用源模板单元格坐标
     （F35/F36/F37），源表已不是本面板的参照物，那套坐标就是指向不存在之物的名字。 */
  console.log('\n⑥ 成功方程式三段转化（分子分母均取自计分项）');
  let fBad = 0;
  EXP.funnel.forEach(e => {
    const g = (S.funnel || []).find(x => x.id === e.id);
    if (!g) { console.log('     ❌ ' + e.id + ' 缺失'); fBad++; return; }
    const c = near(g.ratio, e.ratio, 1e-9) && near(g.pct, e.pct, 0.05)
      && near(g.numerator, e.numerator, EPS) && near(g.denominator, e.denominator, EPS);
    if (!c) fBad++;
    console.log('     ' + (c ? '✅' : '❌') + ' ' + e.id +
      ' ' + g.numerator + '/' + e.numerator + ' ÷ ' + g.denominator + '/' + e.denominator +
      ' → ratio ' + Number(g.ratio).toFixed(6) + '/' + Number(e.ratio).toFixed(6) +
      ' · ' + g.pct + '%/' + e.pct + '%');
  });
  ok(fBad === 0, '漏斗三段全部一致');

  console.log('\n⑦ 首屏 KPI 文本（8 张卡：渲染是否真的落到了 DOM）');
  Object.keys(EXP.dom).forEach(k => {
    const g = got.dom[k];
    ok(g === EXP.dom[k], k + ' 页面「' + g + '」/ 权威「' + EXP.dom[k] + '」');
  });

  console.log('\n⑧ 图表实例已绘制');
  Object.keys(got.charted).forEach(k => ok(got.charted[k], k + ' 画布尺寸非零'));

  console.log('\nJS 错误: ' + (errs.length ? '❌ ' + errs.join(' | ') : '0 ✅'));
  if (errs.length) fail++;

  if (fail) { console.log('\n❌ 运行期数据一致性未通过：' + fail + ' 项'); process.exit(1); }
  console.log('\n🎉 运行期数据一致性通过：Python 重算 ≡ 浏览器重算，逐值全等');
})();
