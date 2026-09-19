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
        tgt: document.querySelectorAll('#setBody .set-input').length,
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
       '参数输入 11 个（6 项业务指标 + 5 周目标；MDRT/月目标已删），实为 ' +
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
               wk0: o.weeks[0].target, changed: o.changedDays,
               keys: Object.keys(o.days[0]).sort().join(',') };
    });
    ok(stExp.app === 'baox-activity' && stExp.ver === 2,
       '导出载荷带 app 标识与版本号 2（v1.2 起口径变了，版本号必须跟着走）');
    ok(stExp.days === 30 && stExp.weeks === 5, '导出 30 天 / 5 周全量，实为 ' +
       stExp.days + ' / ' + stExp.weeks);
    ok(stExp.wk0 === 17500, '导出含周目标值 17500，实为 ' + stExp.wk0);
    ok(stExp.bizKeys === 'monthPerf,quarterDeals,quarterGoal,quarterPerf,quarterPremium,yearPerf',
       '导出含 6 项业务指标，实为：' + stExp.bizKeys);
    ok(stExp.changed === 0, '恢复后 changedDays = 0（导出的是当前值，不是改过的天数）');
    ok(stExp.keys === 'close,date,friend,gzh,need,plan,premium,recJoin,recTalk,refer,service,video,visit,xhs',
       '导出字段 = date + 12 项活动量 + premium，实为：' + stExp.keys);

    ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.join(' | ') : ''));
  }

  await p.close();
  await browser.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}

  if (fail) { console.log('\n❌ 交互实测未通过：' + fail + ' 项'); process.exit(1); }
  console.log('\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选（含空集） / 无破坏性按钮 / ' +
              '打卡 12 模块写路径 / 设置数据可编辑且可撤销');
})();
