#!/usr/bin/env node
/* ============================================================================
   交互实测探针（铁律 11 / 15 的浏览器侧证据）
   ----------------------------------------------------------------------------
   静态门禁能证明「代码里没有重置按钮」，但证明不了三件事，必须真机实测：

   ① 带 #hash 直接打开（冷启动）
      原生 hash 只认 CSS，此刻 JS 还没跑、--sticky-h 还没被实测校正，
      页面靠 scroll-margin-top 的**静态兜底值**落点。这是「分享一个带锚点的
      链接给对方，他打开发现标题被顶栏压住」这类问题的唯一暴露场景 ——
      点导航测不到它（顺序相反：先跑 JS 再滚）。

   ② 「再点一次已选中 chip = 取消筛选」这条路真的能撤销
      （铁律 15：破坏性操作必须有可见且可逆的撤销路径，且该路径要实测）
      判据不是「状态字段变回 all」，而是**行数守恒**：
      筛选前后行数必须等于初始行数。少一行就是静默丢数据。

   ③ 今日打卡的 12 个模块 → 步进 → 保存 → 存档落盘 → 减回去能清空
      这是全页唯一的写路径。它的失败模式是「看着保存了、刷新就没了」，
      或者「减到 0 却留着一条空记录污染样本」。

   ④ 「设置数据」抽屉改几格 → 保存 → 面板联动 → 恢复初始数据
      这是全页第二条写路径，也是唯一会**整体改口径**的一条。失败模式分三层，
      而且每层都能单独成立 —— 所以判据必须逐层取证，不能只测「能不能保存」：
        a. 抽屉里预演正确、页面数字不动（覆盖层没并回种子，或 boot 顺序反了）；
        b. 落盘了，但把 30 天整表写进覆盖层（覆盖层退化成快照，基线一变就错位）；
        c. 「恢复初始数据」单点即执行 —— 点错一次数据全没，而画面只是数字变小。
      故本节断言：覆盖层只含**改过的那一天** · 面板按预期联动 ·
      恢复需要两次点击且第一次不构成破坏性操作。

   ── v1.2 的三处改动（读本文件前先看这段，否则会按 v1.1 的心智误读） ──
   a. 种子清空：窗口改为 2026-09-18 ~ 2026-10-17（30 天），390 格全 0。
      v1.1 里那些「权威值 454 / ¥88,476.38」的硬编码断言全部作废，
      改成**全零口径**（总分 0、保费 ¥0、季完成率 0.0%）。
   b. 存储键换名：baox.act.log（旧打卡）/ baox.act.data（旧覆盖层）
      → 统一为 **baox.act.data.v2**；空覆盖层不落盘（键被 removeItem）。
   c. 面板即窗口：窗口外打卡会被**明确拒绝**（reason='out-of-window'），
      不是静默丢弃。故本节先判「今天在窗口内」——种子窗口是固定的 30 天，
      过期后打卡写路径根本不可达，此时必须**说清是种子过期**，
      而不是让后面几节连锁报红、看起来像页面坏了。

   ── v1.4 增补：窗口不再是固定的 ──
   观察窗口改为可在「设置数据」抽屉里选起止日期（1–90 天，含 5 个快捷预设）。
   于是「窗口」从静态前提变成了**用户可写的状态**，多出三类静默失效：

     · 预设/日期改完，说明刷新了但逐日表格没重排（半成品）；
     · 窗口外的记录在保存时被整片抹掉 —— 切窗口是**纯查看动作**，
       不该有破坏性副作用，而它错了既不报错也不可逆；
     · 只改窗口不改数据时，「恢复初始数据」入口不亮 → 用户失去改回默认的路。

   故新增 ⑦ 节逐条实测这三类，并把 JS 错误检查从 `if (win.ok)` 里移到最外层 ——
   第四节起依赖「今天在窗口内」，而 ⑦ 用固定日期，种子过期也该照跑。

   ⚠️ 一处**本探针刻意不测**的东西，写在这里免得后来者重复劳动：
     日期框的日历图标是否可见。它归 **src/check-native-controls.py** 管
     （CSSOM 在场性 + 逐像素对比度两道判据）。现场是米金主题下白底上那个
     浅色日历字形（1.33:1，等于没有图标），而当时十关全绿。
     为什么这里测不了、也别试图用样式读数代替：`getComputedStyle(elem,
     '::-webkit-calendar-picker-indicator')` 对该伪元素返回的是**元素自身**
     的值（filter:none、158×33 = input 的尺寸），**规则生效时照样返回 none**。
     对照过：同一把 API 对显式设置过的 `::before` 能准确读出 filter/尺寸，
     所以不是 API 失灵，而是这类浏览器内部绘制的伪元素不在它覆盖范围内。
     读了只会把「规则在不在场」误判成「没生效」，不如不测。
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
            '/Applications/Chromium.app/Contents/MacOS/Chromium']
  .filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CH) { console.error('!! 找不到 Chrome'); process.exit(1); }

const TARGET = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!TARGET) { console.error('用法: node probe-interactions.cjs <index.html>'); process.exit(1); }
const url = require('url').pathToFileURL(path.resolve(TARGET)).href;

const LS_KEY = 'baox.act.data.v2';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'act-probe-'));
  const browser = await puppeteer.launch({
    executablePath: CH, headless: 'new', userDataDir: prof, args: ['--no-sandbox']
  });

  const open = async (hash, width) => {
    const p = await browser.newPage();
    await p.setViewport({ width: width || 1440, height: 950 });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 160)));
    await p.goto(url + (hash || ''), { waitUntil: 'load', timeout: 45000 });
    await sleep(2000);
    return { p, errs };
  };

  /* ---------- ① 冷启动带 #hash 直接打开的落点 ---------- */
  console.log('① 冷启动 · 带 #hash 直接打开（原生锚点靠 CSS 兜底，JS 未参与滚动）');
  for (const [w, label] of [[1440, '桌面端 1440'], [390, '移动端 390']]) {
    const { p, errs } = await open('#ledger', w);
    const r = await p.evaluate(() => {
      const sec = document.getElementById('ledger');
      const h2 = sec.querySelector('.sec-head h2');
      const boxes = ['.topbar', '.sidebar'].map(s => document.querySelector(s))
        .filter(Boolean).map(e => {
          const cs = getComputedStyle(e);
          return (cs.position === 'fixed' || cs.position === 'sticky')
            ? e.getBoundingClientRect().bottom : 0;
        });
      return { top: h2.getBoundingClientRect().top, sticky: Math.max(0, ...boxes),
               margin: getComputedStyle(sec).scrollMarginTop };
    });
    ok(r.top >= r.sticky, label + ' #ledger 标题 top=' + Math.round(r.top) +
       ' ≥ 吸顶底=' + Math.round(r.sticky) + '（scroll-margin-top=' + r.margin + '）');
    ok(errs.length === 0, label + ' 无 JS 错误');
    await p.close();
  }

  /* ---------- ② 筛选撤销路径（行数守恒） ---------- */
  console.log('\n② 铁律 15 · 「再点一次已选中 chip」撤销筛选（判据＝行数守恒）');
  const { p, errs } = await open('', 1440);
  /* 明细表末行是「合计」行；筛选到空集时那一行是**空态占位**，两者都不是数据行。
     判据必须把二者都排除，否则「30 天」会被读成 31 行、空集会被读成 1 行 ——
     这类误报会把人引去改数据层，而数据层完全正确。
     ⚠️ v1.1 的写法只排除了「合计」，于是空态会被算成 1 行数据；
        这里改成**正面识别日期行**（2026/09/18 这种形态），空态自然计 0。 */
  const rowInfo = () => p.$$eval('#ledgerBody tr', t => {
    let data = 0, totalTxt = null, emptyMsg = null;
    t.forEach(r => {
      const first = ((r.querySelector('td') || {}).textContent || '').trim();
      if (/^合计/.test(first)) { totalTxt = r.textContent; }
      else if (/^\d{4}\/\d{2}\/\d{2}$/.test(first)) { data++; }
      else { emptyMsg = first; }
    });
    return { data: data, total: totalTxt, empty: emptyMsg, all: t.length };
  });
  const sumTxt = () => p.$eval('#ledgerSummary', e => e.textContent.trim());
  const click = sel => p.evaluate(s => {
    const e = document.querySelector(s); if (e) { e.click(); return true; } return false;
  }, sel);

  const base = await rowInfo();
  const baseSum = await sumTxt();
  ok(base.data === 30, '初始明细数据行 30 行（权威 30 天；另有 1 行合计，共 ' + base.all + ' 行）');
  ok(base.total !== null && /合计 30 天/.test(base.total), '存在「合计 30 天」行');
  /* 清空后的权威值：全 0。断言落在**摘要文本**上而不是「表里出现过 0」——
     后者在满屏 0 里恒真，等于没判。 */
  ok(/得分合计 0 分/.test(baseSum) && /保费 ¥0/.test(baseSum),
     '摘要与清空口径一致（' + baseSum + '）');

  // 周次筛选：点 W3 → 应只剩 7 天；再点 W3 → 回到 30 天
  // 窗口自 2026-09-18（周五）起算：W1=3 天，W2/W3/W4=7 天，W5=6 天。
  ok(await click('#weekChips .chip[data-week="3"]'), '点中 W3 周次 chip');
  await sleep(260);
  const w3 = await rowInfo();
  ok(w3.data === 7, 'W3 筛选后数据行 = 7（该周 7 天），实为 ' + w3.data);
  ok(w3.total !== null, '筛选态下合计行跟随重算（未丢失）');
  ok(await click('#weekChips .chip[data-week="3"]'), '再点一次同一个 W3 chip（撤销）');
  await sleep(260);
  const back = await rowInfo();
  ok(back.data === base.data, '撤销后数据行守恒（' + back.data + ' = ' + base.data + '）← 撤销路径不缺数据');
  ok((await sumTxt()) === baseSum, '摘要文本与初始一致（' + (await sumTxt()) + '）');

  /* 得分区间筛选。全零数据下各档的**正确**行为各不相同，正好用来分别验证：
       · 零打卡档（s<=0）= 命中全部 30 天（不是「没筛」，是筛完恰好全中）；
       · ≥35 分档 = 命中空集，此时必须渲染空态占位而不是崩掉或留一片空白。
     两档都要能撤销回 30 行。 */
  ok(await click('.chip[data-band="zero"]'), '点中「零打卡」chip');
  await sleep(260);
  const bz = await rowInfo();
  ok(bz.data === 30 && bz.empty === null, '零打卡档命中全部 30 天（全零样本的正确行为），实为 ' + bz.data);
  ok(await click('.chip[data-band="zero"]'), '再点一次「零打卡」chip（撤销）');
  await sleep(260);
  ok((await rowInfo()).data === base.data, '撤销后数据行再次守恒（' + (await rowInfo()).data + '）');

  ok(await click('.chip[data-band="top"]'), '点中「≥35 分」chip（全零样本下必然空集）');
  await sleep(260);
  const btop = await rowInfo();
  ok(btop.data === 0, '≥35 分档数据行 = 0（无任何一天达标），实为 ' + btop.data);
  ok(!!btop.empty && /没有匹配/.test(btop.empty),
     '空集渲染空态占位而非空白表格（' + String(btop.empty).slice(0, 40) + '…）');
  ok(await click('.chip[data-band="top"]'), '再点一次同一个 chip（撤销）');
  await sleep(260);
  ok((await rowInfo()).data === base.data, '撤销后数据行再次守恒（' + (await rowInfo()).data + '）');

  // 撤销之后 localStorage 里不应被写入任何筛选状态（筛选是瞬时 UI 态，不该持久化）
  const lsKeys = await p.evaluate(() => Object.keys(localStorage).sort().join(','));
  ok(!/filter|band|week/i.test(lsKeys), '筛选态未被持久化（localStorage: ' + (lsKeys || '(空)') + '）');

  /* ---------- ③ 无「重置」类破坏性按钮 ---------- */
  console.log('\n③ 铁律 15 · 页面不存在「重置/清空筛选」类按钮');
  const buttons = await p.$$eval('button, .chip, a', els => els.map(e => (e.textContent || '').trim()));
  const bad = buttons.filter(t => /重置|清空全部|清除筛选|全部清空/.test(t));
  ok(bad.length === 0, '未发现重置类控件' + (bad.length ? '：' + bad.join(' / ') : ''));

  /* ---------- 窗口前置检查（决定 ④⑤ 是否可跑） ---------- */
  const TODAY = await p.evaluate(() => {
    const d = new Date(), z = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  });
  const win = await p.evaluate(() => {
    const s = window.__ACT_SNAPSHOT__();
    const pd = (window.ACT.SEED.meta || {}).period || {};
    return { ok: s.inWindow, start: pd.start, end: pd.end, days: s.windowDays };
  });
  console.log('\n窗口前置检查：今天 ' + TODAY + ' · 种子窗口 ' + win.start + ' ~ ' + win.end +
              ' · ' + win.days + ' 天');
  if (!win.ok) {
    console.log('  ⛔ 今天不在统计窗口内 —— 打卡与设置两条写路径都不可达，④⑤ 跳过。\n' +
                '     这不是页面缺陷：种子窗口是固定 30 天（面板即窗口，窗口外打卡会被\n' +
                '     明确拒绝而不是静默丢弃）。要重跑本探针，先执行 src/reset_seed.py\n' +
                '     把窗口重建到含今天的 30 天，再重跑 build.py。');
  }

  if (win.ok) {
    /* ---------- ④ 今日打卡：12 模块结构 + 写路径 ---------- */
    console.log('\n④ 今日打卡 · 12 个模块 → 步进 → 保存 → 落盘 → 减回 → 清空');
    /* 结构先判：用户裁定「文章/视频拆为小红书、视频号/抖音，朋友圈改公众号，共 12 项」。
       这条需求若被后续改动吃掉（比如谁把两项合并回去），下面总分、抽屉列数会**照样通过**，
       只有模块数会变 —— 所以它必须单独判，且连名字一起判。 */
    const grid = await p.evaluate(() => {
      const cards = [].slice.call(document.querySelectorAll('#checkGrid .ck'));
      return {
        n: cards.length,
        keys: cards.map(c => c.getAttribute('data-key')).join(','),
        names: cards.map(c => (c.querySelector('.ck-nm') || {}).textContent || '').join(','),
        pts: cards.reduce((s, c) => s + (parseInt((c.querySelector('.ck-pt') || {}).textContent, 10) || 0), 0)
      };
    });
    ok(grid.n === 12, '今日打卡 12 个模块，实为 ' + grid.n);
    ok(/公众号/.test(grid.names) && /小红书/.test(grid.names) && /视频号/.test(grid.names),
       '模块名含 公众号 / 小红书 / 视频号（抖音）—— ' + grid.names.slice(0, 60) + '…');
    ok(grid.pts === 23, '12 项单轮满分合计 = 23 分，实为 ' + grid.pts);

    const before = await p.$eval('#todayScore', e => e.textContent.trim());
    ok(before === '0', '清空后今日得分初始为 0，实为 ' + before);
    const key0 = await p.evaluate(() => {
      const b = document.querySelector('#checkGrid .ck-btn[data-d="1"]');
      const card = b.closest('.ck');
      b.click();
      return card.getAttribute('data-key');
    });
    await sleep(220);
    const after = await p.$eval('#todayScore', e => e.textContent.trim());
    ok(key0 === 'gzh', '首个计分项是「公众号」（gzh），实为 ' + key0);
    ok(after === '1', '点一次「＋」后今日得分 = 1（公众号 1 分/次），实为 ' + after);

    await click('#btnSaveToday');
    await sleep(420);
    const saved = await p.evaluate(k => localStorage.getItem(k), LS_KEY);
    let sv = {};
    try { sv = JSON.parse(saved || '{}'); } catch (e) { sv = {}; }
    ok(!!saved && Object.keys(sv.days || {}).length === 1,
       '保存后 ' + LS_KEY + ' 落盘，且只含 1 天：' + String(saved).slice(0, 140));
    ok(((sv.days || {})[TODAY] || {}).gzh === 1,
       '落盘内容 = ' + TODAY + ' 的 gzh=1（写入的是**今天**，与面板窗口对齐）');

    // 减回去：应把该记录清空（不能留一条全 0 的空记录污染样本）
    await p.evaluate(() => {
      const btns = [].slice.call(document.querySelectorAll('#checkGrid .ck-btn[data-d="-1"]'))
        .filter(b => !b.disabled);
      if (btns.length) { btns[0].click(); }
    });
    await sleep(220);
    await click('#btnSaveToday');
    await sleep(420);
    const cleared = await p.evaluate(k => localStorage.getItem(k), LS_KEY);
    ok(cleared === null,
       '减回 0 并保存后覆盖层键被清除（空覆盖层不落盘，实为 ' + String(cleared).slice(0, 60) + '）');
    ok((await p.$eval('#todayScore', e => e.textContent.trim())) === '0', '今日得分回到 0');

    /* ---------- ⑤ 设置数据 · 编辑 → 应用 → 面板联动 → 撤销回初始 ---------- */
    console.log('\n⑤ 设置数据 · 改 6 格 → 保存并应用 → 面板联动 → 两次点击恢复初始数据');
    const snap = () => p.evaluate(() => {
      const s = window.__ACT_SNAPSHOT__();
      return { score: s.score, premium: s.premium, perDeal: s.perDeal,
               days: s.days, biz: s.biz };
    });
    const kpi = () => p.evaluate(() => {
      const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
      return { score: t('kScore'), monthPerf: t('kMonthPerf'), quarterPerf: t('kQuarterPerf'),
               yearPerf: t('kYearPerf'), quarterGoal: t('kQuarterGoal'),
               quarterRate: t('kQuarterRate'), quarterDeals: t('kQuarterDeals'),
               quarterPremium: t('kQuarterPremium') };
    });
    const stBase = await snap();
    ok(stBase.score === 0 && stBase.premium === 0 && stBase.days === 30,
       '清空后初始：总分 0 · 保费 0 · 30 天（实为 ' + stBase.score + ' / ' + stBase.premium + ' / ' + stBase.days + '）');
    const k0 = await kpi();
    ok(k0.score === '0' && k0.quarterRate === '0.0%' && k0.quarterDeals === '0 单',
       '清空后 8 卡文本为全零口径（总分 ' + k0.score + ' · 完成率 ' + k0.quarterRate +
       ' · 成交 ' + k0.quarterDeals + '）');

    ok(await click('#btnSettings'), '点顶栏「设置数据」按钮');
    await sleep(360);
    const stDg = await p.evaluate(() => {
      const d = document.getElementById('setDrawer');
      const ro = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
      const btn = document.getElementById('btnRestore');
      return {
        open: d.classList.contains('open'),
        rows: document.querySelectorAll('#setBody .dg-tb tbody tr').length,
        cols: document.querySelectorAll('#setBody .dg-tb thead th').length,
        cells: document.querySelectorAll('#setBody .dg-in').length,
        /* 参数输入按**data 属性**归类，不靠 class 计数：v1.4 的窗口日期框
           也带 .set-input，用 .set-input 数会把 2 个日期框算成业务参数
           （断言要么跟着数字漂、要么被迫放宽成一个无意义的区间）。 */
        tgt: document.querySelectorAll('#setBody .set-input:not(.set-date)').length,
        biz: document.querySelectorAll('#setBody [data-biz]').length,
        wkt: document.querySelectorAll('#setBody [data-wkt]').length,
        foot: document.querySelectorAll('#setBody .dg-tb tfoot td').length,
        roScore: ro('st-roScore'), roRate: ro('st-roRate'),
        restoreHidden: btn ? btn.hidden : null,
        thW: document.querySelector('#setBody .dg-tb thead th').getBoundingClientRect().width
      };
    });
    ok(stDg.open, '抽屉已打开（#setDrawer.open）');
    ok(stDg.rows === 30, '逐日数据 30 行（= 权威 30 天），实为 ' + stDg.rows);
    ok(stDg.cols === 15, '表头 15 列（日期 + 12 项 + 当日保费 + 得分），实为 ' + stDg.cols);
    ok(stDg.cells === 390, '可编辑格子 30 × 13 = 390 个，实为 ' + stDg.cells);
    ok(stDg.biz === 6 && stDg.wkt === 5 && stDg.tgt === 11,
       '参数输入 11 个（6 项业务指标 + 5 周目标；MDRT/月目标已删 · 不含 2 个窗口日期框），实为 ' +
       stDg.tgt + '（biz ' + stDg.biz + ' / wkt ' + stDg.wkt + '）');
    ok(stDg.foot === 15, '吸底合计行 15 格，实为 ' + stDg.foot);
    ok(stDg.thW > 0, '表头可见（未因 sticky + 零宽而塌陷）');
    /* 两个只读项必须是 <output> 且不可手改：总分自动累计、完成率自动派生。
       判据同时看文本 —— 分母为 0 时完成率显示「—」而不是 0.0%
       （0.0% 是一个结论「一点都没做」，而事实是「还没有分母」）。 */
    ok(stDg.roScore === '0', '抽屉内只读「累计活动量总分」= 0，实为 ' + stDg.roScore);
    ok(stDg.roRate === '—', '分母为 0 时抽屉内完成率显示「—」（不是 0.0%），实为 ' + stDg.roRate);
    ok(stDg.restoreHidden === true, '无改动时「恢复初始数据」按钮不可见（有覆盖层才出现）');

    /* 改 6 处，分打在三条不同的传导链上 —— 只改一格测不出后两条：
         · 计分项 gzh 0→11    → 总分链
         · 计分项 close 0→4   → **件均链**（closeCount 的口径是日记录，
           不是业务指标 quarterDeals —— 见下方 ok() 的说明）
         · 当日保费 0→10000   → 保费链
         · 季度业绩/目标/单数 → 业务指标链（含自动派生的完成率） */
    await p.evaluate(dt => {
      const set = (sel, v) => {
        const e = document.querySelector(sel);
        if (!e) { throw new Error('missing ' + sel); }
        e.value = String(v);
        e.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('#setBody .dg-in[data-d="' + dt + '"][data-k="gzh"]', 11);
      set('#setBody .dg-in[data-d="' + dt + '"][data-k="close"]', 4);
      set('#setBody .dg-in[data-d="' + dt + '"][data-k="premium"]', 10000);
      set('#st-quarterPerf', 50000);
      set('#st-quarterGoal', 200000);
      set('#st-quarterDeals', 2);
    }, TODAY);
    await sleep(520);

    const stDirty = await p.$$eval('#setBody [data-dirty="1"]', e => e.length);
    ok(stDirty === 6, '6 个改动过的输入带金色描边（data-dirty=1），实为 ' + stDirty);
    const stFtScore = await p.$eval('#setBody .dg-tb tfoot td[data-ft="score"]', e => e.textContent.trim());
    ok(stFtScore === '31', '抽屉内吸底合计行实时重算 = 11×1 + 4×5 = 31，实为 ' + stFtScore);
    const stFtPrem = await p.$eval('#setBody .dg-tb tfoot td[data-ft="premium"]', e => e.textContent.trim());
    ok(stFtPrem === '¥10,000', '抽屉内保费合计 = ¥0+10,000 = ¥10,000，实为 ' + stFtPrem);
    const stRoRate = await p.$eval('#st-roRate', e => e.textContent.trim());
    ok(stRoRate === '25.0%', '抽屉内完成率随草稿实时重算 = 50,000 ÷ 200,000 = 25.0%，实为 ' + stRoRate);

    const stPrev = await p.$eval('#setPreview', e => e.textContent.replace(/\s+/g, ' ').trim());
    ok(/总分 0 → 31/.test(stPrev), '预演总分 0 → 31 —— ' + stPrev.slice(0, 60));
    ok(/件均 ¥0 → ¥2,500/.test(stPrev),
       '预演件均按**日记录 close**重算 = ¥10,000 ÷ 4 次促成签单 = ¥2,500');
    ok(/季完成率 0\.0% → 25\.0%/.test(stPrev), '预演完成率 0.0% → 25.0%');
    ok(/改动 3 处 \/ 1 天 · 业务指标 3 项/.test(stPrev),
       '预演改动计数分组 = 3 处 / 1 天 · 业务指标 3 项（' +
       (stPrev.match(/改动.*$/) || [''])[0] + '）');

    ok(await click('#btnSetSave'), '点「保存并应用」');
    await sleep(620);
    const stAfter = await snap();
    ok(stAfter.score === 31, '面板总分联动 = 31，实为 ' + stAfter.score);
    ok(Math.abs(stAfter.premium - 10000) < 0.01, '面板保费联动 = ¥10,000，实为 ' + stAfter.premium);
    ok(Math.abs(stAfter.perDeal - 2500) < 0.01,
       '面板件均联动 = ¥10,000 ÷ 4 次促成签单 = ¥2,500，实为 ' + stAfter.perDeal);
    ok(Math.abs(stAfter.biz.quarterRate - 25.0) < 0.05,
       '面板季完成率自动派生 = 25.0%，实为 ' + stAfter.biz.quarterRate);
    const k1 = await kpi();
    /* 「成交单数」在本面板有**两套独立口径**，这里刻意让它们取不同数值：
         · 日记录 close=4（促成签单次数）→ 累计 closeCount → 件均 ¥2,500
         · 业务指标 quarterDeals=2（手填的季度成交单数）→ 卡上「2 单」
       若把两者都设成 2，即便有人哪天把它们接成一条链（件均改读季度口径、
       或反过来由日记录反推季度卡），断言照样全绿 —— 数值错开才使
       「两条口径未串线」成为一条真的会失败的断言。 */
    ok(k1.quarterRate === '25.0%' && k1.quarterDeals === '2 单' &&
       k1.quarterPerf === '¥50,000' && k1.quarterGoal === '¥200,000',
       '8 卡文本联动（' + k1.quarterPerf + ' / ' + k1.quarterGoal + ' / ' +
       k1.quarterRate + ' / ' + k1.quarterDeals + '）');
    /* 未手填的季度成交保费保持 0：这条用来证明「6 项业务指标是各自独立的手动字段」，
       不是从别处派生出来的 —— 否则它会被谁顺手算成"从季度业绩推出来"的样子。 */
    ok(k1.quarterPremium === '¥0', '未手填的「季度成交保费」保持 ¥0（业务指标各自独立，非派生）');
    ok(await p.evaluate(() => !document.getElementById('setDrawer').classList.contains('open')),
       '保存后抽屉自动关闭');

    const stOvRaw = await p.evaluate(k => localStorage.getItem(k), LS_KEY);
    ok(!!stOvRaw, '覆盖层已落盘 ' + LS_KEY + '：' + String(stOvRaw).slice(0, 170));
    let stOv = {};
    try { stOv = JSON.parse(stOvRaw || '{}'); } catch (e) { stOv = {}; }
    const ovDayKeys = Object.keys(stOv.days || {});
    ok(ovDayKeys.length === 1 && ovDayKeys[0] === TODAY,
       '覆盖层只存**改过的那 1 天**（30 天未改的不落盘），实为 ' + JSON.stringify(ovDayKeys));
    ok(Object.keys((stOv.days || {})[TODAY] || {}).length === 3,
       '该天只记三个改过的键（close / gzh / premium），实为 ' +
       JSON.stringify(Object.keys((stOv.days || {})[TODAY] || {})));
    ok(Object.keys(stOv.biz || {}).length === 3,
       '业务指标改动单独成键（3 项），实为 ' + JSON.stringify(Object.keys(stOv.biz || {})));
    ok(((stOv.weeks || {}) && Object.keys(stOv.weeks || {}).length === 0),
       '未改的周目标不落盘（覆盖层不写成快照）');

    const ledSum = await sumTxt();
    ok(/得分合计 31 分/.test(ledSum) && /保费 ¥10,000/.test(ledSum),
       '明细摘要同步联动（' + ledSum + '）');

    /* 恢复初始数据：两次点击确认。第一次点击必须**只武装、不执行** ——
       若第一次就把数据清了，那它就是一个单点触发的破坏性操作（铁律 15）。 */
    ok(await click('#btnSettings'), '重新打开设置抽屉');
    await sleep(360);
    const stR0 = await p.$eval('#btnRestore', e => ({ hidden: e.hidden, label: e.textContent.trim() }));
    ok(stR0.hidden === false, '有改动时「恢复初始数据」按钮可见（' + stR0.label + '）');
    await click('#btnRestore');
    await sleep(220);
    const stR1 = await p.$eval('#btnRestore', e => ({ armed: e.getAttribute('data-armed'),
                                                     label: e.textContent.trim() }));
    ok(stR1.armed === '1', '第一次点击只武装（label 变为「' + stR1.label + '」）');
    ok(await p.evaluate(k => !!localStorage.getItem(k), LS_KEY),
       '第一次点击后覆盖层仍在 —— 单点不构成破坏性操作');
    ok((await snap()).score === 31, '第一次点击后面板数据未变（仍为 31）');

    await click('#btnRestore');
    await sleep(620);
    const stBack = await snap();
    ok(stBack.score === 0, '第二次点击后总分回到初始 0，实为 ' + stBack.score);
    ok(Math.abs(stBack.premium - 0) < 0.01, '保费回到 ¥0');
    ok(Math.abs(stBack.biz.quarterRate - 0) < 0.05, '季完成率回到 0.0%');
    ok(await p.evaluate(k => localStorage.getItem(k), LS_KEY) === null,
       '恢复后覆盖层键被清除（空覆盖层不落盘，不留一个「看着还在、其实什么都没恢复」的空对象）');

    /* 导出载荷自检。不测下载动作本身：无痕浏览器里文件会落到临时目录，
       断言不到；而真正会错的是**载荷内容**（少一列、把 30 天写成了 12 项…）。 */
    const stExp = await p.evaluate(() => {
      const o = window.__ACT_SETTINGS__.collect();
      return { app: o.app, ver: o.version, days: o.days.length, weeks: o.weeks.length,
               bizKeys: Object.keys(o.biz || {}).sort().join(','),
               wk0: o.weeks[0].target, wk0from: o.weeks[0].from, changed: o.changedDays,
               keys: Object.keys(o.days[0]).sort().join(','),
               win: o.window, d0: o.days[0].date, dn: o.days[o.days.length - 1].date };
    });
    ok(stExp.app === 'baox-activity' && stExp.ver === 3,
       '导出载荷带 app 标识与版本号 3（v1.4 窗口进了载荷，版本号必须跟着走）');
    /* 备份必须**自洽**：窗口与它导出的日集合首末要对得上。
       少了这条，「窗口字段在、但填的是另一个区间」会一路静默 ——
       导入端先按 window 重建日集合、再按 days 覆盖，错位后表现为
       「导入后数据少了一截」，而文件本身看起来完全正常。 */
    ok(!!stExp.win && stExp.win.start === stExp.d0 && stExp.win.end === stExp.dn,
       '导出 window ≡ 日集合首末（' + JSON.stringify(stExp.win) + ' / ' +
       stExp.d0 + ' … ' + stExp.dn + '）');
    ok(stExp.wk0from === stExp.d0,
       '导出周目标带**周起始日**（首周 from=' + stExp.wk0from + '，非周序号）');
    ok(stExp.days === 30 && stExp.weeks === 5, '导出 30 天 / 5 周全量，实为 ' +
       stExp.days + ' / ' + stExp.weeks);
    ok(stExp.wk0 === 17500, '导出含周目标值 17500，实为 ' + stExp.wk0);
    ok(stExp.bizKeys === 'monthPerf,quarterDeals,quarterGoal,quarterPerf,quarterPremium,yearPerf',
       '导出含 6 项业务指标，实为：' + stExp.bizKeys);
    ok(stExp.changed === 0, '恢复后 changedDays = 0（导出的是当前值，不是改过的天数）');
    ok(stExp.keys === 'close,date,friend,gzh,need,plan,premium,recJoin,recTalk,refer,service,video,visit,xhs',
       '导出字段 = date + 12 项活动量 + premium，实为：' + stExp.keys);

    /* ---------- ⑥ 自定义身份（v1.2 新增 · 头像可换 / 字样可改） ---------- */
    console.log('\n⑥ 自定义身份 · 头像替换 + 品牌字样改写（独立键，不随业绩数据走）');
    /* 本节证明三件静态门禁证明不了的事，理由写在文件头的 /_patch_v12f_probe.py 里：
         a. 压缩：非正方形图裁的是**居中**那块（判据＝正中绿块必然被裁进来）；
         b. 实时编辑的三条边界：输入时截断 / 清空回默认 / Esc 撤销未落盘内容；
         c. 分家：导出载荷无身份字段，且「恢复初始数据」清不掉身份键。
       点击与输入一律走真实鼠标键盘，不用 synthetic dispatch。 */
    try {
      const ID_KEY = await p.evaluate(() => window.__ACT_IDENTITY__.LS_ID);
      ok(ID_KEY === 'baox.act.identity.v1',
         '身份存储键 = ' + ID_KEY + '（与业绩键 ' + LS_KEY + ' 分家）');

      /* 身份快照：既看 DOM，也看存储原文 —— 只看 DOM 会把
         「改了界面但没落盘」当成通过（刷新即复原）。 */
      const idSnap = () => p.evaluate(k => {
        const img = document.getElementById('brandAvatar');
        const nm = document.getElementById('brandName');
        const mark = document.getElementById('brandMark');
        const rst = document.getElementById('brandReset');
        let raw = null;
        try { raw = localStorage.getItem(k); } catch (e) { raw = null; }
        let obj = null;
        try { obj = raw ? JSON.parse(raw) : null; } catch (e) { obj = 'BAD-JSON'; }
        return {
          src: img ? img.getAttribute('src') : null,
          name: nm ? nm.textContent : null,
          editing: !!(nm && nm.isContentEditable),
          editingCls: !!(nm && nm.classList.contains('is-editing')),
          custom: !!(mark && mark.classList.contains('has-custom')),
          resetDisplay: rst ? getComputedStyle(rst).display : 'none',
          hasKey: raw !== null,
          keys: obj && obj !== 'BAD-JSON' ? Object.keys(obj).sort().join(',') : String(obj),
          storedName: (obj && obj !== 'BAD-JSON' && obj.name) || null,
          rawLen: raw ? raw.length : 0
        };
      }, ID_KEY);

      /* 造图并灌进文件框。64×16，正中 16px 绿、两侧红：
         居中裁（sx=(64-16)/2=24）必然整片绿；左上角裁会得到红。 */
      const uploadAvatar = () => p.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 16;
        const g = c.getContext('2d');
        g.fillStyle = '#c8102e'; g.fillRect(0, 0, 64, 16);
        g.fillStyle = '#1d6f42'; g.fillRect(24, 0, 16, 16);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const f = new File([blob], 'probe-avatar.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(f);
        const inp = document.getElementById('avatarFile');
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      });

      /* ---------- 基线：默认态 ---------- */
      const id0 = await idSnap();
      ok(id0.name === '公子的', '初始品牌字样 = 公子的，实为 ' + JSON.stringify(id0.name));
      ok(/assets\/avatar\.png$/.test(id0.src || ''),
         '初始头像为本地 assets/avatar.png（零外链），实为 ' + id0.src);
      ok(id0.custom === false && id0.resetDisplay === 'none',
         '初始不挂 has-custom，还原按钮 display:none（不占视觉）');
      ok(id0.hasKey === false,
         '初始身份键不存在 —— 「键不在」等价于「全是默认值」，不留空对象');

      /* ---------- 点头像 → 文件框 ---------- */
      const wire = await p.evaluate(() => {
        const inp = document.getElementById('avatarFile');
        let n = 0;
        const spy = () => { n++; };
        inp.addEventListener('click', spy);
        document.getElementById('brandMark').click();
        inp.removeEventListener('click', spy);
        return n;
      });
      ok(wire === 1, '点头像容器调起文件选择框（input#avatarFile 收到 ' + wire + ' 次 click）');

      /* ---------- 压缩与落盘 ---------- */
      await uploadAvatar();
      await sleep(760);
      const id1 = await idSnap();
      ok(id1.hasKey === true, '上传后身份键落盘 ' + ID_KEY);
      ok(id1.keys === 'avatar',
         '只落「与默认不同」的键：此刻只有 avatar（name 仍是默认，不写）—— 实为 ' + id1.keys);
      ok(/^data:image\//.test(id1.src || ''),
         'DOM 头像立刻换成内联图（无需刷新）：' + String(id1.src).slice(0, 32) + '…');
      ok(id1.custom === true && id1.resetDisplay === 'grid',
         'has-custom 挂上，还原按钮随之挂载（display:grid，悬停/聚焦浮出）');
      ok(id1.name === '公子的', '换头像不影响字样（两个交互共用一条刷新路径但互不覆盖）');

      const av = await p.evaluate(async () => {
        const raw = JSON.parse(localStorage.getItem(window.__ACT_IDENTITY__.LS_ID) || '{}');
        const url = String(raw.avatar || '');
        const m = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(url);
        if (!m) { return { kind: 'none', url: url.slice(0, 40) }; }
        const im = new Image();
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
        /* 取样点必须离边缘足够远：被裁的源块只有 16px 宽，放大到 256 时
           边缘像素会被重采样与 JPEG 一起**染上邻居的红色** —— 实测四角
           rgb(67,90,62)，据此判「是否绿占优」会得到一条假红（页面是对的）。
           故取三个内部点：源坐标约 (4.5,4.5) / (8,8) / (11.5,11.5)。 */
        return { kind: m[1].toLowerCase(), w: im.naturalWidth, h: im.naturalHeight,
                 center: px(128, 128), q1: px(72, 72), q3: px(184, 184),
                 chars: url.length,
                 sameSrc: document.getElementById('brandAvatar').getAttribute('src') === url };
      });
      ok(av.kind === 'jpeg',
         '入库统一压成 JPEG（透明 PNG 压 JPEG 前会先铺底色，避免透明区变黑）—— 实为 ' + av.kind);
      ok(av.w === 256 && av.h === 256,
         '压到 256×256 正方形（源图 64×16，若未裁会得到 256×64）—— 实为 ' + av.w + '×' + av.h);
      const greens = [av.center, av.q1, av.q3];
      ok(greens.every(c => c[1] > c[0] + 30 && c[1] > 90),
         '裁的是**居中**那块（源图 64×16 的正中 16px 是绿、两侧是红；' +
         '若裁左上角，这三点会全红）—— ' +
         greens.map(c => 'rgb(' + c.join(',') + ')').join(' '));
      ok(av.chars <= 61440,
         'dataURL 长度 ' + av.chars + ' ≤ 61440（AV_CAP，超限会降质重试；不设上限必撞 localStorage 配额）');
      ok(av.sameSrc === true, 'DOM 挂的就是存储里那一份（不是另一张临时图）');

      /* ---------- 点字样 → 实时编辑 ---------- */
      await p.click('#brandName');
      await sleep(180);
      const ed = await idSnap();
      ok(ed.editing === true && ed.editingCls === true,
         '点标题里的字样进入编辑态（contenteditable + .is-editing 金色描边）');

      await p.keyboard.type('保罗');
      await sleep(700);
      const id2 = await idSnap();
      ok(id2.name === '保罗', '编辑态实时改文案 = 保罗，实为 ' + JSON.stringify(id2.name));
      ok(id2.storedName === '保罗',
         '改完 420ms debounce 自动落盘（存储里 name = ' + JSON.stringify(id2.storedName) + '）');
      ok(id2.keys === 'avatar,name',
         '字样与头像**各自成键**共存（实为 ' + id2.keys + '）—— 后改的那个不会把前一个挤掉');

      /* 长度上限：12 个字符全打进去，必然在**输入时**被截到 8 */
      await p.keyboard.type('ABCDEFGHIJKL');
      await sleep(200);
      const id3 = await idSnap();
      ok(id3.name === '保罗ABCDEF' && Array.from(id3.name).length === 8,
         '超长在**输入时**即截到 ' + 8 + ' 字：' + JSON.stringify(id3.name) +
         '（若只在落盘时截，用户会打完 14 字、刷新后剩 8 字，中间毫无提示）');

      /* 先提交并**真正退出**编辑态。Esc 的还原点是「进入编辑态那一刻」的值
         （NAME_BEFORE 在 enterNameEdit 里捕获），而 enterNameEdit 在
         已处于编辑态时会直接 return —— 不先退出，后面的 Esc 会还原到
         最外那层会话的开头，那时断言测的是我自己搞错的会话边界，不是实现。 */
      await p.keyboard.press('Enter');
      await sleep(640);
      const idCommit = await idSnap();
      ok(idCommit.name === '保罗ABCDEF' && idCommit.storedName === '保罗ABCDEF' &&
         idCommit.editing === false,
         'Enter 提交并退出编辑态：DOM=存储=' + JSON.stringify(idCommit.name) +
         '（截断后的值被完整保存，不留在 DOM 里当半成品）');

      /* Esc 撤销：未落盘的编辑一并丢弃 */
      await p.click('#brandName');
      await sleep(160);
      ok((await idSnap()).editing === true,
         '重新开一段编辑会话（进入时全选，直接打字即覆盖）');
      await p.keyboard.type('ZZZ');
      await sleep(120);
      await p.keyboard.press('Escape');
      await sleep(360);
      const idEsc = await idSnap();
      ok(idEsc.name === '保罗ABCDEF' && idEsc.storedName === '保罗ABCDEF',
         'Esc 撤销未落盘的编辑，回到进入编辑态前的值（DOM=' + JSON.stringify(idEsc.name) +
         ' / 存储=' + JSON.stringify(idEsc.storedName) + '）');
      ok(idEsc.editing === false, 'Esc 后退出编辑态（contenteditable 已摘）');
      ok(!/ZZZ/.test(String(await p.evaluate(k => localStorage.getItem(k), ID_KEY))),
         '存储里从未留下被撤销的那串（Esc 清掉了 debounce 定时器，不是靠回写覆盖）');

      /* 清空回默认 + :empty 占位符 + 残留 <br> 清理 */
      await p.click('#brandName');
      await sleep(150);
      await p.evaluate(() => {
        const nm = document.getElementById('brandName');
        nm.focus();
        nm.innerHTML = '<br>';          /* 模拟浏览器删空后留下的 <br> */
        nm.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(120);
      const brCleared = await p.evaluate(() => {
        const nm = document.getElementById('brandName');
        return { after: nm.innerHTML, ph: getComputedStyle(nm, '::before').content };
      });
      ok(brCleared.after === '',
         '删空后残留的 <br> 被主动清掉（不清则 :empty 失效、占位符不显示）—— 实为 ' +
         JSON.stringify(brCleared.after));
      ok(/公子的/.test(brCleared.ph || ''),
         '空值态显示灰色占位符「公子的」（否则用户清空后失焦看名字自己回来了，以为没保存成功）—— 实为 ' +
         String(brCleared.ph));
      await p.keyboard.press('Enter');
      await sleep(700);
      const id4 = await idSnap();
      ok(id4.name === '公子的' && id4.storedName === null && id4.keys === 'avatar',
         '清空后失焦回默认：DOM=' + JSON.stringify(id4.name) + ' / 键集合=' + id4.keys +
         '（name 键被删掉，而不是存一个空字符串）');

      /* ---------- 恢复默认头像：且不得顺带弹文件框 ---------- */
      const noPicker = await p.evaluate(() => {
        const inp = document.getElementById('avatarFile');
        let n = 0;
        const spy = () => { n++; };
        inp.addEventListener('click', spy);
        document.getElementById('brandReset').click();
        inp.removeEventListener('click', spy);
        return n;
      });
      await sleep(420);
      const id5 = await idSnap();
      ok(noPicker === 0,
         '点「恢复默认头像」不会顺带弹文件框（resetAvatar 的 stopPropagation 生效）—— 实为 ' +
         noPicker + ' 次');
      ok(/assets\/avatar\.png$/.test(id5.src || ''), '头像回到默认 assets/avatar.png');
      ok(id5.custom === false && id5.resetDisplay === 'none',
         '恢复默认后 has-custom 摘掉、还原按钮重新收起');
      ok(id5.hasKey === false,
         '身份键被**整键移除**（不留 {"avatar":""} 这种「看着还在、其实什么都没恢复」的空壳）');

      /* ---------- 分家对照组：恢复初始数据清业绩、不清身份 ---------- */
      await uploadAvatar();
      await sleep(760);
      await p.click('#brandName');
      await sleep(160);
      await p.keyboard.type('公子');
      await sleep(700);
      const id6 = await idSnap();
      ok(id6.keys === 'avatar,name' && id6.name === '公子',
         '身份已改为自定义（键集合 ' + id6.keys + '）—— 准备做分家对照');

      ok(await click('#btnSettings'), '打开设置抽屉改一格业绩数据');
      await sleep(380);
      await p.evaluate(dt => {
        const e = document.querySelector('#setBody .dg-in[data-d="' + dt + '"][data-k="gzh"]');
        e.value = '7';
        e.dispatchEvent(new Event('input', { bubbles: true }));
      }, TODAY);
      await sleep(220);
      ok(await click('#btnSetSave'), '保存并应用（业绩覆盖层落盘）');
      await sleep(640);
      ok((await snap()).score === 7, '面板业绩联动 = 7，实为 ' + (await snap()).score);

      await click('#btnSettings');
      await sleep(380);
      await click('#btnRestore');
      await sleep(220);
      await click('#btnRestore');
      await sleep(700);
      ok(await p.evaluate(k => localStorage.getItem(k), LS_KEY) === null,
         '对照组：业绩覆盖层已被「恢复初始数据」清空');
      const id7 = await idSnap();
      ok(id7.hasKey === true && id7.custom === true,
         '身份键**未被**恢复动作清掉（头像仍在，has-custom=' + id7.custom + '）');
      ok(id7.name === '公子' && id7.storedName === '公子',
         '改过的字样也**未被**清掉（DOM=' + JSON.stringify(id7.name) + '）—— ' +
         '这就是「独立保存，不随数据走」的可失败判据');

      const expLeak = await p.evaluate(() => {
        const s = JSON.stringify(window.__ACT_SETTINGS__.collect());
        return { leak: /avatar|identity/i.test(s), len: s.length };
      });
      ok(expLeak.leak === false,
         '导出载荷（' + expLeak.len + ' 字符）不含任何身份字段 —— ' +
         '把业绩备份发到另一台机器不会顺带灌进别人的头像/字样');

      /* 复位到默认态，避免影响后续（本次已在末节，仅为不留下脏存储） */
      await p.evaluate(() => {
        try { localStorage.removeItem(window.__ACT_IDENTITY__.LS_ID); } catch (e) {}
      });
    } catch (e) {
      ok(false, '⑥ 身份节中途异常（其后断言未验证）：' +
         String((e && e.message) || e).slice(0, 200));
    }

  }

  /* ---------- ⑦ 观测窗口（v1.4 新增 · 抽屉里改起止日期） ----------
     本节四条判据都只有真机才拿得到，静态门禁与运行期门禁都测不了：

       ① 预设按钮**真的**重建了逐日表格 —— 行数、周数、日集合三者要同时变。
          只比 `#winInfo` 的文本会漏掉「说明刷新了但表格没重排」这一种半成品。
       ② 只改窗口、不改数据时，「恢复初始数据」入口必须亮起 ——
          窗口也是一处改动，用户得有一条把窗口改回去的路（铁律 15）。
       ③ 起止颠倒 / 超 90 天由「输入即兜底」并 toast 说出来。这条的重点不是
          兜底正确（core.js 的纯函数已被门禁逐值验过），而是**兜底被说出来了**：
          静默改写输入，下次打开抽屉日期与自己填的不一样，用户会以为界面记错了。
       ④ 把窗口挪开再挪回来，窗口外的记录完整重现 —— 既没被删、也没被当成基线。
          这是 v1.4 最容易写错的一处（diffOverlay 必须从既有覆盖层出发、
          重建草稿必须用「基线 + 覆盖层」），而它错了**不会报错**，只会静默丢数据。

     ⚠️ 与 ④⑤⑥ 不同，本节用**固定日期**（种子窗口内的 2026-09-18 ~ 2026-10-17）
        而不是「今天」，所以种子过期后本节照样能跑（预设按钮的断言也是自洽式的：
        只比「点完之后的窗口与表格是否一致」，不硬编码今天 +6 是哪一天）。 */
  console.log('\n⑦ 观测窗口 · 预设重建 / 起止兜底 / 90 天截断 / 越窗数据不丢');
  const D1 = '2026-09-19';   /* 先填值、再被挪出窗口、最后调回来的那一天 */

  const readOv = async () => {
    const raw = await p.evaluate(k => localStorage.getItem(k), LS_KEY);
    if (!raw) { return null; }
    try { return JSON.parse(raw); } catch (e) { return null; }
  };
  const dTxt = () => p.evaluate(() => {
    const t = document.getElementById('toast');
    return t ? t.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  const noteTxt = () => p.evaluate(() => {
    const e = document.getElementById('winNote');
    return e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  /* 日集合按 DOM 顺序取（= 窗口顺序）。用 gzh 这一列代表整表：
     它是第一个计分项，若整表没重建，这一列的行数不会变。 */
  const drawerDays = () => p.$$eval('#setBody .dg-in[data-k="gzh"]',
    els => els.map(e => e.getAttribute('data-d')));
  const cellVal = (iso, k) => p.evaluate((d, kk) => {
    const e = document.querySelector('#setBody .dg-in[data-d="' + d + '"][data-k="' + kk + '"]');
    return e ? e.value : null;
  }, iso, k);
  const setCell = async (iso, k, v) => {
    await p.evaluate((d, kk, x) => {
      const e = document.querySelector('#setBody .dg-in[data-d="' + d + '"][data-k="' + kk + '"]');
      if (!e) { throw new Error('抽屉里找不到 ' + d + ' 的 ' + kk + ' 格'); }
      e.value = String(x);
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }, iso, k, v);
    await sleep(320);
  };
  /* 日期框走真实 change 事件（应用层就是这么监听的）；
     不走 input —— 用户还没选完就被重排 DOM 是真实缺陷，探针不该替它掩盖。 */
  const setWin = async (which, iso) => {
    await p.evaluate((w, v) => {
      const e = document.getElementById(w === 'start' ? 'winStart' : 'winEnd');
      if (!e) { throw new Error('抽屉里没有 ' + w + ' 日期框'); }
      e.value = v;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }, which, iso);
    await sleep(420);
  };
  const winNow = () => p.evaluate(() => {
    const w = window.ACT.currentWindow(), s = window.__ACT_SNAPSHOT__();
    const t = id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { s: w.start, e: w.end, n: w.days.length, nw: w.weeks.length,
             sub: t('ovSub'), tb: t('tbSub'), snap: s.windowDays, score: s.score };
  });
  const spanOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

  /* 先把存储清干净并重载。本节要断言的绝对数值（总分 3 / 0）只有在
     已知起点上才成立，而 ④⑤⑥ 结束时留没留下残余取决于它们跑没跑。 */
  await p.evaluate(k => { try { localStorage.removeItem(k); } catch (e) {} }, LS_KEY);
  await p.reload({ waitUntil: 'load' });
  await sleep(1500);

  const w0 = await winNow();
  ok(w0.s === '2026-09-18' && w0.e === '2026-10-17' && w0.n === 30 && w0.nw === 5,
     '起始窗口 = 种子默认 ' + w0.s + ' ~ ' + w0.e + '（' + w0.n + ' 天 / ' + w0.nw + ' 周）');
  ok(w0.snap === w0.n && /2026\/09\/18 – 2026\/10\/17/.test(w0.sub || ''),
     '页首副标题与快照同源（meta.period 已随窗口同步）：' + w0.sub);
  ok((await rowInfo()).data === 30, '明细表 30 数据行');

  ok(await click('#btnSettings'), '打开设置抽屉（窗口组在最前，先定坐标系再填数）');
  await sleep(420);
  const wd = await p.evaluate(() => {
    const bs = [].slice.call(document.querySelectorAll('#setBody .win-p'));
    const v = id => (document.getElementById(id) || {}).value;
    const t = id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { n: bs.length,
             keys: bs.map(b => b.getAttribute('data-preset')).join(','),
             labels: bs.map(b => b.textContent.trim()).join(' / '),
             s: v('winStart'), e: v('winEnd'), info: t('winInfo'),
             rows: document.querySelectorAll('#setBody .dg-tb tbody tr').length,
             wkt: document.querySelectorAll('#setBody [data-wkt]').length,
             wkDates: [].slice.call(document.querySelectorAll('#setBody [data-wkt]'))
                        .map(i => i.getAttribute('data-wkt')).join(',') };
  });
  ok(wd.n === 5 && wd.keys === 'd7,d30,tm,lm,tq', '快捷预设 5 个：' + wd.labels);
  ok(wd.s === '2026-09-18' && wd.e === '2026-10-17',
     '起止日期框回填当前窗口 ' + wd.s + ' ~ ' + wd.e);
  ok(wd.rows === 30 && wd.wkt === 5 && wd.info === '30 天 · 5 周',
     '窗口组三处联动 = 逐日 ' + wd.rows + ' 行 / 周目标 ' + wd.wkt + ' 个 / 「' + wd.info + '」');
  /* 周目标键必须落在**日期**上。若有人改回 v1.3 的周序号（'1','2'…），
     换窗口后目标会套到另一周上，而界面上看不出任何异常。 */
  ok(wd.wkDates === '2026-09-18,2026-09-21,2026-09-28,2026-10-05,2026-10-12',
     '周目标按**周起始日**存取（data-wkt = ' + wd.wkDates + '，非周序号）');
  const wdNote = await noteTxt();
  ok(wdNote && /W1 09\/18–09\/20（3天）/.test(wdNote),
     '周切分说明按自然周列出（首周只剩 3 天也标出来）：' + String(wdNote).slice(0, 56));

  /* ⚠️ 关于「日期框的日历图标看不看得见」——本探针**测不了**，别在这里补断言。
     它由 **src/check-native-controls.py** 守，两道判据：CSSOM 在场性 + 逐像素
     对比度（截图标区 → 算墨色 vs 底色的 WCAG 比值，两套主题各 ≥3:1）。
     已反向验证会失败：① 退回修前的 filter → 报出深色 2.87:1 / 米金 1.33:1；
     ② 删掉配色注释的收尾符（规则掉进注释）→ 报「规则未在场」。
     为什么不能用样式读数代替：
       · getComputedStyle(elem, '::-webkit-calendar-picker-indicator') 返回的是
         **元素自身**的值（filter:none、158×33 = input 尺寸），**规则生效时也返回
         none**（对照过：同一把 API 对显式设置过的 ::before 能准确读出
         filter/尺寸/content，所以不是 API 失灵，是这类伪元素不在它覆盖范围内）；
       · CDP 的 CSS.getMatchedStylesForNode 只吐 scrollbar 系列，压根不列它。
     初版曾在这里写过「两套主题都含 invert」的断言，跑出来 dark:none / light:none
     —— 规则明明在场、断言却说不在。取不到观测对象的断言只会给出假红/假绿。
     这条缺陷的现场：米金主题下白底上挂着一个浅色的日历字形，视觉上等于没有
     图标，而当时十关全绿。 */

  /* ---- ① 预设按钮真的重建表格 ---- */
  const ledBefore = (await rowInfo()).data;
  await p.evaluate(() => document.querySelector('#setBody .win-p[data-preset="d7"]').click());
  await sleep(460);
  const w7 = await p.evaluate(() => {
    const v = id => (document.getElementById(id) || {}).value;
    const t = id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const sel = document.querySelector('#setBody .win-p.sel');
    return { s: v('winStart'), e: v('winEnd'), info: t('winInfo'),
             sel: sel ? sel.getAttribute('data-preset') : null,
             rows: document.querySelectorAll('#setBody .dg-tb tbody tr').length,
             wkt: document.querySelectorAll('#setBody [data-wkt]').length };
  });
  const d7 = await drawerDays();
  ok(w7.sel === 'd7', '点「近 7 天」→ 该胶囊进入选中态（可看出当前窗口是不是某个预设）');
  ok(spanOf(w7.s, w7.e) === 7 && w7.rows === 7 && d7.length === 7,
     '窗口与逐日表格一起重建为 7 天（' + w7.s + ' ~ ' + w7.e + '）：' +
     w7.rows + ' 行 / ' + d7.length + ' 天');
  ok(d7[0] === w7.s && d7[d7.length - 1] === w7.e,
     '日集合首末 = 窗口首末日（' + d7[0] + ' … ' + d7[d7.length - 1] + '）');
  ok(w7.info === '7 天 · ' + w7.wkt + ' 周', '窗口说明随重建刷新：「' + w7.info + '」');
  ok((await rowInfo()).data === ledBefore,
     '未保存前**只改草稿**：面板明细仍是 ' + ledBefore + ' 行（改窗口不越权改数据）');

  /* ---- ② 只改窗口也算一处改动，必须有回退入口 ---- */
  await click('#btnSetSave');
  await sleep(680);
  const ovC = await readOv();
  ok(!!(ovC && ovC.window && ovC.window.start === w7.s && ovC.window.end === w7.e),
     '窗口单独变更也落盘（overlay.window = ' + JSON.stringify(ovC && ovC.window) + '）');
  ok(Object.keys((ovC || {}).days || {}).length === 0,
     '没动数据 → days 不落盘（窗口不会把整表写成快照）');
  const wC = await winNow();
  ok(wC.n === 7 && (await rowInfo()).data === 7, '面板按新窗口重算：7 天 / 明细 7 行');
  const cToast = await dTxt();
  /* ⚠️ 断言里**必须带上分隔符**。首跑这里只比了两个关键词，于是
     「已应用窗口 09/14–09/20其余数据无改动」（漏了 ' · '）照样通过 ——
     关键词一个不缺，却是句读不通的话，用户会当乱码扫过去。
     关键词式断言测「信息在不在」，测不出「信息能不能读」。 */
  ok(/^已应用 窗口 \d\d\/\d\d–\d\d\/\d\d · 其余数据无改动$/.test(cToast || ''),
     '保存提示说清「只改了窗口」，且连接符正确：' + cToast);
  await click('#btnSettings');
  await sleep(420);
  ok((await p.evaluate(() => {
    const b = document.getElementById('btnRestore'); return b ? b.hidden : null;
  })) === false, '只改窗口也点亮「恢复初始数据」入口（窗口算改动，用户有路可回）');

  /* ---- ③ 起止颠倒 / 超上限：兜底 + 把兜底说出来 ---- */
  await setWin('end', '2026-10-31');     /* 先把终点推远，避免下一步被误判成颠倒 */
  await setWin('start', '2026-10-01');
  const wD = await p.evaluate(() => ({
    s: document.getElementById('winStart').value,
    e: document.getElementById('winEnd').value,
    info: document.getElementById('winInfo').textContent.trim(),
    wkt: document.querySelectorAll('#setBody [data-wkt]').length }));
  ok(wD.s === '2026-10-01' && wD.e === '2026-10-31' && spanOf(wD.s, wD.e) === 31,
     '手工输入起止 → 窗口 ' + wD.s + ' ~ ' + wD.e + '（31 天）');
  ok(wD.info === '31 天 · 5 周', '窗口说明 = 「' + wD.info + '」');

  await setWin('end', '2026-09-05');
  const wRev = await p.evaluate(() => ({ s: document.getElementById('winStart').value,
                                         e: document.getElementById('winEnd').value }));
  ok(wRev.s === '2026-09-05' && wRev.e === '2026-10-01',
     '起止颠倒被自动对调（终点填 09/05 < 起点 10/01）：' + wRev.s + ' ~ ' + wRev.e);
  const rToast = await dTxt();
  ok(/起止颠倒/.test(rToast), '并把兜底说出来：' + rToast);

  await setWin('end', '2027-03-31');
  const wTr = await p.evaluate(() => ({ s: document.getElementById('winStart').value,
                                        e: document.getElementById('winEnd').value,
                                        info: document.getElementById('winInfo').textContent.trim() }));
  ok(spanOf(wTr.s, wTr.e) === 90,
     '超上限被截到 90 天：' + wTr.s + ' ~ ' + wTr.e + '（请求 09/05 ~ 2027/03/31 = 209 天）');
  ok(wTr.info === '90 天 · 14 周', '窗口说明随截断刷新：「' + wTr.info + '」');
  const tToast = await dTxt();
  ok(/90 天上限，已截到 90 天/.test(tToast), '并把截断说出来：' + tToast);

  /* 调回默认窗口，为下面「越窗数据」一节准备已知起点 */
  await setWin('end', '2026-10-17');
  await setWin('start', '2026-09-18');
  const wD0 = await p.evaluate(() => ({ s: document.getElementById('winStart').value,
                                        e: document.getElementById('winEnd').value }));
  ok(wD0.s === '2026-09-18' && wD0.e === '2026-10-17',
     '手工调回默认窗口 ' + wD0.s + ' ~ ' + wD0.e);

  /* ---- ④ 越窗数据不丢：挪开 → 记录仍在；挪回 → 完整重现 ---- */
  await setCell(D1, 'gzh', 3);
  await click('#btnSetSave');
  await sleep(680);
  const ovE = await readOv();
  ok(!!(ovE && ovE.days && ovE.days[D1] && ovE.days[D1].gzh === 3),
     '在 ' + D1 + ' 填 gzh=3 并保存 → 覆盖层只记这一天这一个键');
  ok(ovE.window === null || ovE.window === undefined,
     '窗口 = 默认值 → 不落盘（键存在 = 有自定义）');
  ok((await winNow()).score === 3, D1 + ' 在窗口内 → 面板总分 = 3');

  await click('#btnSettings');
  await sleep(420);
  await setWin('start', '2026-10-01');
  const fDays = await drawerDays();
  const fNote = await noteTxt();
  ok(fDays.length === 17 && fDays[0] === '2026-10-01' && fDays[16] === '2026-10-17',
     '起点改为 10/01 → 逐日表格重建为 17 天（' + fDays[0] + ' ~ ' + fDays[16] + '）');
  ok(fDays.indexOf(D1) === -1, '窗口外的 ' + D1.slice(5) + ' 已不在逐日表格里');
  ok(/窗口外另有 1 天/.test(fNote) && /不会被删除/.test(fNote) && /完整重现/.test(fNote),
     '★ 抽屉主动说明「窗口外记录不会被删」：' + fNote.slice(fNote.indexOf('窗口外')));

  await click('#btnSetSave');
  await sleep(680);
  const ovF = await readOv();
  ok(!!(ovF && ovF.days && ovF.days[D1] && ovF.days[D1].gzh === 3),
     '★★ 越窗保存后 ' + D1 + ' 的记录**仍在覆盖层里**' +
     '（diffOverlay 从既有覆盖层出发，不是从空对象重建 —— 错了会静默删数据）');
  ok(!!(ovF.window && ovF.window.start === '2026-10-01' && ovF.window.end === '2026-10-17'),
     '窗口与数据一起提交（overlay.window = ' + JSON.stringify(ovF.window) + '）');
  const wF = await winNow();
  ok(wF.score === 0, '面板按新窗口统计：总分 0（' + D1.slice(5) + ' 落在窗外，不参与统计）');
  ok((await rowInfo()).data === 17, '明细表重建为 17 数据行');
  const fToast = await dTxt();
  ok(/^已应用 窗口 10\/01–10\/17 · 1 天 \/ 1 处改动$/.test(fToast || ''),
     '保存提示把窗口与改动一起报出来（含连接符）：' + fToast);

  await click('#btnSettings');
  await sleep(420);
  await setWin('start', '2026-09-18');
  await click('#btnSetSave');
  await sleep(680);
  const wG = await winNow();
  const ovG = await readOv();
  ok(wG.score === 3 && wG.n === 30, '★ 窗口调回去 → 总分回到 3（越窗记录完整重现）');
  ok(!!(ovG && ovG.days && ovG.days[D1] && ovG.days[D1].gzh === 3),
     '记录仍在覆盖层，切来切去没有丢');
  ok(ovG.window === null || ovG.window === undefined,
     '窗口回到默认 → 键被清掉（不落盘）');
  ok((await rowInfo()).data === 30, '明细表回到 30 数据行');
  await click('#btnSettings');
  await sleep(420);
  ok((await cellVal(D1, 'gzh')) === '3',
     '抽屉逐日表格里 ' + D1.slice(5) + ' 的 gzh 显示 3 —— UI 也完整重现');

  /* 收尾：改回基线并保存，不把本节制造的覆盖层留给后续 */
  await setCell(D1, 'gzh', 0);
  await click('#btnSetSave');
  await sleep(680);
  ok((await readOv()) === null, '改回基线并保存 → 覆盖层键被清除（不留空记录）');
  ok((await winNow()).score === 0, '总分回到 0（本节收尾，不污染后续）');

  ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.join(' | ') : ''));

  await p.close();
  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}

  if (fail) { console.log('\n❌ 交互实测未通过：' + fail + ' 项'); process.exit(1); }
  console.log('\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选（含空集） / 无破坏性按钮 / ' +
              '打卡 12 模块写路径 / 设置数据可编辑且可撤销 / ' +
              '自定义身份（头像居中裁剪 + 字样实时落盘 + 与业绩数据分家） / ' +
              '观测窗口（预设重建 · 起止兜底 · 90 天截断 · 越窗数据不丢）');
})();
